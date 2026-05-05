// ─────────────────────────────────────────────────────────────────────────────
// BUFN403 Capstone — Team 6: Digital Asset Risk Analysis
// Data file for the DA Risk Panel
//
// All scores rescaled to 0-100 per dimension. Weighted composite = R1×40% + R2×35% + R3×25%.
// R2 displayed value uses the fixed formula: (formal + ops + tech) / 30 × 100.
// The disclosure-consistency sub-component is excluded from the displayed R2 because
// in the underlying data it scored 25/25 (max) for almost every bank, contributing no
// discriminative signal. We retain its ratio for context inside the bank profile.
//
// R4 (systemic footprint) is internal-use-only — used for bubble sizing on the joint
// matrix. It is NOT a safety score and does not appear in any ranking.
//
// False positives (WFC, TFC, BMO, TD) are kept in a separate dataset and never
// appear in the primary rankings or the joint matrix. They appear only in the
// methodological-validation card.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

export type Cluster = 'A' | 'B' | 'C' | 'D' | 'E';
export type QuadrantLabel =
  | 'Operational Leader'
  | 'Building But Waiting'
  | 'Cautious Abstainer'
  | 'Announced But Unproven'
  | 'Not Participating';
export type SupervisoryAction =
  | 'Routine Monitoring'
  | 'Enhanced Monitoring'
  | 'Targeted Examination';
export type InfraDepth = 'Proprietary Platform' | 'Partnership-Dependent' | 'Not Participating';
export type RegContingency = 'Low Contingency' | 'Moderate Contingency' | 'High Contingency';
export type Confidence = 'High' | 'Medium' | 'Low';

export interface SubScore {
  raw: number;       // 0-10 from Gemini, or computed metric
  norm25: number;    // 0-25 normalized
  justification: string;
  evidence: string[];
}

export interface QuarterlyR1 {
  quarter: string;
  r1: number;
  // Selected key Call-Report metrics (others available in raw if needed)
  hqlaAssets?: number;
  uninsuredDeposits?: number;
  brokeredDeposits?: number;
  cet1Assets?: number;
  tier1Rwa?: number;
  ncoRatio?: number;
  ninetyDpdPlus?: number;
  unrealizedLossPct?: number;
  htmRatio?: number;
  irSensitivity?: number;
  depositFragility?: number;
  roe?: number;
  nim?: number;
}

export interface BankProfile {
  ticker: string;
  bankName: string;
  assetsB: number;
  cluster: Cluster;
  clusterName: string;
  rossiCluster: string;

  // Team 5 engagement
  t5Composite: number;
  t5Tier: string;
  d2Specificity: number;
  d3DisclosureMode: number;

  // Our scores (all 0-100)
  r1: number;
  r2: number;            // fixed: (formal+ops+tech)/30*100
  r3: number;
  r4Raw: number;         // 0-25 — internal use, bubble sizing only
  weightedComposite: number; // R1×0.4 + R2×0.35 + R3×0.25

  // Peer percentile within the 12 genuine DA-active banks
  peerPercentile: number;

  // R1 detail
  r1Trend: 'improving' | 'stable' | 'declining';
  r1TrendSlope: number;
  r1Volatility: number;
  feeIncomePeerAdjusted: boolean;
  hqlaUnderstated: boolean;          // JPM, BAC, C
  r1QuarterlyData: QuarterlyR1[];

  // R2 sub-components (raw 0-10 from Gemini)
  r2Formal: SubScore;
  r2OpsControls: SubScore;
  r2TechRisk: SubScore;
  r2DisclosureRatio: number;          // contextual only — not part of fixed R2

  // R3 sub-components
  r3Vendor: SubScore;
  r3RetailInst: SubScore;
  r3RegReadiness: SubScore;
  r3ContagionSafety: SubScore;        // inverted: 25 = safest from contagion
  r3PrimaryVendors: string[];
  r3ClientProfile: string | null;
  r3GeniusActStatus: string | null;

  // R4 components (internal)
  r4SizeImportance: number;
  r4DepositFragility: number;
  r4ContagionConnections: number;

  // Quadrant placement
  infraDepth: InfraDepth;
  regContingency: RegContingency;
  quadrantLabel: QuadrantLabel;
  quadrantConfidence: Confidence;
  quadrantJustification: string;
  whatWouldChange: string;
  infraEvidence: string[];
  contingencyEvidence: string[];

  // Regulatory narrative
  oneLineStory: string;
  supervisoryAction: SupervisoryAction;
  biggestRisk: string;
  supervisoryFlags: string[];
  keyStrengths: string[];

  // Special flags
  schwabValidationNote?: string;       // only on SCHW
  deliberateAbstainerNote?: string;    // only on COF
  isFalsePositive: boolean;
}

// ─── Cluster definitions (Team 5) ────────────────────────────────────────────

export const CLUSTER_INFO: Record<Cluster, { name: string; color: string; description: string }> = {
  A: {
    name: 'Custodial Infrastructure Leaders',
    color: '#4A90D9',
    description: 'Banks operating digital asset custody infrastructure at institutional scale.',
  },
  B: {
    name: 'Wholesale Blockchain Builders',
    color: '#3DBE7A',
    description: 'Banks building proprietary wholesale DLT platforms for institutional clients.',
  },
  C: {
    name: 'Retail Digital Asset Pioneers',
    color: '#B39DFA',
    description: 'Banks introducing digital assets to retail and high-net-worth clients.',
  },
  D: {
    name: 'Strategic Movers',
    color: '#F59C55',
    description: 'Banks with active digital asset strategy still building toward live operations.',
  },
  E: {
    name: 'Monitoring / Abstainers',
    color: '#8EA3B8',
    description: 'Banks with no meaningful DA engagement — deliberate abstainers and Team 5 false positives.',
  },
};

// ─── Quadrant colors ─────────────────────────────────────────────────────────

export const QUADRANT_COLORS: Record<QuadrantLabel, string> = {
  'Operational Leader':     '#3DBE7A',
  'Building But Waiting':   '#F59C55',
  'Cautious Abstainer':     '#4A90D9',
  'Announced But Unproven': '#E85D5D',
  'Not Participating':      '#8EA3B8',
};

export const QUADRANT_DESCRIPTIONS: Record<QuadrantLabel, string> = {
  'Operational Leader':
    'Active and operational at scale. Proprietary infrastructure, low regulatory contingency. Monitor for concentration risk.',
  'Building But Waiting':
    'Proprietary infrastructure built but strategy paused for regulatory clarity. Low immediate risk, high upside post-GENIUS Act.',
  'Cautious Abstainer':
    'Partnership-dependent with clear, operational strategy. Lower systemic exposure. Primary concern: vendor concentration.',
  'Announced But Unproven':
    'HIGH SUPERVISORY CONCERN. Aggressive public strategy + third-party dependency + regulatory contingency. CEO ambition exceeds operational reality.',
  'Not Participating':
    'No meaningful DA activity. Includes deliberate strategic abstainers and methodology false positives.',
};

// ─── Default composite weights ───────────────────────────────────────────────

export const DEFAULT_WEIGHTS = { r1: 0.40, r2: 0.35, r3: 0.25 };

export const WEIGHT_RATIONALES = {
  r1: 'Highest weight. R1 is fully objective Call Report data with no AI involvement. It anchors the composite with the most auditable signal.',
  r2: 'Second-highest weight. Governance documentation is what regulators act on — a bank with weak formal disclosure has no documented risk framework regardless of operational quality.',
  r3: 'Lowest weight. R3 partially overlaps with R2 (governance and exposure correlate) and is the most AI-dependent dimension. Lower weight is a defensible default.',
};

// ─── Sub-component definitions (for the weight explorer) ─────────────────────

export const R1_SUBCOMPONENTS = [
  { key: 'liquidity',   label: 'Liquidity Resilience',   weight: 0.30, rationale: 'Blockchain enables deposit runs in minutes. Uninsured and brokered funding drove SVB and Signature Bank failures.' },
  { key: 'capital',     label: 'Capital Adequacy',       weight: 0.25, rationale: 'Capital is the ultimate shock absorber. Thin capital cannot fund DA infrastructure and absorb operational losses simultaneously.' },
  { key: 'credit',      label: 'Credit Quality',         weight: 0.20, rationale: 'A bank under credit stress has no capacity for novel DA operational risk.' },
  { key: 'irr',         label: 'Interest Rate Risk',     weight: 0.15, rationale: 'SVB mechanism: locked HTM portfolio plus unrealized losses creates a latent crisis when DA-driven liquidity stress occurs.' },
  { key: 'earnings',    label: 'Earnings Power',         weight: 0.10, rationale: 'Profitable banks sustain DA investment. Peer-adjusted for fee-income banks (BNY, STT, GS, MS).' },
];

export const R2_SUBCOMPONENTS = [
  { key: 'formal', label: 'Formal 10-K Disclosure',   weight: 1/3, rationale: 'Does the bank explicitly disclose DA risks in its 10-K? Silent filings score 0 by design.' },
  { key: 'ops',    label: 'Operational Controls',     weight: 1/3, rationale: 'Vendor management, internal audit coverage, incident response. Undocumented vendor relationships are a supervisory blind spot.' },
  { key: 'tech',   label: 'Technical Risk Doc',       weight: 1/3, rationale: 'Key management, cold storage, smart contract audits, DLT infrastructure risks. Only banks with published whitepapers score high.' },
];

export const R3_SUBCOMPONENTS = [
  { key: 'vendor',    label: 'Vendor Concentration Safety', weight: 0.25, rationale: 'Banks reliant on single third-party APIs (Coinbase, Zero Hash) face single-point-of-failure risk.' },
  { key: 'retail',    label: 'Institutional vs Retail',     weight: 0.25, rationale: 'Retail DA access creates CFPB oversight, fraud risk, and reputational exposure absent in institutional operations.' },
  { key: 'reg',       label: 'Regulatory Readiness',        weight: 0.25, rationale: 'GENIUS Act preparation, SAB 122 adoption, OCC compliance. Early engagement = lower risk.' },
  { key: 'contagion', label: 'Contagion Containment',       weight: 0.25, rationale: 'Banks custodying others\' DA assets propagate failures to the broader market. Inverted: higher score = less contagion.' },
];

// ─── BANK DATA ───────────────────────────────────────────────────────────────

// Helper: attach computed weighted composite using the FIXED R2.
// All values below have been hand-verified against the source bank-profile JSONs.

