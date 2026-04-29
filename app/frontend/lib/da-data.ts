// Digital Assets classification & intent data — BUFN403 Team 5, Spring 2026
// Ported from da_classification_intent_dash.html (digital-assets/dashboard/)

export type TierLabel = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4' | 'Tier 5';
export type ClusterLabel = 'A' | 'B' | 'C' | 'D' | 'E';
export type UseStatus = 'Active' | 'Pilot' | 'Planned';
export type EvidenceType = 'NLP' | 'Gemini' | 'Web';
export type TimelineCategory = 'Regulatory' | 'Custody' | 'Infrastructure' | 'Capital Markets' | 'Retail';

export interface BankScore {
  ticker: string;
  cluster: ClusterLabel;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  comp: number;
  tier: TierLabel;
  nlpPeak: number;
  adjAvg: number;
  realTerms: number;
  specificity: number;
  disclosure: number;
  consistency: number;
  active: number;
  fp: boolean;
}

export interface QuarterData {
  quarter: string;
  score: number;
  cust: number;
  infra: number;
  fintech: number;
  gen: number;
  terms: string;
}

export interface BankQNA {
  quarters: string[];
  scores: number[];
  cust: number[];
  infra: number[];
  fintech: number[];
  gen: number[];
  terms: string[];
  peakQ: string;
  ex1: string;
  ex2: string;
  research: string;
}

export interface ClusterCap {
  label: string;
  value: number;
}

export interface UseCase {
  bank: string;
  uc: string;
  status: UseStatus;
}

export interface ClusterEvidence {
  type: EvidenceType;
  text: string;
}

export interface ClusterDef {
  id: ClusterLabel;
  color: string;
  name: string;
  banks: string[];
  caps: ClusterCap[];
  desc: string;
  evidence: ClusterEvidence[];
  usecases: UseCase[];
}

export interface TimelineItem {
  date: string;
  event: string;
  bank: string;
  category: TimelineCategory;
  color: string;
  summary: string;
}

export interface Development {
  date: string;
  bank: string;
  color: string;
  text: string;
}

// ── Scores ────────────────────────────────────────────────────────────────────

export const SCORES: Record<string, BankScore> = {
  'BNY Mellon':      { ticker:'BK',   cluster:'A', d1:19.5, d2:15.9, d3:25.0, d4:25, comp:85.4, tier:'Tier 1', nlpPeak:9.70,  adjAvg:2.58, realTerms:11, specificity:0.222, disclosure:3.16, consistency:0.875, active:7, fp:false },
  'Charles Schwab':  { ticker:'SCHW', cluster:'C', d1:24.9, d2:14.7, d3:22.4, d4:21, comp:83.0, tier:'Tier 1', nlpPeak:19.81, adjAvg:6.01, realTerms:10, specificity:0.245, disclosure:2.70, consistency:0.750, active:6, fp:false },
  'Citi':            { ticker:'C',    cluster:'B', d1:16.9, d2:10.3, d3:25.0, d4:21, comp:73.2, tier:'Tier 2', nlpPeak:6.79,  adjAvg:1.86, realTerms:7,  specificity:0.118, disclosure:3.40, consistency:0.625, active:5, fp:false },
  'State Street':    { ticker:'STT',  cluster:'A', d1:11.8, d2:20.1, d3:16.0, d4:21, comp:68.9, tier:'Tier 2', nlpPeak:3.19,  adjAvg:1.92, realTerms:6,  specificity:1.000, disclosure:1.07, consistency:1.000, active:8, fp:false },
  'JPMorgan':        { ticker:'JPM',  cluster:'B', d1:15.6, d2:12.7, d3:14.2, d4:24, comp:66.5, tier:'Tier 2', nlpPeak:5.72,  adjAvg:1.09, realTerms:9,  specificity:0.322, disclosure:1.15, consistency:0.375, active:3, fp:false },
  'US Bancorp':      { ticker:'USB',  cluster:'D', d1:14.0, d2:13.0, d3:14.6, d4:17, comp:58.6, tier:'Tier 2', nlpPeak:4.53,  adjAvg:1.27, realTerms:8,  specificity:0.369, disclosure:1.00, consistency:0.500, active:4, fp:false },
  'American Express':{ ticker:'AXP',  cluster:'C', d1:17.5, d2:8.2,  d3:14.2, d4:13, comp:52.9, tier:'Tier 3', nlpPeak:7.42,  adjAvg:1.01, realTerms:7,  specificity:0.040, disclosure:1.00, consistency:0.375, active:3, fp:false },
  'Bank of America': { ticker:'BAC',  cluster:'D', d1:12.4, d2:9.7,  d3:13.8, d4:15, comp:50.9, tier:'Tier 3', nlpPeak:3.51,  adjAvg:0.71, realTerms:4,  specificity:0.501, disclosure:1.00, consistency:0.250, active:2, fp:false },
  'PNC':             { ticker:'PNC',  cluster:'D', d1:15.8, d2:6.6,  d3:14.2, d4:13, comp:49.6, tier:'Tier 3', nlpPeak:5.87,  adjAvg:1.21, realTerms:5,  specificity:0.048, disclosure:1.00, consistency:0.375, active:3, fp:false },
  'Morgan Stanley':  { ticker:'MS',   cluster:'D', d1:8.9,  d2:7.0,  d3:14.2, d4:11, comp:41.1, tier:'Tier 3', nlpPeak:1.96,  adjAvg:0.42, realTerms:4,  specificity:0.168, disclosure:1.00, consistency:0.375, active:3, fp:false },
  'Goldman Sachs':   { ticker:'GS',   cluster:'B', d1:8.6,  d2:3.5,  d3:5.8,  d4:22, comp:39.9, tier:'Tier 3', nlpPeak:1.84,  adjAvg:0.31, realTerms:1,  specificity:0.141, disclosure:0.23, consistency:0.250, active:2, fp:false },
  'Capital One':     { ticker:'COF',  cluster:'E', d1:6.0,  d2:3.0,  d3:13.8, d4:8,  comp:30.8, tier:'Tier 4', nlpPeak:1.07,  adjAvg:0.17, realTerms:2,  specificity:0.000, disclosure:1.00, consistency:0.250, active:2, fp:false },
  'Wells Fargo':     { ticker:'WFC',  cluster:'E', d1:0.0,  d2:0.0,  d3:0.0,  d4:9,  comp:9.0,  tier:'Tier 5', nlpPeak:0.00,  adjAvg:0.00, realTerms:0,  specificity:0.000, disclosure:1.00, consistency:0.000, active:0, fp:true  },
  'Truist':          { ticker:'TFC',  cluster:'E', d1:0.0,  d2:0.0,  d3:0.0,  d4:3,  comp:3.0,  tier:'Tier 5', nlpPeak:0.00,  adjAvg:0.00, realTerms:0,  specificity:0.000, disclosure:1.00, consistency:0.000, active:0, fp:true  },
  'Bank of Montreal':{ ticker:'BMO',  cluster:'E', d1:0.0,  d2:0.0,  d3:0.0,  d4:2,  comp:2.0,  tier:'Tier 5', nlpPeak:0.00,  adjAvg:0.00, realTerms:0,  specificity:0.000, disclosure:1.00, consistency:0.000, active:0, fp:true  },
  'TD Bank':         { ticker:'TD',   cluster:'E', d1:0.0,  d2:0.0,  d3:0.0,  d4:1,  comp:1.0,  tier:'Tier 5', nlpPeak:0.00,  adjAvg:0.00, realTerms:0,  specificity:0.000, disclosure:1.00, consistency:0.000, active:0, fp:true  },
};

