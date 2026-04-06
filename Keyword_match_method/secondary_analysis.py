import os
import pandas as pd
import json
import time
import re
import itertools
from pathlib import Path
from google import genai

try:
    from dotenv import load_dotenv
    _env = Path(__file__).resolve().parent.parent / ".env"
    if _env.is_file():
        load_dotenv(_env, override=False)
except ImportError:
    pass


def _legacy_api_keys():
    keys = []
    g = os.environ.get("GEMINI_API_KEY", "").strip()
    if g:
        keys.append(g)
    keys.extend(
        k.strip()
        for k in os.environ.get("GEMINI_API_KEYS", "").split(",")
        if k.strip()
    )
    if not keys:
        raise EnvironmentError(
            "Set GEMINI_API_KEY in BUFN403/.env or the environment (see run_pipeline.py)."
        )
    return keys


api_key_cycle = itertools.cycle(_legacy_api_keys())

# --- EXPANDED KEYWORDS ---
TARGET_KEYWORDS = [
    "private credit", "direct lending", "alternative credit", 
    "middle market loan", "middle-market loan", "sponsor finance", 
    "collateralized loan", "CLO", "non-bank lender", "shadow banking",
    "leveraged finance", "syndicated loan", "syndicated corporate loan",
    "Apollo", "Blackstone", "Ares", "Blue Owl", "Golub", "KKR" 
]

SYSTEM_PROMPT = """
You are a lead financial sector analyst. You will be provided with a targeted dossier of a bank's recent SEC filings, earnings transcripts, and Schedule RC-C data.
We are conducting a Phase 2 deep-dive analysis on specific private credit dynamics.

Based on the text provided, answer the following three questions and respond with ONLY a valid JSON object. No preamble.
Schema:
{
  "pullback_mentions": "Is the bank explicitly mentioning pulling back from or reducing their exposure to CLOs, covenant-lite loans, or Alternative Credit? Quote the exact sentences. If no pullback is mentioned, write 'No pullback mentioned.'",
  "named_competitors": "Identify any specific external alternative asset managers/non-bank lenders mentioned by name (e.g., Apollo, Blackstone, Ares, Blue Owl) that they view as a threat to their lending margins or as major market players. If none are named, write 'No specific competitors named.'",
  "risk_focus_analysis": "Analyze how management describes 'Perceived Risks' in private credit. Do their fears align more with a universal depository bank (fearing systemic shadow banking risks, retail contagion, regulatory capital constraints) or a pure investment bank (fearing disintermediation, loss of advisory fees, illiquid valuation risks)? Briefly explain."
}
"""

def extract_json(raw_text):
    match = re.search(r'\{[\s\S]*\}', raw_text)
    if match: return json.loads(match.group(0))
    raise ValueError("No JSON object found in the LLM output.")

def clean_sec_text(raw_text):
    # Strips HTML/XML tags and removes massive blocks of Base64 gibberish
    clean_text = re.sub(r'<[^>]+>', ' ', raw_text)
    clean_text = re.sub(r'[A-Za-z0-9+/=]{100,}', ' ', clean_text)
    return re.sub(r'\s+', ' ', clean_text).strip()

def extract_relevant_context(text, window=800):
    text_lower = text.lower()
    snippets = []
    last_end = 0
    pattern = re.compile(r'\b(?:' + '|'.join(map(re.escape, TARGET_KEYWORDS)) + r')\b', re.IGNORECASE)
    
    for match in pattern.finditer(text_lower):
        start = max(0, match.start() - window)
        end = min(len(text), match.end() + window)
        if start < last_end: start = last_end
        if start < end:
            while start > 0 and text[start-1] != ' ': start -= 1
            while end < len(text) and text[end] != ' ': end += 1
            snippets.append("... " + text[start:end].strip() + " ...")
            last_end = end
    return "\n\n".join(snippets)

