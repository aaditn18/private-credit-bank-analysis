// Team 6 — Digital Asset Risk Analysis data
// Source: BUFN403 Capstone, Spring 2026 · Vedanta Gawande (Team Lead)
// Raw JSONs preserved in digital-assets/risk-data/

export type QuadrantLabel =
  | 'Operational Leader'
  | 'Building But Waiting'
  | 'Cautious Abstainer'
  | 'Announced But Unproven'
  | 'Not Participating';

export const QUADRANT_COLOR: Record<QuadrantLabel, string> = {
  'Operational Leader':   '#3DBE7A',
  'Building But Waiting': '#F59C55',
  'Cautious Abstainer':   '#4A90D9',
  'Announced But Unproven': '#E85D5D',
  'Not Participating':    '#8EA3B8',
};

export interface RiskBank {
  ticker: string;
  bankName: string;
  clusterLabel: string;
  clusterColor: string;
  isFalsePositive: boolean;
  // Joint matrix axes
  xEngagement: number;   // T5 composite 0-100
  ySafety: number;       // R1+R2+R3 composite 0-75
  bubbleSizeR4: number;  // systemic footprint 0-25 (bubble area, NOT added to safety)
  // Dimension scores
  r1: number; r2: number; r3: number; r4: number;
  safetyPctAmongGenuine: number;
  // Narrative
  oneLineStory: string;
  supervisoryAction: 'Enhanced Monitoring' | 'Targeted Examination' | 'Routine Monitoring';
  pncPattern: boolean;
  goldmanPattern: boolean;
  quadrantLabel: QuadrantLabel;
}