// Sorted by composite descending
export const BANK_NAMES_SORTED = Object.entries(SCORES)
  .sort((a, b) => b[1].comp - a[1].comp)
  .map(([name]) => name);

// ── Quarterly NLP data ────────────────────────────────────────────────────────

export const QNA: Record<string, BankQNA> = {
  'BNY Mellon': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0.2, 0.42, 0,    3.07, 3.14, 1.06, 9.70, 3.03],
    cust:    [0.2, 0.42, 0,    0.92, 0.63, 0.21, 1.72, 0.93],
    infra:   [0,   0,    0,    0,    0.21, 0,    0.43, 0.7],
    fintech: [0,   0,    0,    2.15, 0.63, 0,    0,    0],
    gen:     [0,   0,    0,    0,    1.67, 0.85, 7.55, 1.4],
    terms:   ['custody','custody','','circle; fintech; custodian; custody','stablecoin; bitcoin; circle; digital currency; tokenization; custody','bitcoin; digital asset; custody','stablecoin; bitcoin; digital asset custody; digital asset; tokenization; crypto; custody','stablecoin; digital asset custody; digital asset; tokenized deposit; custody'],
    peakQ: 'Q3 2025',
    ex1: 'digital asset custody. We can custody. We\'re the first US G-SIB to natively custody Bitcoin and other digital assets. It\'s stablecoins, yes, but it\'s also this whole mobility conversation.',
    ex2: 'we\'ve always seen digital assets as a long-term play. We\'re in the business of looking after things. Digital asset custody is a natural extension — connecting traditional and on-chain rails.',
    research: '$57.8T AuC/A. RLUSD custody (Jul 2025). BSRXX stablecoin reserves fund (Nov 2025). 80%+ of all US/Canada/EMEA crypto ETP fund services. 50% of all tokenized fund assets globally. CEO Vince: "future of crypto runs through big banks" (Mar 2026).',
  },
  'Charles Schwab': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0,    0,    3.03, 6.07, 3.92, 19.81, 12.66, 2.56],
    cust:    [0,    0,    3.03, 0.81, 0,    0.75,  0.67,  0.73],
    infra:   [0,    0,    0,    0,    0,    4.11,  4.66,  0],
    fintech: [0,    0,    0,    0,    0,    1.12,  1,     0.37],
    gen:     [0,    0,    0,    5.26, 3.92, 13.83, 6.33,  1.46],
    terms:   ['','','custody','custody; crypto','bitcoin; crypto','cryptocurrency; stablecoin; bitcoin; blockchain; ethereum; circle; tokenization; crypto; custody','blockchain; coinbase; crypto; tokenization; custody','fintech; custody; crypto'],
    peakQ: 'Q2 2025',
    ex1: 'we have more than a 20% share of all exchange-traded product assets in crypto on our custody platform. We are working on launch of spot crypto trading for retail clients.',
    ex2: 'our crypto launch is different. We\'re building the books and records and capabilities so that we can custody the assets ourselves — long-term view to participate in blockchain and tokenization.',
    research: 'Schwab Crypto launched April 16, 2026 — BTC/ETH at 75bps via Charles Schwab Premier Bank SSB. $11.9T client assets. 20% of all spot crypto ETP assets. Spot crypto waitlist opened March 2026.',
  },
  'Citi': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0.41, 0, 0, 0, 0.21, 6.79, 6.51, 0.96],
    cust:    [0.41, 0, 0, 0, 0.21, 0.2,  0,    0.48],
    infra:   [0,    0, 0, 0, 0,    0.6,  1.63, 0],
    fintech: [0,    0, 0, 0, 0,    1.2,  0,    0],
    gen:     [0,    0, 0, 0, 0,    4.79, 4.88, 0.48],
    terms:   ['custody','','','','custody','stablecoin; digital asset; circle; custodian; crypto; tokenized deposit','stablecoin; digital asset; crypto; tokenization; tokenized deposit','digital asset; custody'],
    peakQ: 'Q2 2025',
    ex1: 'four main areas: reserve management for stablecoins, on and off ramps, issuance of a Citi stablecoin, and most importantly, the tokenized deposit space where we\'re very active.',
    ex2: 'we view stablecoin as another option in the digital asset toolkit — more friction than tokenized deposits, but we will stand ready to support our clients\' needs.',
    research: 'Crypto custody launch confirmed 2026. CEO Fraser: "looking at Citi stablecoin issuance" (Jul 2025). BVNK investment alongside Visa. Citi Token Services live for cross-border treasury 24/7. Joint stablecoin exploration with PNC and Wells Fargo via Early Warning Services.',
  },
  'State Street': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [1.69, 0.89, 2.24, 3.19, 0.3,  2.99, 2.07, 2.01],
    cust:    [1.69, 0.89, 1.12, 3.19, 0.3,  1.36, 2.07, 0.45],
    infra:   [0,    0,    0,    0,    0,    1.63, 0,    0],
    fintech: [0,    0,    1.12, 0,    0,    0,    0,    0],
    gen:     [0,    0,    0,    0,    0,    0,    0,    1.56],
    terms:   ['custodian; custody','custody','circle; custody','custody','custody','custody; tokenization','custodian; custody','bitcoin; digital asset; custody; crypto'],
    peakQ: 'Q4 2024',
    ex1: 'we knew we needed to perform better in our core custody and servicing business. Digital asset servicing is a core component of our long-term growth plan.',
    ex2: 'enhancing capabilities in core custody, Private Markets, and Alpha broadly — that\'s the digital asset servicing layer we\'ve been building.',
    research: 'Digital Asset Platform launched January 15, 2026 — tokenization infrastructure for MMFs, ETFs, deposits, stablecoins. $51.7T AuC/A. 100% quarter consistency (8/8) — the only bank in our dataset with this pattern. Taurus custody technology partnership.',
  },
  'JPMorgan': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0.42, 0, 0.39, 0, 0, 5.72, 0,    2.59],
    cust:    [0,    0, 0,    0, 0, 0.18, 0,    0],
    infra:   [0,    0, 0,    0, 0, 1.66, 0,    0.74],
    fintech: [0.42, 0, 0.39, 0, 0, 2.03, 0,    0.74],
    gen:     [0,    0, 0,    0, 0, 1.85, 0,    1.11],
    terms:   ['strategic investment','','fintech','','','stablecoin; fintech; circle; deposit token; tokenized deposit; custody','','stablecoin; fintech; blockchain; coinbase; kinexys; crypto'],
    peakQ: 'Q2 2025',
    ex1: 'Kinexys processes $5B daily. We have JPMD — first bank-issued USD deposit token on Base public blockchain — for 24/7 settlement.',
    ex2: 'Kinexys has processed over $1.5 trillion since 2020. The rebrand from Onyx signals moving from experimentation to operating global infrastructure.',
    research: 'JPMD live on Base and Canton Network (Jan 2026 phased rollout). Kinexys: $5B/day, $1.5T+ cumulative. Tokenized MMF on Ethereum Dec 2025. DTCC selected Canton for tokenized US Treasuries. Exploring BTC/ETH as collateral.',
  },
  'US Bancorp': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0,    0.7,  0,    0.25, 0,    1.14, 4.25, 4.53],
    cust:    [0,    0,    0,    0,    0,    0,    1.18, 1.43],
    infra:   [0,    0,    0,    0,    0,    0,    0,    0.24],
    fintech: [0,    0.7,  0,    0.25, 0,    0,    0.71, 0],
    gen:     [0,    0,    0,    0,    0,    1.14, 2.36, 2.86],
    terms:   ['','circle','','fintech','','stablecoin','stablecoin; safekeeping; circle; cryptocurrency; custody','cryptocurrency; stablecoin; digital asset; cryptocurrency custody; tokenization; custody'],
    peakQ: 'Q4 2025',
    ex1: 'progress in two distinct areas: capital markets custody where we have $12 trillion in assets and have stood up cryptocurrency custody with NYDIG as sub-custodian.',
    ex2: 'we stood up Digital Assets and Money Movement division, led by a seasoned payments executive. Stablecoin work in two tracks: capital markets and payments.',
    research: 'Digital Assets and Money Movement division formed Q4 2025. $12T AuC. Live Bitcoin custody with NYDIG. Stablecoin work in capital markets (custody demand) and payments (always-on rails). Administers Hashdex Nasdaq Crypto Index ETF.',
  },
  'American Express': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0, 0, 0, 0.31, 0, 7.42, 0.36, 0.97],
    cust:    [0, 0, 0, 0,    0, 0,    0,    0],
    infra:   [0, 0, 0, 0,    0, 0.3,  0,    0],
    fintech: [0, 0, 0, 0.31, 0, 3.56, 0.36, 0.97],
    gen:     [0, 0, 0, 0,    0, 3.56, 0,    0],
    terms:   ['','','','fintech','','stablecoin; bitcoin; blockchain; ethereum; coinbase; digital currency','fintech','circle'],
    peakQ: 'Q2 2025',
    ex1: 'there\'s a role for stablecoins in payment systems. The Coinbase partnership enables stablecoin off-ramp and cross-border utility for small businesses.',
    ex2: 'CEO Squeri post-GENIUS Act: stablecoins are a viable substitute for Swift/ACH — not a big revenue driver yet, but an opportunity we are seriously looking at.',
    research: 'Coinbase One Card live October 2025 — up to 4% BTC cashback on AmEx network. CEO confirmed stablecoin exploration for cross-border payments post-GENIUS Act. Partnership strategy rather than proprietary platform build.',
  },
  'Bank of America': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0, 0, 0, 0, 0, 3.51, 0,    2.17],
    cust:    [0, 0, 0, 0, 0, 0,    0,    0],
    infra:   [0, 0, 0, 0, 0, 1.76, 0,    0],
    fintech: [0, 0, 0, 0, 0, 0.75, 0,    0],
    gen:     [0, 0, 0, 0, 0, 1,    0,    2.17],
    terms:   ['','','','','','stablecoin; bitcoin; blockchain; circle; tokenized deposit','','stablecoin'],
    peakQ: 'Q2 2025',
    ex1: 'we had to make sure we had legal clarity before going customer-facing. The business cases for incremental value are still to be proven. We have lots of blockchain patents.',
    ex2: 'CEO Moynihan July 2025: we will issue a stablecoin if Congress legalizes it. We are ready.',
    research: 'CEO Moynihan: stablecoin launch confirmed July 2025 post-GENIUS. 15,000+ Merrill and Private Bank advisors authorised to recommend Bitcoin ETFs (1–4% allocation). BofA research Dec 2025: "US banks heading for an onchain future." Participant in G7 stablecoin coalition.',
  },
  'PNC': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0, 0, 0, 0, 1.77, 5.87, 0,    2.03],
    cust:    [0, 0, 0, 0, 0,    0,    0,    0],
    infra:   [0, 0, 0, 0, 0,    0.28, 0,    0],
    fintech: [0, 0, 0, 0, 1.42, 0.28, 0,    0.87],
    gen:     [0, 0, 0, 0, 0.35, 5.31, 0,    1.16],
    terms:   ['','','','','fintech; circle; crypto','crypto; stablecoin; fintech; blockchain','','coinbase; stablecoin; crypto'],
    peakQ: 'Q2 2025',
    ex1: 'revenue opportunities beyond day-to-day client serving are likely in our payment business and treasury management. We\'re going to empower clients who want to use crypto.',
    ex2: 'we\'ve dabbled in direct Bitcoin trading for private banking clients. Stablecoin discussion is everywhere in D.C.',
    research: 'Direct Bitcoin trading launched December 2025 via Coinbase — first top-10 US lender. Joint stablecoin initiative with Citi and Wells Fargo via Early Warning Services (Zelle). NOTE: PNC\'s NLP peak is 90% General terms — reactive disclosure, not operational.',
  },
  'Morgan Stanley': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0, 0.58, 0, 0, 0, 1.96, 0.43, 0.98],
    cust:    [0, 0,    0, 0, 0, 0,    0,    0],
    infra:   [0, 0,    0, 0, 0, 0.33, 0,    0],
    fintech: [0, 0.58, 0, 0, 0, 0,    0,    0],
    gen:     [0, 0,    0, 0, 0, 1.63, 0.43, 0.98],
    terms:   ['','joint venture','','','','stablecoin; crypto; tokenization','digital asset','digital asset; crypto'],
    peakQ: 'Q2 2025',
    ex1: 'I have a question on stablecoins and tokenization — stablecoin legislation is moving forward, how is Morgan Stanley thinking about this?',
    ex2: '',
    research: 'First major WM firm to allow advisors to recommend Bitcoin ETFs (August 2024). E*Trade spot BTC/ETH trading planned H1 2026 via Zerohash. Research recommends max 4% crypto allocation at 6% annual expected return / 55% volatility.',
  },
  'Goldman Sachs': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0, 0, 0, 0, 0, 1.84, 0,    0.61],
    cust:    [0, 0, 0, 0, 0, 0,    0,    0],
    infra:   [0, 0, 0, 0, 0, 0.26, 0,    0.61],
    fintech: [0, 0, 0, 0, 0, 1.58, 0,    0],
    gen:     [0, 0, 0, 0, 0, 0,    0,    0],
    terms:   ['','','','','','circle; tokenization','','tokenization'],
    peakQ: 'Q2 2025',
    ex1: 'a follow-up on the broader theme of tokenization — we\'re still waiting for more clarity on that.',
    ex2: 'NOTE: "coming full circle" in transcripts is idiomatic — not a reference to Circle Financial.',
    research: 'KEY UNDERDISCLOSER: Q&A/Full transcript ratio 0.23x — discusses DA 4x more in scripted remarks than Q&A. GS DAP spinning out as industry-owned platform mid-2026 (announced Oct 2025). Tokenized MMF with BNY live July 2025. EIB digital bond (Project Venus). $135M Digital Asset investment.',
  },
  'Capital One': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0.74, 0.28, 0, 0.36, 0, 0, 0.46, 1.07],
    cust:    [0,    0,    0, 0,    0, 0, 0,    0],
    infra:   [0,    0,    0, 0,    0, 0, 0,    0],
    fintech: [0.74, 0.28, 0, 0.36, 0, 0, 0.46, 1.07],
    gen:     [0,    0,    0, 0,    0, 0, 0,    0],
    terms:   ['circle','fintech','','strategic investment','','','strategic investment','coinbase; fintech'],
    peakQ: 'Q4 2025',
    ex1: 'Brex clients include Anthropic, Robinhood, TikTok, Coinbase — building on our fintech-first foundation.',
    ex2: '',
    research: 'Brex acquisition (fintech-native commercial banking platform used by crypto-adjacent firms). Discover network rail relevant to tokenized payments. Infrastructure-preparation posture rather than product-first. No direct DA products announced.',
  },
  'Wells Fargo': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0,0,0,0,0,0,0,0],
    cust:    [0,0,0,0,0,0,0,0],
    infra:   [0,0,0,0,0,0,0,0],
    fintech: [0,0,0,0,0,0,0,0],
    gen:     [0,0,0,0,0,0,0,0],
    terms:   ['','','','','','','circle [FALSE POS]','circle [FALSE POS]'],
    peakQ: '—',
    ex1: 'FALSE POSITIVE: "maybe I\'ll just circle back on that" — idiomatic English, not Circle Financial. Score zeroed.',
    ex2: '',
    research: 'WFUSD trademark filed March 11, 2026 (USPTO) — cryptocurrency trading, payment processing, tokenization software. Joint stablecoin exploration with PNC and Citi via Early Warning Services/Zelle. No production DA products. D4 score of 9 reflects trajectory signal only.',
  },
  'Truist': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0,0,0,0,0,0,0,0],
    cust:    [0,0,0,0,0,0,0,0],
    infra:   [0,0,0,0,0,0,0,0],
    fintech: [0,0,0,0,0,0,0,0],
    gen:     [0,0,0,0,0,0,0,0],
    terms:   ['','','','','','circle [FALSE POS]','',''],
    peakQ: '—',
    ex1: 'FALSE POSITIVE: "just wanted to circle back on the investment banking cap" — idiomatic, not Circle Financial. Score zeroed.',
    ex2: '',
    research: 'Bitcoin ETF access enabled for advisors via BlackRock and Fidelity Feb 2026. No production DA products. Lowest scores in dataset — retained as baseline comparator.',
  },
  'Bank of Montreal': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0,0,0,0,0,0,0,0],
    cust:    [0,0,0,0,0,0,0,0],
    infra:   [0,0,0,0,0,0,0,0],
    fintech: [0,0,0,0,0,0,0,0],
    gen:     [0,0,0,0,0,0,0,0],
    terms:   ['','circle [FALSE POS]','','circle [FALSE POS]','','','',''],
    peakQ: '—',
    ex1: 'FALSE POSITIVE: "if I just bring all of this full circle" — idiomatic, not Circle Financial. Score zeroed.',
    ex2: '',
    research: 'Named in G7-currency stablecoin coalition (Oct 2025, 9 banks). Appears exploratory with no commitments. No production DA products. Retained as baseline comparator.',
  },
  'TD Bank': {
    quarters: ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'],
    scores:  [0,0,0,0,0,0,0,0],
    cust:    [0,0,0,0,0,0,0,0],
    infra:   [0,0,0,0,0,0,0,0],
    fintech: [0,0,0,0,0,0,0,0],
    gen:     [0,0,0,0,0,0,0,0],
    terms:   ['','strategic investment [FALSE POS]','','','','','',''],
    peakQ: '—',
    ex1: 'FALSE POSITIVE: "strategic investment" refers to TD\'s stake in Charles Schwab — not a digital asset investment. Score zeroed.',
    ex2: '',
    research: 'Named in G7 stablecoin coalition Oct 2025 but no commitments. TD Bank under AML regulatory scrutiny 2024–2025 limiting DA engagement. Lowest average score (0.06) in dataset. Retained as baseline.',
  },
};

