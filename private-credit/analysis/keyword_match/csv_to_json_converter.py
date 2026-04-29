import pandas as pd
import json

def convert_to_presentation_formats():
    csv_file = 'PC_Exploratory_Findings_Banks_1_10.csv'
    
    try:
        df = pd.read_csv(csv_file)
    except FileNotFoundError:
        print(f"Error: Could not find {csv_file}. Please ensure it is in the same directory.")
        return

    # Fill NaNs with 'None' for cleaner output
    df = df.fillna('None')

    # 1. Generate the updated Markdown Presentation File
    md_content = "# Private Credit Deep-Dive Findings: Top 10 Banks\n\n"
    md_content += "This document synthesizes both Phase 1 (Exploratory) and Phase 2 (Deep-Dive) management commentary regarding Private Credit, Leveraged Finance, and Alternative Credit.\n\n---\n\n"

    for idx, row in df.iterrows():
        # Pre-process pipe-separated lists into bullet points
        themes = [f"  * {t.strip()}" for t in str(row['key_themes']).split('|')] if str(row['key_themes']) != 'None' else ["  * None"]
        quotes = [f"  * \"{q.strip()}\"" for q in str(row['notable_quotes']).split('|')] if str(row['notable_quotes']) != 'None' else ["  * None"]
        
        md_content += f"## {row['bank_name']} ({row['ticker']})\n"
        
        # --- PHASE 1 DATA ---
        md_content += f"### Phase 1: High-Level Strategy\n"
        md_content += f"* **Mention Frequency:** {row['mention_frequency']}\n"
        md_content += f"* **Overall Sentiment:** {row['sentiment']}\n\n"
        
        md_content += f"**Key Strategic Themes:**\n"
        md_content += "\n".join(themes) + "\n\n"
        
        md_content += f"**Specific Strategic Initiatives:**\n"
        md_content += f"  {row['strategic_initiatives']}\n\n"
        
        md_content += f"**Perceived Market Risks:**\n"
        md_content += f"  {row['perceived_risks']}\n\n"
        
        md_content += f"**Notable Management Quotes:**\n"
        md_content += "\n".join(quotes) + "\n\n"

        # --- THE NEW PHASE 2 DATA ---
        md_content += f"### Phase 2: Deep-Dive Analysis\n"
        
        md_content += f"**Pullback Mentions:**\n"
        md_content += f"  {row.get('pullback_mentions', 'N/A')}\n\n"
        
        md_content += f"**Named Competitors:**\n"
        md_content += f"  {row.get('named_competitors', 'N/A')}\n\n"
        
        md_content += f"**Risk Focus Analysis (Universal vs. IB):**\n"
        md_content += f"  {row.get('risk_focus_analysis', 'N/A')}\n\n"
        
        md_content += "---\n\n"

    # Save Markdown File
    with open('Presentation_Findings_Phase2.md', 'w', encoding='utf-8') as f:
        f.write(md_content)

    # 2. Generate the Updated Pretty JSON Tree Structure
    df_json = df.copy()
    
    # Parse the pipe-separated strings back into actual JSON lists
    for col in ['key_themes', 'notable_quotes']:
        if col in df_json.columns:
            df_json[col] = df_json[col].apply(lambda x: [y.strip() for y in str(x).split('|')] if pd.notna(x) and str(x) != 'None' else [])

    json_data = df_json.to_dict(orient='records')
    
    # Clean up JSON output (remove internal error column if it exists to keep it professional)
    for record in json_data:
        record.pop('error', None)

    # Save JSON File
    with open('Presentation_Findings_Phase2.json', 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=4, ensure_ascii=False)

    print("Success!")
    print(" -> Markdown Presentation saved to: Presentation_Findings_Phase2.md")
    print(" -> JSON Tree Structure saved to: Presentation_Findings_Phase2.json")

if __name__ == '__main__':
    convert_to_presentation_formats()