export const RISK_BANKS: RiskBank[] = [
  { ticker:'BK',   bankName:'BNY Mellon',       clusterLabel:'A — Custodial Infrastructure Leaders', clusterColor:'#4A90D9', isFalsePositive:false, xEngagement:85.4, ySafety:46.0, bubbleSizeR4:19.38, r1:11.65, r2:18.12, r3:16.25, r4:19.38, safetyPctAmongGenuine:100, oneLineStory:"BNY Mellon is positioning itself as the systemic 'trusted infrastructure' layer for institutional digital assets, balancing aggressive stablecoin reserve growth with disciplined regulatory alignment.", supervisoryAction:'Enhanced Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Operational Leader' },
  { ticker:'SCHW', bankName:'Charles Schwab',    clusterLabel:'C — Retail Digital Asset Pioneers',   clusterColor:'#B39DFA', isFalsePositive:false, xEngagement:83.0, ySafety:32.6, bubbleSizeR4:8.51,  r1:18.88, r2:6.25,  r3:7.5,  r4:8.51,  safetyPctAmongGenuine:31,  oneLineStory:"Classic 'PNC Pattern' — high management engagement and a looming 2026 launch date are completely unreflected in formal risk disclosures, creating a significant transparency gap for examiners.", supervisoryAction:'Targeted Examination', pncPattern:true,  goldmanPattern:false, quadrantLabel:'Announced But Unproven' },
  { ticker:'C',    bankName:'Citigroup',         clusterLabel:'B — Wholesale Blockchain Builders',   clusterColor:'#3DBE7A', isFalsePositive:false, xEngagement:73.2, ySafety:43.6, bubbleSizeR4:20.73, r1:7.95,  r2:18.12, r3:17.5, r4:20.73, safetyPctAmongGenuine:81,  oneLineStory:"Citi is positioning itself as the premier wholesale DLT utility by building proprietary 'always-on' infrastructure while carefully avoiding direct crypto-asset balance sheet exposure.", supervisoryAction:'Enhanced Monitoring', pncPattern:true,  goldmanPattern:false, quadrantLabel:'Operational Leader' },
  { ticker:'STT',  bankName:'State Street',      clusterLabel:'A — Custodial Infrastructure Leaders', clusterColor:'#4A90D9', isFalsePositive:false, xEngagement:68.9, ySafety:45.4, bubbleSizeR4:19.28, r1:9.14,  r2:20.0,  r3:16.25, r4:19.28, safetyPctAmongGenuine:94,  oneLineStory:"State Street is positioning itself as the systemic plumbing for institutional tokenization, balancing aggressive infrastructure development with sophisticated regulatory mapping.", supervisoryAction:'Enhanced Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Building But Waiting' },
  { ticker:'JPM',  bankName:'JPMorgan Chase',    clusterLabel:'B — Wholesale Blockchain Builders',   clusterColor:'#3DBE7A', isFalsePositive:false, xEngagement:66.5, ySafety:44.7, bubbleSizeR4:20.5,  r1:10.35, r2:18.75, r3:15.62, r4:20.5,  safetyPctAmongGenuine:88,  oneLineStory:"JPMorgan is aggressively building proprietary wholesale DLT infrastructure while lobbying for strict regulatory perimeters to prevent non-bank stablecoin issuers from disintermediating its deposit base.", supervisoryAction:'Enhanced Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Operational Leader' },
  { ticker:'USB',  bankName:'US Bancorp',        clusterLabel:'D — Strategic Movers',               clusterColor:'#F59C55', isFalsePositive:false, xEngagement:58.6, ySafety:39.6, bubbleSizeR4:17.0,  r1:9.03,  r2:15.62, r3:15.0, r4:17.0,  safetyPctAmongGenuine:47,  oneLineStory:"US Bancorp is positioning itself as a compliant, institutional-grade infrastructure provider for the tokenized ETF and stablecoin markets, leveraging the GENIUS Act to secure a first-mover advantage.", supervisoryAction:'Targeted Examination', pncPattern:false, goldmanPattern:false, quadrantLabel:'Announced But Unproven' },
  { ticker:'AXP',  bankName:'American Express',  clusterLabel:'C — Retail Digital Asset Pioneers',   clusterColor:'#B39DFA', isFalsePositive:false, xEngagement:52.9, ySafety:39.6, bubbleSizeR4:7.21,  r1:14.6,  r2:13.75, r3:11.25, r4:7.21,  safetyPctAmongGenuine:47,  oneLineStory:"American Express maintains a disciplined, risk-averse posture that treats digital assets primarily as a competitive threat to its payment network and a compliance hurdle for its AML programs.", supervisoryAction:'Enhanced Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Announced But Unproven' },
  { ticker:'BAC',  bankName:'Bank of America',   clusterLabel:'D — Strategic Movers',               clusterColor:'#F59C55', isFalsePositive:false, xEngagement:50.9, ySafety:42.6, bubbleSizeR4:14.65, r1:8.81,  r2:15.62, r3:18.12, r4:14.65, safetyPctAmongGenuine:69,  oneLineStory:"Bank of America is maintaining a defensive 'fast-follower' posture, prioritizing protection of its deposit base from stablecoin disintermediation while quietly maturing its internal DLT capabilities.", supervisoryAction:'Enhanced Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Building But Waiting' },
  { ticker:'PNC',  bankName:'PNC',               clusterLabel:'D — Strategic Movers',               clusterColor:'#F59C55', isFalsePositive:false, xEngagement:49.6, ySafety:38.2, bubbleSizeR4:13.62, r1:12.01, r2:13.12, r3:13.12, r4:13.62, safetyPctAmongGenuine:38,  oneLineStory:"PNC is executing a 'fast-follower' strategy by integrating stablecoins into its Pinnacle treasury platform while its CEO aggressively lobbies to prevent crypto-entities from bypassing banking standards.", supervisoryAction:'Enhanced Monitoring', pncPattern:true,  goldmanPattern:false, quadrantLabel:'Announced But Unproven' },
  { ticker:'MS',   bankName:'Morgan Stanley',    clusterLabel:'D — Strategic Movers',               clusterColor:'#F59C55', isFalsePositive:false, xEngagement:41.1, ySafety:40.2, bubbleSizeR4:11.74, r1:20.17, r2:11.25, r3:8.75, r4:11.74, safetyPctAmongGenuine:56,  oneLineStory:"Morgan Stanley is pursuing a vendor-led digital asset strategy for its wealth division, maintaining high financial resilience while acknowledging significant upcoming operational integration challenges.", supervisoryAction:'Enhanced Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Announced But Unproven' },
  { ticker:'GS',   bankName:'Goldman Sachs',     clusterLabel:'B — Wholesale Blockchain Builders',   clusterColor:'#3DBE7A', isFalsePositive:false, xEngagement:39.9, ySafety:43.5, bubbleSizeR4:17.98, r1:14.11, r2:14.38, r3:15.0, r4:17.98, safetyPctAmongGenuine:75,  oneLineStory:"Goldman Sachs maintains an institutional-grade 'wait-and-see' posture, embedding digital assets into executive governance while prioritizing tokenized funding and regulatory lobbying over public operational disclosure.", supervisoryAction:'Enhanced Monitoring', pncPattern:true,  goldmanPattern:true,  quadrantLabel:'Building But Waiting' },
  { ticker:'COF',  bankName:'Capital One',       clusterLabel:'E — Monitoring / False Positives',    clusterColor:'#8EA3B8', isFalsePositive:false, xEngagement:30.8, ySafety:40.8, bubbleSizeR4:8.46,  r1:18.3,  r2:11.25, r3:11.25, r4:8.46,  safetyPctAmongGenuine:62,  oneLineStory:"Capital One is defensively positioned, viewing digital assets and the GENIUS Act primarily as competitive threats to its retail deposit base rather than near-term operational opportunities.", supervisoryAction:'Enhanced Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Not Participating' },
  { ticker:'WFC',  bankName:'Wells Fargo',       clusterLabel:'E — Monitoring / False Positives',    clusterColor:'#8EA3B8', isFalsePositive:true,  xEngagement:9.0,  ySafety:30.5, bubbleSizeR4:16.51, r1:9.3,   r2:7.5,   r3:13.75, r4:16.51, safetyPctAmongGenuine:19,  oneLineStory:"Wells Fargo maintains a minimal and strictly compliant digital asset posture, with disclosures limited to mandatory accounting updates and no evidence of public-facing crypto operations.", supervisoryAction:'Routine Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Not Participating' },
  { ticker:'TFC',  bankName:'Truist',            clusterLabel:'E — Monitoring / False Positives',    clusterColor:'#8EA3B8', isFalsePositive:true,  xEngagement:3.0,  ySafety:23.5, bubbleSizeR4:13.52, r1:11.0,  r2:6.25,  r3:6.25, r4:13.52, safetyPctAmongGenuine:6,   oneLineStory:"Truist maintains a zero-exposure posture toward digital assets, with previous data signals confirmed as linguistic false positives rather than operational engagement.", supervisoryAction:'Routine Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Not Participating' },
  { ticker:'BMO',  bankName:'Bank of Montreal',  clusterLabel:'E — Monitoring / False Positives',    clusterColor:'#8EA3B8', isFalsePositive:true,  xEngagement:2.0,  ySafety:27.0, bubbleSizeR4:16.23, r1:14.46, r2:6.25,  r3:6.25, r4:16.23, safetyPctAmongGenuine:12,  oneLineStory:"BMO maintains a zero-exposure posture, with previous NLP signals confirmed as idiomatic false positives and no evidence of operational or strategic engagement in digital assets.", supervisoryAction:'Routine Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Not Participating' },
  { ticker:'TD',   bankName:'TD Bank',           clusterLabel:'E — Monitoring / False Positives',    clusterColor:'#8EA3B8', isFalsePositive:true,  xEngagement:1.0,  ySafety:31.7, bubbleSizeR4:10.26, r1:19.15, r2:6.25,  r3:6.25, r4:10.26, safetyPctAmongGenuine:25,  oneLineStory:"TD Bank maintains a zero-exposure posture, with previous signals identified as linguistic false positives, while focusing on recovery of its core financial resilience metrics.", supervisoryAction:'Routine Monitoring', pncPattern:false, goldmanPattern:false, quadrantLabel:'Not Participating' },
];

// ── Quadrant grid ─────────────────────────────────────────────────────────────

export interface QuadrantBankCard {
  ticker: string;
  bankName: string;
  clusterColor: string;
  t5Composite: number;
  safetyComposite: number;
  confidence: 'High' | 'Medium' | 'Low';
  infraDepth: string;
  regContingency: string;
  justification: string;
  infraEvidence: string[];
  contingencyEvidence: string[];
  whatWouldChange: string;
  pncPattern: boolean;
}