// ── Clusters ──────────────────────────────────────────────────────────────────

export const CLUSTERS: ClusterDef[] = [
  {
    id: 'A',
    color: '#3b82f6',
    name: 'Custodial Infrastructure Leaders',
    banks: ['BNY Mellon', 'State Street'],
    caps: [
      { label: 'Custody', value: 10 },
      { label: 'Payments', value: 5 },
      { label: 'Cap Mkts', value: 7 },
      { label: 'Retail', value: 2 },
      { label: 'Regulatory', value: 9 },
    ],
    desc: "Both banks' NLP scores are dominated by Custodial sub-category terms. State Street has specificity ratio of 1.000 (100% Custodial) and is the only bank with 8/8 quarter consistency. BNY has the highest external research score (25/25) and a 3.16x proactive disclosure ratio. These are the banks the institutional market goes to for regulated custody infrastructure.",
    evidence: [
      { type: 'NLP', text: 'BNY: 11 unique terms including "digital asset custody", "tokenized deposit", "stablecoin". Peak 9.70 in Q3 2025. Custodial sub-score dominant. State Street: 8/8 quarters non-zero — only bank with perfect consistency. Custodial = 100% of all sub-scores.' },
      { type: 'Gemini', text: 'BNY: first US G-SIB to natively custody Bitcoin. State Street: Taurus partnership for custody technology. Both serve as fund administrators for spot crypto ETPs. BNY supports 80%+ of US/Canada/EMEA crypto ETP assets.' },
      { type: 'Web', text: 'BNY: $57.8T AuC, RLUSD custody (Jul 2025), BSRXX fund (Nov 2025), BlackRock blockchain platform (Apr 2025). CEO: "future of crypto runs through big banks" (Mar 2026). State Street Digital Asset Platform: Jan 15, 2026 — full tokenization infrastructure for MMFs, ETFs, deposits, stablecoins.' },
    ],
    usecases: [
      { bank: 'BNY Mellon', uc: 'ETF Custody', status: 'Active' },
      { bank: 'BNY Mellon', uc: 'SC Reserves', status: 'Active' },
      { bank: 'BNY Mellon', uc: 'Fund Servicing', status: 'Active' },
      { bank: 'BNY Mellon', uc: 'Tokenized MMF', status: 'Active' },
      { bank: 'BNY Mellon', uc: 'Tok Deposit', status: 'Pilot' },
      { bank: 'State Street', uc: 'ETF Custody', status: 'Active' },
      { bank: 'State Street', uc: 'SC Reserves', status: 'Active' },
      { bank: 'State Street', uc: 'Fund Servicing', status: 'Active' },
      { bank: 'State Street', uc: 'Tokenized MMF', status: 'Pilot' },
    ],
  },
  {
    id: 'B',
    color: '#10b981',
    name: 'Wholesale Blockchain Builders',
    banks: ['JPMorgan', 'Citi', 'Goldman Sachs'],
    caps: [
      { label: 'Custody', value: 4 },
      { label: 'Payments', value: 10 },
      { label: 'Cap Mkts', value: 9 },
      { label: 'Retail', value: 2 },
      { label: 'Regulatory', value: 8 },
    ],
    desc: "All three have built or are building proprietary blockchain infrastructure. JPMorgan's Infrastructure sub-score leads the dataset. Goldman's inclusion is driven by Dimension 4 external research (22/25) compensating for its low NLP score — confirming the value of the multi-dimensional approach. Goldman is the clearest underdisclosure case: Q&A/Full ratio of 0.23x.",
    evidence: [
      { type: 'NLP', text: 'JPMorgan: 9 real unique terms including "kinexys", "deposit token", "tokenized deposit" — most specific Infrastructure vocabulary. Citi: dual Developing peaks Q2+Q3 2025 — sustained engagement. Goldman: low score (1.84) but tokenization terms specific. D3 score of 5.8 reflects underdiscloser status.' },
      { type: 'Gemini', text: 'JPM Kinexys ($5B/day). Citi Token Services: live production for cross-border treasury. GS DAP: Euromoney award winner, EIB digital bond (Project Venus). Goldman discusses DA in scripted remarks 4x more than Q&A.' },
      { type: 'Web', text: 'JPMorgan: JPMD live on Base+Canton, tokenized MMF on Ethereum Dec 2025. Citi: crypto custody 2026 confirmed, BVNK investment, joint stablecoin with PNC/WFC. Goldman: GS DAP spin-out mid-2026 as industry-owned platform, tokenized MMF with BNY Jul 2025.' },
    ],
    usecases: [
      { bank: 'JPMorgan', uc: 'Tok Deposit', status: 'Active' },
      { bank: 'JPMorgan', uc: 'Cross-Border', status: 'Active' },
      { bank: 'JPMorgan', uc: 'FX Clearing', status: 'Active' },
      { bank: 'JPMorgan', uc: 'Bond Issuance', status: 'Pilot' },
      { bank: 'Citi', uc: 'Tok Deposit', status: 'Active' },
      { bank: 'Citi', uc: 'Cross-Border', status: 'Active' },
      { bank: 'Citi', uc: 'Crypto Custody', status: 'Planned' },
      { bank: 'Goldman Sachs', uc: 'Tokenized MMF', status: 'Active' },
      { bank: 'Goldman Sachs', uc: 'Bond Issuance', status: 'Active' },
      { bank: 'Goldman Sachs', uc: 'Collateral Mgmt', status: 'Active' },
    ],
  },
  {
    id: 'C',
    color: '#a78bfa',
    name: 'Retail Digital Asset Pioneers',
    banks: ['Charles Schwab', 'American Express'],
    caps: [
      { label: 'Custody', value: 3 },
      { label: 'Payments', value: 4 },
      { label: 'Cap Mkts', value: 2 },
      { label: 'Retail', value: 10 },
      { label: 'Regulatory', value: 5 },
    ],
    desc: "Highest proactive disclosure ratios (Schwab 2.70x) and highest absolute NLP scores. Strategy is retail and consumer-facing rather than wholesale infrastructure. Schwab's score composition shows both high General (13.83) AND Infrastructure (4.11) in peak quarter — executives discussed both the opportunity and the native custody infrastructure they are building.",
    evidence: [
      { type: 'NLP', text: 'Schwab: peak 19.81 — highest in dataset. 10 unique real terms. Fintech and General dominant with meaningful Infrastructure (custody build-out language). Proactive disclosure ratio 2.70x. AmEx: Fintech sub-score entirely drives engagement (stablecoin/Coinbase vocabulary).' },
      { type: 'Gemini', text: 'Schwab: building native custody infrastructure, 20%+ of all spot crypto ETP assets, CEO explicitly framing crypto as long-term platform play. AmEx: Coinbase partnership 2025, stablecoin exploration for cross-border SMB payments.' },
      { type: 'Web', text: 'Schwab Crypto launched April 16, 2026 — BTC/ETH at 75bps. VALIDATES MODEL: 19.81 peak score predicted this 10 months early. AmEx: Coinbase One Card live Oct 2025 with 4% BTC cashback. CEO Squeri post-GENIUS: stablecoins "an opportunity we are seriously looking at."' },
    ],
    usecases: [
      { bank: 'Charles Schwab', uc: 'ETF Custody', status: 'Active' },
      { bank: 'Charles Schwab', uc: 'Spot Crypto', status: 'Active' },
      { bank: 'American Express', uc: 'Cross-Border', status: 'Pilot' },
      { bank: 'American Express', uc: 'Crypto Card', status: 'Active' },
    ],
  },
  {
    id: 'D',
    color: '#f59e0b',
    name: 'Strategic Movers — GENIUS Act Ready',
    banks: ['US Bancorp', 'Bank of America', 'PNC', 'Morgan Stanley'],
    caps: [
      { label: 'Custody', value: 5 },
      { label: 'Payments', value: 4 },
      { label: 'Cap Mkts', value: 3 },
      { label: 'Retail', value: 7 },
      { label: 'Regulatory', value: 7 },
    ],
    desc: "A mix of operational progress and strategic signaling. US Bancorp is most advanced: $12T AuC, live Bitcoin custody with NYDIG, Digital Assets division formed. Bank of America is notable for the inverse: low NLP score (3.51) but high trajectory (7/7) — CEO commitment, 15,000+ advisors authorised. PNC launched direct Bitcoin trading Dec 2025. Morgan Stanley first for Bitcoin ETF WM advisory.",
    evidence: [
      { type: 'NLP', text: 'US Bancorp: Custodial sub-score emerges Q3–Q4 2025 — only Strategic Mover with meaningful Custodial signal. PNC: 90% General terms in peak quarter — reactive disclosure. BAC: 6 of 8 quarters silent. MS: General-only scores, advisory discussion language.' },
      { type: 'Gemini', text: 'USB: Digital Assets and Money Movement division, $12T custody, active stablecoin work in capital markets + payments tracks. MS: first major WM for BTC ETF advisory (Aug 2024). PNC and WFC: signalling stablecoin intent through exec comments.' },
      { type: 'Web', text: 'PNC: Direct BTC trading launched Dec 2025 via Coinbase. WFC: WFUSD trademark March 2026. USB: revived BTC custody with NYDIG, administers crypto ETFs. MS: E*Trade spot trading planned H1 2026. PNC+Citi+WFC: joint stablecoin via Early Warning Services/Zelle.' },
    ],
    usecases: [
      { bank: 'US Bancorp', uc: 'Crypto Custody', status: 'Active' },
      { bank: 'US Bancorp', uc: 'SC Reserves', status: 'Planned' },
      { bank: 'Bank of America', uc: 'Stablecoin', status: 'Planned' },
      { bank: 'Bank of America', uc: 'ETF Advisory', status: 'Active' },
      { bank: 'PNC', uc: 'Spot Crypto', status: 'Active' },
      { bank: 'Morgan Stanley', uc: 'ETF Advisory', status: 'Active' },
      { bank: 'Morgan Stanley', uc: 'Spot Crypto', status: 'Planned' },
    ],
  },
  {
    id: 'E',
    color: '#9ca3af',
    name: 'Monitoring / False Positives',
    banks: ['Capital One', 'Wells Fargo', 'Truist', 'Bank of Montreal', 'TD Bank'],
    caps: [
      { label: 'Custody', value: 1 },
      { label: 'Payments', value: 2 },
      { label: 'Cap Mkts', value: 1 },
      { label: 'Retail', value: 3 },
      { label: 'Regulatory', value: 4 },
    ],
    desc: "Near-zero or zero adjusted NLP scores. Capital One is most advanced — Brex acquisition provides fintech-ecosystem exposure. Wells Fargo, Truist, BMO, and TD Bank all had NLP scores driven entirely by false positive terms. They are retained as baseline comparators confirming what disengagement looks like.",
    evidence: [
      { type: 'NLP', text: 'BMO: all "circle" hits are idiomatic ("full circle"). TD Bank: "strategic investment" refers to Schwab stake. Truist: "circle back" phrase. WFC: "circle back on that" phrase. All four have adjusted NLP score of zero. Capital One: 2 real terms (fintech, coinbase) but scores driven by false-positive-adjacent vocabulary.' },
      { type: 'Gemini', text: 'No confirmed production DA products for any of the five. Capital One: Brex acquisition gives fintech ecosystem exposure. Truist: Bitcoin ETF access via BlackRock/Fidelity. TD Bank and BMO: Canadian banks with limited direct US regulatory exposure.' },
      { type: 'Web', text: 'WFC: WFUSD trademark Mar 2026 — only concrete DA signal; D4 trajectory score of 9. BMO and TD: named in nine-bank G7 stablecoin coalition Oct 2025 — appears exploratory. Truist: Bitcoin ETF advisory confirmed Feb 2026. Capital One: Discover acquisition gives payment rail infrastructure.' },
    ],
    usecases: [
      { bank: 'Wells Fargo', uc: 'Stablecoin Prep', status: 'Planned' },
      { bank: 'Truist', uc: 'ETF Advisory', status: 'Active' },
      { bank: 'Capital One', uc: 'Fintech Rails', status: 'Planned' },
    ],
  },
];

