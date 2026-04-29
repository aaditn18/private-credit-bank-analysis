import matplotlib
matplotlib.use("Agg")
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_CSV = REPO_ROOT / "combined_code" / "combined_output" / "Combined_PC_Findings.csv"
OUTPUT_DIR = Path(__file__).resolve().parent / "qualitative_analysis"
OUTPUT_PNG = OUTPUT_DIR / "Pullback_Signal_Classifier.png"

# ── Manually coded from pullback_mentions prose + call report trend signals ──
# Explicit Pullback: management explicitly states reducing/exiting activity
# Implied Pullback: "no explicit pullback" BUT call report data shows consistent decline
# Active Growth: rating 3-5, no pullback, positive strategic direction
# Not Engaged: rating 1-2, no meaningful private credit involvement
PULLBACK_MAP = {
    'SNV':  'Explicit Pullback',   # "strategically reduce non-relationship syndicated lending"
    'MS':   'Explicit Pullback',   # "Excludes leveraged loans and self-led issuances"
    'RF':   'Explicit Pullback',   # "things we're nice to decline on"
    'GS':   'Implied Pullback',    # Gemini flags: "Call Report data shows a consistent decline"
    'NTRS': 'Implied Pullback',    # Gemini flags: "call report data shows a slight decline"
    'FLG':  'Implied Pullback',    # Gemini flags: "declining trend in the call report data"
    'ALLY': 'Active Growth',
    'BAC':  'Active Growth',
    'BK':   'Active Growth',
    'BKU':  'Active Growth',
    'C':    'Active Growth',
    'EWBC': 'Active Growth',
    'FITB': 'Active Growth',
    'HBAN': 'Active Growth',
    'JPM':  'Active Growth',
    'KEY':  'Active Growth',
    'MTB':  'Active Growth',
    'ONB':  'Active Growth',
    'PB':   'Active Growth',
    'PNC':  'Active Growth',
    'SOFI': 'Active Growth',
    'TFC':  'Active Growth',
    'UMBF': 'Active Growth',
    'USB':  'Active Growth',
    'WFC':  'Active Growth',
}

CATEGORY_ORDER = ['Active Growth', 'Implied Pullback', 'Explicit Pullback', 'Not Engaged']
CATEGORY_COLORS = {
    'Active Growth':    '#2ca02c',
    'Implied Pullback': '#ff7f0e',
    'Explicit Pullback':'#d62728',
    'Not Engaged':      '#aec7e8',
}

RATING_COLORS = {1: '#d9534f', 2: '#f0ad4e', 3: '#f5e642', 4: '#9fd67f', 5: '#2ca02c'}


def generate_pullback_chart():
    df = pd.read_csv(FINDINGS_CSV)
    df['pullback_category'] = df['ticker'].map(PULLBACK_MAP).fillna('Not Engaged')

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── Figure 1: Stacked bar – category x-axis, rating breakdown inside ──
    fig, axes = plt.subplots(1, 2, figsize=(16, 7),
                             gridspec_kw={'width_ratios': [2, 1]})

    ax = axes[0]
    ratings = sorted(df['rating'].unique())
    x = np.arange(len(CATEGORY_ORDER))
    width = 0.6
    bottom = np.zeros(len(CATEGORY_ORDER))

    for rating in ratings:
        vals = []
        for cat in CATEGORY_ORDER:
            count = len(df[(df['pullback_category'] == cat) & (df['rating'] == rating)])
            vals.append(count)
        bars = ax.bar(x, vals, width, bottom=bottom,
                      label=f'Rating {rating}',
                      color=RATING_COLORS[rating], edgecolor='white', linewidth=0.8)
        # Annotate segments large enough to label
        for xi, (v, b) in enumerate(zip(vals, bottom)):
            if v > 0:
                # collect tickers in this cell
                tickers = df[(df['pullback_category'] == CATEGORY_ORDER[xi]) &
                              (df['rating'] == rating)]['ticker'].tolist()
                label = ', '.join(tickers)
                ax.text(xi, b + v / 2, label,
                        ha='center', va='center', fontsize=7,
                        color='black', fontweight='bold')
        bottom += np.array(vals)

    for i, total in enumerate(bottom):
        if total > 0:
            ax.text(i, total + 0.3, str(int(total)),
                    ha='center', va='bottom', fontweight='bold', fontsize=13)

    ax.set_xticks(x)
    ax.set_xticklabels(CATEGORY_ORDER, fontsize=11, fontweight='bold')
    ax.set_ylabel('Number of Banks', fontsize=12, fontweight='bold')
    ax.set_title('Pullback Signal Categories\n(stacked by LLM Rating)', fontsize=14, fontweight='bold')
    ax.set_ylim(0, max(bottom) + 4)

    rating_patches = [mpatches.Patch(color=RATING_COLORS[r], label=f'Rating {r}')
                      for r in ratings]
    ax.legend(handles=rating_patches, title='Rating', loc='upper right', frameon=True, fontsize=9)

    # ── Figure 2 (right): Summary donut of category distribution ──
    ax2 = axes[1]
    counts = [len(df[df['pullback_category'] == cat]) for cat in CATEGORY_ORDER]
    colors = [CATEGORY_COLORS[cat] for cat in CATEGORY_ORDER]
    explode = [0.04] * len(CATEGORY_ORDER)
    wedges, texts, autotexts = ax2.pie(
        counts,
        labels=CATEGORY_ORDER,
        colors=colors,
        autopct=lambda p: f'{int(round(p * sum(counts) / 100))}\n({p:.0f}%)',
        startangle=140,
        pctdistance=0.72,
        explode=explode,
        wedgeprops=dict(width=0.55, edgecolor='white', linewidth=2),
        textprops=dict(fontsize=10, fontweight='bold'),
    )
    for at in autotexts:
        at.set_fontsize(9)
    ax2.text(0, 0, f'{sum(counts)}\nBanks', ha='center', va='center',
             fontsize=16, fontweight='bold', color='#333333')
    ax2.set_title('Distribution Overview', fontsize=13, fontweight='bold')

    fig.suptitle('Private Credit Pullback Signal Analysis (50 Banks)',
                 fontsize=16, fontweight='bold', y=1.01)

    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300, bbox_inches='tight')
    print(f"Saved: {OUTPUT_PNG}")


if __name__ == "__main__":
    generate_pullback_chart()