export const QUADRANT_GRID: Record<QuadrantLabel, QuadrantBankCard[]> = {
  'Operational Leader': [
    { ticker:'BK',  bankName:'BNY Mellon',    clusterColor:'#4A90D9', t5Composite:85.4, safetyComposite:46.0, confidence:'High',   infraDepth:'Proprietary Platform', regContingency:'Low Contingency',  justification:"BNY operates the 'BNY Digital Asset Platform' with live stablecoin reserve custody, SAB 121 non-objection secured, and proactive disclosure ratio of 3.16x. Strategy is operational and not conditional on regulatory outcomes.", infraEvidence:['BNY Digital Asset Platform (proprietary custodial infra)','Primary custodian for Circle USDC reserves','D2 Specificity score 0.82 — infra-specific vocabulary'], contingencyEvidence:['SEC non-objection received for crypto custody','GENIUS Act status: Fully Prepared','D3 Disclosure mode 3.16x — proactive institutional guidance'], whatWouldChange:'Regulatory reversal or enforcement action targeting stablecoin reserve management.', pncPattern:false },
    { ticker:'C',   bankName:'Citigroup',     clusterColor:'#3DBE7A', t5Composite:73.2, safetyComposite:43.6, confidence:'High',   infraDepth:'Proprietary Platform', regContingency:'Low Contingency',  justification:"Citi operates 'Citi Token Services' (CTS), a proprietary DLT platform live for wholesale treasury and trade finance. Strategy is not conditional on retail crypto legislation. GENIUS Act: Fully Prepared.", infraEvidence:['Citi Token Services (CTS) — proprietary DLT infrastructure','Vendor concentration score 8/10 (Proprietary)','D2 Specificity 0.58 — infra-specific vocabulary'], contingencyEvidence:['GENIUS Act status: Fully Prepared','D3 Disclosure mode 3.4x — proactive Q&A','Strategy described as always-on, avoiding direct crypto balance sheet exposure'], whatWouldChange:'Explicit pause of Citi Token Services expansion citing need for SEC or Basel III clarity on tokenized deposits.', pncPattern:true },
    { ticker:'JPM', bankName:'JPMorgan Chase',clusterColor:'#3DBE7A', t5Composite:66.5, safetyComposite:44.7, confidence:'High',   infraDepth:'Proprietary Platform', regContingency:'Low Contingency',  justification:"JPMorgan operates Kinexys (formerly Onyx) with live $5B/day wholesale settlement. Strategy is operational for core wholesale functions and not described as pending or subject to future guidance.", infraEvidence:['Kinexys proprietary blockchain platform','JPM Coin live transaction volume for wholesale settlement','D2 Specificity 0.71 — infra-specific technical vocabulary'], contingencyEvidence:['D3 Disclosure mode 1.85x — proactive Q&A','Operational status of wholesale DLT cited in filings','Regulatory readiness score 8/10'], whatWouldChange:"Official suspension of Kinexys growth or JPM Coin expansion citing need for final stablecoin legislation.", pncPattern:false },
  ],
  'Building But Waiting': [
    { ticker:'STT', bankName:'State Street',   clusterColor:'#4A90D9', t5Composite:68.9, safetyComposite:45.4, confidence:'High',   infraDepth:'Proprietary Platform', regContingency:'High Contingency', justification:"State Street has developed an internal 'fabric' platform for institutional tokenization, but core digital custody ambitions are constrained by SAB 121/122. Strategy described as 'sophisticated regulatory mapping' rather than live volume.", infraEvidence:["Internal 'fabric' platform identified as primary infrastructure",'D2 Specificity score 1.0 — 100% custodial vocabulary','Vendor concentration 7/10 — proprietary development focus'], contingencyEvidence:['GENIUS Act status: In Progress','Emphasis on regulatory mapping over current live transaction volumes','Q4 2025 R1 trend: improving (4.29) but governance still conservative'], whatWouldChange:'Specific disclosure of live transaction volumes on the fabric platform or SAB 122 balance sheet reflection.', pncPattern:false },
    { ticker:'BAC', bankName:'Bank of America',clusterColor:'#F59C55', t5Composite:50.9, safetyComposite:42.6, confidence:'Medium', infraDepth:'Proprietary Platform', regContingency:'High Contingency', justification:"Bank of America maintains a massive internal blockchain patent portfolio with vendor concentration 8/10, but 'fast-follower' posture with no specific volume disclosures or SAB 122 implementation.", infraEvidence:['Vendor concentration 8/10 — proprietary focus','Internal blockchain patent portfolio','D2 Specificity 0.48 — infra-specific vocabulary'], contingencyEvidence:["One-line story describes 'fast-follower' posture",'No specific transaction volume disclosures in formal filings','Strategy characterized as quietly maturing rather than active market participation'], whatWouldChange:'Named proprietary DLT platform launch with specific daily transaction volume disclosures.', pncPattern:false },
    { ticker:'GS',  bankName:'Goldman Sachs',  clusterColor:'#3DBE7A', t5Composite:39.9, safetyComposite:43.5, confidence:'Medium', infraDepth:'Proprietary Platform', regContingency:'High Contingency', justification:"GS DAP is a live proprietary tokenization platform (EIB digital bond, tokenized MMF with BNY). Goldman is the canonical underdiscloser: Q&A/Full ratio 0.23x — discusses DA 4× more in scripted remarks than Q&A.", infraEvidence:['GS DAP used for EIB digital bond issuance','Vendor concentration 7/10 — proprietary focus','D2 Specificity 0.63 — infra-specific vocabulary'], contingencyEvidence:['Disclosure mode 0.23x — systematic Q&A underdisclosure','Strategy described as pending regulatory clarity','SAB 122 accounting not reflected on balance sheet'], whatWouldChange:'Public disclosure of specific recurring GS DAP transaction volumes or formal SAB 122 adoption.', pncPattern:true },
  ],
  'Cautious Abstainer': [],
  'Announced But Unproven': [
    { ticker:'SCHW',bankName:'Charles Schwab', clusterColor:'#B39DFA', t5Composite:83.0, safetyComposite:32.6, confidence:'Medium', infraDepth:'Partnership-Dependent', regContingency:'High Contingency', justification:"Schwab shows vendor concentration 2/10 via Forge Global. Total absence of formal risk disclosure (R2=6.25/25) and no SAB 122 implementation despite a looming 2026 retail crypto launch — the PNC Pattern at scale.", infraEvidence:['Vendor concentration 2/10 — Forge Global dependency','PNC Pattern: True — no 10-K DA risk disclosure','D2 Specificity 0.245 — moderate infra vocabulary but no proprietary platform'], contingencyEvidence:['Formal disclosure quality 0/10','No SAB 122 balance sheet implementation','2026 launch date unreflected in formal risk disclosures'], whatWouldChange:'Proprietary custodial platform announcement or SAB 122 custody volumes on balance sheet.', pncPattern:true },
    { ticker:'USB',  bankName:'US Bancorp',     clusterColor:'#F59C55', t5Composite:58.6, safetyComposite:39.6, confidence:'Medium', infraDepth:'Partnership-Dependent', regContingency:'High Contingency', justification:"US Bancorp relies on unnamed partner platforms. Strategy is explicitly tied to the GENIUS Act for a 'first-mover regulatory advantage' — meaning full-scale operations are conditional on legislative outcomes.", infraEvidence:['Vendor concentration 5/10 — unnamed partner platforms','Global Fund Services integrated partners','D2 Specificity 0.52 — lacks proprietary platform naming'], contingencyEvidence:['Strategy leverages GENIUS Act for first-mover advantage','No specific transaction volume disclosures','Technical risk documentation 4/10 — compliance-alignment phase'], whatWouldChange:"Named proprietary custodial blockchain (e.g., 'USB Digital Asset Vault') with live transaction volume.", pncPattern:false },
    { ticker:'AXP',  bankName:'American Express',clusterColor:'#B39DFA', t5Composite:52.9, safetyComposite:39.6, confidence:'High',   infraDepth:'Partnership-Dependent', regContingency:'High Contingency', justification:"AmEx relies on Coinbase exclusively. D2 specificity 0.39 confirms lack of in-house infrastructure. Strategy is defensive — digital assets treated as compliance hurdle. No SAB 122 implementation.", infraEvidence:['Primary vendor: Coinbase','Vendor concentration 4/10','D2 Specificity 0.39 — lacks infra-specific vocabulary'], contingencyEvidence:['Regulatory readiness 3/10','Technical risk documentation 2/10','Treats digital assets primarily as compliance hurdle'], whatWouldChange:'Proprietary blockchain-based merchant settlement system or internal ledger announcement.', pncPattern:false },
    { ticker:'PNC',  bankName:'PNC',             clusterColor:'#F59C55', t5Composite:49.6, safetyComposite:38.2, confidence:'Medium', infraDepth:'Partnership-Dependent', regContingency:'High Contingency', justification:"Canonical PNC Pattern case: CEO Demchak described Pinnacle stablecoin platform in Q3 2025 earnings calls with specificity. The Q4 2025 10-K contains no digital asset risk section. 90% of NLP peak score is generic vocabulary.", infraEvidence:['Primary vendors: Coinbase, unnamed industry consortium','D2 Specificity 0.048 — generic vocabulary (90% General)','Vendor concentration 4/10'], contingencyEvidence:['CEO lobbies for regulatory framework — not operational leader','Strategy described as fast-follower','Technical risk documentation 2/10'], whatWouldChange:"Named proprietary blockchain platform with live transaction volume → 'Building But Waiting'.", pncPattern:true },
    { ticker:'MS',   bankName:'Morgan Stanley',  clusterColor:'#F59C55', t5Composite:41.1, safetyComposite:40.2, confidence:'High',   infraDepth:'Partnership-Dependent', regContingency:'High Contingency', justification:"Morgan Stanley is fully vendor-led via Zero Hash. Vendor concentration 0/10. Strategy in early planning with regulatory readiness 3/10. No SAB 122 implementation or live volume disclosures.", infraEvidence:['Primary vendor: Zero Hash','Vendor concentration 0/10 — no independent infrastructure','D2 Specificity 0.31 — low infra vocabulary'], contingencyEvidence:['Regulatory readiness 3/10','GENIUS Act status: Early Planning','Formal disclosure 2/10'], whatWouldChange:"Proprietary tokenization or custodial platform → 'Building But Waiting'.", pncPattern:false },
  ],
  'Not Participating': [
    { ticker:'COF',bankName:'Capital One',      clusterColor:'#8EA3B8', t5Composite:30.8, safetyComposite:40.8, confidence:'High', infraDepth:'Not Participating', regContingency:'High Contingency', justification:"No proprietary or partnership-based DA infrastructure. GENIUS Act status: Early Planning. D2 Specificity 0.08.", infraEvidence:['D2 Specificity 0.08 — generic vocabulary','Vendor concentration 2/10 — None disclosed'], contingencyEvidence:['GENIUS Act status: Early Planning','Technical risk documentation 2/10'], whatWouldChange:"Formal custodian partnership or tokenized deposit pilot → 'Announced But Unproven'.", pncPattern:false },
    { ticker:'WFC', bankName:'Wells Fargo',     clusterColor:'#8EA3B8', t5Composite:9.0,  safetyComposite:30.5, confidence:'High', infraDepth:'Not Participating', regContingency:'High Contingency', justification:'FALSE POSITIVE. No proprietary or third-party DA infrastructure. All disclosures limited to mandatory accounting updates. WFUSD trademark (Mar 2026) is trajectory signal only.', infraEvidence:['D2 Specificity 0.0 — false positive (idiomatic "circle back")','Vendor concentration 0/10'], contingencyEvidence:['Regulatory readiness 2/10','Technical risk documentation 0/10'], whatWouldChange:"Named platform or formal custody partnership.", pncPattern:false },
    { ticker:'TFC', bankName:'Truist',          clusterColor:'#8EA3B8', t5Composite:3.0,  safetyComposite:23.5, confidence:'High', infraDepth:'Not Participating', regContingency:'High Contingency', justification:'FALSE POSITIVE. Zero-exposure posture. All prior NLP signals were idiomatic false positives ("circle back" idiom).', infraEvidence:['D2 Specificity 0.0','Vendor concentration 0/10'], contingencyEvidence:['SAB 122 not reflected','Formal disclosure 0/10'], whatWouldChange:"Formal custodian partnership or tokenization pilot.", pncPattern:false },
    { ticker:'BMO', bankName:'Bank of Montreal',clusterColor:'#8EA3B8', t5Composite:2.0,  safetyComposite:27.0, confidence:'High', infraDepth:'Not Participating', regContingency:'High Contingency', justification:'FALSE POSITIVE. Zero-exposure posture. NLP signals were idiomatic ("full circle"). Named in G7 stablecoin coalition Oct 2025 but exploratory only.', infraEvidence:['D2 Specificity 0.0','Vendor concentration 0/10'], contingencyEvidence:['Regulatory readiness 0/10','Formal disclosure 0/10'], whatWouldChange:"Formal DA custody pilot or crypto-native provider partnership.", pncPattern:false },
    { ticker:'TD',  bankName:'TD Bank',         clusterColor:'#8EA3B8', t5Composite:1.0,  safetyComposite:31.7, confidence:'High', infraDepth:'Not Participating', regContingency:'High Contingency', justification:'FALSE POSITIVE. Zero-exposure posture. NLP signal was "strategic investment" referring to Schwab stake, not DA. Under AML regulatory scrutiny 2024–2025.', infraEvidence:['D2 Specificity 0.0','Vendor concentration 0/10'], contingencyEvidence:['Formal disclosure 0/10','SAB 122 not reflected'], whatWouldChange:"Formal DA custody pilot announcement.", pncPattern:false },
  ],
};

