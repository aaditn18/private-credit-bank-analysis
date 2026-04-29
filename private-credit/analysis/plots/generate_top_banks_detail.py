import matplotlib
matplotlib.use("Agg")
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_CSV = REPO_ROOT / "combined_code" / "combined_output" / "Combined_PC_Findings.csv"
CALL_REPORT_CSV = REPO_ROOT / "Call_Reports" / "20251231.csv"
OUTPUT_PNG = Path(__file__).resolve().parent / "Top_Banks_Detail.png"

COLOR_MAP = {
    'Positive': '#2ca02c',
    'Cautious': '#ff7f0e',
    'Neutral':  '#1f77b4',
    'Negative': '#d62728',
}

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

SENTIMENT_ORDER = ['Positive', 'Cautious', 'Neutral', 'Negative']


def normalize_sentiment(s):
    s = str(s).strip()
    if s in COLOR_MAP:
        return s
    return 'Neutral'


def generate_top_banks_detail():
    df = pd.read_csv(FINDINGS_CSV)
    df['sentiment_clean'] = df['sentiment'].apply(normalize_sentiment)
    df = df[df['rating'] >= 3].copy()
    df = df.sort_values(by=['rating', 'ticker'], ascending=[False, True]).reset_index(drop=True)
    df['color'] = df['sentiment_clean'].map(COLOR_MAP)

    print(f"Top banks (rating >= 3): {len(df)}")

    df_cr = pd.read_csv(CALL_REPORT_CSV, low_memory=False)
    df_map = pd.DataFrame(list(ENTITY_MAP.items()), columns=['ticker', 'Financial Institution Name'])
    target_banks = list(ENTITY_MAP.values())
    df_cr_filt = df_cr[df_cr['Financial Institution Name'].isin(target_banks)].copy()
    for col in ['RCFD1563', 'RCON1545']:
        if col not in df_cr_filt.columns:
            df_cr_filt[col] = np.nan
        df_cr_filt[col] = pd.to_numeric(df_cr_filt[col], errors='coerce')
    df_cr_filt['Loan_Volume_Billions'] = df_cr_filt['RCFD1563'].fillna(df_cr_filt['RCON1545']) / 1_000_000
    df_vol = pd.merge(df_map, df_cr_filt[['Financial Institution Name', 'Loan_Volume_Billions']],
                      on='Financial Institution Name', how='left')

    df = pd.merge(df, df_vol[['ticker', 'Loan_Volume_Billions']], on='ticker', how='left')

    n = len(df)
    x = np.arange(n)
    fig, ax1 = plt.subplots(figsize=(max(12, n * 0.7), 7))

    ax1.bar(x, df['rating'], color=df['color'], edgecolor='white', linewidth=0.5, width=0.5, zorder=2)
    ax1.set_ylabel('Private Credit Rating', fontsize=12, fontweight='bold')
    ax1.set_ylim(0, 6)
    ax1.set_yticks([1, 2, 3, 4, 5])
    ax1.set_xticks(x)
    ax1.set_xticklabels(df['ticker'], rotation=45, ha='right', fontsize=10, fontweight='bold')

    for i, (rating, color) in enumerate(zip(df['rating'], df['color'])):
        ax1.text(i, rating + 0.1, str(rating), ha='center', va='bottom',
                 fontweight='bold', fontsize=9, color=color)

    ax2 = ax1.twinx()
    has_vol = df['Loan_Volume_Billions'].notna()
    ax2.scatter(x[has_vol], df.loc[has_vol, 'Loan_Volume_Billions'],
                color='black', marker='D', s=60, zorder=3, label='Loan Volume ($B)')
    for i in x[has_vol]:
        vol = df.loc[i, 'Loan_Volume_Billions']
        ax2.annotate(f'${vol:,.1f}B', (i, vol), xytext=(0, 8), textcoords='offset points',
                     ha='center', fontsize=7, color='#333333')
    ax2.set_ylabel('Call Report Loan Volume ($ Billions)', fontsize=12, fontweight='bold')

    legend_patches = [mpatches.Patch(color=COLOR_MAP[s], label=s) for s in SENTIMENT_ORDER]
    legend_patches.append(plt.Line2D([0], [0], marker='D', color='w', markerfacecolor='black',
                                     markersize=8, label='Loan Volume ($B)'))
    ax1.legend(handles=legend_patches, title='Legend', loc='upper right', frameon=True)

    ax1.set_title('Top-Rated Banks: Rating + Balance Sheet Exposure', fontsize=16, fontweight='bold', pad=15)
    fig.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300)
    print(f"Saved: {OUTPUT_PNG}")
    plt.show()


if __name__ == "__main__":
    generate_top_banks_detail()