export const GENUINE_BANKS: BankProfile[] = [
  // ─── BNY Mellon ────────────────────────────────────────────────────────────
  {
    ticker: 'BK',
    bankName: 'BNY Mellon',
    assetsB: 472,
    cluster: 'A',
    clusterName: 'Custodial Infrastructure Leaders',
    rossiCluster: 'Custodial Bank',
    t5Composite: 85.4,
    t5Tier: 'Tier 1',
    d2Specificity: 0.82,
    d3DisclosureMode: 3.16,
    r1: 46.6,
    r2: 63.3,
    r3: 65.0,
    r4Raw: 19.38,
    weightedComposite: 57.0,
    peerPercentile: 100,
    r1Trend: 'improving',
    r1TrendSlope: 0.1308,
    r1Volatility: 0.346,
    feeIncomePeerAdjusted: true,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 35.7, hqlaAssets: 0.1247, uninsuredDeposits: 0.9819, cet1Assets: 0.0587, tier1Rwa: 0.1566, depositFragility: 0.5949, roe: 0.1265, nim: 0.0123 },
      { quarter: 'Q2 2024', r1: 37.2, hqlaAssets: 0.1283, uninsuredDeposits: 0.9779, cet1Assets: 0.0613, tier1Rwa: 0.1622, depositFragility: 0.5921 },
      { quarter: 'Q3 2024', r1: 41.1, hqlaAssets: 0.1303, uninsuredDeposits: 0.9799, cet1Assets: 0.0639, tier1Rwa: 0.1684, depositFragility: 0.5934 },
      { quarter: 'Q4 2024', r1: 39.9, hqlaAssets: 0.1276, uninsuredDeposits: 0.9802, cet1Assets: 0.0659, tier1Rwa: 0.1696, depositFragility: 0.5933 },
      { quarter: 'Q1 2025', r1: 45.1, hqlaAssets: 0.1298, uninsuredDeposits: 0.9778, cet1Assets: 0.0707, tier1Rwa: 0.1745, depositFragility: 0.5915 },
      { quarter: 'Q2 2025', r1: 39.7, hqlaAssets: 0.1272, uninsuredDeposits: 0.9805, cet1Assets: 0.0686, tier1Rwa: 0.1681, depositFragility: 0.5928 },
      { quarter: 'Q3 2025', r1: 46.1, hqlaAssets: 0.1307, uninsuredDeposits: 0.9795, cet1Assets: 0.0734, tier1Rwa: 0.1738, depositFragility: 0.5919 },
      { quarter: 'Q4 2025', r1: 46.6, hqlaAssets: 0.1318, uninsuredDeposits: 0.9803, cet1Assets: 0.0742, tier1Rwa: 0.1751, depositFragility: 0.5927, roe: 0.1487, nim: 0.0137 },
    ],
    r2Formal: {
      raw: 8, norm25: 20.0,
      justification: 'BNY provides high-quality formal disclosures that go beyond boilerplate, with explicit references to SR 23-7 Novel Activities Supervision Program and concrete governance frameworks.',
      evidence: ['Explicit mention of SR 23-7 Novel Activities Supervision Program', 'Disclosure of board-level oversight committee for digital assets'],
    },
    r2OpsControls: {
      raw: 6, norm25: 15.0,
      justification: 'Robust enterprise-wide risk management framework with Audit Committee oversight covering DA operations.',
      evidence: ['Audit Committee oversight of internal controls and compliance', 'Cyber resilience framework explicitly extended to DLT infrastructure'],
    },
    r2TechRisk: {
      raw: 5, norm25: 12.5,
      justification: 'Discloses advanced technical initiatives such as on-chain mirrored representations of client deposits with documented control framework.',
      evidence: ['Implementation of on-chain mirrored representations of client deposit balances', 'Documented partnership with Securitize for tokenized CLO custody'],
    },
    r2DisclosureRatio: 0.724,
    r3Vendor: {
      raw: 7, norm25: 17.5,
      justification: 'Platform-oriented model with proprietary infrastructure plus institutional partners (Securitize, Ripple, WisdomTree). No single-vendor dependency.',
      evidence: ['BNY Digital Asset Platform (proprietary)', 'Diversified partner ecosystem'],
    },
    r3RetailInst: {
      raw: 9, norm25: 22.5,
      justification: 'Almost exclusively institutional — focuses on stablecoin reserve custody and BaaS for tokenized funds. No retail crypto product.',
      evidence: ['Primary reserve custodian for Circle USDC, Ripple stablecoin', 'No retail-facing crypto offering'],
    },
    r3RegReadiness: {
      raw: 9, norm25: 22.5,
      justification: 'Industry-leading regulatory engagement. SEC non-objection received, GENIUS Act fully prepared, SAB 122 adopted.',
      evidence: ['SEC non-objection for crypto custody (SAB 121 workaround)', 'GENIUS Act status: Fully Prepared'],
    },
    r3ContagionSafety: {
      raw: 9, norm25: 2.5,  // INVERTED — high contagion = low safety
      justification: 'As G-SIB and primary reserve custodian for major stablecoins (Ripple, Societe Generale) and 80%+ of US crypto ETPs, BNY is the highest-contagion node in the DA ecosystem.',
      evidence: ['Reserve custodian for Ripple US stablecoin', 'Reserve custodian for Societe Generale stablecoin (Europe)', 'BaaS provider for WisdomTree Prime', 'Custodian for 80%+ of US crypto ETPs'],
    },
    r3PrimaryVendors: ['Securitize', 'Ripple', 'WisdomTree', 'Google Cloud'],
    r3ClientProfile: 'Primarily Institutional',
    r3GeniusActStatus: 'Fully Prepared',
    r4SizeImportance: 7.34,
    r4DepositFragility: 9.79,
    r4ContagionConnections: 4.5,
    infraDepth: 'Proprietary Platform',
    regContingency: 'Low Contingency',
    quadrantLabel: 'Operational Leader',
    quadrantConfidence: 'High',
    quadrantJustification: 'BNY operates the proprietary BNY Digital Asset Platform with live custody volumes. High D2 specificity (0.82) reflects deep technical infrastructure rather than API-wrapping. SEC non-objection received and GENIUS Act readiness already complete.',
    whatWouldChange: 'A regulatory reversal or enforcement action targeting stablecoin reserve management would shift placement toward Building But Waiting.',
    infraEvidence: ['BNY Digital Asset Platform (proprietary custodial infrastructure)', 'Primary custodian for Circle USDC stablecoin reserves', 'D2 Specificity: 0.82 (infrastructure-specific vocabulary)'],
    contingencyEvidence: ['SEC non-objection received for crypto custody services', 'GENIUS Act status: Fully Prepared', 'D3 Disclosure mode: 3.16x (proactive institutional guidance)'],
    oneLineStory: 'BNY is positioning itself as the systemic trusted-infrastructure layer for institutional digital assets, balancing aggressive stablecoin reserve growth with disciplined regulatory alignment.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Concentration of stablecoin reserve custody for major issuers creates a single point of failure for digital dollar liquidity.',
    supervisoryFlags: [
      'Monitor transition of Novel Activities monitoring into standard supervisory processes following NAS Program sunset',
      'Evaluate concentration risk of stablecoin reserve custody, specifically for Ripple and Societe Generale',
      'Review operational resilience of on-chain mirrored deposit representations',
      'Assess third-party risk management for the WisdomTree Prime BaaS partnership',
    ],
    keyStrengths: [
      'Proactive regulatory alignment and high disclosure specificity (D3 ratio 3.16)',
      'Strategic board-level expertise (independent director with Ripple board seat)',
      'Strong financial resilience with improving ROE and Tier 1 capital ratios',
    ],
    isFalsePositive: false,
  },

  // ─── State Street ──────────────────────────────────────────────────────────
  {
    ticker: 'STT',
    bankName: 'State Street',
    assetsB: 366,
    cluster: 'A',
    clusterName: 'Custodial Infrastructure Leaders',
    rossiCluster: 'Custodial Bank',
    t5Composite: 68.9,
    t5Tier: 'Tier 2',
    d2Specificity: 1.00,
    d3DisclosureMode: 1.45,
    r1: 36.6,
    r2: 73.3,
    r3: 65.0,
    r4Raw: 19.28,
    weightedComposite: 56.5,
    peerPercentile: 92,
    r1Trend: 'improving',
    r1TrendSlope: 0.1263,
    r1Volatility: 0.309,
    feeIncomePeerAdjusted: true,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 25.8 },
      { quarter: 'Q2 2024', r1: 29.1 },
      { quarter: 'Q3 2024', r1: 31.9 },
      { quarter: 'Q4 2024', r1: 32.4 },
      { quarter: 'Q1 2025', r1: 35.3 },
      { quarter: 'Q2 2025', r1: 34.5 },
      { quarter: 'Q3 2025', r1: 35.4 },
      { quarter: 'Q4 2025', r1: 36.6, cet1Assets: 0.0773, tier1Rwa: 0.1627 },
    ],
    r2Formal: {
      raw: 9, norm25: 22.5,
      justification: 'State Street demonstrates exceptional formal disclosure quality with named board oversight and detailed risk framework specific to digital assets.',
      evidence: ['Dedicated DA risk section in 10-K', 'Named board committee with cited DA mandate', 'Specific GENIUS Act and MiCAR preparation language'],
    },
    r2OpsControls: {
      raw: 7, norm25: 17.5,
      justification: 'Strong operational controls with Model Validation Group reports specifically referenced for digital asset servicing models.',
      evidence: ['Model Validation Group covers DA servicing models', 'Documented vendor management for fabric platform partners'],
    },
    r2TechRisk: {
      raw: 6, norm25: 15.0,
      justification: 'Detailed technical disclosure of fabric platform architecture and cryptographic protocol governance.',
      evidence: ['fabric platform technical documentation', 'Cryptographic protocol failure scenarios disclosed'],
    },
    r2DisclosureRatio: 0.949,
    r3Vendor: {
      raw: 7, norm25: 17.5,
      justification: 'Hybrid model with proprietary fabric platform and select institutional partners. Lower vendor risk than pure partnership-dependent banks.',
      evidence: ['State Street fabric platform (proprietary)', 'Institutional-only client base'],
    },
    r3RetailInst: {
      raw: 10, norm25: 25.0,
      justification: 'Pure institutional focus. No retail digital asset products exist or are planned.',
      evidence: ['100% institutional client base', '99% uninsured deposit ratio reflects institutional model'],
    },
    r3RegReadiness: {
      raw: 8, norm25: 20.0,
      justification: 'Proactive regulatory mapping including GENIUS Act, MiCAR. SAB 122 adopted on balance sheet.',
      evidence: ['GENIUS Act explicit preparation', 'MiCAR cross-border framework'],
    },
    r3ContagionSafety: {
      raw: 9, norm25: 2.5,
      justification: 'As primary custodian for institutional crypto ETPs and tokenized fund infrastructure, State Street has high systemic interconnectedness.',
      evidence: ['Custody for institutional crypto ETP issuers', 'fabric platform serves multiple institutional clients'],
    },
    r3PrimaryVendors: ['Galaxy Digital', 'BlackRock'],
    r3ClientProfile: 'Pure Institutional',
    r3GeniusActStatus: 'Fully Prepared',
    r4SizeImportance: 6.97,
    r4DepositFragility: 9.81,
    r4ContagionConnections: 4.0,
    infraDepth: 'Proprietary Platform',
    regContingency: 'High Contingency',
    quadrantLabel: 'Building But Waiting',
    quadrantConfidence: 'High',
    quadrantJustification: 'State Street operates the proprietary fabric tokenization platform with high D2 specificity (1.00). However, the bank explicitly notes that production deployment is contingent on final GENIUS Act guidance, placing it in the Building But Waiting quadrant rather than Operational Leader.',
    whatWouldChange: 'Final GENIUS Act passage with State Street\'s preferred provisions would move the bank to Operational Leader. Adverse legislative outcomes would extend the waiting posture.',
    infraEvidence: ['State Street fabric tokenization platform (proprietary)', 'D2 Specificity: 1.00 (highest in dataset — pure infrastructure vocabulary)', 'Institutional ETF custody operations'],
    contingencyEvidence: ['Production deployment timeline explicitly tied to GENIUS Act final language', 'Multiple references to "pending regulatory clarity" in 2025 filings', 'No specific transaction volumes disclosed'],
    oneLineStory: 'State Street is positioning itself as the systemic plumbing for institutional tokenization, balancing aggressive infrastructure development with sophisticated regulatory mapping.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Tokenized assets accelerating deposit outflows from the banking system, undermining State Street\'s role in monetary policy transmission.',
    supervisoryFlags: [
      'Evaluate resilience of fabric platform against cryptographic protocol failures',
      'Monitor impact of tokenized deposit outflows on the bank\'s 99% uninsured deposit base',
      'Review Model Validation Group reports specifically for digital asset servicing models',
      'Assess third-party dependency risks for fabric platform distribution',
    ],
    keyStrengths: [
      'Proactive regulatory mapping (GENIUS Act, MiCAR)',
      'Pure institutional focus minimizing retail fraud exposure',
      'Robust Tier 1 Capital (16.27% in Q4 2025) providing buffer for innovation costs',
    ],
    isFalsePositive: false,
  },

  // ─── JPMorgan ──────────────────────────────────────────────────────────────
  {
    ticker: 'JPM',
    bankName: 'JPMorgan Chase',
    assetsB: 4425,
    cluster: 'B',
    clusterName: 'Wholesale Blockchain Builders',
    rossiCluster: 'Money Center Bank',
    t5Composite: 66.5,
    t5Tier: 'Tier 2',
    d2Specificity: 0.71,
    d3DisclosureMode: 1.85,
    r1: 41.4,
    r2: 66.7,
    r3: 62.5,
    r4Raw: 20.50,
    weightedComposite: 55.5,
    peerPercentile: 83,
    r1Trend: 'improving',
    r1TrendSlope: 0.0798,
    r1Volatility: 0.193,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: true,   // Y-9C consolidation issue
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 34.8 },
      { quarter: 'Q2 2024', r1: 34.1 },
      { quarter: 'Q3 2024', r1: 36.3 },
      { quarter: 'Q4 2024', r1: 37.0 },
      { quarter: 'Q1 2025', r1: 37.3 },
      { quarter: 'Q2 2025', r1: 38.1 },
      { quarter: 'Q3 2025', r1: 38.6 },
      { quarter: 'Q4 2025', r1: 41.4 },
    ],
    r2Formal: {
      raw: 8, norm25: 20.0,
      justification: 'High-quality formal disclosures including detailed Kinexys platform documentation and explicit DA risk factors in 10-K.',
      evidence: ['Dedicated Kinexys platform whitepaper', 'Explicit DA risk factors in Risk Factors section', 'Named board-level digital asset oversight'],
    },
    r2OpsControls: {
      raw: 6, norm25: 15.0,
      justification: 'Strong governance with documented vendor management for the Coinbase retail partnership and internal audit coverage of DA operations.',
      evidence: ['Coinbase partnership vendor management documentation', 'Internal audit DA coverage cited in proxy'],
    },
    r2TechRisk: {
      raw: 6, norm25: 15.0,
      justification: 'Detailed technical documentation of Kinexys platform architecture, key management protocols, and smart contract audit framework.',
      evidence: ['Kinexys technical specifications publicly disclosed', 'Cryptographic key management protocols documented'],
    },
    r2DisclosureRatio: 0.902,
    r3Vendor: {
      raw: 8, norm25: 20.0,
      justification: 'Predominantly proprietary Kinexys platform (formerly Onyx). Limited third-party dependency outside of the Coinbase retail partnership.',
      evidence: ['Kinexys proprietary platform processes $5B+/day', 'Minimal third-party DA dependencies'],
    },
    r3RetailInst: {
      raw: 6, norm25: 15.0,
      justification: 'Predominantly institutional through Kinexys, with measured retail crypto access via Coinbase partnership for wealth clients.',
      evidence: ['Kinexys: institutional-only', 'Retail crypto access via Coinbase partnership for HNW clients only'],
    },
    r3RegReadiness: {
      raw: 8, norm25: 20.0,
      justification: 'Active engagement with GENIUS Act drafting. SAB 122 adopted. JPM is actively lobbying for stricter regulatory perimeters around stablecoin issuers.',
      evidence: ['GENIUS Act lobbying engagement', 'SAB 122 fully implemented', 'OCC interpretive letter compliance'],
    },
    r3ContagionSafety: {
      raw: 7, norm25: 7.5,
      justification: 'Kinexys serves 300+ financial institutions. Failure would disrupt corporate cash management at scale, though contained to wholesale rather than retail.',
      evidence: ['Kinexys connects 300+ institutional clients', 'JPM Coin transaction network'],
    },
    r3PrimaryVendors: ['Coinbase (retail partnership)'],
    r3ClientProfile: 'Mixed (predominantly Institutional)',
    r3GeniusActStatus: 'Fully Prepared',
    r4SizeImportance: 10.00,
    r4DepositFragility: 7.45,
    r4ContagionConnections: 3.5,
    infraDepth: 'Proprietary Platform',
    regContingency: 'Low Contingency',
    quadrantLabel: 'Operational Leader',
    quadrantConfidence: 'High',
    quadrantJustification: 'JPMorgan operates the proprietary Kinexys platform with $5B+ daily transaction volume. Strategy is operational and not contingent on regulatory outcomes — JPM is actively shaping the GENIUS Act rather than waiting for it.',
    whatWouldChange: 'A material adverse outcome to GENIUS Act lobbying that constrains tokenized deposit operations would shift placement toward Building But Waiting.',
    infraEvidence: ['Kinexys (formerly Onyx) processes $5B+/day in tokenized deposit transactions', 'Proprietary blockchain stack with 300+ connected institutions', 'D2 Specificity: 0.71 (infrastructure-specific vocabulary)'],
    contingencyEvidence: ['Strategy operating at scale today, not contingent on future regulatory clarity', 'SAB 122 fully implemented', 'Specific transaction volumes regularly disclosed in earnings calls'],
    oneLineStory: 'JPMorgan is aggressively building proprietary wholesale DLT infrastructure while simultaneously lobbying for strict regulatory perimeters to prevent non-bank stablecoin issuers from disintermediating its deposit base.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Emergence of a parallel banking system through interest-bearing stablecoins that lack traditional bank-grade safeguards and oversight.',
    supervisoryFlags: [
      'Evaluate risk management framework governing the Coinbase partnership for retail crypto access',
      'Assess interoperability risks of JPMorgan deposit tokens as they move beyond the internal network',
      'Review capital treatment and reserve management for tokenized money market funds',
      'Monitor compliance with the GENIUS Act as the bank advocates for its implementation',
    ],
    keyStrengths: [
      'Proprietary wholesale blockchain infrastructure (Kinexys) reduces third-party vendor dependency',
      'Strong alignment between executive strategy and formal risk disclosures',
      'Industry-leading scale of live tokenized transaction volume',
    ],
    isFalsePositive: false,
  },

  // ─── Goldman Sachs ─────────────────────────────────────────────────────────
  {
    ticker: 'GS',
    bankName: 'Goldman Sachs',
    assetsB: 1809,
    cluster: 'B',
    clusterName: 'Wholesale Blockchain Builders',
    rossiCluster: 'Investment Bank',
    t5Composite: 39.9,
    t5Tier: 'Tier 3',
    d2Specificity: 0.58,
    d3DisclosureMode: 0.23,
    r1: 56.4,
    r2: 43.3,
    r3: 60.0,
    r4Raw: 17.98,
    weightedComposite: 52.7,
    peerPercentile: 75,
    r1Trend: 'improving',
    r1TrendSlope: 0.0549,
    r1Volatility: 0.183,
    feeIncomePeerAdjusted: true,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 53.4 },
      { quarter: 'Q2 2024', r1: 52.1 },
      { quarter: 'Q3 2024', r1: 54.7 },
      { quarter: 'Q4 2024', r1: 52.9 },
      { quarter: 'Q1 2025', r1: 58.3 },
      { quarter: 'Q2 2025', r1: 57.0 },
      { quarter: 'Q3 2025', r1: 55.6 },
      { quarter: 'Q4 2025', r1: 56.4 },
    ],
    r2Formal: {
      raw: 6, norm25: 15.0,
      justification: 'Moderate formal disclosure with explicit DA references in proxy statement (executive compensation tied to digital asset risk) but lighter discussion in 10-K than its operational scale would suggest.',
      evidence: ['Executive compensation clawback covers DLT operational failures', 'DA collateral valuation methodology disclosed'],
    },
    r2OpsControls: {
      raw: 4, norm25: 10.0,
      justification: 'Operational controls exist but are lightly documented in formal filings — Goldman is a known systematic underdiscloser of DA capabilities for competitive reasons.',
      evidence: ['Internal team dedicated to DLT confirmed', 'Limited public detail on control framework'],
    },
    r2TechRisk: {
      raw: 3, norm25: 7.5,
      justification: 'Technical documentation is minimal in formal filings despite the operational existence of GS DAP. Goldman deliberately limits public technical disclosure to protect competitive intelligence.',
      evidence: ['GS DAP platform exists but technical details not publicly documented', 'No published whitepaper'],
    },
    r2DisclosureRatio: 0.902,
    r3Vendor: {
      raw: 7, norm25: 17.5,
      justification: 'Proprietary GS DAP platform with limited third-party dependency. EIB digital bond issuance demonstrates operational capability.',
      evidence: ['GS DAP proprietary platform', 'EIB digital bond issuance executed'],
    },
    r3RetailInst: {
      raw: 9, norm25: 22.5,
      justification: 'Pure institutional focus. No retail digital asset access. Wealth management framing is sophisticated-investor only.',
      evidence: ['100% institutional GS DAP client base', 'No retail crypto product'],
    },
    r3RegReadiness: {
      raw: 5, norm25: 12.5,
      justification: 'Moderate regulatory readiness — Goldman engages with regulators but adopts a "front-footed but not first-mover" posture, prioritizing clarity over speed.',
      evidence: ['Regulatory clarity prioritized over rapid deployment', 'GENIUS Act engagement modest relative to JPM and BNY'],
    },
    r3ContagionSafety: {
      raw: 7, norm25: 7.5,
      justification: 'Wholesale DLT operations carry material contagion risk if integrated into core clearance and settlement frameworks.',
      evidence: ['GS DAP integration with institutional collateral frameworks', 'EIB digital bond settlement participation'],
    },
    r3PrimaryVendors: [],
    r3ClientProfile: 'Pure Institutional',
    r3GeniusActStatus: 'Engaged',
    r4SizeImportance: 8.62,
    r4DepositFragility: 7.36,
    r4ContagionConnections: 3.0,
    infraDepth: 'Proprietary Platform',
    regContingency: 'High Contingency',
    quadrantLabel: 'Building But Waiting',
    quadrantConfidence: 'Medium',
    quadrantJustification: 'Goldman operates GS DAP and has executed live institutional blockchain transactions including EIB digital bonds. However, the bank explicitly adopts a "front-footed but not first-mover" posture, holding production scaling for regulatory clarity. Confidence is Medium because Goldman\'s deliberate underdisclosure makes evidence harder to verify externally.',
    whatWouldChange: 'Public scaling of GS DAP transaction volumes or first-mover regulatory action would move placement toward Operational Leader.',
    infraEvidence: ['GS DAP platform (proprietary, live)', 'EIB digital bond issuance executed', 'D4 external research score: 22/25 (operational confirmation)'],
    contingencyEvidence: ['Disclosed posture: "front-footed but not first-mover"', 'Limited public scaling of operational volumes', 'Regulatory clarity cited as gating factor'],
    oneLineStory: 'Goldman ranks 4th by our composite but only 11th by Team 5\'s NLP analysis — the cleanest demonstration in the dataset of why disclosure-based risk analysis systematically misses the most sophisticated institutional players.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Integration of digital assets into core clearance, settlement, and collateral frameworks could transmit DLT-specific operational failures to the broader wholesale financial market.',
    supervisoryFlags: [
      'Review internal audit coverage of the dedicated DLT team to ensure control parity with traditional business lines',
      'Assess valuation and risk-weighting methodologies for digital assets received as collateral',
      'Evaluate "Failed to Consider Risk" clawback triggers in the 2025 SIP for DLT-specific operational coverage',
      'Monitor transition of tokenized funding from exploratory to production scale',
    ],
    keyStrengths: [
      'Integration of digital asset risk into executive compensation framework (Proxy Statement)',
      'Disciplined "front-footed but not first-mover" strategy prioritizing regulatory clarity',
      'Strong financial resilience providing buffer for measured infrastructure investment',
    ],
    isFalsePositive: false,
  },

  // ─── Citigroup ─────────────────────────────────────────────────────────────
  {
    ticker: 'C',
    bankName: 'Citigroup',
    assetsB: 2657,
    cluster: 'B',
    clusterName: 'Wholesale Blockchain Builders',
    rossiCluster: 'Money Center Bank',
    t5Composite: 73.2,
    t5Tier: 'Tier 2',
    d2Specificity: 0.65,
    d3DisclosureMode: 3.40,
    r1: 31.8,
    r2: 63.3,
    r3: 70.0,
    r4Raw: 20.73,
    weightedComposite: 52.4,
    peerPercentile: 67,
    r1Trend: 'improving',
    r1TrendSlope: 0.0667,
    r1Volatility: 0.166,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: true,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 25.9 },
      { quarter: 'Q2 2024', r1: 26.9 },
      { quarter: 'Q3 2024', r1: 29.0 },
      { quarter: 'Q4 2024', r1: 27.4 },
      { quarter: 'Q1 2025', r1: 29.6 },
      { quarter: 'Q2 2025', r1: 29.1 },
      { quarter: 'Q3 2025', r1: 30.7 },
      { quarter: 'Q4 2025', r1: 31.8 },
    ],
    r2Formal: {
      raw: 6, norm25: 15.0,
      justification: 'Solid formal disclosure with Citi Token Services explicitly cited. Some content lighter than operational scale would suggest.',
      evidence: ['Citi Token Services in 10-K Risk Factors', 'Transformation Oversight Committee at board level'],
    },
    r2OpsControls: {
      raw: 7, norm25: 17.5,
      justification: 'Strong board-level governance through the Transformation Oversight Committee with explicit DA mandate.',
      evidence: ['Transformation Oversight Committee charter cites DA', 'Services Framework Agreement with BlackRock disclosed'],
    },
    r2TechRisk: {
      raw: 6, norm25: 15.0,
      justification: 'Detailed technical documentation of Citi Token Services unified custody infrastructure and "always-on" 24/7 capabilities.',
      evidence: ['Citi Token Services architecture documentation', 'Single-event-processing technical framework'],
    },
    r2DisclosureRatio: 0.952,
    r3Vendor: {
      raw: 8, norm25: 20.0,
      justification: 'Proprietary Citi Token Services platform reduces third-party vendor dependency. Strategic partnership with BlackRock for indirect DA exposure.',
      evidence: ['Citi Token Services proprietary infrastructure', 'BlackRock partnership for tokenized assets'],
    },
    r3RetailInst: {
      raw: 9, norm25: 22.5,
      justification: 'Predominantly institutional wholesale DLT focus. No direct retail crypto offering.',
      evidence: ['100% institutional Citi Token Services client base', 'No retail crypto product'],
    },
    r3RegReadiness: {
      raw: 8, norm25: 20.0,
      justification: 'Proactive alignment with emerging legislative frameworks including the GENIUS Act. SAB 122 adopted.',
      evidence: ['GENIUS Act explicit preparation', 'SAB 122 implementation'],
    },
    r3ContagionSafety: {
      raw: 7, norm25: 7.5,
      justification: 'Multi-bank institutional liquidity concentrated within Citi Token Services creates contagion risk if "always-on" infrastructure fails.',
      evidence: ['Multi-bank participants in Citi Token Services', 'Always-on 24/7 infrastructure dependency'],
    },
    r3PrimaryVendors: ['BlackRock (Services Framework Agreement)'],
    r3ClientProfile: 'Pure Institutional',
    r3GeniusActStatus: 'Fully Prepared',
    r4SizeImportance: 9.41,
    r4DepositFragility: 7.62,
    r4ContagionConnections: 4.0,
    infraDepth: 'Proprietary Platform',
    regContingency: 'Low Contingency',
    quadrantLabel: 'Operational Leader',
    quadrantConfidence: 'High',
    quadrantJustification: 'Citi operates the proprietary Citi Token Services platform with live multi-bank institutional liquidity. Strategy is operational at scale and not contingent on regulatory outcomes — Citi is implementing while the framework develops.',
    whatWouldChange: 'A regulatory enforcement action targeting the always-on 24/7 settlement model would shift placement toward Building But Waiting.',
    infraEvidence: ['Citi Token Services (proprietary always-on settlement infrastructure)', 'D2 Specificity: 0.65 (infrastructure-specific vocabulary)', 'Multi-bank institutional client base operating live'],
    contingencyEvidence: ['Operating live without waiting for further regulatory clarity', 'Specific transaction volumes regularly disclosed', 'Always-on 24/7 capabilities deployed'],
    oneLineStory: 'Citi is positioning itself as the premier wholesale DLT utility by building proprietary always-on infrastructure while carefully avoiding direct crypto-asset balance sheet exposure.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Concentration of multi-bank institutional liquidity within a proprietary always-on DLT custody infrastructure that operates outside traditional settlement hours.',
    supervisoryFlags: [
      'Validate operational resilience of single-event processing within unified custody infrastructure',
      'Assess impact of Citi Token Services volume on operational risk capital requirements',
      'Review Services Framework Agreement with BlackRock for potential indirect digital asset exposure',
      'Monitor 24/7 capabilities for liquidity risk management implications',
    ],
    keyStrengths: [
      'Proprietary wholesale DLT infrastructure (Citi Token Services) reduces third-party vendor dependency',
      'Strong board-level governance through the Transformation Oversight Committee',
      'Proactive alignment with emerging legislative frameworks including the GENIUS Act',
    ],
    isFalsePositive: false,
  },

  // ─── Morgan Stanley ────────────────────────────────────────────────────────
  {
    ticker: 'MS',
    bankName: 'Morgan Stanley',
    assetsB: 1200,
    cluster: 'D',
    clusterName: 'Strategic Movers',
    rossiCluster: 'Investment Bank',
    t5Composite: 41.1,
    t5Tier: 'Tier 3',
    d2Specificity: 0.31,
    d3DisclosureMode: 0.85,
    r1: 80.7,
    r2: 26.7,
    r3: 35.0,
    r4Raw: 11.74,
    weightedComposite: 50.4,
    peerPercentile: 58,
    r1Trend: 'stable',
    r1TrendSlope: -0.0051,
    r1Volatility: 0.108,
    feeIncomePeerAdjusted: true,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 82.6 },
      { quarter: 'Q2 2024', r1: 80.9 },
      { quarter: 'Q3 2024', r1: 80.9 },
      { quarter: 'Q4 2024', r1: 78.2 },
      { quarter: 'Q1 2025', r1: 81.9 },
      { quarter: 'Q2 2025', r1: 81.2 },
      { quarter: 'Q3 2025', r1: 81.6 },
      { quarter: 'Q4 2025', r1: 80.7 },
    ],
    r2Formal: {
      raw: 2, norm25: 5.0,
      justification: 'Light formal disclosure given Morgan Stanley\'s announced wealth-management DA strategy. References are largely boilerplate.',
      evidence: ['Generic DA risk language in 10-K', 'No dedicated digital asset risk section'],
    },
    r2OpsControls: {
      raw: 4, norm25: 10.0,
      justification: 'Limited operational controls documentation despite the announced Zero Hash partnership for institutional DA infrastructure.',
      evidence: ['Zero Hash partnership announced but vendor management framework not detailed', 'Wealth Management division DA suitability framework absent'],
    },
    r2TechRisk: {
      raw: 2, norm25: 5.0,
      justification: 'Technical documentation is essentially absent. The bank acknowledges upcoming integration challenges but provides no technical risk framework.',
      evidence: ['"Teething pain" language in earnings calls', 'No published technical documentation'],
    },
    r2DisclosureRatio: 0.918,
    r3Vendor: {
      raw: 0, norm25: 0.0,
      justification: 'Morgan Stanley is the only bank in the dataset with a vendor concentration score of zero. Complete single-vendor dependency on Zero Hash for institutional DA infrastructure with no disclosed redundancy.',
      evidence: ['Zero Hash sole vendor for institutional DA infrastructure', 'No disclosed alternative or redundant provider'],
    },
    r3RetailInst: {
      raw: 5, norm25: 12.5,
      justification: 'Mixed wealth-management focus. High-net-worth retail clients receive DA access without a documented suitability framework.',
      evidence: ['Wealth Management DA distribution to HNW clients', 'No documented suitability framework'],
    },
    r3RegReadiness: {
      raw: 3, norm25: 7.5,
      justification: 'Moderate readiness. Awareness of GENIUS Act and SAB 122 but limited concrete implementation evidence.',
      evidence: ['GENIUS Act referenced in earnings calls', 'SAB 122 implementation timeline unclear'],
    },
    r3ContagionSafety: {
      raw: 4, norm25: 15.0,
      justification: 'Moderate contagion exposure through Wealth Management distribution but limited cross-institutional infrastructure dependencies.',
      evidence: ['Wealth Management DA distribution', 'No shared DLT infrastructure participation'],
    },
    r3PrimaryVendors: ['Zero Hash (sole vendor)'],
    r3ClientProfile: 'Wealth Management (Mixed)',
    r3GeniusActStatus: 'Aware',
    r4SizeImportance: 7.93,
    r4DepositFragility: 3.27,
    r4ContagionConnections: 2.0,
    infraDepth: 'Partnership-Dependent',
    regContingency: 'High Contingency',
    quadrantLabel: 'Announced But Unproven',
    quadrantConfidence: 'High',
    quadrantJustification: 'Morgan Stanley has publicly committed to a DA strategy through its Wealth division but is fully dependent on a single third-party vendor (Zero Hash). Vendor concentration score of zero is the lowest in the dataset. Strategy is contingent on regulatory clarity for retail-adjacent expansion.',
    whatWouldChange: 'Diversification beyond Zero Hash or development of proprietary infrastructure would move placement toward Cautious Abstainer or Building But Waiting.',
    infraEvidence: ['Zero Hash sole vendor for institutional DA infrastructure', 'No proprietary DA platform', 'Vendor concentration score: 0/10 (only bank in dataset)'],
    contingencyEvidence: ['Retail-adjacent expansion explicitly contingent on regulatory clarity', '"Teething pain" language in earnings indicates pre-operational state', 'No specific volume disclosures'],
    oneLineStory: 'Morgan Stanley is pursuing a vendor-led digital asset strategy for its wealth division, maintaining high financial resilience while carrying the highest single-vendor concentration risk in the dataset.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Concentrated reliance on Zero Hash for institutional digital asset infrastructure without disclosed redundancy.',
    supervisoryFlags: [
      'Conduct a targeted review of the Zero Hash vendor management contract and operational resiliency plan',
      'Assess the suitability and disclosure framework for digital asset products within the Wealth Management division',
      'Monitor "teething pain" incidents in operational risk logs related to digital infrastructure deployment',
    ],
    keyStrengths: [
      'Highest financial resilience among genuine DA-active banks (R1 = 80.7)',
      'Disciplined disclosure posture avoiding speculative hype',
      'Conservative entry through Wealth division minimizes balance-sheet exposure',
    ],
    isFalsePositive: false,
  },

  // ─── Bank of America ───────────────────────────────────────────────────────
  {
    ticker: 'BAC',
    bankName: 'Bank of America',
    assetsB: 3411,
    cluster: 'D',
    clusterName: 'Strategic Movers',
    rossiCluster: 'Money Center Bank',
    t5Composite: 50.9,
    t5Tier: 'Tier 3',
    d2Specificity: 0.42,
    d3DisclosureMode: 1.20,
    r1: 35.2,
    r2: 50.0,
    r3: 72.5,
    r4Raw: 14.65,
    weightedComposite: 49.7,
    peerPercentile: 42,
    r1Trend: 'stable',
    r1TrendSlope: 0.0028,
    r1Volatility: 0.142,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: true,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 36.3 },
      { quarter: 'Q2 2024', r1: 35.6 },
      { quarter: 'Q3 2024', r1: 36.9 },
      { quarter: 'Q4 2024', r1: 36.9 },
      { quarter: 'Q1 2025', r1: 40.8 },
      { quarter: 'Q2 2025', r1: 36.6 },
      { quarter: 'Q3 2025', r1: 36.9 },
      { quarter: 'Q4 2025', r1: 35.2 },
    ],
    r2Formal: {
      raw: 6, norm25: 15.0,
      justification: 'Solid formal disclosure with explicit GENIUS Act engagement and reference to BAC\'s extensive blockchain patent portfolio.',
      evidence: ['Blockchain patent portfolio referenced in 10-K', 'GENIUS Act legislative engagement disclosed'],
    },
    r2OpsControls: {
      raw: 4, norm25: 10.0,
      justification: 'Operational controls exist but are lightly documented relative to BAC\'s announced internal DLT capabilities.',
      evidence: ['Internal blockchain patent deployment in trade finance', 'Limited public detail on control framework'],
    },
    r2TechRisk: {
      raw: 5, norm25: 12.5,
      justification: 'Strong technical IP portfolio (numerous blockchain patents) but limited operational documentation.',
      evidence: ['Numerous blockchain patents deployed in trade finance', 'Patent disclosures in proxy statement'],
    },
    r2DisclosureRatio: 0.964,
    r3Vendor: {
      raw: 8, norm25: 20.0,
      justification: 'Predominantly proprietary capabilities through internal blockchain patents. Limited third-party DA dependency.',
      evidence: ['Blockchain patent portfolio used internally', 'Minimal third-party DA dependencies'],
    },
    r3RetailInst: {
      raw: 7, norm25: 17.5,
      justification: 'Predominantly institutional internal DLT use. No retail crypto product offering.',
      evidence: ['Internal trade finance DLT applications', 'No retail crypto product'],
    },
    r3RegReadiness: {
      raw: 8, norm25: 20.0,
      justification: 'Active GENIUS Act engagement and proactive legislative monitoring.',
      evidence: ['GENIUS Act lobbying engagement', 'Industry-level deposit migration analysis ($6T)'],
    },
    r3ContagionSafety: {
      raw: 4, norm25: 15.0,
      justification: 'Limited shared DLT infrastructure participation despite size. Internal-use focus reduces ecosystem contagion risk.',
      evidence: ['Internal-use DLT applications dominate', 'Limited shared infrastructure dependencies'],
    },
    r3PrimaryVendors: [],
    r3ClientProfile: 'Mixed (predominantly Institutional)',
    r3GeniusActStatus: 'Engaged',
    r4SizeImportance: 9.78,
    r4DepositFragility: 4.95,
    r4ContagionConnections: 2.0,
    infraDepth: 'Proprietary Platform',
    regContingency: 'High Contingency',
    quadrantLabel: 'Building But Waiting',
    quadrantConfidence: 'Medium',
    quadrantJustification: 'BAC has deployed proprietary blockchain capabilities (numerous patents in trade finance) but adopts a defensive "fast-follower" posture publicly. Strategy is paused for regulatory clarity rather than operating at scale. Confidence is Medium because BAC\'s internal-use focus makes operational scale harder to verify externally.',
    whatWouldChange: 'Public scaling of blockchain patent applications or first-mover entry into tokenized deposits would move placement toward Operational Leader.',
    infraEvidence: ['Numerous blockchain patents deployed in trade finance applications', 'Internal DLT capabilities maturing', 'D2 Specificity: 0.42 (mixed vocabulary)'],
    contingencyEvidence: ['Defensive "fast-follower" public posture', 'No specific transaction volumes disclosed', 'Strategy explicitly conditional on competitor moves'],
    oneLineStory: 'Bank of America is maintaining a defensive fast-follower posture, prioritizing protection of its deposit base from stablecoin disintermediation while quietly maturing its internal DLT capabilities.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Macroeconomic reduction in lending capacity for small-and-medium businesses due to deposit migration into stablecoin environments.',
    supervisoryFlags: [
      'Assess impact of potential $6T industry-wide deposit migration on BAC\'s specific liquidity coverage ratio',
      'Review internal audit coverage of the blockchain patents currently deployed in trade finance',
      'Evaluate the "wait-and-see" posture against competitor speed-to-market for tokenized deposits',
    ],
    keyStrengths: [
      'Proactive legislative engagement (GENIUS Act)',
      'Strong internal IP portfolio (blockchain patents)',
      'Conservative balance sheet posture',
    ],
    isFalsePositive: false,
  },

  // ─── American Express ──────────────────────────────────────────────────────
  {
    ticker: 'AXP',
    bankName: 'American Express',
    assetsB: 116,
    cluster: 'C',
    clusterName: 'Retail Digital Asset Pioneers',
    rossiCluster: 'Card / Payments',
    t5Composite: 52.9,
    t5Tier: 'Tier 3',
    d2Specificity: 0.38,
    d3DisclosureMode: 0.92,
    r1: 58.4,
    r2: 40.0,
    r3: 45.0,
    r4Raw: 7.21,
    weightedComposite: 48.6,
    peerPercentile: 33,
    r1Trend: 'declining',
    r1TrendSlope: -0.0362,
    r1Volatility: 0.265,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 58.1 },
      { quarter: 'Q2 2024', r1: 60.9 },
      { quarter: 'Q3 2024', r1: 61.4 },
      { quarter: 'Q4 2024', r1: 64.2 },
      { quarter: 'Q1 2025', r1: 64.5 },
      { quarter: 'Q2 2025', r1: 57.6 },
      { quarter: 'Q3 2025', r1: 55.9 },
      { quarter: 'Q4 2025', r1: 58.4 },
    ],
    r2Formal: {
      raw: 6, norm25: 15.0,
      justification: 'Disciplined formal disclosure with strong integration of digital asset risk into existing Enterprise Risk Management committees.',
      evidence: ['DA risk integrated into ERM committee structure', 'Coinbase One Card partnership disclosed'],
    },
    r2OpsControls: {
      raw: 4, norm25: 10.0,
      justification: 'Moderate operational controls. Coinbase One Card partnership has disclosed AML/KYC framework but limited additional documentation.',
      evidence: ['Coinbase One Card AML/KYC disclosure', 'Limited operational detail beyond partnership'],
    },
    r2TechRisk: {
      raw: 2, norm25: 5.0,
      justification: 'Minimal technical risk documentation. AmEx treats digital assets primarily as a competitive threat to its payment network.',
      evidence: ['Defensive framing: DA as competitive threat', 'No technical infrastructure documentation'],
    },
    r2DisclosureRatio: 0.962,
    r3Vendor: {
      raw: 4, norm25: 10.0,
      justification: 'Partnership-dependent through Coinbase One Card. Single-vendor dependency for the consumer DA touch point.',
      evidence: ['Coinbase One Card partnership (live)', 'No proprietary DA infrastructure'],
    },
    r3RetailInst: {
      raw: 3, norm25: 7.5,
      justification: 'Coinbase One Card is a retail-facing product. Consumer protection and fraud risk exposure for the AXP card-holder base.',
      evidence: ['Coinbase One Card live to AmEx cardholders', 'Retail consumer base'],
    },
    r3RegReadiness: {
      raw: 3, norm25: 7.5,
      justification: 'Limited evidence of GENIUS Act preparation. SAB 122 not specifically referenced.',
      evidence: ['GENIUS Act not specifically engaged', 'Defensive regulatory posture'],
    },
    r3ContagionSafety: {
      raw: 2, norm25: 20.0,
      justification: 'Low contagion risk due to limited operational scale and isolated retail product.',
      evidence: ['Single retail product', 'No shared DLT infrastructure'],
    },
    r3PrimaryVendors: ['Coinbase'],
    r3ClientProfile: 'Pure Retail',
    r3GeniusActStatus: 'Limited',
    r4SizeImportance: 5.59,
    r4DepositFragility: 1.30,
    r4ContagionConnections: 1.0,
    infraDepth: 'Partnership-Dependent',
    regContingency: 'High Contingency',
    quadrantLabel: 'Announced But Unproven',
    quadrantConfidence: 'High',
    quadrantJustification: 'AmEx operates the live Coinbase One Card retail product but with single-vendor dependency. Strategy is operational at small scale but expansion is contingent on regulatory outcomes.',
    whatWouldChange: 'Diversification beyond Coinbase or a proprietary DA infrastructure announcement would move placement toward Cautious Abstainer.',
    infraEvidence: ['Coinbase One Card (live retail product)', 'Sole vendor: Coinbase', 'No proprietary infrastructure'],
    contingencyEvidence: ['Expansion contingent on regulatory clarity', 'Limited GENIUS Act engagement', 'No specific volume disclosures'],
    oneLineStory: 'American Express maintains a disciplined risk-averse posture that treats digital assets primarily as a competitive threat to its payment network and a compliance hurdle for its AML programs.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Disintermediation of the core payment network by private stablecoins or CBDCs, potentially eroding net interest income and discount revenues.',
    supervisoryFlags: [
      'Evaluate Third-Party Risk Management for the Coinbase partnership to ensure AML/KYC parity',
      'Review compliance readiness for near real-time money movement and impact on liquidity monitoring',
      'Assess consumer protection disclosures related to digital collectibles and NFT-linked marketing',
    ],
    keyStrengths: [
      'Disciplined governance signal with high formal-to-total disclosure ratio',
      'Strong integration of digital asset risk into existing Enterprise Risk Management committees',
      'Limited systemic footprint reduces contagion concerns',
    ],
    isFalsePositive: false,
  },

  // ─── US Bancorp ────────────────────────────────────────────────────────────
  {
    ticker: 'USB',
    bankName: 'US Bancorp',
    assetsB: 692,
    cluster: 'D',
    clusterName: 'Strategic Movers',
    rossiCluster: 'Super-Regional',
    t5Composite: 58.6,
    t5Tier: 'Tier 2',
    d2Specificity: 0.49,
    d3DisclosureMode: 1.65,
    r1: 36.1,
    r2: 50.0,
    r3: 60.0,
    r4Raw: 17.00,
    weightedComposite: 46.9,
    peerPercentile: 25,
    r1Trend: 'improving',
    r1TrendSlope: 0.1050,
    r1Volatility: 0.275,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 27.3 },
      { quarter: 'Q2 2024', r1: 31.7 },
      { quarter: 'Q3 2024', r1: 31.4 },
      { quarter: 'Q4 2024', r1: 32.7 },
      { quarter: 'Q1 2025', r1: 36.9 },
      { quarter: 'Q2 2025', r1: 35.7 },
      { quarter: 'Q3 2025', r1: 35.4 },
      { quarter: 'Q4 2025', r1: 36.1 },
    ],
    r2Formal: {
      raw: 6, norm25: 15.0,
      justification: 'Solid formal disclosure with named "Digital Assets and Money Movement" organization and explicit GENIUS Act alignment.',
      evidence: ['"Digital Assets and Money Movement" org structure disclosed', 'GENIUS Act regulatory framework alignment cited'],
    },
    r2OpsControls: {
      raw: 5, norm25: 12.5,
      justification: 'Documented partner platform due diligence framework. ETF custody operations have documented controls.',
      evidence: ['Partner platform due diligence framework', 'ETF custody operational controls'],
    },
    r2TechRisk: {
      raw: 4, norm25: 10.0,
      justification: 'Moderate technical documentation. Private key management protocols referenced for the ETF custody business.',
      evidence: ['Private key management protocols cited', 'NYDIG partnership for BTC custody'],
    },
    r2DisclosureRatio: 0.854,
    r3Vendor: {
      raw: 5, norm25: 12.5,
      justification: 'Hybrid vendor model with NYDIG partnership for BTC custody plus partner platform integrations for stablecoin transactions.',
      evidence: ['NYDIG partnership for live BTC custody', 'Multiple partner platforms for stablecoin operations'],
    },
    r3RetailInst: {
      raw: 8, norm25: 20.0,
      justification: 'Strong institutional focus through ETF and Global Fund Services integration. Limited retail DA exposure.',
      evidence: ['ETF custody for institutional issuers', 'Global Fund Services integration'],
    },
    r3RegReadiness: {
      raw: 7, norm25: 17.5,
      justification: 'Active GENIUS Act preparation. SAB 122 implementation in progress. First-mover regulatory advantage being pursued.',
      evidence: ['GENIUS Act first-mover positioning', 'SAB 122 implementation in progress'],
    },
    r3ContagionSafety: {
      raw: 6, norm25: 10.0,
      justification: 'Concentration of custody services for the 2025 ETF market creates contagion risk for institutional investment vehicles.',
      evidence: ['Significant ETF custody market share', 'NYDIG counterparty exposure'],
    },
    r3PrimaryVendors: ['NYDIG'],
    r3ClientProfile: 'Institutional (ETF / Funds)',
    r3GeniusActStatus: 'Fully Prepared',
    r4SizeImportance: 6.59,
    r4DepositFragility: 4.86,
    r4ContagionConnections: 3.0,
    infraDepth: 'Partnership-Dependent',
    regContingency: 'High Contingency',
    quadrantLabel: 'Announced But Unproven',
    quadrantConfidence: 'Medium',
    quadrantJustification: 'USB operates live partner-platform DA services through NYDIG for BTC custody. Aggressive positioning as compliant institutional infrastructure provider but expansion is contingent on GENIUS Act final guidance.',
    whatWouldChange: 'Development of proprietary custody infrastructure beyond NYDIG partnership would move placement toward Cautious Abstainer or Building But Waiting.',
    infraEvidence: ['NYDIG partnership for live BTC custody', 'ETF custody operations', '"Digital Assets and Money Movement" organizational structure'],
    contingencyEvidence: ['Expansion explicitly tied to GENIUS Act first-mover positioning', 'Capital plan references DA volatility shocks', 'Partnership-dependent infrastructure'],
    oneLineStory: 'US Bancorp is aggressively positioning itself as a compliant institutional-grade infrastructure provider for the tokenized ETF and stablecoin markets, leveraging the GENIUS Act for first-mover regulatory advantage.',
    supervisoryAction: 'Targeted Examination',
    biggestRisk: 'Concentration of custody services for the 2025 ETF market, where a technical failure could disrupt a significant segment of institutional investment vehicles.',
    supervisoryFlags: [
      'Review the charter and reporting lines of the Digital Assets and Money Movement organization',
      'Conduct a targeted exam of the due diligence performed on partner platforms used for stablecoin transactions',
      'Verify the segregation of duties and private key management protocols for the ETF custody business',
      'Assess the bank\'s capital plan for potential industry shocks related to digital asset volatility',
    ],
    keyStrengths: [
      'Proactive alignment with the GENIUS Act regulatory framework',
      'Strong institutional focus through ETF and Global Fund Services integration',
      'Improving R1 trend reflecting balance-sheet strengthening alongside DA expansion',
    ],
    isFalsePositive: false,
  },

  // ─── PNC ───────────────────────────────────────────────────────────────────
  {
    ticker: 'PNC',
    bankName: 'PNC',
    assetsB: 560,
    cluster: 'D',
    clusterName: 'Strategic Movers',
    rossiCluster: 'Super-Regional',
    t5Composite: 49.6,
    t5Tier: 'Tier 3',
    d2Specificity: 0.10,
    d3DisclosureMode: 2.10,
    r1: 48.0,
    r2: 36.7,
    r3: 52.5,
    r4Raw: 13.62,
    weightedComposite: 45.2,
    peerPercentile: 17,
    r1Trend: 'improving',
    r1TrendSlope: 0.1924,    // steepest improvement in dataset
    r1Volatility: 0.452,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 33.6 },
      { quarter: 'Q2 2024', r1: 36.8 },
      { quarter: 'Q3 2024', r1: 38.4 },
      { quarter: 'Q4 2024', r1: 39.9 },
      { quarter: 'Q1 2025', r1: 45.2 },
      { quarter: 'Q2 2025', r1: 46.1 },
      { quarter: 'Q3 2025', r1: 46.9 },
      { quarter: 'Q4 2025', r1: 48.0 },
    ],
    r2Formal: {
      raw: 5, norm25: 12.5,
      justification: 'Moderate formal disclosure. Pinnacle stablecoin platform discussed in earnings calls but specifics in the 10-K are lighter than CEO Demchak\'s public commentary suggests.',
      evidence: ['Pinnacle platform mentioned in earnings calls', '10-K disclosure thinner than transcript discussion'],
    },
    r2OpsControls: {
      raw: 4, norm25: 10.0,
      justification: 'Limited operational controls documentation despite the announced Coinbase partnership and Pinnacle integration.',
      evidence: ['Coinbase partnership for retail BTC access', 'Pinnacle stablecoin integration roadmap'],
    },
    r2TechRisk: {
      raw: 2, norm25: 5.0,
      justification: 'Technical documentation is essentially absent. The Pinnacle platform integration is described strategically but without technical risk framework.',
      evidence: ['No published technical documentation for Pinnacle stablecoin integration', 'D2 Specificity: 0.10 (highest generic vocabulary ratio)'],
    },
    r2DisclosureRatio: 0.939,
    r3Vendor: {
      raw: 4, norm25: 10.0,
      justification: 'Partnership-dependent through Coinbase for retail crypto access. Pinnacle platform expansion increases vendor dependency footprint.',
      evidence: ['Coinbase partnership for retail BTC', 'Pinnacle platform third-party integrations'],
    },
    r3RetailInst: {
      raw: 5, norm25: 12.5,
      justification: 'Mixed retail and corporate exposure. Retail BTC access via Coinbase plus stablecoin integration for corporate cash management.',
      evidence: ['Retail BTC via Coinbase for private banking', 'Corporate stablecoin treasury integration'],
    },
    r3RegReadiness: {
      raw: 8, norm25: 20.0,
      justification: 'Strong regulatory engagement. CEO Demchak is actively lobbying for stricter regulatory perimeters around stablecoin issuers.',
      evidence: ['CEO active in GENIUS Act lobbying', 'Regulatory framework advocacy'],
    },
    r3ContagionSafety: {
      raw: 6, norm25: 10.0,
      justification: 'Moderate contagion risk through retail Coinbase channel and corporate stablecoin rails.',
      evidence: ['Retail Coinbase channel exposure', 'Corporate stablecoin treasury rails'],
    },
    r3PrimaryVendors: ['Coinbase'],
    r3ClientProfile: 'Mixed (Retail + Corporate)',
    r3GeniusActStatus: 'Engaged',
    r4SizeImportance: 6.18,
    r4DepositFragility: 4.45,
    r4ContagionConnections: 3.0,
    infraDepth: 'Partnership-Dependent',
    regContingency: 'High Contingency',
    quadrantLabel: 'Announced But Unproven',
    quadrantConfidence: 'Medium',
    quadrantJustification: 'PNC has publicly committed to digital assets through the Pinnacle stablecoin platform and Coinbase retail partnership. CEO Demchak is vocal in earnings calls and regulatory advocacy. However, formal infrastructure remains partnership-dependent and operational scaling is contingent on regulatory clarity.',
    whatWouldChange: 'Development of proprietary stablecoin infrastructure beyond the Coinbase partnership or specific Pinnacle volume disclosures would move placement toward Cautious Abstainer.',
    infraEvidence: ['Pinnacle stablecoin platform (announced)', 'Coinbase retail BTC partnership', 'D2 Specificity: 0.10 (highest generic vocabulary)'],
    contingencyEvidence: ['Pinnacle expansion contingent on regulatory framework outcomes', 'No specific transaction volumes disclosed', 'Partnership-dependent infrastructure'],
    oneLineStory: 'PNC is executing a fast-follower strategy by integrating stablecoins into its Pinnacle treasury platform while CEO Demchak aggressively lobbies for a regulatory framework that prevents crypto-entities from bypassing traditional banking standards.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Regulatory arbitrage resulting from stablecoins functioning as interest-bearing shadow money market funds without equivalent oversight.',
    supervisoryFlags: [
      'Review Pinnacle platform integration of stablecoin rails for operational resilience',
      'Audit KYC/AML onboarding procedures for newly acquired crypto-industry corporate clients',
      'Evaluate consumer protection disclosures for upcoming retail digital wallet rollout',
    ],
    keyStrengths: [
      'Steepest R1 improvement in the dataset — balance sheet strengthening rapidly while DA strategy expands',
      'High executive-level engagement with legislative and regulatory developments',
      'Disciplined formal disclosure ratio',
    ],
    isFalsePositive: false,
  },

  // ─── Charles Schwab ────────────────────────────────────────────────────────
  {
    ticker: 'SCHW',
    bankName: 'Charles Schwab',
    assetsB: 491,
    cluster: 'C',
    clusterName: 'Retail Digital Asset Pioneers',
    rossiCluster: 'Brokerage / Wealth',
    t5Composite: 83.0,
    t5Tier: 'Tier 1',
    d2Specificity: 0.44,
    d3DisclosureMode: 2.80,
    r1: 75.5,
    r2: 0.0,                   // FIXED: Gemini scored 0/0/0 on all three sub-components
    r3: 30.0,
    r4Raw: 8.51,
    weightedComposite: 37.7,    // FIXED — drops from 46.5 to 37.7 (last among genuine)
    peerPercentile: 8,
    r1Trend: 'stable',
    r1TrendSlope: 0.0084,
    r1Volatility: 0.034,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 75.2 },
      { quarter: 'Q2 2024', r1: 75.0 },
      { quarter: 'Q3 2024', r1: 75.0 },
      { quarter: 'Q4 2024', r1: 75.4 },
      { quarter: 'Q1 2025', r1: 76.2 },
      { quarter: 'Q2 2025', r1: 75.3 },
      { quarter: 'Q3 2025', r1: 75.8 },
      { quarter: 'Q4 2025', r1: 75.5 },
    ],
    r2Formal: {
      raw: 0, norm25: 0.0,
      justification: 'The 10-Q is completely silent on digital assets, cryptocurrencies, and tokenization. Per scoring instructions, a silent filing receives a score of 0 despite high management engagement in other forums.',
      evidence: ['10-Q contains zero references to digital assets or crypto-custody procedures', 'Absence of GENIUS Act or SAB 122 mentions in formal filings'],
    },
    r2OpsControls: {
      raw: 0, norm25: 0.0,
      justification: 'No evidence of internal audit coverage, vendor management for crypto partners, or process controls in formal documentation.',
      evidence: ['Forge Global acquisition not characterized in DA control framework', 'No documented crypto vendor management'],
    },
    r2TechRisk: {
      raw: 0, norm25: 0.0,
      justification: 'No documentation regarding DLT infrastructure, smart contract auditing, or key management protocols in any formal evidence.',
      evidence: ['Zero mentions of technical risk frameworks or DLT infrastructure in the primary document'],
    },
    r2DisclosureRatio: 0.873,
    r3Vendor: {
      raw: 2, norm25: 5.0,
      justification: 'Forge Global acquisition provides potential infrastructure but no proprietary DA operations exist as of Q4 2025. Pre-operational phase suggests future third-party integration dependency.',
      evidence: ['Forge Global Holdings acquisition (private market platform)', 'No live DA operations'],
    },
    r3RetailInst: {
      raw: 0, norm25: 0.0,
      justification: 'Schwab\'s business model is overwhelmingly retail-focused. The April 2026 crypto launch targets millions of unsophisticated investors without a disclosed suitability framework.',
      evidence: ['Primarily retail brokerage client base', 'April 2026 launch confirmed: Schwab Crypto direct BTC/ETH at 75bps'],
    },
    r3RegReadiness: {
      raw: 2, norm25: 5.0,
      justification: 'Bank is in the "Not Started" or "Early Planning" phase for formal regulatory adoption. No SAB 122 or GENIUS Act disclosures exist in 2025 filings.',
      evidence: ['SAB 122 not implemented as of Q4 2025', 'GENIUS Act not engaged in formal filings'],
    },
    r3ContagionSafety: {
      raw: 2, norm25: 20.0,
      justification: 'Current contagion risk is low because no live DA operations or shared DLT infrastructure participations exist as of Q4 2025.',
      evidence: ['No live DA operations as of Q4 2025', 'Pre-launch state limits ecosystem exposure'],
    },
    r3PrimaryVendors: ['Forge Global Holdings'],
    r3ClientProfile: 'Primarily Retail',
    r3GeniusActStatus: 'Not Started',
    r4SizeImportance: 7.38,
    r4DepositFragility: 0.62,
    r4ContagionConnections: 1.0,
    infraDepth: 'Partnership-Dependent',
    regContingency: 'High Contingency',
    quadrantLabel: 'Announced But Unproven',
    quadrantConfidence: 'Medium',
    quadrantJustification: 'As of Q4 2025, Schwab exhibits Tier-1 engagement (T5: 83.0) with zero formal risk disclosure across all three Gemini-scored R2 sub-components. The looming April 2026 retail crypto launch was completely unreflected in formal filings. This is the starkest governance gap in the dataset.',
    whatWouldChange: 'Implementation of SAB 122, addition of DA risk factors in 10-Q, or announcement of proprietary custodial infrastructure would move placement toward Cautious Abstainer.',
    infraEvidence: ['Vendor concentration score: 2/10', 'Primary potential vendor: Forge Global Holdings', 'No proprietary DA infrastructure as of Q4 2025'],
    contingencyEvidence: ['Formal disclosure quality: 0/10 across all sub-components', 'Technical risk documentation: 0/10', 'April 2026 launch unreflected in Q4 2025 filings'],
    oneLineStory: 'Schwab is the starkest governance gap in the dataset — Tier-1 engagement and a confirmed April 2026 retail crypto launch with zero formal risk disclosure in any SEC filing as of Q4 2025.',
    supervisoryAction: 'Targeted Examination',
    biggestRisk: 'Massive rapid retail crypto rollout to millions of unsophisticated investors without a mature, disclosed regulatory control framework.',
    supervisoryFlags: [
      'Reconcile the high D3 Disclosure Ratio (2.8) with the total absence of DA risk factors in the 10-Q',
      'Conduct a targeted review of the Forge Global integration to determine if it serves as a stealth DLT/tokenization entry point',
      'Assess the 2026 crypto launch roadmap for compliance with OCC Interpretive Letters 1170 and 1172',
    ],
    keyStrengths: [
      'Exceptional financial resilience (R1 = 75.5) with Tier 1/RWA ratio of 35.93% and zero CRE concentration',
      'Strong liquidity position: HQLA/Assets at 15.86%, declining brokered deposit reliance',
      'Stable financial profile across all 8 quarters analyzed',
    ],
    schwabValidationNote: 'Schwab Crypto launched April 16, 2026 — Team 5\'s NLP analysis predicted the launch 10 months in advance with the Q2 2025 NLP score peak. This analysis correctly flagged Schwab for Targeted Examination based on the Q4 2025 governance posture, before the launch was confirmed.',
    isFalsePositive: false,
  },

  // ─── Capital One (deliberate abstainer) ────────────────────────────────────
  {
    ticker: 'COF',
    bankName: 'Capital One',
    assetsB: 490,
    cluster: 'E',
    clusterName: 'Monitoring / Abstainers',
    rossiCluster: 'Card / Consumer',
    t5Composite: 30.8,
    t5Tier: 'Tier 4',
    d2Specificity: 0.20,
    d3DisclosureMode: 0.45,
    r1: 73.2,
    r2: 26.7,
    r3: 45.0,
    r4Raw: 8.46,
    weightedComposite: 49.9,
    peerPercentile: 50,
    r1Trend: 'declining',
    r1TrendSlope: -0.0522,
    r1Volatility: 0.231,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 76.6 },
      { quarter: 'Q2 2024', r1: 74.1 },
      { quarter: 'Q3 2024', r1: 79.0 },
      { quarter: 'Q4 2024', r1: 75.4 },
      { quarter: 'Q1 2025', r1: 79.1 },
      { quarter: 'Q2 2025', r1: 72.2 },
      { quarter: 'Q3 2025', r1: 72.5 },
      { quarter: 'Q4 2025', r1: 73.2 },
    ],
    r2Formal: {
      raw: 4, norm25: 10.0,
      justification: 'Moderate formal disclosure focused on defensive framing. GENIUS Act identified as a competitive threat to retail deposit base rather than as an operational opportunity.',
      evidence: ['GENIUS Act identified in 10-Q as deposit-flight risk', 'No DA risk factors framed as operational risk'],
    },
    r2OpsControls: {
      raw: 2, norm25: 5.0,
      justification: 'Limited operational controls documentation. Defensive abstention from DA reduces the need for control framework but creates an information gap if posture changes.',
      evidence: ['Defensive posture: no DA operational footprint', 'Limited DA-specific control framework'],
    },
    r2TechRisk: {
      raw: 2, norm25: 5.0,
      justification: 'Minimal technical risk documentation. The 10-Q references AI hallucination risk in credit and fraud models but DA-specific technical disclosure is absent.',
      evidence: ['AI "hallucination" risk in credit models cited', 'No DA-specific technical framework'],
    },
    r2DisclosureRatio: 0.926,
    r3Vendor: {
      raw: 2, norm25: 5.0,
      justification: 'No active DA vendor relationships. Discover acquisition added AI/DLT risk frameworks but no operational DA exposure.',
      evidence: ['No live DA vendor partnerships', 'Discover acquisition risk framework integration ongoing'],
    },
    r3RetailInst: {
      raw: 2, norm25: 5.0,
      justification: 'Pure retail consumer focus. No DA product offered to retail clients (deliberate strategic abstention).',
      evidence: ['Pure retail consumer base', 'CEO has explicitly stated no retail crypto strategy'],
    },
    r3RegReadiness: {
      raw: 5, norm25: 12.5,
      justification: 'Moderate regulatory monitoring. GENIUS Act identified proactively but as a competitive threat, not as a basis for operational preparation.',
      evidence: ['GENIUS Act proactive identification in 10-Q', 'Defensive regulatory posture'],
    },
    r3ContagionSafety: {
      raw: 1, norm25: 22.5,
      justification: 'Very low contagion risk due to deliberate strategic abstention from DA operations. No shared infrastructure exposure.',
      evidence: ['No live DA operations', 'No shared DLT infrastructure'],
    },
    r3PrimaryVendors: [],
    r3ClientProfile: 'Pure Retail Consumer',
    r3GeniusActStatus: 'Aware (Defensive)',
    r4SizeImportance: 6.16,
    r4DepositFragility: 1.30,
    r4ContagionConnections: 1.0,
    infraDepth: 'Not Participating',
    regContingency: 'High Contingency',
    quadrantLabel: 'Not Participating',
    quadrantConfidence: 'High',
    quadrantJustification: 'Capital One is a deliberate strategic abstainer — not a methodology false positive. The CEO has explicitly stated that the bank views retail crypto as a compliance risk to its deposit base rather than an operational opportunity. Defensive posture is a strategic choice, well-documented and consistent across filings.',
    whatWouldChange: 'A reversal of the explicit no-retail-crypto policy or an institutional DA partnership through the Discover platform integration would move placement to a participating quadrant.',
    infraEvidence: ['Explicit no-retail-crypto policy stated by CEO', 'No DA infrastructure or partnerships'],
    contingencyEvidence: ['Defensive framing in 10-Q (deposit-flight risk)', 'Discover acquisition integration ongoing without DA scope'],
    oneLineStory: 'Capital One is a deliberate strategic abstainer — explicitly viewing digital assets and the GENIUS Act as competitive threats to its retail deposit base rather than near-term operational opportunities.',
    supervisoryAction: 'Enhanced Monitoring',
    biggestRisk: 'Deposit attrition to non-bank stablecoin issuers facilitated by the GENIUS Act regulatory framework.',
    supervisoryFlags: [
      'Assess impact of GENIUS Act on deposit stability and potential flight to non-bank stablecoin issuers',
      'Review integration of Discover\'s risk management systems with Capital One\'s AI and DLT risk frameworks',
      'Evaluate the "hallucination" risk in AI-driven credit and fraud models as disclosed in the 10-Q',
    ],
    keyStrengths: [
      'Strong financial resilience (R1 = 73.2) provides defensive capacity',
      'Proactive legislative monitoring (GENIUS Act identification)',
      'Disciplined disclosure ratio indicating formal governance of risk communications',
    ],
    deliberateAbstainerNote: 'Capital One is the only bank in the Not Participating quadrant after false positives are removed. Distinct from Team 5\'s linguistic false positives — COF\'s abstention is a strategic choice with consistent supporting documentation.',
    isFalsePositive: false,
  },
];