// ── R1 Financial Resilience time series ──────────────────────────────────────

export const QUARTERS = ['Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025','Q3 2025','Q4 2025'];

export interface R1Series {
  ticker: string;
  bankName: string;
  clusterColor: string;
  t5Composite: number;
  r1Scores: number[];
  trendDirection: 'improving' | 'stable' | 'declining';
  feeIncomePeerAdjusted: boolean;
  hqlaFlag: boolean;
}

export const R1_TIMESERIES: R1Series[] = [
  { ticker:'BK',   bankName:'BNY Mellon',      clusterColor:'#4A90D9', t5Composite:85.4, r1Scores:[4.21,4.35,4.70,4.59,5.06,4.57,5.14,5.19], trendDirection:'improving', feeIncomePeerAdjusted:true,  hqlaFlag:false },
  { ticker:'STT',  bankName:'State Street',     clusterColor:'#4A90D9', t5Composite:68.9, r1Scores:[3.32,3.61,3.87,3.92,4.18,4.11,4.19,4.29], trendDirection:'improving', feeIncomePeerAdjusted:true,  hqlaFlag:false },
  { ticker:'JPM',  bankName:'JPMorgan Chase',   clusterColor:'#3DBE7A', t5Composite:66.5, r1Scores:[4.13,4.07,4.26,4.33,4.36,4.43,4.47,4.72], trendDirection:'improving', feeIncomePeerAdjusted:false, hqlaFlag:true  },
  { ticker:'C',    bankName:'Citigroup',        clusterColor:'#3DBE7A', t5Composite:73.2, r1Scores:[3.33,3.43,3.61,3.46,3.66,3.61,3.76,3.86], trendDirection:'improving', feeIncomePeerAdjusted:false, hqlaFlag:true  },
  { ticker:'GS',   bankName:'Goldman Sachs',    clusterColor:'#3DBE7A', t5Composite:39.9, r1Scores:[5.81,5.69,5.92,5.76,6.25,6.13,6.00,6.08], trendDirection:'improving', feeIncomePeerAdjusted:true,  hqlaFlag:false },
  { ticker:'SCHW', bankName:'Charles Schwab',   clusterColor:'#B39DFA', t5Composite:83.0, r1Scores:[7.77,7.75,7.75,7.79,7.86,7.78,7.83,7.79], trendDirection:'stable',    feeIncomePeerAdjusted:false, hqlaFlag:false },
  { ticker:'AXP',  bankName:'American Express', clusterColor:'#B39DFA', t5Composite:52.9, r1Scores:[6.23,6.48,6.53,6.78,6.80,6.19,6.03,6.25], trendDirection:'declining', feeIncomePeerAdjusted:false, hqlaFlag:false },
  { ticker:'USB',  bankName:'US Bancorp',       clusterColor:'#F59C55', t5Composite:58.6, r1Scores:[3.45,3.85,3.83,3.94,4.33,4.21,4.19,4.25], trendDirection:'improving', feeIncomePeerAdjusted:false, hqlaFlag:false },
  { ticker:'BAC',  bankName:'Bank of America',  clusterColor:'#F59C55', t5Composite:50.9, r1Scores:[4.26,4.21,4.32,4.32,4.67,4.29,4.33,4.17], trendDirection:'stable',    feeIncomePeerAdjusted:false, hqlaFlag:true  },
  { ticker:'PNC',  bankName:'PNC',              clusterColor:'#F59C55', t5Composite:49.6, r1Scores:[4.03,4.31,4.46,4.59,5.07,5.15,5.22,5.32], trendDirection:'improving', feeIncomePeerAdjusted:false, hqlaFlag:false },
  { ticker:'MS',   bankName:'Morgan Stanley',   clusterColor:'#F59C55', t5Composite:41.1, r1Scores:[8.43,8.28,8.28,8.04,8.37,8.31,8.35,8.26], trendDirection:'stable',    feeIncomePeerAdjusted:true,  hqlaFlag:false },
  { ticker:'COF',  bankName:'Capital One',      clusterColor:'#8EA3B8', t5Composite:30.8, r1Scores:[7.90,7.67,8.11,7.79,8.12,7.50,7.53,7.59], trendDirection:'declining', feeIncomePeerAdjusted:false, hqlaFlag:false },
  { ticker:'WFC',  bankName:'Wells Fargo',      clusterColor:'#8EA3B8', t5Composite:9.0,  r1Scores:[3.93,4.17,4.57,4.19,4.51,4.69,4.49,4.35], trendDirection:'improving', feeIncomePeerAdjusted:false, hqlaFlag:false },
  { ticker:'TFC',  bankName:'Truist',           clusterColor:'#8EA3B8', t5Composite:3.0,  r1Scores:[4.45,5.21,5.43,5.22,5.25,4.80,5.00,4.96], trendDirection:'stable',    feeIncomePeerAdjusted:false, hqlaFlag:false },
  { ticker:'BMO',  bankName:'Bank of Montreal', clusterColor:'#8EA3B8', t5Composite:2.0,  r1Scores:[5.65,5.60,6.32,6.18,6.47,6.73,6.41,6.21], trendDirection:'improving', feeIncomePeerAdjusted:false, hqlaFlag:false },
  { ticker:'TD',   bankName:'TD Bank',          clusterColor:'#8EA3B8', t5Composite:1.0,  r1Scores:[7.50,7.44,7.07,7.36,7.60,7.65,7.55,7.89], trendDirection:'improving', feeIncomePeerAdjusted:false, hqlaFlag:false },
];

