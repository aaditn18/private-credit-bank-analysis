import matplotlib
matplotlib.use("Agg")
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_CSV = REPO_ROOT / "combined_code" / "combined_output" / "Combined_PC_Findings.csv"
OUTPUT_PNG = Path(__file__).resolve().parent / "Sentiment_Distribution_Donut.png"

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


def generate_sentiment_donut():
    df = pd.read_csv(FINDINGS_CSV)
    df['sentiment_clean'] = df['sentiment'].apply(normalize_sentiment)

    counts = df['sentiment_clean'].value_counts()
    labels = [s for s in SENTIMENT_ORDER if s in counts.index]
    sizes = [counts[s] for s in labels]
    colors = [COLOR_MAP[s] for s in labels]
    total = sum(sizes)

    fig, ax = plt.subplots(figsize=(8, 8))

    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=labels,
        colors=colors,
        autopct=lambda pct: f'{int(round(pct * total / 100))}\n({pct:.0f}%)',
        startangle=90,
        pctdistance=0.78,
        wedgeprops=dict(width=0.45, edgecolor='white', linewidth=2),
        textprops=dict(fontsize=13, fontweight='bold'),
    )
    for at in autotexts:
        at.set_fontsize(11)
        at.set_fontweight('bold')

    ax.text(0, 0, f'{total}\nBanks', ha='center', va='center',
            fontsize=20, fontweight='bold', color='#333333')

    ax.set_title('Management Sentiment Distribution', fontsize=16, fontweight='bold', pad=20)

    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300)
    print(f"Saved: {OUTPUT_PNG}")
    plt.show()


if __name__ == "__main__":
    generate_sentiment_donut()