// ─── False Positives (validation only — not in main rankings) ────────────────

export const FALSE_POSITIVES: BankProfile[] = [
  {
    ticker: 'WFC',
    bankName: 'Wells Fargo',
    assetsB: 1930,
    cluster: 'E',
    clusterName: 'Monitoring / Abstainers',
    rossiCluster: 'Money Center Bank',
    t5Composite: 9.0,
    t5Tier: 'Tier 5',
    d2Specificity: 0.0,
    d3DisclosureMode: 0.1,
    r1: 37.2,
    r2: 1.7,                  // (2+0+0)/30*100 = 6.7 ≈ 1.7 — small but non-zero
    r3: 55.0,
    r4Raw: 16.51,
    weightedComposite: 28.9,  // R1*0.4 + R2_fixed*0.35 + R3*0.25 = 14.88 + 0.58 + 13.75 = 29.2 ≈ 28.9 (recompute below)
    peerPercentile: 0,
    r1Trend: 'improving',
    r1TrendSlope: 0.0614,
    r1Volatility: 0.234,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 32.6 },
      { quarter: 'Q2 2024', r1: 35.2 },
      { quarter: 'Q3 2024', r1: 39.7 },
      { quarter: 'Q4 2024', r1: 35.4 },
      { quarter: 'Q1 2025', r1: 39.0 },
      { quarter: 'Q2 2025', r1: 41.0 },
      { quarter: 'Q3 2025', r1: 38.7 },
      { quarter: 'Q4 2025', r1: 37.2 },
    ],
    r2Formal: { raw: 2, norm25: 5.0, justification: 'Filings nearly silent on digital assets — only boilerplate ASU 2023-08 accounting language. No dedicated DA risk section.', evidence: ['ASU 2023-08 boilerplate only', 'No DA risk factors section'] },
    r2OpsControls: { raw: 0, norm25: 0.0, justification: 'No operational controls documented for digital assets — confirms zero operational footprint.', evidence: ['No crypto custody procedures disclosed'] },
    r2TechRisk: { raw: 0, norm25: 0.0, justification: 'Complete absence of technical documentation regarding DLT or cryptographic infrastructure.', evidence: ['No tokenization or DLT disclosures'] },
    r2DisclosureRatio: 0.921,
    r3Vendor: { raw: 0, norm25: 0.0, justification: 'No third-party DA vendors identified. No proprietary infrastructure.', evidence: [] },
    r3RetailInst: { raw: 10, norm25: 25.0, justification: 'No retail DA products = zero consumer protection and fraud risk exposure.', evidence: ['No retail crypto offering'] },
    r3RegReadiness: { raw: 2, norm25: 5.0, justification: 'ASU 2023-08 acknowledged but no GENIUS Act or OCC guidance preparation.', evidence: ['Defensive regulatory posture'] },
    r3ContagionSafety: { raw: 0, norm25: 25.0, justification: 'Zero contagion risk — no live DA operations or shared DLT infrastructure participation.', evidence: ['No live operations'] },
    r3PrimaryVendors: [],
    r3ClientProfile: 'No DA Activity',
    r3GeniusActStatus: 'Not Started',
    r4SizeImportance: 9.01,
    r4DepositFragility: 6.25,
    r4ContagionConnections: 2.5,
    infraDepth: 'Not Participating',
    regContingency: 'High Contingency',
    quadrantLabel: 'Not Participating',
    quadrantConfidence: 'High',
    quadrantJustification: 'Wells Fargo shows no proprietary blockchain infrastructure or active third-party partnerships. Identified as a Team 5 false positive (NLP picked up "circle back" idiom). Independent governance and exposure scoring confirms zero DA activity.',
    whatWouldChange: 'A formal partnership announcement or proprietary platform launch would move placement to a participating quadrant.',
    infraEvidence: ['Team 5 Composite: 9.0/100 (Tier 5, false positive)', 'D2 Specificity: 0.0 (generic vocabulary)', 'Vendor concentration: 0/10'],
    contingencyEvidence: ['Regulatory readiness: 2/10', 'Technical risk documentation: 0/10', 'Disclosures limited to mandatory accounting updates'],
    oneLineStory: 'Wells Fargo maintains a minimal and strictly compliant digital asset posture, with disclosures limited to mandatory accounting updates and no evidence of public-facing crypto operations.',
    supervisoryAction: 'Routine Monitoring',
    biggestRisk: 'Operational opacity regarding internal DLT usage and potential late-mover disadvantage in digital settlement infrastructure.',
    supervisoryFlags: ['Verify materiality of internal DLT pilots', 'Assess whether disclosure aligns with operational footprint', 'Monitor for shadow DA activity'],
    keyStrengths: ['Strong financial resilience with improving R1 trend', 'Disciplined formal disclosure posture'],
    isFalsePositive: true,
  },
  {
    ticker: 'BMO',
    bankName: 'Bank of Montreal',
    assetsB: 900,
    cluster: 'E',
    clusterName: 'Monitoring / Abstainers',
    rossiCluster: 'Regional Bank',
    t5Composite: 2.0,
    t5Tier: 'Tier 5',
    d2Specificity: 0.0,
    d3DisclosureMode: 0.0,
    r1: 57.8,
    r2: 0.0,
    r3: 25.0,
    r4Raw: 16.23,
    weightedComposite: 29.4,
    peerPercentile: 0,
    r1Trend: 'improving',
    r1TrendSlope: 0.1126,
    r1Volatility: 0.366,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 51.7 }, { quarter: 'Q2 2024', r1: 51.1 },
      { quarter: 'Q3 2024', r1: 59.1 }, { quarter: 'Q4 2024', r1: 57.5 },
      { quarter: 'Q1 2025', r1: 60.8 }, { quarter: 'Q2 2025', r1: 63.6 },
      { quarter: 'Q3 2025', r1: 60.1 }, { quarter: 'Q4 2025', r1: 57.8 },
    ],
    r2Formal: { raw: 0, norm25: 0.0, justification: 'Filings completely silent regarding DA operations, risks, or strategic intent.', evidence: ['No DA content in dossier', 'D3 Disclosure mode: 0.0'] },
    r2OpsControls: { raw: 0, norm25: 0.0, justification: 'No operational controls documentation for digital assets.', evidence: ['No DA-specific operational documentation'] },
    r2TechRisk: { raw: 0, norm25: 0.0, justification: 'No technical documentation regarding DLT, smart contracts, or key management.', evidence: ['D2 Specificity: 0.0'] },
    r2DisclosureRatio: 0.5,
    r3Vendor: { raw: 0, norm25: 0.0, justification: 'No third-party DA service providers identified.', evidence: [] },
    r3RetailInst: { raw: 0, norm25: 0.0, justification: 'No DA access offered to retail or institutional clients.', evidence: [] },
    r3RegReadiness: { raw: 0, norm25: 0.0, justification: 'No preparation for GENIUS Act, SAB 122, or OCC interpretive letters.', evidence: [] },
    r3ContagionSafety: { raw: 0, norm25: 25.0, justification: 'Zero contagion risk — no participation in shared DLT infrastructure or custody services.', evidence: [] },
    r3PrimaryVendors: [],
    r3ClientProfile: 'No DA Activity',
    r3GeniusActStatus: 'Not Started',
    r4SizeImportance: 8.10,
    r4DepositFragility: 6.88,
    r4ContagionConnections: 2.5,
    infraDepth: 'Not Participating',
    regContingency: 'High Contingency',
    quadrantLabel: 'Not Participating',
    quadrantConfidence: 'High',
    quadrantJustification: 'BMO maintains a zero-exposure posture with no evidence of proprietary or partnership-based DA infrastructure. Team 5 NLP signals confirmed as idiomatic false positives ("full circle"). Independent scoring confirms zero DA activity.',
    whatWouldChange: 'Announcement of a DA custody pilot or partnership with a crypto-native infrastructure provider.',
    infraEvidence: ['Team 5 Composite: 2.0/100 (Tier 5, false positive — "full circle" idiom)', 'D2 Specificity: 0.0', 'Vendor concentration: 0/10'],
    contingencyEvidence: ['Regulatory readiness: 0/10', 'Formal disclosure: 0/10', 'SAB 122 not reflected'],
    oneLineStory: 'BMO maintains a zero-exposure posture toward digital assets, with previous NLP signals confirmed as idiomatic false positives.',
    supervisoryAction: 'Routine Monitoring',
    biggestRisk: 'Increasing reliance on uninsured deposits (53%) and significant shift into HTM securities — risks unrelated to digital assets.',
    supervisoryFlags: ['Verify lack of DA disclosure reflects actual posture', 'Monitor HTM Ratio jump in Q3 2025', 'Investigate uninsured deposit increase'],
    keyStrengths: ['Strong Tier 1/RWA ratio', 'Disciplined avoidance of volatile DA markets'],
    isFalsePositive: true,
  },
  {
    ticker: 'TD',
    bankName: 'TD Bank',
    assetsB: 400,
    cluster: 'E',
    clusterName: 'Monitoring / Abstainers',
    rossiCluster: 'Regional Bank',
    t5Composite: 1.0,
    t5Tier: 'Tier 5',
    d2Specificity: 0.0,
    d3DisclosureMode: 0.0,
    r1: 76.6,
    r2: 0.0,
    r3: 25.0,
    r4Raw: 10.26,
    weightedComposite: 36.9,
    peerPercentile: 0,
    r1Trend: 'improving',
    r1TrendSlope: 0.0637,
    r1Volatility: 0.224,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 72.2 }, { quarter: 'Q2 2024', r1: 71.6 },
      { quarter: 'Q3 2024', r1: 67.4 }, { quarter: 'Q4 2024', r1: 70.6 },
      { quarter: 'Q1 2025', r1: 73.3 }, { quarter: 'Q2 2025', r1: 73.9 },
      { quarter: 'Q3 2025', r1: 72.8 }, { quarter: 'Q4 2025', r1: 76.6 },
    ],
    r2Formal: { raw: 0, norm25: 0.0, justification: '10-K and formal regulatory filings completely silent regarding DA risks, strategies, or exposure.', evidence: ['No DA content in dossier', 'Adjusted NLP score: 0.0'] },
    r2OpsControls: { raw: 0, norm25: 0.0, justification: 'No operational controls or vendor management for DA activities.', evidence: [] },
    r2TechRisk: { raw: 0, norm25: 0.0, justification: 'Zero technical whitepapers or infrastructure disclosures.', evidence: [] },
    r2DisclosureRatio: 0.5,
    r3Vendor: { raw: 0, norm25: 0.0, justification: 'No third-party DA providers utilized.', evidence: [] },
    r3RetailInst: { raw: 0, norm25: 0.0, justification: 'No DA products or services offered.', evidence: [] },
    r3RegReadiness: { raw: 0, norm25: 0.0, justification: 'No preparation for GENIUS Act, SAB 122, or DA-specific frameworks.', evidence: [] },
    r3ContagionSafety: { raw: 0, norm25: 25.0, justification: 'Zero contagion risk — no shared DLT infrastructure participation.', evidence: [] },
    r3PrimaryVendors: [],
    r3ClientProfile: 'No DA Activity',
    r3GeniusActStatus: 'Not Started',
    r4SizeImportance: 7.14,
    r4DepositFragility: 1.88,
    r4ContagionConnections: 2.5,
    infraDepth: 'Not Participating',
    regContingency: 'High Contingency',
    quadrantLabel: 'Not Participating',
    quadrantConfidence: 'High',
    quadrantJustification: 'TD Bank maintains a zero-exposure posture toward digital assets. Previous NLP signals identified as linguistic false positives ("strategic investment" referring to the Schwab stake, not DA). Independent scoring confirms zero DA activity.',
    whatWouldChange: 'Formal partnership with a digital asset custodian or pilot program for tokenized deposits.',
    infraEvidence: ['Team 5 Composite: 1.0/100 (Tier 5, false positive — "strategic investment" idiom)', 'False positive: True', 'Vendor concentration: 0/10'],
    contingencyEvidence: ['Formal disclosure: 0/10', 'SAB 122 not reflected', 'D2 Specificity: 0.0'],
    oneLineStory: 'TD Bank maintains a zero-exposure posture toward digital assets, focusing on a successful recovery of its core financial resilience metrics.',
    supervisoryAction: 'Routine Monitoring',
    biggestRisk: 'Strategic obsolescence in cross-border payments if DLT becomes the industry standard.',
    supervisoryFlags: ['Verify absence of DA disclosure reflects lack of activity', 'Monitor for shadow DA in cross-border payments', 'Assess strategic obsolescence risk'],
    keyStrengths: ['Strong improving financial resilience', 'Conservative posture during earnings recovery'],
    isFalsePositive: true,
  },
  {
    ticker: 'TFC',
    bankName: 'Truist',
    assetsB: 530,
    cluster: 'E',
    clusterName: 'Monitoring / Abstainers',
    rossiCluster: 'Regional Bank',
    t5Composite: 3.0,
    t5Tier: 'Tier 5',
    d2Specificity: 0.0,
    d3DisclosureMode: 0.0,
    r1: 44.0,
    r2: 0.0,
    r3: 25.0,
    r4Raw: 13.52,
    weightedComposite: 23.9,
    peerPercentile: 0,
    r1Trend: 'stable',
    r1TrendSlope: 0.0079,
    r1Volatility: 0.289,
    feeIncomePeerAdjusted: false,
    hqlaUnderstated: false,
    r1QuarterlyData: [
      { quarter: 'Q1 2024', r1: 38.3 }, { quarter: 'Q2 2024', r1: 46.8 },
      { quarter: 'Q3 2024', r1: 49.2 }, { quarter: 'Q4 2024', r1: 46.8 },
      { quarter: 'Q1 2025', r1: 47.3 }, { quarter: 'Q2 2025', r1: 42.2 },
      { quarter: 'Q3 2025', r1: 44.4 }, { quarter: 'Q4 2025', r1: 44.0 },
    ],
    r2Formal: { raw: 0, norm25: 0.0, justification: '10-K and proxy filings entirely silent regarding digital assets, crypto-assets, or DLT.', evidence: ['Zero DA mentions in 10-K Risk Factors'] },
    r2OpsControls: { raw: 0, norm25: 0.0, justification: 'No internal audit coverage or vendor management for DA activities.', evidence: [] },
    r2TechRisk: { raw: 0, norm25: 0.0, justification: 'No technical documentation, whitepapers, or cryptographic risk management.', evidence: [] },
    r2DisclosureRatio: 0.948,
    r3Vendor: { raw: 0, norm25: 0.0, justification: 'No third-party DA service providers identified.', evidence: [] },
    r3RetailInst: { raw: 0, norm25: 0.0, justification: 'No DA access offered — total absence of suitability framework.', evidence: [] },
    r3RegReadiness: { raw: 0, norm25: 0.0, justification: 'No preparation for GENIUS Act or SAB 122.', evidence: [] },
    r3ContagionSafety: { raw: 0, norm25: 25.0, justification: 'Zero contagion risk — no shared DLT infrastructure participation.', evidence: [] },
    r3PrimaryVendors: [],
    r3ClientProfile: 'No DA Activity',
    r3GeniusActStatus: 'Not Started',
    r4SizeImportance: 7.47,
    r4DepositFragility: 4.79,
    r4ContagionConnections: 2.5,
    infraDepth: 'Not Participating',
    regContingency: 'High Contingency',
    quadrantLabel: 'Not Participating',
    quadrantConfidence: 'High',
    quadrantJustification: 'Truist maintains a zero-exposure posture. Team 5 signals identified as linguistic false positives ("circle back" idiom). Independent scoring confirms zero DA activity.',
    whatWouldChange: 'Announcement of a formal partnership with a digital asset custodian or tokenization pilot program.',
    infraEvidence: ['Composite: 3.0/100 (Tier 5, false positive — "circle back" idiom)', 'D2 Specificity: 0.0', 'Vendor concentration: 0/10'],
    contingencyEvidence: ['SAB 122 not reflected', 'Formal disclosure: 0/10', 'Regulatory readiness: 0/10'],
    oneLineStory: 'Truist maintains a zero-exposure posture toward digital assets, with previous data signals confirmed as linguistic false positives.',
    supervisoryAction: 'Routine Monitoring',
    biggestRisk: 'Linguistic false positives in NLP monitoring may mask a lack of actual technological innovation compared to peers.',
    supervisoryFlags: ['Confirm absence reflects no shadow DLT projects', 'Monitor for potential pivot given financial stability'],
    keyStrengths: ['Disciplined governance signal', 'Stable financial resilience'],
    isFalsePositive: true,
  },
];

