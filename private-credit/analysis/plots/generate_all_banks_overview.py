import matplotlib
matplotlib.use("Agg")
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_CSV = REPO_ROOT / "combined_code" / "combined_output" / "Combined_PC_Findings.csv"
OUTPUT_PNG = Path(__file__).resolve().parent / "All_Banks_Rating_Overview.png"

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


def generate_all_banks_overview():
    df = pd.read_csv(FINDINGS_CSV)
    df['sentiment_clean'] = df['sentiment'].apply(normalize_sentiment)
    df['color'] = df['sentiment_clean'].map(COLOR_MAP)

    df = df.sort_values(by=['rating', 'ticker'], ascending=[True, False]).reset_index(drop=True)

    fig, ax = plt.subplots(figsize=(12, 16))
    y_pos = range(len(df))

    bars = ax.barh(y_pos, df['rating'], color=df['color'], edgecolor='white', linewidth=0.5, height=0.75)

    ax.set_yticks(y_pos)
    ax.set_yticklabels(df['ticker'], fontsize=8)
    ax.set_xlabel('Private Credit Rating', fontsize=12, fontweight='bold')
    ax.set_title('All 50 Banks: Private Credit Rating by Sentiment', fontsize=16, fontweight='bold', pad=15)
    ax.set_xlim(0, 6)
    ax.set_xticks([1, 2, 3, 4, 5])
    ax.invert_yaxis()

    for i, (rating, color) in enumerate(zip(df['rating'], df['color'])):
        ax.text(rating + 0.08, i, str(rating), va='center', ha='left',
                fontweight='bold', fontsize=8, color=color)

    legend_patches = [mpatches.Patch(color=COLOR_MAP[s], label=s) for s in SENTIMENT_ORDER]
    ax.legend(handles=legend_patches, title='LLM Sentiment', loc='lower right', frameon=True)

    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300)
    print(f"Saved: {OUTPUT_PNG}")
    plt.show()


if __name__ == "__main__":
    generate_all_banks_overview()
