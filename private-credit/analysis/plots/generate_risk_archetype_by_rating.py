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
OUTPUT_PNG = OUTPUT_DIR / "Risk_Archetype_by_Rating.png"

# ── Manually coded from risk_focus_analysis prose ──
# Depository: "aligns with a universal depository bank" (credit quality, NIM, portfolio concerns)
# Investment Bank: "markdowns in private portfolios / harvesting / leveraged finance fees"
# Mixed: explicitly leverages both regulatory stability AND alternative/non-bank dynamics
# Insufficient Data: Gemini said "no qualitative data available" or field is empty
RISK_ARCHETYPE_MAP = {
    # Investment Bank risk mindset
    'GS':   'Investment Bank',
    'C':    'Investment Bank',
    # Mixed – depository charter but explicitly frames risk through IB/platform lens
    'SOFI': 'Mixed',
    # Depository risk mindset
    'ALLY': 'Depository', 'ASB': 'Depository', 'AXP': 'Depository',
    'BKU':  'Depository', 'COF': 'Depository', 'FHN': 'Depository',
    'FITB': 'Depository', 'FLG': 'Depository', 'JPM': 'Depository',
    'KEY':  'Depository', 'MS':  'Depository', 'ONB': 'Depository',
    'PB':   'Depository', 'RF':  'Depository', 'SCHW':'Depository',
    'SNV':  'Depository', 'SSB': 'Depository', 'SYF': 'Depository',
    'UMBF': 'Depository', 'USB': 'Depository', 'VLY': 'Depository',
    'WFC':  'Depository', 'ZION':'Depository',
    # Default for all others: Insufficient Data (Gemini could not assess)
}

ARCHETYPE_ORDER = ['Investment Bank', 'Mixed', 'Depository', 'Insufficient Data']
ARCHETYPE_COLORS = {
    'Investment Bank':   '#9467bd',
    'Mixed':             '#ff7f0e',
    'Depository':        '#1f77b4',
    'Insufficient Data': '#c7c7c7',
}


def generate_risk_archetype_chart():
    df = pd.read_csv(FINDINGS_CSV)
    df['archetype'] = df['ticker'].map(RISK_ARCHETYPE_MAP).fillna('Insufficient Data')

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    ratings = sorted(df['rating'].unique())
    cross = pd.crosstab(df['rating'], df['archetype'])
    for arch in ARCHETYPE_ORDER:
        if arch not in cross.columns:
            cross[arch] = 0
    cross = cross[ARCHETYPE_ORDER]

    fig, axes = plt.subplots(1, 2, figsize=(16, 7),
                             gridspec_kw={'width_ratios': [3, 2]})

    # ── Left: stacked bar by rating ──
    ax = axes[0]
    x = np.arange(len(ratings))
    width = 0.55
    bottom = np.zeros(len(ratings))

    for arch in ARCHETYPE_ORDER:
        vals = [cross.loc[r, arch] if r in cross.index else 0 for r in ratings]
        bars = ax.bar(x, vals, width, bottom=bottom,
                      label=arch, color=ARCHETYPE_COLORS[arch],
                      edgecolor='white', linewidth=0.8)
        for xi, (v, b) in enumerate(zip(vals, bottom)):
            if v > 0:
                tickers = df[(df['rating'] == ratings[xi]) &
                              (df['archetype'] == arch)]['ticker'].tolist()
                ax.text(xi, b + v / 2, ', '.join(tickers),
                        ha='center', va='center', fontsize=7,
                        color='white' if arch != 'Insufficient Data' else '#555',
                        fontweight='bold')
        bottom += np.array(vals)

    for i, total in enumerate(bottom):
        if total > 0:
            ax.text(i, total + 0.2, str(int(total)),
                    ha='center', va='bottom', fontweight='bold', fontsize=12)

    ax.set_xticks(x)
    ax.set_xticklabels([f'Rating {r}' for r in ratings], fontsize=11, fontweight='bold')
    ax.set_ylabel('Number of Banks', fontsize=12, fontweight='bold')
    ax.set_title('Risk Archetype Breakdown by Rating\n(how management frames private credit risk)',
                 fontsize=13, fontweight='bold')
    ax.set_ylim(0, max(bottom) + 4)

    legend_patches = [mpatches.Patch(color=ARCHETYPE_COLORS[a], label=a) for a in ARCHETYPE_ORDER]
    ax.legend(handles=legend_patches, title='Risk Archetype', loc='upper right',
              frameon=True, fontsize=9)

    # ── Right: 100% stacked bar (normalized) to show proportion at each rating ──
    ax2 = axes[1]
    for arch in ARCHETYPE_ORDER:
        bottom2 = np.zeros(len(ratings))
        totals = np.array([cross.loc[r].sum() if r in cross.index else 1 for r in ratings], dtype=float)
        for i_arch, arch2 in enumerate(ARCHETYPE_ORDER):
            vals2 = np.array([cross.loc[r, arch2] if r in cross.index else 0 for r in ratings], dtype=float)
            pct = vals2 / totals * 100
            if i_arch == 0:
                bottoms = np.zeros(len(ratings))
            ax2.bar(x, pct, width, bottom=bottoms,
                    color=ARCHETYPE_COLORS[arch2], edgecolor='white', linewidth=0.5)
            bottoms += pct
        break  # loop trick: draw outside

    bottoms2 = np.zeros(len(ratings))
    for arch2 in ARCHETYPE_ORDER:
        totals = np.array([cross.loc[r].sum() if r in cross.index else 1 for r in ratings], dtype=float)
        vals2 = np.array([cross.loc[r, arch2] if r in cross.index else 0 for r in ratings], dtype=float)
        pct = vals2 / totals * 100
        ax2.bar(x, pct, width, bottom=bottoms2,
                color=ARCHETYPE_COLORS[arch2], edgecolor='white', linewidth=0.5)
        for xi, (p, b) in enumerate(zip(pct, bottoms2)):
            if p > 8:
                ax2.text(xi, b + p / 2, f'{p:.0f}%',
                         ha='center', va='center', fontsize=8, color='white',
                         fontweight='bold')
        bottoms2 += pct

    ax2.set_xticks(x)
    ax2.set_xticklabels([f'R{r}' for r in ratings], fontsize=11, fontweight='bold')
    ax2.set_ylabel('Proportion (%)', fontsize=11, fontweight='bold')
    ax2.set_ylim(0, 105)
    ax2.set_title('Normalized Proportion\nper Rating', fontsize=12, fontweight='bold')

    fig.suptitle('Risk Framing Archetype vs. Private Credit Rating (50 Banks)',
                 fontsize=15, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300, bbox_inches='tight')
    print(f"Saved: {OUTPUT_PNG}")


if __name__ == "__main__":
    generate_risk_archetype_chart()