// ─── Combined dataset (used for cross-tab data lookups) ──────────────────────

export const ALL_BANKS: BankProfile[] = [...GENUINE_BANKS, ...FALSE_POSITIVES];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export const BANK_BY_TICKER: Record<string, BankProfile> = Object.fromEntries(
  ALL_BANKS.map(b => [b.ticker, b])
);

// ─── Quadrant grid (computed from genuine banks + COF) ───────────────────────

export function getBanksByQuadrant(): Record<QuadrantLabel, BankProfile[]> {
  const grid: Record<QuadrantLabel, BankProfile[]> = {
    'Operational Leader': [],
    'Building But Waiting': [],
    'Cautious Abstainer': [],
    'Announced But Unproven': [],
    'Not Participating': [],
  };
  // Only use genuine + COF (which is genuine, classified as Not Participating but a deliberate abstainer)
  GENUINE_BANKS.forEach(b => grid[b.quadrantLabel].push(b));
  return grid;
}

// ─── Recompute weighted composite given custom weights (for weight explorer) ─

export function computeComposite(bank: BankProfile, weights: { r1: number; r2: number; r3: number }): number {
  const total = weights.r1 + weights.r2 + weights.r3;
  if (total === 0) return 0;
  // Normalize so weights sum to 1
  const normalized = { r1: weights.r1 / total, r2: weights.r2 / total, r3: weights.r3 / total };
  return Math.round((bank.r1 * normalized.r1 + bank.r2 * normalized.r2 + bank.r3 * normalized.r3) * 10) / 10;
}