// ── Timeline ──────────────────────────────────────────────────────────────────

export const TIMELINE: TimelineItem[] = [
  { date: '2020-01', event: 'JPM Coin Launch', bank: 'JPMorgan Chase', category: 'Infrastructure', color: '#10b981', summary: 'First major bank blockchain payment system — rebranded Kinexys, $5B/day by 2026' },
  { date: '2022-03', event: 'SAB 121 Issued', bank: 'SEC', category: 'Regulatory', color: '#ef4444', summary: 'Banks required to book client digital assets as own liabilities — made custody uneconomic' },
  { date: '2022-10', event: 'BNY Mellon Crypto Custody Live', bank: 'BNY Mellon', category: 'Custody', color: '#3b82f6', summary: 'First US G-SIB to offer regulated crypto custody after securing SEC variance on SAB 121' },
  { date: '2023-07', event: 'GS DAP Wins Euromoney Award', bank: 'Goldman Sachs', category: 'Capital Markets', color: '#10b981', summary: 'Financial Innovation of the Year — end-to-end digital bond lifecycle on private ledger' },
  { date: '2024-08', event: 'Morgan Stanley Bitcoin ETF Advisory', bank: 'Morgan Stanley', category: 'Retail', color: '#f59e0b', summary: 'First major wealth manager allowing advisors to proactively recommend Bitcoin ETFs' },
  { date: '2024-10', event: 'Citi Token Services Live', bank: 'Citigroup', category: 'Infrastructure', color: '#10b981', summary: 'Production tokenized deposits for corporate treasury 24/7 cross-border payments' },
  { date: '2024-12', event: 'SAB 121 Rescinded — SAB 122', bank: 'SEC', category: 'Regulatory', color: '#ef4444', summary: 'Removed balance sheet requirement — major unlock for bank crypto custody economics' },
  { date: '2025-06', event: 'GENIUS Act Senate Passage', bank: 'US Senate', category: 'Regulatory', color: '#ef4444', summary: 'Senate passes 68–30 — generates wave of analyst stablecoin questions in Q2 2025 earnings' },
  { date: '2025-07', event: 'GENIUS Act Signed into Law', bank: 'US Congress', category: 'Regulatory', color: '#ef4444', summary: 'First federal stablecoin legislation signed July 18. Root cause of Q2 2025 NLP inflection across 9 banks.' },
  { date: '2025-07', event: 'BNY Custody of Ripple RLUSD', bank: 'BNY Mellon', category: 'Custody', color: '#3b82f6', summary: 'Primary custody of Ripple USD stablecoin reserves — confirms BNY as dominant stablecoin infrastructure' },
  { date: '2025-07', event: 'GS-BNY Tokenized MMF Live', bank: 'Goldman Sachs + BNY', category: 'Capital Markets', color: '#10b981', summary: 'First US tokenized MMF — BlackRock, Federated Hermes, Fidelity, GSAM all participating' },
  { date: '2025-10', event: 'Citi 2026 Crypto Custody Confirmed', bank: 'Citi', category: 'Custody', color: '#3b82f6', summary: 'CNBC: Citi confirms custody launch coming quarters, 2–3 years in development, targeting asset managers' },
  { date: '2025-10', event: 'GS DAP Spin-Out Announced', bank: 'Goldman Sachs', category: 'Capital Markets', color: '#10b981', summary: 'GS DAP to become industry-owned distributed platform mid-2026, Tradeweb partnership' },
  { date: '2025-10', event: 'US Bancorp Digital Assets Division', bank: 'US Bancorp', category: 'Infrastructure', color: '#f59e0b', summary: 'Dedicated division — $12T AuC, live Bitcoin custody with NYDIG, stablecoin in two tracks' },
  { date: '2025-11', event: 'BNY Dreyfus Stablecoin Reserves Fund', bank: 'BNY Mellon', category: 'Custody', color: '#3b82f6', summary: 'BSRXX — money market fund to hold reserves for GENIUS Act-compliant stablecoin issuers' },
  { date: '2025-12', event: 'PNC Direct Bitcoin Trading', bank: 'PNC', category: 'Retail', color: '#f59e0b', summary: 'First top-10 US lender with direct Bitcoin trading for private banking clients via Coinbase' },
  { date: '2026-01', event: 'State Street Digital Asset Platform', bank: 'State Street', category: 'Custody', color: '#3b82f6', summary: 'Full tokenization infrastructure — MMFs, ETFs, deposits, stablecoins across private+public blockchains' },
  { date: '2026-01', event: 'JPMorgan JPMD on Canton Network', bank: 'JPMorgan', category: 'Infrastructure', color: '#10b981', summary: 'JPMD deposit token to issue natively on Canton — phased rollout throughout 2026' },
  { date: '2026-01', event: 'BofA Merrill Advisors Bitcoin ETF', bank: 'Bank of America', category: 'Retail', color: '#f59e0b', summary: '15,000+ Merrill and Private Bank advisors authorised to recommend Bitcoin ETFs (1–4% allocation)' },
  { date: '2026-03', event: 'Wells Fargo WFUSD Trademark', bank: 'Wells Fargo', category: 'Infrastructure', color: '#f59e0b', summary: 'USPTO filing covers crypto trading, payments, tokenization — USD suffix implies stablecoin/deposit token' },
  { date: '2026-04', event: 'Schwab Crypto Launched ✓ VALIDATES MODEL', bank: 'Charles Schwab', category: 'Retail', color: '#a78bfa', summary: '"Schwab Crypto" live April 16, 2026 — BTC/ETH at 75bps. 10-month lead from Q2 2025 peak NLP score of 19.81.' },
];