// ── Interactive weighting panel ───────────────────────────────────────────────

export interface WeightComponent {
  key: string;
  label: string;
  dimension: 'R1' | 'R2' | 'R3';
  defaultWeight: number;
  rationale: string;
}

export const WEIGHT_COMPONENTS: WeightComponent[] = [
  { key:'R1_Liquidity',    label:'Liquidity Resilience',             dimension:'R1', defaultWeight:0.30, rationale:'Blockchain enables deposit runs in minutes. SVB & Signature failed via liquidity runs on uninsured deposits.' },
  { key:'R1_Capital',      label:'Capital Adequacy',                  dimension:'R1', defaultWeight:0.25, rationale:'Capital is the shock absorber. Thin capital cannot sustain DA R&D and absorb unexpected operational losses simultaneously.' },
  { key:'R1_Credit',       label:'Credit Quality',                    dimension:'R1', defaultWeight:0.20, rationale:'A bank under traditional credit stress has no capacity to absorb novel DA operational risks.' },
  { key:'R1_IR',           label:'Interest Rate Risk',                dimension:'R1', defaultWeight:0.15, rationale:'The SVB mechanism: locked HTM portfolio + unrealized losses = latent liquidity crisis.' },
  { key:'R1_Earnings',     label:'Earnings Power',                    dimension:'R1', defaultWeight:0.10, rationale:'Profitable banks sustain DA investment. Peer-adjusted for BNY, STT, GS, MS (fee-income business model).' },
  { key:'R2_Formal',       label:'Formal 10-K Disclosure Quality',   dimension:'R2', defaultWeight:0.25, rationale:'A bank silent in its 10-K has no documented governance framework, regardless of CEO statements.' },
  { key:'R2_Ops',          label:'Operational Controls Documentation', dimension:'R2', defaultWeight:0.25, rationale:'Vendor management for crypto partners and internal audit coverage. Undocumented vendor relationships are a supervisory blind spot.' },
  { key:'R2_Technical',    label:'Technical Risk Documentation',      dimension:'R2', defaultWeight:0.25, rationale:'Key management protocols, cold storage, DLT infrastructure risks. Only banks with published technical whitepapers score high.' },
  { key:'R2_Consistency',  label:'Disclosure Consistency (CEO vs 10-K)', dimension:'R2', defaultWeight:0.25, rationale:'The PNC signal: aggressive CEO transcript commentary not matched by formal 10-K disclosure. Computed — not Gemini judgment.' },
  { key:'R3_Vendor',       label:'Vendor Concentration Safety',       dimension:'R3', defaultWeight:0.25, rationale:'Banks fully dependent on Coinbase/Zerohash have single-point-of-failure risk if that vendor faces regulatory action.' },
  { key:'R3_Retail',       label:'Institutional vs Retail Focus',     dimension:'R3', defaultWeight:0.25, rationale:'Retail DA creates consumer protection and fraud risks absent in institutional-only operations.' },
  { key:'R3_Regulatory',   label:'Regulatory Readiness',              dimension:'R3', defaultWeight:0.25, rationale:'GENIUS Act preparation, SAB 122 adoption, OCC guidance compliance.' },
  { key:'R3_Contagion',    label:'Contagion Containment',             dimension:'R3', defaultWeight:0.25, rationale:'BNY custodies 80%+ of US crypto ETPs — failure propagates widely. High contagion → lower safety score.' },
];