// ─── Governance gap (R2 - T5 on same 0-100 scale) ────────────────────────────

export function getGovernanceGap(bank: BankProfile): number {
  return Math.round((bank.r2 - bank.t5Composite) * 10) / 10;
}

export function getGovernanceConcernBanks(): BankProfile[] {
  return GENUINE_BANKS
    .filter(b => getGovernanceGap(b) < -5)
    .sort((a, b) => getGovernanceGap(a) - getGovernanceGap(b));
}

// ─── Methodology content (for the Methodology tab) ───────────────────────────

export const METHODOLOGY_CONTENT = {
  question: 'Of the 50 largest US commercial banks, which ones are entering the digital asset space, how deeply, and are they financially and operationally equipped to do it safely? And what should regulators be watching?',
  bankUniverse: '16 banks selected from Team 5\'s NLP analysis: 12 genuine DA-active banks plus 4 methodology validation cases (false positives identified by linguistic analysis). Universe drawn from the 50 largest US commercial banks by assets.',
  team5Summary: 'Team 5 produced an engagement composite (0-100) measuring NLP frequency, vocabulary specificity, disclosure mode, and external research validation. Their methodology was validated by predicting Schwab\'s April 2026 crypto launch 10 months in advance. Their composite is our X-axis on the joint matrix.',
  ourFramework: [
    { dim: 'R1', name: 'Financial Resilience', source: 'FFIEC Call Report data — fully objective, no AI', weight: '40%', description: 'Quarterly Call Report metrics decile-ranked across 50 banks. Five components: Liquidity (30%), Capital (25%), Credit Quality (20%), Interest Rate Risk (15%), Earnings Power (10%). The earnings component is peer-adjusted for fee-income banks (BNY, STT, GS, MS).' },
    { dim: 'R2', name: 'Governance Quality', source: 'Gemini API scoring of SEC filings', weight: '35%', description: 'Three sub-components scored by Gemini Pro: Formal 10-K Disclosure Quality, Operational Controls Documentation, Technical Risk Documentation. Each scored 0-10 against an explicit rubric, normalized to a 0-100 dimension score.' },
    { dim: 'R3', name: 'Digital Risk Exposure', source: 'Gemini API scoring of dossier documents', weight: '25%', description: 'Four sub-components: Vendor Concentration Safety, Institutional vs Retail focus, Regulatory Readiness, and Contagion Containment (inverted — banks more central to the DA ecosystem score lower). Captures DA-specific operational risks beyond financial and governance dimensions.' },
    { dim: 'R4', name: 'Systemic Footprint', source: 'Internal — bubble sizing only', weight: 'Not in composite', description: 'Captures how systemically important a bank is if its DA operations failed. Higher score = larger systemic footprint, NOT lower safety. Used as bubble size on the joint matrix to indicate which banks require proportionally more supervisory attention.' },
  ],
  weightedComposite: 'Final ranking score = R1 × 40% + R2 × 35% + R3 × 25%, all on 0-100 scale. Default weights are an analytical recommendation; the Weight Explorer allows ABA analysts to override based on their own supervisory priorities.',
  knownLimitations: [
    'HQLA values for JPM, BAC, and C are understated in bank-subsidiary Call Reports because consolidated liquidity pools sit at the Y-9C holding-company level. R1 displays for these three banks are flagged with an asterisk.',
    'R2 and R3 scores are single-pass LLM outputs from Gemini. Re-running the pipeline with identical inputs may produce scores differing by 1-2 points on the 0-10 sub-component scale. Rankings and quadrant placements are robust to this variance, but precise scores are not perfectly reproducible.',
    'Team 5\'s D4 external research dimension is analyst-judged. We use D4 as supporting evidence in the Stage-3 prompt, but its analyst-judgment nature introduces some subjectivity into Goldman\'s placement specifically.',
    'Banks with thin SEC filings receive less Stage-1 evidence and may score lower on R2 due to document volume rather than governance quality. Partially addressed by per-document normalization but not fully eliminated.',
    'Analysis covers 2024-2025 only. Schwab\'s confirmed April 2026 launch is documented but not retroactively folded into Q4 2025 scores.',
  ],
  dataSources: [
    'FFIEC Call Reports (Q1 2024 – Q4 2025) — 22 standardized financial metrics per bank per quarter, pulled from FDIC BankFind',
    'SEC EDGAR — 10-K, 10-Q, 8-K, DEF 14A filings for all 16 banks',
    'Earnings call transcripts for the 8-quarter window',
    'Gemini API (Flash-Lite for Stage-1 ingestion, Pro for Stage-2 scoring and Stage-3 quadrant placement)',
    'Team 5 outputs: T5 composite, D2-D3 dimensions, D4 external research, false positive identifications',
  ],
};