def build_bank_dossier(ticker, bank_name):
    dossier = f"--- DOSSIER FOR {bank_name} ({ticker}) ---\n\n"
    base_dir = Path(".")
    
    print("    -> Scanning Transcripts...")
    dossier += "### EARNINGS TRANSCRIPTS EXCERPTS ###\n"
    transcript_dir = base_dir / "Earnings Calls" / "transcripts_final"
    if transcript_dir.exists():
        for file in transcript_dir.glob(f"{ticker}_*.txt"):
            try:
                with open(file, 'r', encoding='utf-8', errors='ignore') as f:
                    extracted = extract_relevant_context(f.read())
                    if extracted: dossier += f"Source: {file.name}\n{extracted}\n\n"
            except Exception: pass

    print("    -> Scanning SEC Filings (This might take a moment)...")
    dossier += "### SEC FILINGS EXCERPTS ###\n"
    sec_dir = base_dir / "sec-edgar-filings" / ticker
    if sec_dir.exists():
        # THE FIX: Using 'full*submission.txt' to catch both hyphens and underscores
        for file in sec_dir.rglob("full*submission.txt"):
            try:
                with open(file, 'r', encoding='utf-8', errors='ignore') as f:
                    extracted = extract_relevant_context(clean_sec_text(f.read()), window=1000)
                    if extracted: dossier += f"Source: {file.parent.name}\n{extracted}\n\n"
            except Exception: pass

    print("    -> Querying LLM...")
    # Cap to ~100k tokens to prevent Free Tier 429 crashes
    return dossier[:400000]

def call_llm_with_retry(bank_name, dossier_text, retries=3):
    prompt = f"{SYSTEM_PROMPT}\n\nBank: {bank_name}\n\nDossier:\n{dossier_text}"
    
    for attempt in range(retries):
        try:
            client = genai.Client(api_key=next(api_key_cycle))
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            return extract_json(response.text)
        except Exception as e:
            print(f"    -> Attempt {attempt+1} failed: {type(e).__name__}. Retrying in 5 seconds...")
            time.sleep(5)
    raise Exception("Max retries exceeded.")

def main():
    csv_file = 'PC_Exploratory_Findings_Banks_1_10.csv'
    
    print(f"Loading existing findings from {csv_file}...")
    try:
        df = pd.read_csv(csv_file)
    except FileNotFoundError:
        print(f"Error: Could not find {csv_file}. Please ensure it is in the same directory.")
        return
        
    # Initialize new columns if they don't exist yet
    for col in ['pullback_mentions', 'named_competitors', 'risk_focus_analysis']:
        if col not in df.columns:
            df[col] = ""
    
    print(f"\nCommencing Phase 2 Deep-Dive Analysis for all 10 banks...\n")
    
    for index, row in df.iterrows():
        bank_name = row['bank_name']
        ticker = row['ticker']
        
        print(f"[{index+1}/10] Analyzing secondary themes for {bank_name} ({ticker})...")
        dossier_text = build_bank_dossier(ticker, bank_name)
        
        if len(dossier_text) < 150:
            print(f"    -> Skipping. Not enough text available for deep analysis.")
            df.at[index, 'pullback_mentions'] = "Insufficient data"
            df.at[index, 'named_competitors'] = "Insufficient data"
            df.at[index, 'risk_focus_analysis'] = "Insufficient data"
            continue
            
        try:
            result_json = call_llm_with_retry(bank_name, dossier_text)
            
            # Inject new findings into the dataframe
            df.at[index, 'pullback_mentions'] = result_json.get('pullback_mentions', 'N/A')
            df.at[index, 'named_competitors'] = result_json.get('named_competitors', 'N/A')
            df.at[index, 'risk_focus_analysis'] = result_json.get('risk_focus_analysis', 'N/A')
            
            print(f"    -> Success! Extracted Phase 2 insights.")
            
        except Exception as e:
            print(f"    -> ERROR analyzing {ticker}: {str(e)}")
            
    # Save the expanded dataframe back to CSV
    df.to_csv(csv_file, index=False)
    print(f"\nDone! Overwrote {csv_file} with the 3 new secondary analysis columns.")

if __name__ == '__main__':
    main()
