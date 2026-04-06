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
OUTPUT_DIR = Path(__file__).resolve().parent / "qualitative_analysis"
OUTPUT_PNG = OUTPUT_DIR / "Risk_Archetype_vs_Sentiment_Heatmap.png"

# ── Same archetype map as generate_risk_archetype_by_rating.py ──
RISK_ARCHETYPE_MAP = {
    'GS':   'Investment Bank',
    'C':    'Investment Bank',
    'SOFI': 'Mixed',
    'ALLY': 'Depository', 'ASB': 'Depository', 'AXP': 'Depository',
    'BKU':  'Depository', 'COF': 'Depository', 'FHN': 'Depository',
    'FITB': 'Depository', 'FLG': 'Depository', 'JPM': 'Depository',
    'KEY':  'Depository', 'MS':  'Depository', 'ONB': 'Depository',
    'PB':   'Depository', 'RF':  'Depository', 'SCHW':'Depository',
    'SNV':  'Depository', 'SSB': 'Depository', 'SYF': 'Depository',
    'UMBF': 'Depository', 'USB': 'Depository', 'VLY': 'Depository',
    'WFC':  'Depository', 'ZION':'Depository',
}

ARCHETYPE_ORDER  = ['Investment Bank', 'Mixed', 'Depository', 'Insufficient Data']
SENTIMENT_ORDER  = ['Positive', 'Cautious', 'Neutral', 'Negative']

SENTIMENT_COLORS = {
    'Positive': '#2ca02c',
    'Cautious': '#ff7f0e',
    'Neutral':  '#1f77b4',
    'Negative': '#d62728',
}

ARCHETYPE_COLORS = {
    'Investment Bank':   '#9467bd',
    'Mixed':             '#ff7f0e',
    'Depository':        '#1f77b4',
    'Insufficient Data': '#c7c7c7',
}


def normalize_sentiment(s):
    s = str(s).strip()
    if s in SENTIMENT_COLORS:
        return s
    return 'Neutral'


def generate_risk_sentiment_heatmap():
    df = pd.read_csv(FINDINGS_CSV)
    df['archetype'] = df['ticker'].map(RISK_ARCHETYPE_MAP).fillna('Insufficient Data')
    df['sentiment_clean'] = df['sentiment'].apply(normalize_sentiment)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    cross = pd.crosstab(df['archetype'], df['sentiment_clean'])
    for s in SENTIMENT_ORDER:
        if s not in cross.columns:
            cross[s] = 0
    for a in ARCHETYPE_ORDER:
        if a not in cross.index:
            cross.loc[a] = 0
    cross = cross.loc[ARCHETYPE_ORDER, SENTIMENT_ORDER]

    fig, axes = plt.subplots(1, 2, figsize=(16, 6),
                             gridspec_kw={'width_ratios': [2, 1.5]})

    # ── Left: heatmap (count) ──
    ax = axes[0]
    sns.heatmap(
        cross,
        annot=True, fmt='d',
        cmap='YlOrRd',
        linewidths=1.5, linecolor='white',
        cbar_kws={'label': 'Number of Banks', 'shrink': 0.8},
        ax=ax,
        annot_kws={'fontsize': 14, 'fontweight': 'bold'},
        vmin=0,
    )

    ax.set_xlabel('Management Sentiment', fontsize=12, fontweight='bold')
    ax.set_ylabel('Risk Framing Archetype', fontsize=12, fontweight='bold')
    ax.set_xticklabels(ax.get_xticklabels(), fontsize=11, fontweight='bold', rotation=0)
    ax.set_yticklabels(ax.get_yticklabels(), fontsize=11, fontweight='bold', rotation=0)
    ax.set_title('Risk Archetype × Management Sentiment\n(cell = number of banks)',
                 fontsize=13, fontweight='bold')

    # ── Right: normalised % heatmap (within each archetype row) ──
    ax2 = axes[1]
    row_totals = cross.sum(axis=1).replace(0, 1)
    cross_pct = cross.div(row_totals, axis=0) * 100

    sns.heatmap(
        cross_pct,
        annot=True, fmt='.0f',
        cmap='Blues',
        linewidths=1.5, linecolor='white',
        cbar_kws={'label': '% within Archetype', 'shrink': 0.8, 'format': '%.0f%%'},
        ax=ax2,
        annot_kws={'fontsize': 12, 'fontweight': 'bold'},
        vmin=0, vmax=100,
    )
    ax2.set_xlabel('Management Sentiment', fontsize=12, fontweight='bold')
    ax2.set_ylabel('')
    ax2.set_xticklabels(ax2.get_xticklabels(), fontsize=11, fontweight='bold', rotation=0)
    ax2.set_yticklabels(ax2.get_yticklabels(), fontsize=11, fontweight='bold', rotation=0)
    ax2.set_title('Row-Normalised (%)\n(% of each archetype by sentiment)',
                  fontsize=13, fontweight='bold')

    # Add colored side bar for archetype rows
    for i, arch in enumerate(ARCHETYPE_ORDER):
        for axi in [ax, ax2]:
            axi.get_yticklabels()[i].set_color(ARCHETYPE_COLORS[arch])

    fig.suptitle('Risk Framing Archetype vs. Management Sentiment (50 Banks)',
                 fontsize=15, fontweight='bold', y=1.03)
    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300, bbox_inches='tight')
    print(f"Saved: {OUTPUT_PNG}")


if __name__ == "__main__":
    generate_risk_sentiment_heatmap()
