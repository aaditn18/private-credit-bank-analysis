import matplotlib
matplotlib.use("Agg")
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_CSV = REPO_ROOT / "combined_code" / "combined_output" / "Combined_PC_Findings.csv"
OUTPUT_PNG = Path(__file__).resolve().parent / "Rating_vs_Frequency_Heatmap.png"

FREQ_ORDER = ['None', 'Low', 'Medium', 'High']


def generate_heatmap():
    df = pd.read_csv(FINDINGS_CSV)
    df['freq_clean'] = df['mention_frequency'].fillna('None').apply(
        lambda x: x if x in FREQ_ORDER else 'None'
    )

    cross = pd.crosstab(df['rating'], df['freq_clean'])
    for f in FREQ_ORDER:
        if f not in cross.columns:
            cross[f] = 0
    cross = cross[FREQ_ORDER]
    cross = cross.reindex(sorted(cross.index, reverse=True))

    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(cross, annot=True, fmt='d', cmap='Blues', linewidths=1, linecolor='white',
                cbar_kws={'label': 'Number of Banks'}, ax=ax, annot_kws={'fontsize': 14, 'fontweight': 'bold'})

    ax.set_xlabel('Mention Frequency', fontsize=12, fontweight='bold')
    ax.set_ylabel('Private Credit Rating', fontsize=12, fontweight='bold')
    ax.set_title('Rating vs. Mention Frequency', fontsize=16, fontweight='bold', pad=15)
    ax.set_xticklabels(FREQ_ORDER, fontsize=11, fontweight='bold')
    ax.set_yticklabels(ax.get_yticklabels(), fontsize=11, fontweight='bold', rotation=0)

    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300)
    print(f"Saved: {OUTPUT_PNG}")
    plt.show()


if __name__ == "__main__":
    generate_heatmap()
