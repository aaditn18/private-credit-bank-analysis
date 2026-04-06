import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_CSV = REPO_ROOT / "combined_code" / "combined_output" / "Combined_PC_Findings.csv"
CALL_REPORT_CSV = REPO_ROOT / "Call_Reports" / "20251231.csv"
RISK_XLSX = REPO_ROOT / "Plots" / "Bank_Risk_Analysis.xlsx"
OUTPUT_PNG = Path(__file__).resolve().parent / "Risk_vs_Sentiment_Scatter.png"

ENTITY_MAP = {
    'ALLY': 'ALLY BANK',
    'ASB':  'ASSOCIATED BANK, NATIONAL ASSOCIATION',
    'BAC':  'BANK OF AMERICA, NATIONAL ASSOCIATION',
    'BK':   'BANK OF NEW YORK MELLON, THE',
    'BOKF': 'BOKF, NATIONAL ASSOCIATION',
    'BPOP': 'BANCO POPULAR DE PUERTO RICO',
    'C':    'CITIBANK, N.A.',
    'CFG':  'CITIZENS BANK, NATIONAL ASSOCIATION',
    'CFR':  'FROST BANK',
    'CMA':  'COMERICA BANK',
    'COLB': 'COLUMBIA BANK',
    'EWBC': 'EAST WEST BANK',
    'FCNCA':'FIRST-CITIZENS BANK & TRUST COMPANY',
    'FHN':  'FIRST HORIZON BANK',
    'FITB': 'FIFTH THIRD BANK, NATIONAL ASSOCIATION',
    'FLG':  'FLAGSTAR BANK, NATIONAL ASSOCIATION',
    'GS':   'GOLDMAN SACHS BANK USA',
    'HBAN': 'HUNTINGTON NATIONAL BANK, THE',
    'JPM':  'JPMORGAN CHASE BANK, NATIONAL ASSOCIATION',
    'KEY':  'KEYBANK NATIONAL ASSOCIATION',
    'MS':   'MORGAN STANLEY BANK, N.A.',
    'MTB':  'MANUFACTURERS AND TRADERS TRUST COMPANY',
    'NTRS': 'NORTHERN TRUST COMPANY, THE',
    'ONB':  'OLD NATIONAL BANK',
    'PNC':  'PNC BANK, NATIONAL ASSOCIATION',
    'PNFP': 'PINNACLE BANK',
    'RF':   'REGIONS BANK',
    'SNV':  'SYNOVUS BANK',
    'SSB':  'SOUTHSTATE BANK, N.A.',
    'STT':  'STATE STREET BANK AND TRUST COMPANY',
    'TFC':  'TRUIST BANK',
    'UMBF': 'UMB BANK, NATIONAL ASSOCIATION',
    'USB':  'U.S. BANK NATIONAL ASSOCIATION',
    'WAL':  'WESTERN ALLIANCE BANK',
    'WBS':  'WEBSTER BANK, NATIONAL ASSOCIATION',
    'WFC':  'WELLS FARGO BANK, NATIONAL ASSOCIATION',
    'ZION': 'ZIONS BANCORPORATION, NATIONAL ASSOCIATION',
}


