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

# --- Gemini API keys (BUFN403/.env loaded above, or set in shell) ---
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

# --- CONSOLIDATED KEYWORDS ---
# Includes the original keywords, Truist's corporate jargon, and fixes the 'CLO' space bug
TARGET_KEYWORDS = [
    "private credit", "direct lending", "alternative credit", 
    "middle market loan", "middle-market loan", "sponsor finance", 
    "collateralized loan", "CLO", "non-bank lender", "shadow banking",
    "leveraged finance", "syndicated loan", "syndicated corporate loan"
]

SYSTEM_PROMPT = """
You are a lead financial sector analyst. You will be provided with a targeted dossier of a bank's recent SEC filings, earnings transcripts, and Schedule RC-C data.
The text excerpts specifically surround mentions of Private Credit, Leveraged Finance, and Syndicated Loans. 
Your task is to conduct an exploratory qualitative analysis.

Respond with ONLY a valid JSON object. No preamble.
Schema:
{
  "bank_name": "string",
  "mention_frequency": "High, Medium, Low, or None",
  "key_themes": ["List 2-3 brief themes the bank focuses on regarding private credit or leveraged finance"],
  "sentiment": "Positive, Cautious, Negative, or Neutral",
  "strategic_initiatives": "Brief summary of any specific actions, partnerships, or divisions mentioned. If none, write 'None mentioned'.",
  "perceived_risks": "Brief summary of risks the bank associates with these lending activities.",
  "notable_quotes": ["Extract 1-2 direct, highly relevant quotes from the text. Keep them concise."]
}
"""

def extract_json(raw_text):
    match = re.search(r'\{[\s\S]*\}', raw_text)
    if match: return json.loads(match.group(0))
    raise ValueError("No JSON object found in the LLM output.")

def clean_sec_text(raw_text):
    # FAST CLEANING: Just strip HTML tags and normalize spaces to prevent freezing.
    clean_text = re.sub(r'<[^>]+>', ' ', raw_text)
    return ' '.join(clean_text.split())

def extract_relevant_context(raw_text, window=800):
    # FAST PRE-FILTER: Instantly check if keywords exist before heavy regex processing
    text_lower = raw_text.lower()
    if not any(kw.lower() in text_lower for kw in TARGET_KEYWORDS):
        return ""
        
    clean_text_str = clean_sec_text(raw_text)
    clean_text_lower = clean_text_str.lower()
    
    snippets = []
    last_end = 0
    pattern = re.compile(r'\b(?:' + '|'.join(map(re.escape, TARGET_KEYWORDS)) + r')\b', re.IGNORECASE)
    
    for match in pattern.finditer(clean_text_lower):
        start = max(0, match.start() - window)
        end = min(len(clean_text_str), match.end() + window)
        if start < last_end: start = last_end
        if start < end:
            snippets.append("... " + clean_text_str[start:end].strip() + " ...")
            last_end = end
            
    return "\n\n".join(snippets)

