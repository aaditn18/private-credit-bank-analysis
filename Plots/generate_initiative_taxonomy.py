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
OUTPUT_PNG = OUTPUT_DIR / "Strategic_Initiative_Taxonomy.png"

# ── Manually coded from strategic_initiatives prose ──
# Only banks WITH a specific, named initiative are included.
# Banks with "None mentioned" or generic "grow loans" language are excluded.
INITIATIVE_MAP = {
    'JPM':  'Direct Lending / Balance Sheet',  # $10B capital deployed to direct loans
    'BAC':  'Direct Lending / Balance Sheet',  # 200-banker middle-market expansion
    'ALLY': 'Direct Lending / Balance Sheet',  # Corporate Finance: "continue to grow"
    'ONB':  'Direct Lending / Balance Sheet',  # Specialty/sponsor finance growth
    'KEY':  'Direct Lending / Balance Sheet',  # Middle-market banking expansion
    'PB':   'Direct Lending / Balance Sheet',  # Revenue-sharing corporate lending + IB
    'C':    'Non-Bank Partnership / JV',        # $25B Apollo partnership
    'SOFI': 'Non-Bank Partnership / JV',        # Loan Platform Business with Blue Owl
    'BK':   'CLO / Trust / AUM Infrastructure',# CLO corporate trust market share
    'GS':   'CLO / Trust / AUM Infrastructure',# $355B alt AUM + $18B fundraising
    'SNV':  'Syndication Reduction',            # Reducing non-relationship syndicated loans
    'SCHW': 'Adjacent / Platform Expansion',   # Pledged Asset Line + mortgage for RIAs
}

INITIATIVE_ORDER = [
    'Direct Lending / Balance Sheet',
    'Non-Bank Partnership / JV',
    'CLO / Trust / AUM Infrastructure',
    'Syndication Reduction',
    'Adjacent / Platform Expansion',
]

INIT_COLORS = {
    'Direct Lending / Balance Sheet':    '#1f77b4',
    'Non-Bank Partnership / JV':         '#9467bd',
    'CLO / Trust / AUM Infrastructure':  '#17becf',
    'Syndication Reduction':             '#d62728',
    'Adjacent / Platform Expansion':     '#8c564b',
}

RATING_COLORS = {1: '#d9534f', 2: '#f0ad4e', 3: '#f5e642', 4: '#9fd67f', 5: '#2ca02c'}


def generate_initiative_chart():
    df = pd.read_csv(FINDINGS_CSV)
    df['initiative'] = df['ticker'].map(INITIATIVE_MAP)
    df_active = df[df['initiative'].notna()].copy()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── Left panel: horizontal bar per initiative type, annotated with bank tickers ──
    fig, axes = plt.subplots(1, 2, figsize=(17, 7),
                             gridspec_kw={'width_ratios': [2.5, 1]})

    ax = axes[0]
    y_pos = np.arange(len(INITIATIVE_ORDER))
    counts = [df_active[df_active['initiative'] == t].shape[0] for t in INITIATIVE_ORDER]

    bars = ax.barh(y_pos, counts,
                   color=[INIT_COLORS[t] for t in INITIATIVE_ORDER],
                   edgecolor='white', linewidth=1.0, height=0.55)

    for i, (bar, cat) in enumerate(zip(bars, INITIATIVE_ORDER)):
        tickers_in_cat = df_active[df_active['initiative'] == cat].sort_values('rating', ascending=False)
        ticker_labels = []
        for _, row in tickers_in_cat.iterrows():
            ticker_labels.append(f"{row['ticker']} (R{int(row['rating'])})")
        label_str = '   '.join(ticker_labels)
        ax.text(bar.get_width() + 0.08, i, label_str,
                va='center', ha='left', fontsize=10, color='#333333', fontweight='bold')
        ax.text(bar.get_width() / 2, i, str(int(bar.get_width())),
                va='center', ha='center', fontsize=13, color='white', fontweight='bold')

    ax.set_yticks(y_pos)
    ax.set_yticklabels(INITIATIVE_ORDER, fontsize=11, fontweight='bold')
    ax.set_xlabel('Number of Banks', fontsize=12, fontweight='bold')
    ax.set_xlim(0, max(counts) + 4.5)
    ax.set_title('Strategic Initiative Types\n(banks with specific named initiatives only)',
                 fontsize=13, fontweight='bold')
    ax.invert_yaxis()
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    # ── Right panel: scatter – each active bank as a dot, initiative on y, rating on x ──
    ax2 = axes[1]
    init_y = {cat: i for i, cat in enumerate(INITIATIVE_ORDER)}

    for _, row in df_active.iterrows():
        yi = init_y[row['initiative']]
        color = RATING_COLORS.get(int(row['rating']), '#888')
        ax2.scatter(row['rating'], yi,
                    s=250, color=color, edgecolors='white', linewidths=1.5, zorder=3)
        ax2.text(row['rating'], yi + 0.22, row['ticker'],
                 ha='center', va='bottom', fontsize=8, color='#333',
                 fontweight='bold')

    ax2.set_yticks(list(init_y.values()))
    ax2.set_yticklabels([t.split('/')[0].strip() for t in INITIATIVE_ORDER], fontsize=9)
    ax2.set_xticks([1, 2, 3, 4, 5])
    ax2.set_xlabel('LLM Rating', fontsize=11, fontweight='bold')
    ax2.set_title('Rating per Bank\n(by initiative type)', fontsize=12, fontweight='bold')
    ax2.set_xlim(0.5, 5.5)
    ax2.set_ylim(-0.6, len(INITIATIVE_ORDER) - 0.4)
    ax2.invert_yaxis()
    ax2.grid(axis='x', alpha=0.3)
    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)

    rating_patches = [mpatches.Patch(color=RATING_COLORS[r], label=f'Rating {r}')
                      for r in sorted(RATING_COLORS)]
    ax2.legend(handles=rating_patches, title='Rating', fontsize=8,
               loc='lower right', frameon=True)

    n_active = len(df_active)
    n_total = len(df)
    fig.suptitle(f'Strategic Initiative Taxonomy — {n_active} of {n_total} Banks Have Named Initiatives',
                 fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300, bbox_inches='tight')
    print(f"Saved: {OUTPUT_PNG}")


if __name__ == "__main__":
    generate_initiative_chart()