export interface WeightedBank {
  ticker: string;
  bankName: string;
  t5Composite: number;
  safetyComposite: number;
  r4Footprint: number;
  scores: Record<string, number>; // 0-10 per component
  disclosureRatio: number;
  pncPattern: boolean;
  goldmanPattern: boolean;
}

export const WEIGHTED_BANKS: WeightedBank[] = [
  { ticker:'BK',   bankName:'BNY Mellon',      t5Composite:85.4, safetyComposite:46.0, r4Footprint:19.38, scores:{ R1_Liquidity:1.4,  R1_Capital:1.17, R1_Credit:0.93, R1_IR:0.7,  R1_Earnings:0.47, R2_Formal:8.0,  R2_Ops:6.0, R2_Technical:4.99, R2_Consistency:10.0, R3_Vendor:7.01, R3_Retail:8.99, R3_Regulatory:8.99, R3_Contagion:0.99 }, disclosureRatio:0.724, pncPattern:false, goldmanPattern:false },
  { ticker:'SCHW', bankName:'Charles Schwab',   t5Composite:83.0, safetyComposite:32.6, r4Footprint:8.51,  scores:{ R1_Liquidity:2.27, R1_Capital:1.89, R1_Credit:1.51, R1_IR:1.13, R1_Earnings:0.76, R2_Formal:0.0,  R2_Ops:0.0, R2_Technical:0.0,  R2_Consistency:10.0, R3_Vendor:2.0,  R3_Retail:0.0,  R3_Regulatory:2.0,  R3_Contagion:8.0  }, disclosureRatio:0.873, pncPattern:true,  goldmanPattern:false },
  { ticker:'C',    bankName:'Citigroup',        t5Composite:73.2, safetyComposite:43.6, r4Footprint:20.73, scores:{ R1_Liquidity:0.95, R1_Capital:0.8,  R1_Credit:0.64, R1_IR:0.48, R1_Earnings:0.32, R2_Formal:6.0,  R2_Ops:7.01,R2_Technical:6.0,  R2_Consistency:10.0, R3_Vendor:8.0,  R3_Retail:8.99, R3_Regulatory:8.0,  R3_Contagion:3.01 }, disclosureRatio:0.952, pncPattern:true,  goldmanPattern:false },
  { ticker:'STT',  bankName:'State Street',     t5Composite:68.9, safetyComposite:45.4, r4Footprint:19.28, scores:{ R1_Liquidity:1.1,  R1_Capital:0.91, R1_Credit:0.73, R1_IR:0.55, R1_Earnings:0.37, R2_Formal:8.99, R2_Ops:7.01,R2_Technical:6.0,  R2_Consistency:10.0, R3_Vendor:7.01, R3_Retail:10.0, R3_Regulatory:8.0,  R3_Contagion:0.99 }, disclosureRatio:0.949, pncPattern:false, goldmanPattern:false },
  { ticker:'JPM',  bankName:'JPMorgan Chase',   t5Composite:66.5, safetyComposite:44.7, r4Footprint:20.5,  scores:{ R1_Liquidity:1.24, R1_Capital:1.03, R1_Credit:0.83, R1_IR:0.62, R1_Earnings:0.41, R2_Formal:8.0,  R2_Ops:6.0, R2_Technical:6.0,  R2_Consistency:10.0, R3_Vendor:8.0,  R3_Retail:6.0,  R3_Regulatory:8.0,  R3_Contagion:3.01 }, disclosureRatio:0.902, pncPattern:false, goldmanPattern:false },
  { ticker:'USB',  bankName:'US Bancorp',       t5Composite:58.6, safetyComposite:39.6, r4Footprint:17.0,  scores:{ R1_Liquidity:1.08, R1_Capital:0.9,  R1_Credit:0.72, R1_IR:0.54, R1_Earnings:0.36, R2_Formal:6.0,  R2_Ops:4.99,R2_Technical:4.0,  R2_Consistency:10.0, R3_Vendor:4.99, R3_Retail:8.0,  R3_Regulatory:7.01, R3_Contagion:4.0  }, disclosureRatio:0.854, pncPattern:false, goldmanPattern:false },
  { ticker:'AXP',  bankName:'American Express', t5Composite:52.9, safetyComposite:39.6, r4Footprint:7.21,  scores:{ R1_Liquidity:1.75, R1_Capital:1.46, R1_Credit:1.17, R1_IR:0.88, R1_Earnings:0.58, R2_Formal:6.0,  R2_Ops:4.0, R2_Technical:2.0,  R2_Consistency:10.0, R3_Vendor:4.0,  R3_Retail:3.01, R3_Regulatory:3.01, R3_Contagion:8.0  }, disclosureRatio:0.962, pncPattern:false, goldmanPattern:false },
  { ticker:'BAC',  bankName:'Bank of America',  t5Composite:50.9, safetyComposite:42.6, r4Footprint:14.65, scores:{ R1_Liquidity:1.06, R1_Capital:0.88, R1_Credit:0.7,  R1_IR:0.53, R1_Earnings:0.35, R2_Formal:6.0,  R2_Ops:4.0, R2_Technical:4.99, R2_Consistency:10.0, R3_Vendor:8.0,  R3_Retail:7.01, R3_Regulatory:8.0,  R3_Contagion:6.0  }, disclosureRatio:0.964, pncPattern:false, goldmanPattern:false },
  { ticker:'PNC',  bankName:'PNC',              t5Composite:49.6, safetyComposite:38.2, r4Footprint:13.62, scores:{ R1_Liquidity:1.44, R1_Capital:1.2,  R1_Credit:0.96, R1_IR:0.72, R1_Earnings:0.48, R2_Formal:4.99, R2_Ops:4.0, R2_Technical:2.0,  R2_Consistency:10.0, R3_Vendor:4.0,  R3_Retail:4.99, R3_Regulatory:8.0,  R3_Contagion:4.0  }, disclosureRatio:0.939, pncPattern:true,  goldmanPattern:false },
  { ticker:'MS',   bankName:'Morgan Stanley',   t5Composite:41.1, safetyComposite:40.2, r4Footprint:11.74, scores:{ R1_Liquidity:2.42, R1_Capital:2.02, R1_Credit:1.61, R1_IR:1.21, R1_Earnings:0.81, R2_Formal:2.0,  R2_Ops:4.0, R2_Technical:2.0,  R2_Consistency:10.0, R3_Vendor:0.0,  R3_Retail:4.99, R3_Regulatory:3.01, R3_Contagion:6.0  }, disclosureRatio:0.918, pncPattern:false, goldmanPattern:false },
  { ticker:'GS',   bankName:'Goldman Sachs',    t5Composite:39.9, safetyComposite:43.5, r4Footprint:17.98, scores:{ R1_Liquidity:1.69, R1_Capital:1.41, R1_Credit:1.13, R1_IR:0.85, R1_Earnings:0.56, R2_Formal:6.0,  R2_Ops:4.0, R2_Technical:3.01, R2_Consistency:10.0, R3_Vendor:7.01, R3_Retail:8.99, R3_Regulatory:4.99, R3_Contagion:3.01 }, disclosureRatio:0.902, pncPattern:true,  goldmanPattern:true  },
  { ticker:'COF',  bankName:'Capital One',      t5Composite:30.8, safetyComposite:40.8, r4Footprint:8.46,  scores:{ R1_Liquidity:2.2,  R1_Capital:1.83, R1_Credit:1.46, R1_IR:1.1,  R1_Earnings:0.73, R2_Formal:4.0,  R2_Ops:2.0, R2_Technical:2.0,  R2_Consistency:10.0, R3_Vendor:2.0,  R3_Retail:2.0,  R3_Regulatory:4.99, R3_Contagion:8.99 }, disclosureRatio:0.926, pncPattern:false, goldmanPattern:false },
  { ticker:'WFC',  bankName:'Wells Fargo',      t5Composite:9.0,  safetyComposite:30.5, r4Footprint:16.51, scores:{ R1_Liquidity:1.12, R1_Capital:0.93, R1_Credit:0.74, R1_IR:0.56, R1_Earnings:0.37, R2_Formal:2.0,  R2_Ops:0.0, R2_Technical:0.0,  R2_Consistency:10.0, R3_Vendor:0.0,  R3_Retail:10.0, R3_Regulatory:2.0,  R3_Contagion:10.0 }, disclosureRatio:0.921, pncPattern:false, goldmanPattern:false },
  { ticker:'TFC',  bankName:'Truist',           t5Composite:3.0,  safetyComposite:23.5, r4Footprint:13.52, scores:{ R1_Liquidity:1.32, R1_Capital:1.1,  R1_Credit:0.88, R1_IR:0.66, R1_Earnings:0.44, R2_Formal:0.0,  R2_Ops:0.0, R2_Technical:0.0,  R2_Consistency:10.0, R3_Vendor:0.0,  R3_Retail:0.0,  R3_Regulatory:0.0,  R3_Contagion:10.0 }, disclosureRatio:0.948, pncPattern:false, goldmanPattern:false },
  { ticker:'BMO',  bankName:'Bank of Montreal', t5Composite:2.0,  safetyComposite:27.0, r4Footprint:16.23, scores:{ R1_Liquidity:1.74, R1_Capital:1.45, R1_Credit:1.16, R1_IR:0.87, R1_Earnings:0.58, R2_Formal:0.0,  R2_Ops:0.0, R2_Technical:0.0,  R2_Consistency:10.0, R3_Vendor:0.0,  R3_Retail:0.0,  R3_Regulatory:0.0,  R3_Contagion:10.0 }, disclosureRatio:0.5,   pncPattern:false, goldmanPattern:false },
  { ticker:'TD',   bankName:'TD Bank',          t5Composite:1.0,  safetyComposite:31.7, r4Footprint:10.26, scores:{ R1_Liquidity:2.3,  R1_Capital:1.91, R1_Credit:1.53, R1_IR:1.15, R1_Earnings:0.77, R2_Formal:0.0,  R2_Ops:0.0, R2_Technical:0.0,  R2_Consistency:10.0, R3_Vendor:0.0,  R3_Retail:0.0,  R3_Regulatory:0.0,  R3_Contagion:10.0 }, disclosureRatio:0.5,   pncPattern:false, goldmanPattern:false },
];