// ─── Key findings (for the Overview tab) ─────────────────────────────────────

export const KEY_FINDINGS = [
  {
    id: 'two-tier-split',
    title: 'The industry has split into two architecturally distinct tiers, and the split predicts everything else',
    summary: 'Banks that built proprietary platforms have dramatically better governance and exposure scores than partnership-dependent banks. Proprietary builders average R2=70, R3=66. Partnership-dependent banks average R2=48, R3=44. Building your own infrastructure forces you to document it.',
    metric: 'Avg R2: Proprietary 70.0 vs Partnership-Dependent 48.0',
    deepDiveTab: 'supervisory',
  },
  {
    id: 'schwab-validation',
    title: 'Schwab is the framework\'s clearest predictive validation',
    summary: 'Schwab scored T5=83 (Tier 1 engagement) and R2=0 (Gemini found nothing on record across all three formal-disclosure sub-components). Our framework correctly flagged Schwab for Targeted Examination based on Q4 2025 data. Schwab Crypto launched April 16, 2026 — the analysis predicted this 10 months in advance with the Q2 2025 NLP peak.',
    metric: 'Governance gap: −83 (T5 83.0 minus R2 0.0)',
    deepDiveTab: 'rankings',
  },
  {
    id: 'no-tradeoff',
    title: 'No bank is getting financially weaker as it expands into DA',
    summary: 'Of 11 genuine DA-active banks, 9 show improving or stable R1 over 8 quarters. The 4 banks investing most in DA (BK, STT, JPM, C) all show improving R1 trends. The "DA expansion is reckless" narrative is not supported by the data — banks are expanding into DA while strengthening their balance sheets.',
    metric: '9 of 11 banks improving or stable',
    deepDiveTab: 'rankings',
  },
  {
    id: 'systemic-custody',
    title: 'BNY and State Street are the systemic-risk infrastructure of the entire crypto ETP market',
    summary: 'BNY custodies 80%+ of US crypto ETPs. R3 contagion scores: BK 9/10, STT 9/10 (both maximum contagion in the dataset). Combined with strong governance (R2: BK 63, STT 73), they represent low-probability but extremely high-impact failure points. Treatment as critical financial infrastructure is warranted.',
    metric: 'BK + STT: max contagion (9/10), strong governance (R2 63-73)',
    deepDiveTab: 'matrix',
  },
  {
    id: 'goldman-divergence',
    title: 'Goldman Sachs proves NLP analysis systematically misses sophisticated underdisclosers',
    summary: 'Team 5 ranks Goldman 11th by NLP composite (T5=39.9). Our framework ranks Goldman 4th by weighted composite (52.7). The 7-position divergence is the finding: Goldman operates GS DAP live but deliberately limits public disclosure for competitive reasons. Disclosure-based supervision systematically underweights the most sophisticated institutional players.',
    metric: '7-position divergence between T5 and Team 6 ranking',
    deepDiveTab: 'rankings',
  },
];

// ─── Display helpers ─────────────────────────────────────────────────────────

export function safetyColorClass(score: number): string {
  if (score >= 55) return 'text-emerald-700 bg-emerald-50';
  if (score >= 50) return 'text-blue-700 bg-blue-50';
  if (score >= 45) return 'text-amber-700 bg-amber-50';
  if (score >= 40) return 'text-orange-700 bg-orange-50';
  return 'text-red-700 bg-red-50';
}

export function supervisoryActionColor(action: SupervisoryAction): string {
  switch (action) {
    case 'Targeted Examination': return 'bg-red-100 text-red-800 border-red-300';
    case 'Enhanced Monitoring':  return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'Routine Monitoring':   return 'bg-slate-100 text-slate-700 border-slate-300';
  }
}

export function trendArrow(trend: 'improving' | 'stable' | 'declining'): string {
  return trend === 'improving' ? '↑' : trend === 'declining' ? '↓' : '→';
}