// ── Latest Developments ───────────────────────────────────────────────────────

export const DEVELOPMENTS: Development[] = [
  { date: 'Apr 16 2026', bank: 'Charles Schwab', color: '#a78bfa', text: 'Schwab Crypto launched — direct BTC/ETH at 75bps via Charles Schwab Premier Bank SSB. Validates our Q2 2025 NLP peak of 19.81 as a predictive signal.' },
  { date: 'Mar 11 2026', bank: 'Wells Fargo', color: '#f59e0b', text: 'WFUSD trademark filed with USPTO — cryptocurrency trading, exchange services, payment processing, digital asset transfers, staking, tokenization software.' },
  { date: 'Jan 15 2026', bank: 'State Street', color: '#3b82f6', text: 'Digital Asset Platform launched — full tokenization infrastructure: MMFs, ETFs, deposits, stablecoins across private and public permissioned blockchains. $51.7T AuC/A.' },
  { date: 'Jan 7 2026', bank: 'JPMorgan', color: '#10b981', text: 'JPMD to issue natively on Canton Network — phased rollout 2026. Also launched tokenized money market fund on Ethereum Dec 2025. DTCC selected Canton for tokenized US Treasuries.' },
  { date: 'Jan 5 2026', bank: 'Bank of America', color: '#10b981', text: '15,000+ Merrill and Private Bank advisors authorised to recommend Bitcoin ETFs (1–4% allocation via BlackRock, Fidelity, Bitwise, Grayscale).' },
  { date: 'Nov 2025', bank: 'BNY Mellon', color: '#3b82f6', text: 'BNY Dreyfus Stablecoin Reserves Fund (BSRXX) launched — MMF designed to hold reserves for GENIUS Act-compliant stablecoin issuers.' },
  { date: 'Oct 2025', bank: 'Citi', color: '#10b981', text: 'Crypto custody launch confirmed for 2026 (CNBC). 2–3 years in development. Also investing in BVNK (stablecoin infrastructure startup) alongside Visa.' },
  { date: 'Oct 2025', bank: 'Goldman Sachs', color: '#10b981', text: 'GS DAP spin-out announced — platform to become industry-owned distributed solution mid-2026, partnering with Tradeweb. Builds on July 2025 tokenized MMF launch with BNY.' },
  { date: 'Oct 2025', bank: 'PNC + Citi + Wells Fargo', color: '#f59e0b', text: 'Joint stablecoin initiative via Early Warning Services (Zelle) — three banks from three different clusters exploring shared stablecoin infrastructure.' },
  { date: 'Dec 2025', bank: 'PNC', color: '#f59e0b', text: 'Direct Bitcoin trading launched for private banking clients via Coinbase — first top-10 US lender to do so.' },
  { date: 'Jul 18 2025', bank: 'US Congress', color: '#ef4444', text: 'GENIUS Act signed into law — Senate 68-30, House 308-122. First federal stablecoin legislation. Root cause of Q2 2025 NLP inflection across 9 of 16 banks.' },
];

