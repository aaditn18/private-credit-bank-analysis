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
OUTPUT_DIR = Path(__file__).resolve().parent / "qualitative_analysis"
OUTPUT_PNG = OUTPUT_DIR / "Involvement_vs_Direction_Scatter.png"

# ── Direction score: coded from pullback_mentions + strategic_initiatives ──
# +1.0  = strong explicit growth language
# +0.5  = mild / implicit growth (no pullback, rating 3, generic growth)
#  0.0  = not engaged (rating 1-2, no meaningful activity)
# -0.5  = implied pullback (call report data declining, no explicit statement)
# -1.0  = explicit pullback (management directly states reduction/exit)
DIRECTION_MAP = {
    'SNV':  -1.0,
    'MS':   -1.0,
    'RF':   -1.0,
    'GS':   -0.5,
    'NTRS': -0.5,
    'FLG':  -0.5,
    'ALLY':  1.0,
    'BAC':   1.0,
    'C':     1.0,
    'JPM':   1.0,
    'ONB':   1.0,
    'SOFI':  1.0,
    'BK':    0.5,
    'BKU':   0.5,
    'EWBC':  0.5,
    'FITB':  0.5,
    'HBAN':  0.5,
    'KEY':   0.5,
    'MTB':   0.5,
    'PB':    0.5,
    'PNC':   0.5,
    'TFC':   0.5,
    'UMBF':  0.5,
    'USB':   0.5,
    'WFC':   0.5,
    # All others default to 0.0 (Not Engaged)
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

SENTIMENT_COLORS = {
    'Positive': '#2ca02c',
    'Cautious': '#ff7f0e',
    'Neutral':  '#1f77b4',
    'Negative': '#d62728',
}

Y_LABELS = {
    1.0:  'Strong Growth (+1)',
    0.5:  'Mild Growth (+0.5)',
    0.0:  'Not Engaged (0)',
    -0.5: 'Implied Pullback (−0.5)',
    -1.0: 'Explicit Pullback (−1)',
}

QUADRANT_COLORS = {
    ('high', 'positive'): '#e8f5e9',   # high involvement + growth = green
    ('high', 'negative'): '#fdecea',   # high involvement + pullback = red
    ('low',  'any'):       '#f5f5f5',  # low involvement = grey
}


def normalize_sentiment(s):
    s = str(s).strip()
    if s in SENTIMENT_COLORS:
        return s
    return 'Neutral'


def generate_direction_scatter():
    df = pd.read_csv(FINDINGS_CSV)
    df['direction'] = df['ticker'].map(DIRECTION_MAP).fillna(0.0)
    df['sentiment_clean'] = df['sentiment'].apply(normalize_sentiment)
    df['color'] = df['sentiment_clean'].map(SENTIMENT_COLORS)

    # Load call report loan volumes for bubble sizing
    try:
        df_cr = pd.read_csv(CALL_REPORT_CSV, low_memory=False)
        df_map = pd.DataFrame(list(ENTITY_MAP.items()),
                               columns=['ticker', 'Financial Institution Name'])
        for col in ['RCFD1563', 'RCON1545']:
            if col not in df_cr.columns:
                df_cr[col] = np.nan
        df_cr_f = df_cr[df_cr['Financial Institution Name'].isin(ENTITY_MAP.values())].copy()
        df_cr_f['RCFD1563'] = pd.to_numeric(df_cr_f['RCFD1563'], errors='coerce')
        df_cr_f['RCON1545'] = pd.to_numeric(df_cr_f['RCON1545'], errors='coerce')
        df_cr_f['vol'] = df_cr_f['RCFD1563'].fillna(df_cr_f['RCON1545'])
        df_cr_f = pd.merge(df_map, df_cr_f[['Financial Institution Name', 'vol']],
                           on='Financial Institution Name', how='left')
        df = pd.merge(df, df_cr_f[['ticker', 'vol']], on='ticker', how='left')
        df['vol_b'] = (df['vol'] / 1_000_000).fillna(0.0)
    except Exception as e:
        print(f"Warning: could not load call report data ({e}). Using uniform bubble size.")
        df['vol_b'] = 1.0

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Jitter x (rating) slightly so overlapping points are visible
    rng = np.random.default_rng(42)
    df['x_jitter'] = df['rating'] + rng.uniform(-0.22, 0.22, size=len(df))
    df['y_jitter'] = df['direction'] + rng.uniform(-0.06, 0.06, size=len(df))

    # Bubble size: sqrt-scaled, capped
    max_vol = df['vol_b'].max()
    if max_vol > 0:
        df['bubble'] = 60 + (df['vol_b'] / max_vol) ** 0.5 * 1200
    else:
        df['bubble'] = 200

    fig, ax = plt.subplots(figsize=(14, 9))

    # Shaded quadrant backgrounds
    ax.axhspan(0.25, 1.2,  xmin=0.5, alpha=0.06, color='green')   # high involvement + growth
    ax.axhspan(-1.2, -0.25, xmin=0.5, alpha=0.06, color='red')    # high involvement + pullback
    ax.axhspan(-0.25, 0.25, alpha=0.04, color='grey')              # neutral band

    # Horizontal reference line at y=0
    ax.axhline(0, color='#aaa', linewidth=1.0, linestyle='--')

    # Plot each bank
    scatter = ax.scatter(
        df['x_jitter'], df['y_jitter'],
        s=df['bubble'],
        c=df['color'],
        alpha=0.82,
        edgecolors='white',
        linewidths=1.2,
        zorder=3,
    )

    # Label every point
    for _, row in df.iterrows():
        ax.annotate(
            row['ticker'],
            (row['x_jitter'], row['y_jitter']),
            fontsize=7.5, fontweight='bold', color='#222',
            xytext=(4, 4), textcoords='offset points',
        )

    # Quadrant labels
    ax.text(4.7, 0.92, 'High involvement\n+ Active Growth', ha='right', va='top',
            fontsize=9, color='green', alpha=0.7, style='italic')
    ax.text(4.7, -0.92, 'High involvement\n+ Pullback', ha='right', va='bottom',
            fontsize=9, color='red', alpha=0.7, style='italic')
    ax.text(1.2, 0.92, 'Low involvement\n(bystanders)', ha='left', va='top',
            fontsize=9, color='grey', alpha=0.7, style='italic')

    ax.set_xticks([1, 2, 3, 4, 5])
    ax.set_xlabel('Private Credit Involvement Rating (1 = Negligible → 5 = Central)',
                  fontsize=12, fontweight='bold')
    ax.set_yticks(list(Y_LABELS.keys()))
    ax.set_yticklabels(list(Y_LABELS.values()), fontsize=10)
    ax.set_ylabel('Strategic Direction Score', fontsize=12, fontweight='bold')
    ax.set_xlim(0.5, 5.5)
    ax.set_ylim(-1.3, 1.3)
    ax.set_title('Involvement vs. Strategic Direction\n'
                 '(bubble size = call-report proxy loan volume)',
                 fontsize=14, fontweight='bold')

    # Legend for sentiment color
    sentiment_patches = [mpatches.Patch(color=c, label=s)
                         for s, c in SENTIMENT_COLORS.items()]
    # Legend for bubble size
    vol_handles = []
    for vol_val, label in [(1, '$1B'), (5, '$5B'), (20, '$20B'), (100, '$100B+')]:
        sz = 60 + (vol_val / (max_vol if max_vol > 0 else 1)) ** 0.5 * 1200
        sz = min(sz, 1400)
        vol_handles.append(ax.scatter([], [], s=sz, color='grey',
                                       edgecolors='white', alpha=0.7, label=label))

    leg1 = ax.legend(handles=sentiment_patches, title='Sentiment', loc='upper left',
                     frameon=True, fontsize=9)
    ax.add_artist(leg1)
    ax.legend(handles=vol_handles, title='Loan Volume', loc='lower right',
              frameon=True, fontsize=9, labelspacing=1.1)

    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300, bbox_inches='tight')
    print(f"Saved: {OUTPUT_PNG}")


if __name__ == "__main__":
    generate_direction_scatter()
