import matplotlib
matplotlib.use("Agg")
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_CSV = REPO_ROOT / "combined_code" / "combined_output" / "Combined_PC_Findings.csv"
OUTPUT_PNG = Path(__file__).resolve().parent / "Rating_Distribution.png"

COLOR_MAP = {
    'Positive': '#2ca02c',
    'Cautious': '#ff7f0e',
    'Neutral':  '#1f77b4',
    'Negative': '#d62728',
}

SENTIMENT_ORDER = ['Positive', 'Cautious', 'Neutral', 'Negative']


def normalize_sentiment(s):
    s = str(s).strip()
    if s in COLOR_MAP:
        return s
    return 'Neutral'


def generate_rating_distribution():
    df = pd.read_csv(FINDINGS_CSV)
    df['sentiment_clean'] = df['sentiment'].apply(normalize_sentiment)

    ratings = sorted(df['rating'].unique())
    cross = pd.crosstab(df['rating'], df['sentiment_clean'])
    for s in SENTIMENT_ORDER:
        if s not in cross.columns:
            cross[s] = 0
    cross = cross[SENTIMENT_ORDER]

    plt.figure(figsize=(10, 6))
    x = np.arange(len(ratings))
    width = 0.6
    bottom = np.zeros(len(ratings))

    for sentiment in SENTIMENT_ORDER:
        vals = [cross.loc[r, sentiment] if r in cross.index else 0 for r in ratings]
        plt.bar(x, vals, width, bottom=bottom, label=sentiment,
                color=COLOR_MAP[sentiment], edgecolor='white', linewidth=0.5)
        bottom += np.array(vals)

    for i, total in enumerate(bottom):
        if total > 0:
            plt.text(x[i], total + 0.3, str(int(total)),
                     ha='center', va='bottom', fontweight='bold', fontsize=12)

    plt.xticks(x, [str(r) for r in ratings], fontsize=12, fontweight='bold')
    plt.xlabel('Private Credit Rating (1 = Negligible, 5 = Central)', fontsize=12, fontweight='bold')
    plt.ylabel('Number of Banks', fontsize=12, fontweight='bold')
    plt.title('Distribution of Private Credit Ratings by Sentiment', fontsize=16, fontweight='bold', pad=15)
    plt.ylim(0, max(bottom) + 3)

    legend_patches = [mpatches.Patch(color=COLOR_MAP[s], label=s) for s in SENTIMENT_ORDER]
    plt.legend(handles=legend_patches, title='LLM Sentiment', loc='upper right', frameon=True)

    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300)
    print(f"Saved: {OUTPUT_PNG}")
    plt.show()


if __name__ == "__main__":
    generate_rating_distribution()