// ── Helper functions ──────────────────────────────────────────────────────────

export function tierColor(tier: TierLabel): string {
  const map: Record<TierLabel, string> = {
    'Tier 1': '#10b981',
    'Tier 2': '#3b82f6',
    'Tier 3': '#a78bfa',
    'Tier 4': '#f59e0b',
    'Tier 5': '#ef4444',
  };
  return map[tier];
}

export function tierBg(tier: TierLabel): string {
  const map: Record<TierLabel, string> = {
    'Tier 1': 'rgba(16,185,129,0.15)',
    'Tier 2': 'rgba(59,130,246,0.15)',
    'Tier 3': 'rgba(167,139,250,0.15)',
    'Tier 4': 'rgba(245,158,11,0.15)',
    'Tier 5': 'rgba(239,68,68,0.15)',
  };
  return map[tier];
}

export function clusterColor(cluster: ClusterLabel): string {
  const map: Record<ClusterLabel, string> = {
    A: '#3b82f6',
    B: '#10b981',
    C: '#a78bfa',
    D: '#f59e0b',
    E: '#9ca3af',
  };
  return map[cluster];
}

export function compositeColor(comp: number): string {
  if (comp >= 75) return '#10b981';
  if (comp >= 55) return '#3b82f6';
  if (comp >= 35) return '#a78bfa';
  if (comp >= 15) return '#f59e0b';
  return '#ef4444';
}

export function statusColor(status: UseStatus): string {
  const map: Record<UseStatus, string> = {
    Active:  '#10b981',
    Pilot:   '#f59e0b',
    Planned: '#a78bfa',
  };
  return map[status];
}

export function evidenceColor(type: EvidenceType): string {
  const map: Record<EvidenceType, string> = {
    NLP:    '#f59e0b',
    Gemini: '#a78bfa',
    Web:    '#10b981',
  };
  return map[type];
}
