import matplotlib
matplotlib.use("Agg")
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
import numpy as np
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_CSV = REPO_ROOT / "combined_code" / "combined_output" / "Combined_PC_Findings.csv"
CALL_REPORT_CSV = REPO_ROOT / "Call_Reports" / "20251231.csv"
OUTPUT_PNG = Path(__file__).resolve().parent / "Private_Credit_Fraction_BarChart.png"

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


def generate_fraction_chart():
    print("Step 1: Extracting Qualitative Sentiment Data...")
    df_qual = pd.read_csv(FINDINGS_CSV)
    df_qual = df_qual[['ticker', 'sentiment']].dropna(subset=['ticker'])

    color_map = {
        'Positive': '#2ca02c',
        'Cautious': '#ff7f0e',
        'Neutral':  '#1f77b4',
        'Negative': '#d62728',
    }

    print("Step 2 & 3: Extracting Quantitative Data & Entity Resolution...")
    df_quant = pd.read_csv(CALL_REPORT_CSV, low_memory=False)

    df_mapping = pd.DataFrame(list(ENTITY_MAP.items()), columns=['ticker', 'Financial Institution Name'])

    target_banks = list(ENTITY_MAP.values())
    df_quant_filtered = df_quant[df_quant['Financial Institution Name'].isin(target_banks)].copy()

    for col in ['RCFD1563', 'RCON1545', 'RCFD2122', 'RCON2122']:
        if col not in df_quant_filtered.columns:
            df_quant_filtered[col] = np.nan
        df_quant_filtered[col] = pd.to_numeric(df_quant_filtered[col], errors='coerce')

    df_quant_filtered['Private_Credit_Proxy'] = df_quant_filtered['RCFD1563'].fillna(df_quant_filtered['RCON1545'])
    df_quant_filtered['Total_Loans'] = df_quant_filtered['RCFD2122'].fillna(df_quant_filtered['RCON2122'])

    print("Step 4: Joining and Calculating Proportions...")
    df_merged = pd.merge(df_qual, df_mapping, on='ticker', how='inner')
    df_final = pd.merge(df_merged, df_quant_filtered[['Financial Institution Name', 'Private_Credit_Proxy', 'Total_Loans']],
                        on='Financial Institution Name', how='left')

    df_final['Fraction_Private_Credit'] = (df_final['Private_Credit_Proxy'] / df_final['Total_Loans']) * 100

    df_final = df_final.dropna(subset=['Fraction_Private_Credit'])
    df_final = df_final.sort_values(by='Fraction_Private_Credit', ascending=False).reset_index(drop=True)
    df_final['Color'] = df_final['sentiment'].apply(lambda x: color_map.get(x, '#7f7f7f'))

    MIN_FRAC = 0.1  # 0.1% threshold
    df_show = df_final[df_final['Fraction_Private_Credit'] >= MIN_FRAC].copy()
    df_rest = df_final[df_final['Fraction_Private_Credit'] < MIN_FRAC]
    n_rest = len(df_rest)

    n_banks = len(df_show)
    print(f"Step 5: Generating Normalized Visualization ({n_banks} banks shown, {n_rest} grouped as ≈0%)...")
    sns.set_theme(style="whitegrid")

    tickers = list(df_show['ticker'])
    values = list(df_show['Fraction_Private_Credit'])
    colors = list(df_show['Color'])
    if n_rest > 0:
        tickers.append(f'Others ({n_rest})')
        values.append(0.0)
        colors.append('#d3d3d3')

    fig_w = max(12, len(tickers) * 0.65)
    plt.figure(figsize=(fig_w, 7))

    bars = plt.bar(tickers, values, color=colors, edgecolor='black')

    font_sz = 10 if len(tickers) <= 15 else 8
    for bar in bars:
        height = bar.get_height()
        if height >= MIN_FRAC:
            plt.annotate(f'{height:.2f}%',
                         xy=(bar.get_x() + bar.get_width() / 2, height),
                         xytext=(0, 5), textcoords="offset points",
                         ha='center', va='bottom', fontweight='bold', fontsize=font_sz)

    plt.title('Private Credit Exposure as % of Total Loans vs. Sentiment', fontsize=16, fontweight='bold', pad=20)
    plt.xlabel('Bank Ticker', fontsize=12, fontweight='bold')
    plt.ylabel('% of Total Loan Volume', fontsize=12, fontweight='bold')
    plt.xticks(rotation=45 if len(tickers) > 12 else 0, ha='right' if len(tickers) > 12 else 'center')

    legend_patches = [mpatches.Patch(color=color, label=sentiment) for sentiment, color in color_map.items()]
    plt.legend(handles=legend_patches, title='LLM Sentiment', loc='upper right', frameon=True)

    sns.despine(left=True)
    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300)
    print(f"Success! Chart saved as '{OUTPUT_PNG}'.")
    plt.show()

if __name__ == "__main__":
    generate_fraction_chart()