// ── Supervisory priority table ────────────────────────────────────────────────

export interface SupervisoryRow {
  rank: number;
  ticker: string;
  bankName: string;
  t5Composite: number;
  safetyComposite: number;
  r1: number; r2: number; r3: number; r4: number;
  governanceGap: number;
  supervisoryAction: string;
  pncPattern: boolean;
  goldmanPattern: boolean;
  biggestRisk: string;
  oneLineStory: string;
  quadrantLabel: QuadrantLabel;
}

export const SUPERVISORY_TABLE: SupervisoryRow[] = [
  { rank:1,  ticker:'SCHW', bankName:'Charles Schwab',    t5Composite:83.0, safetyComposite:32.6, r1:18.88, r2:6.25,  r3:7.5,  r4:8.51,  governanceGap:-14.5, supervisoryAction:'Targeted Examination', pncPattern:true,  goldmanPattern:false, biggestRisk:'Massive, rapid retail crypto rollout to millions of unsophisticated investors without a mature regulatory control framework.', oneLineStory:"Classic PNC Pattern — 2026 launch date completely unreflected in formal risk disclosures, creating a significant transparency gap.", quadrantLabel:'Announced But Unproven' },
  { rank:2,  ticker:'BK',   bankName:'BNY Mellon',        t5Composite:85.4, safetyComposite:46.0, r1:11.65, r2:18.12, r3:16.25,r4:19.38, governanceGap:-3.23, supervisoryAction:'Enhanced Monitoring',  pncPattern:false, goldmanPattern:false, biggestRisk:'Concentration of stablecoin reserve custody for major issuers — single point of failure for digital dollar liquidity.', oneLineStory:"Positioned as the systemic 'trusted infrastructure' layer, balancing stablecoin reserve growth with regulatory alignment.", quadrantLabel:'Operational Leader' },
  { rank:3,  ticker:'STT',  bankName:'State Street',      t5Composite:68.9, safetyComposite:45.4, r1:9.14,  r2:20.0,  r3:16.25,r4:19.28, governanceGap:2.77,  supervisoryAction:'Enhanced Monitoring',  pncPattern:false, goldmanPattern:false, biggestRisk:'Tokenized assets accelerating deposit outflows, undermining role in monetary policy transmission.', oneLineStory:'Positioning as systemic plumbing for institutional tokenization with sophisticated regulatory mapping.', quadrantLabel:'Building But Waiting' },
  { rank:4,  ticker:'JPM',  bankName:'JPMorgan Chase',    t5Composite:66.5, safetyComposite:44.7, r1:10.35, r2:18.75, r3:15.62,r4:20.5,  governanceGap:2.12,  supervisoryAction:'Enhanced Monitoring',  pncPattern:false, goldmanPattern:false, biggestRisk:"Emergence of a 'parallel banking system' through interest-bearing stablecoins without bank-grade safeguards.", oneLineStory:'Aggressively building proprietary wholesale DLT (Kinexys $5B/day) while lobbying for strict regulatory perimeters.', quadrantLabel:'Operational Leader' },
  { rank:5,  ticker:'C',    bankName:'Citigroup',         t5Composite:73.2, safetyComposite:43.6, r1:7.95,  r2:18.12, r3:17.5, r4:20.73, governanceGap:-0.18, supervisoryAction:'Enhanced Monitoring',  pncPattern:true,  goldmanPattern:false, biggestRisk:'Concentration of multi-bank institutional liquidity within proprietary DLT custody operating outside traditional settlement hours.', oneLineStory:"Premier wholesale DLT utility via 'always-on' Citi Token Services, avoiding direct crypto balance sheet exposure.", quadrantLabel:'Operational Leader' },
  { rank:6,  ticker:'GS',   bankName:'Goldman Sachs',     t5Composite:39.9, safetyComposite:43.5, r1:14.11, r2:14.38, r3:15.0, r4:17.98, governanceGap:4.41,  supervisoryAction:'Enhanced Monitoring',  pncPattern:true,  goldmanPattern:true,  biggestRisk:'Integration of DA into core clearance and settlement frameworks could transmit DLT operational failures to the wholesale market.', oneLineStory:"Institutional-grade 'wait-and-see' posture — GS DAP live but Q&A ratio 0.23x (systematic underdiscloser).", quadrantLabel:'Building But Waiting' },
  { rank:7,  ticker:'USB',  bankName:'US Bancorp',        t5Composite:58.6, safetyComposite:39.6, r1:9.03,  r2:15.62, r3:15.0, r4:17.0,  governanceGap:0.97,  supervisoryAction:'Targeted Examination', pncPattern:false, goldmanPattern:false, biggestRisk:'Concentration of custody services for 2025 ETF market — technical failure could disrupt institutional investment vehicles.', oneLineStory:'Positioning as compliant institutional infrastructure for tokenized ETF/stablecoin markets via GENIUS Act first-mover strategy.', quadrantLabel:'Announced But Unproven' },
  { rank:8,  ticker:'AXP',  bankName:'American Express',  t5Composite:52.9, safetyComposite:39.6, r1:14.6,  r2:13.75, r3:11.25,r4:7.21,  governanceGap:0.52,  supervisoryAction:'Enhanced Monitoring',  pncPattern:false, goldmanPattern:false, biggestRisk:'Disintermediation of core payment network by stablecoins/CBDCs, eroding net interest income and discount revenues.', oneLineStory:'Disciplined risk-averse posture treating digital assets as competitive threat and compliance hurdle.', quadrantLabel:'Announced But Unproven' },
  { rank:9,  ticker:'BAC',  bankName:'Bank of America',   t5Composite:50.9, safetyComposite:42.6, r1:8.81,  r2:15.62, r3:18.12,r4:14.65, governanceGap:2.89,  supervisoryAction:'Enhanced Monitoring',  pncPattern:false, goldmanPattern:false, biggestRisk:'Macroeconomic reduction in SMB lending capacity due to deposit migration into stablecoin environments.', oneLineStory:"'Fast-follower' posture prioritizing deposit base protection while quietly maturing internal DLT capabilities.", quadrantLabel:'Building But Waiting' },
  { rank:10, ticker:'PNC',  bankName:'PNC',               t5Composite:49.6, safetyComposite:38.2, r1:12.01, r2:13.12, r3:13.12,r4:13.62, governanceGap:0.72,  supervisoryAction:'Enhanced Monitoring',  pncPattern:true,  goldmanPattern:false, biggestRisk:'Regulatory arbitrage — stablecoins functioning as interest-bearing shadow MMFs without equivalent bank oversight.', oneLineStory:"'Fast-follower' integrating stablecoins into Pinnacle treasury platform while CEO lobbies against non-bank crypto bypass of banking standards.", quadrantLabel:'Announced But Unproven' },
  { rank:11, ticker:'MS',   bankName:'Morgan Stanley',    t5Composite:41.1, safetyComposite:40.2, r1:20.17, r2:11.25, r3:8.75, r4:11.74, governanceGap:0.97,  supervisoryAction:'Enhanced Monitoring',  pncPattern:false, goldmanPattern:false, biggestRisk:'Concentrated reliance on Zero Hash for institutional DA infrastructure without disclosed redundancy.', oneLineStory:'Vendor-led strategy via Zero Hash for wealth division — high financial resilience but significant operational integration challenges ahead.', quadrantLabel:'Announced But Unproven' },
  { rank:12, ticker:'COF',  bankName:'Capital One',       t5Composite:30.8, safetyComposite:40.8, r1:18.3,  r2:11.25, r3:11.25,r4:8.46,  governanceGap:3.55,  supervisoryAction:'Enhanced Monitoring',  pncPattern:false, goldmanPattern:false, biggestRisk:'Deposit attrition to non-bank stablecoin issuers facilitated by the GENIUS Act regulatory framework.', oneLineStory:'Defensively positioned, viewing DA and GENIUS Act primarily as competitive threats to retail deposit base.', quadrantLabel:'Not Participating' },
];