def generate_idea1_chart():
    print("Step 1: Loading Qualitative Data...")
    df_qual = pd.read_csv(FINDINGS_CSV)
    df_qual = df_qual[['ticker', 'sentiment', 'bank_name']].dropna(subset=['ticker'])

    print("Step 2: Loading Call Report Data (for bubble size)...")
    df_quant = pd.read_csv(CALL_REPORT_CSV, low_memory=False)

    df_cr_mapping = pd.DataFrame(list(ENTITY_MAP.items()), columns=['ticker', 'Financial Institution Name'])

    target_banks = list(ENTITY_MAP.values())
    df_quant_filtered = df_quant[df_quant['Financial Institution Name'].isin(target_banks)].copy()

    for col in ['RCFD1563', 'RCON1545']:
        if col not in df_quant_filtered.columns:
            df_quant_filtered[col] = np.nan
        df_quant_filtered[col] = pd.to_numeric(df_quant_filtered[col], errors='coerce')

    df_quant_filtered['Private_Credit_Proxy'] = df_quant_filtered['RCFD1563'].fillna(df_quant_filtered['RCON1545'])
    df_quant_filtered['Loan_Volume_Billions'] = df_quant_filtered['Private_Credit_Proxy'] / 1_000_000

    df_vol = pd.merge(df_cr_mapping, df_quant_filtered[['Financial Institution Name', 'Loan_Volume_Billions']], on='Financial Institution Name')

    print("Step 3: Loading Risk Analysis Data from Excel...")
    if not RISK_XLSX.exists():
        alt = REPO_ROOT / "Bank_Risk_Analysis.xlsx"
        if alt.exists():
            risk_path = alt
        else:
            print(f"  WARNING: {RISK_XLSX} not found. Skipping risk overlay.")
            print("  Provide Bank_Risk_Analysis.xlsx (sheet 'Risk Rankings') to enable this chart.")
            return
    else:
        risk_path = RISK_XLSX

    df_risk = pd.read_excel(risk_path, sheet_name='Risk Rankings')
    df_risk_q4 = df_risk[df_risk['Quarter'] == 'Q4 2025'].copy()

    risk_bank_names = df_risk_q4['Bank'].unique()
    risk_hints = {
        t: ENTITY_MAP[t].split(',')[0].replace(', THE', '').replace(' THE', '')
        for t in ENTITY_MAP
    }

    final_risk_mapping = {}
    for ticker, name_hint in risk_hints.items():
        match = [b for b in risk_bank_names if name_hint.upper() in b.upper()]
        if match:
            final_risk_mapping[ticker] = min(match, key=len)

    df_risk_map = pd.DataFrame(list(final_risk_mapping.items()), columns=['ticker', 'Bank'])
    df_risk_final = pd.merge(df_risk_map, df_risk_q4[['Bank', 'Total Risk Score', 'Risk Level']], on='Bank')

    print("Step 4: Joining and Plotting...")
    df_final = pd.merge(df_qual, df_vol[['ticker', 'Loan_Volume_Billions']], on='ticker')
    df_final = pd.merge(df_final, df_risk_final[['ticker', 'Total Risk Score']], on='ticker')

    color_map = {
        'Positive': '#2ca02c',
        'Neutral':  '#1f77b4',
        'Cautious': '#ff7f0e',
        'Negative': '#d62728',
    }
    df_final['Color'] = df_final['sentiment'].map(color_map).fillna('#7f7f7f')

    sentiment_order = {'Negative': 0, 'Cautious': 1, 'Neutral': 2, 'Positive': 3}
    df_final['Sentiment_Score'] = df_final['sentiment'].map(sentiment_order)
    df_final = df_final.dropna(subset=['Sentiment_Score'])

    np.random.seed(42)
    df_final['Jittered_X'] = df_final['Sentiment_Score'] + np.random.uniform(-0.15, 0.15, size=len(df_final))

    sns.set_theme(style="whitegrid")
    plt.figure(figsize=(12, 7))

    sizes = df_final['Loan_Volume_Billions'] * 100 + 100

    plt.scatter(df_final['Jittered_X'], df_final['Total Risk Score'],
                s=sizes, c=df_final['Color'], alpha=0.7, edgecolors='black', linewidth=1.5)

    for _, row in df_final.iterrows():
        plt.annotate(row['ticker'],
                     (row['Jittered_X'], row['Total Risk Score']),
                     xytext=(0, 10), textcoords='offset points',
                     ha='center', va='bottom', fontweight='bold', fontsize=9)

    used_sentiments = sorted(df_final['sentiment'].unique(), key=lambda s: sentiment_order.get(s, 99))
    tick_vals = sorted(set(sentiment_order[s] for s in used_sentiments))
    tick_labels = [s for s in used_sentiments]
    plt.xticks(ticks=tick_vals, labels=tick_labels, fontsize=12, fontweight='bold')
    plt.xlabel('Management Sentiment (LLM Analyzed)', fontsize=12, fontweight='bold')

    plt.ylabel('Total Risk Resilience Score (Higher = Stronger Balance Sheet)', fontsize=12, fontweight='bold')
    plt.title('Risk Resilience vs. Management Narrative (Q4 2025)', fontsize=16, fontweight='bold', pad=20)

    legend_patches = [mpatches.Patch(color=color_map[s], label=s) for s in used_sentiments if s in color_map]
    plt.legend(handles=legend_patches, title='Sentiment', loc='upper left', bbox_to_anchor=(1, 1), frameon=True)

    sns.despine(left=True)
    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300)
    print(f"Success! Chart saved as '{OUTPUT_PNG}'.")
    plt.show()

if __name__ == "__main__":
    generate_idea1_chart()