def build_bank_dossier(ticker, bank_name):
    dossier = f"--- DOSSIER FOR {bank_name} ({ticker}) ---\n\n"
    base_dir = Path(".")
    
    print("    -> Scanning Transcripts...")
    transcript_dir = base_dir / "Earnings Calls" / "transcripts_final"
    if transcript_dir.exists():
        for file in transcript_dir.glob(f"{ticker}_*.txt"):
            try:
                with open(file, 'r', encoding='utf-8', errors='ignore') as f:
                    extracted = extract_relevant_context(f.read())
                    if extracted: dossier += f"Source: {file.name}\n{extracted}\n\n"
            except Exception: pass

    print("    -> Scanning SEC Filings...")
    sec_dir = base_dir / "sec-edgar-filings" / ticker
    if sec_dir.exists():
        # Using wildcard to catch both full-submission and full_submission
        for file in sec_dir.rglob("full*submission.txt"):
            try:
                with open(file, 'r', encoding='utf-8', errors='ignore') as f:
                    extracted = extract_relevant_context(f.read(), window=1000)
                    if extracted: dossier += f"Source: {file.parent.name}\n{extracted}\n\n"
            except Exception: pass

    print("    -> Extracting Call Report Schedule RC-C Data...")
    # Consolidated Alias Mapping
    call_report_aliases = [bank_name.lower(), ticker.lower()]
    if ticker == 'JPM': call_report_aliases.append("jpmorgan chase bank")
    if ticker == 'WFC': call_report_aliases.append("wells fargo bank")
    if ticker == 'TFC': call_report_aliases.append("truist bank")
    
    MDRM_MAPPING = {'RCFD1563': 'Total loans to nondepository financial institutions (Consolidated)', 
                    'RCFD1460': 'Loans to business credit intermediaries (Consolidated)'}
    
    for file in [f for f in base_dir.rglob("*.csv") if "banks" not in f.name.lower() and "findings" not in f.name.lower()]:
        try:
            cols_to_use = ['Financial Institution Name'] + list(MDRM_MAPPING.keys())
            header = pd.read_csv(file, nrows=0).columns
            actual_cols = [c for c in cols_to_use if c in header]
            if 'Financial Institution Name' not in header: continue
                
            df = pd.read_csv(file, usecols=actual_cols, low_memory=False)
            bank_data = df[df['Financial Institution Name'].astype(str).str.lower().str.contains('|'.join(call_report_aliases), na=False)]
            
            if not bank_data.empty:
                row = bank_data.iloc[0]
                dossier += f"Source: {file.name}\n"
                for code in actual_cols:
                    if code in MDRM_MAPPING and pd.notna(row[code]) and float(row[code]) > 0: 
                        dossier += f"- {MDRM_MAPPING[code]}: ${float(row[code]):,.0f}\n"
                dossier += "\n"
        except Exception: pass

    print("    -> Querying LLM...")
    # Cap to ~400k characters (~100k tokens) to prevent Free Tier 429 crashes
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
            print(f"    -> Attempt {attempt+1} failed: {type(e).__name__} - {str(e)}. Retrying in 5 seconds...")
            time.sleep(5)
    raise Exception("Max retries exceeded.")

def main():
    source_file = 'banks.csv'
    output_file = 'Master_PC_Exploratory_Findings.csv'
    
    print(f"Loading bank universe from {source_file}...")
    try:
        # Load the first 10 banks
        my_banks = pd.read_csv(source_file).head(10)
    except FileNotFoundError:
        print(f"Error: Could not find {source_file}. Please ensure it is in the directory.")
        return

    results = []
    
    for index, row in my_banks.iterrows():
        bank_name = row['Name']
        ticker = row['Ticker']
        
        print(f"\n[{index+1}/10] Compiling dossier and analyzing {bank_name} ({ticker})...")
        dossier_text = build_bank_dossier(ticker, bank_name)
        
        if len(dossier_text) < 150:
            print(f"  -> No targeted mentions found even with expanded keywords. Skipping.")
            results.append({"bank_name": bank_name, "ticker": ticker, "mention_frequency": "None", "sentiment": "Neutral"})
            continue
            
        try:
            result_json = call_llm_with_retry(bank_name, dossier_text)
            result_json['ticker'] = ticker
            results.append(result_json)
            print(f"  -> Success! Sentiment: {result_json.get('sentiment')}")
        except Exception as e:
            print(f"  -> ERROR: {type(e).__name__} - {str(e)}")
            results.append({"bank_name": bank_name, "ticker": ticker, "error": str(e)})

    if results:
        df_findings = pd.json_normalize(results)
        
        # Flatten lists into pipe-separated strings for easy Excel viewing
        for col in ['key_themes', 'notable_quotes']:
            if col in df_findings.columns:
                df_findings[col] = df_findings[col].apply(lambda x: ' | '.join(x) if isinstance(x, list) else x)
        
        # Reorder columns so bank_name and ticker are first
        cols = ['bank_name', 'ticker'] + [c for c in df_findings.columns if c not in ['bank_name', 'ticker']]
        df_findings = df_findings[cols]
        
        df_findings.to_csv(output_file, index=False)
        print(f"\nDone! Fully assembled dataset saved to {output_file}")

if __name__ == '__main__':
    main()
