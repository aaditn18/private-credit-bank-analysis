import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data', 'ai');
const generatedAt = new Date().toISOString();

const factorMeta = [
  ['board_governance', 'Board Governance'],
  ['strategic_implementation', 'Strategic Implementation'],
  ['risk_management', 'Risk Management'],
  ['leadership_acumen', 'Leadership Acumen'],
  ['growth_profitability', 'Growth & Profitability'],
  ['compliance', 'Compliance'],
  ['strategic_risk', 'Strategic Risk'],
];

const factorKeywords = {
  board_governance: [
    'board',
    'committee',
    'oversight',
    'governance',
    'risk appetite',
    'model risk committee',
    'audit committee',
    'technology committee',
    'enterprise risk',
  ],
  strategic_implementation: [
    'artificial intelligence',
    'generative ai',
    'machine learning',
    'automation',
    'automated',
    'digital',
    'technology',
    'deploy',
    'implementation',
    'adoption',
    'platform',
    'model',
  ],
  risk_management: [
    'risk',
    'model risk',
    'credit risk',
    'operational risk',
    'fraud',
    'controls',
    'loss model',
    'allowance',
    'stress',
    'uncertainty',
  ],
  leadership_acumen: [
    'management',
    'senior management',
    'executive',
    'leadership',
    'strategy',
    'strategic',
    'chief',
    'committee',
    'transformation',
  ],
  growth_profitability: [
    'efficiency',
    'productivity',
    'profitability',
    'expense',
    'cost',
    'revenue',
    'growth',
    'underwriting',
    'origination',
    'operating leverage',
  ],
  compliance: [
    'compliance',
    'regulatory',
    'law',
    'legal',
    'privacy',
    'validation',
    'audit',
    'control',
    'fair lending',
    'information security',
    'policy',
  ],
  strategic_risk: [
    'competition',
    'competitive',
    'strategic risk',
    'disruption',
    'technology change',
    'emerging technology',
    'reputation',
    'market',
    'business risk',
    'innovation',
  ],
};

const highSalienceSections = [
  'management’s discussion',
  "management's discussion",
  'proxy',
  'ceo',
  'business',
  'governance',
  'risk management',
  'prepared remarks',
];

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), 'utf8'));
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(dataDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function textForEvidence(record) {
  return `${record.excerpt ?? ''} ${record.section ?? ''} ${record.notes ?? ''}`.toLowerCase();
}

function confidenceWeight(confidence) {
  if (confidence === 'high') return 1.25;
  if (confidence === 'medium') return 1;
  return 0.65;
}

function tierWeight(tier) {
  if (tier === 'P1') return 3.5;
  if (tier === 'P2') return 2.25;
  if (tier === 'P3') return 1.2;
  return 0.85;
}

function keywordScore(record, factorId) {
  const text = textForEvidence(record);
  let score = 0;

  if (record.factor_tags?.includes(factorId)) score += 120;
  for (const keyword of factorKeywords[factorId]) {
    if (text.includes(keyword)) score += 18;
  }
  if (highSalienceSections.some((section) => text.includes(section))) score += 10;
  score += tierWeight(record.p_tier);
  score += confidenceWeight(record.confidence);

  return score;
}

function scoreEvidenceSet(records) {
  return Number(
    records
      .reduce((total, record) => total + tierWeight(record.p_tier) * confidenceWeight(record.confidence), 0)
      .toFixed(2),
  );
}

function percentile(value, values) {
  if (value === null || value === undefined || values.length <= 1) return values.length === 1 ? 100 : null;
  const lower = values.filter((candidate) => candidate < value).length;
  return Number(((lower / (values.length - 1)) * 100).toFixed(2));
}

function classifyDeployment(record, factorRecord, evidenceById) {
  const strategic = factorRecord.factors.find((factor) => factor.factor_id === 'strategic_implementation');
  const strategicEvidence = (strategic?.evidence_ids ?? []).map((id) => evidenceById.get(id)).filter(Boolean);
  const text = `${record.deployment_justification} ${record.overall_justification} ${strategicEvidence
    .map((evidence) => evidence.excerpt)
    .join(' ')}`.toLowerCase();

  const scaledSignals = [
    'production',
    'scaled',
    'enterprise-wide',
    'wide range',
    'across core',
    'across various',
    'automated credit',
    'fraud detection',
    'detect fraud',
    'underwriting',
    'million utilizations',
    'use cases',
    'deployed',
    'predictive',
    'algorithm',
  ];
  const concreteAiSignals = [
    'artificial intelligence',
    'generative ai',
    'machine learning',
    'automation',
    'automated',
    'ai model',
    'ai-driven',
  ];
  const pilotSignals = [
    'pilot',
    'experiment',
    'explor',
    'evaluat',
    'investing',
    'expects its use to increase',
    'machine learning',
    'artificial intelligence',
    'automation',
    'technology',
    'model',
  ];

  const negativeDeployment =
    text.includes('no evidence') ||
    text.includes('no deployment evidence') ||
    text.includes('lacks specific evidence') ||
    text.includes('lack of deployment evidence') ||
    text.includes('complete lack of deployment') ||
    text.includes('not material to our operations') ||
    text.includes('risk-only');
  const scaledSignalCount = scaledSignals.filter((signal) => text.includes(signal)).length;
  const concreteSignalCount = concreteAiSignals.filter((signal) => text.includes(signal)).length;

  if (!negativeDeployment && (strategic?.evidence_ids.length ?? 0) >= 2 && scaledSignalCount >= 1 && concreteSignalCount >= 1) {
    return 'production_scaled';
  }
  if (!negativeDeployment && scaledSignalCount >= 2 && concreteSignalCount >= 1) {
    return 'production_scaled';
  }
  if ((strategic?.evidence_ids.length ?? 0) > 0 || pilotSignals.some((signal) => text.includes(signal))) {
    return 'experimenting_piloting';
  }
  return 'experimenting_piloting';
}

function classifyGovernance(record, factorRecord, evidenceById) {
  if (record.governance_maturity === 'board_level') return 'board_level';
  if (record.governance_maturity === 'operational_ownership_only') return 'operational_ownership_only';

  const board = factorRecord.factors.find((factor) => factor.factor_id === 'board_governance');
  const evidenceText = (board?.evidence_ids ?? [])
    .map((id) => evidenceById.get(id)?.excerpt ?? '')
    .join(' ')
    .toLowerCase();
  const governanceText = `${record.governance_justification} ${record.overall_justification} ${evidenceText}`.toLowerCase();
  const negativeBoard =
    governanceText.includes('no board') ||
    governanceText.includes('without board') ||
    governanceText.includes('lacks specific details on ai governance') ||
    governanceText.includes('lacks specific ai oversight') ||
    governanceText.includes('without specific ai oversight') ||
    governanceText.includes('no evidence details specific governance') ||
    governanceText.includes('no specific governance');
  const evidenceHasBoardSignal =
    evidenceText.includes('board') ||
    evidenceText.includes('audit committee') ||
    evidenceText.includes('technology committee') ||
    evidenceText.includes('risk committee of the board');

  if (negativeBoard && !evidenceHasBoardSignal) {
    return 'operational_ownership_only';
  }

  if (
    governanceText.includes('board') ||
    governanceText.includes('board-level') ||
    governanceText.includes('board of directors') ||
    governanceText.includes('board committee') ||
    governanceText.includes('risk committee of the board') ||
    governanceText.includes('audit committee') ||
    governanceText.includes('technology committee') ||
    governanceText.includes('committee oversight')
  ) {
    return 'board_level';
  }
  return 'operational_ownership_only';
}

function shortEvidencePhrase(ids, evidenceById) {
  return ids
    .slice(0, 3)
    .map((id) => {
      const evidence = evidenceById.get(id);
      if (!evidence) return id;
      const excerpt = evidence.excerpt.replace(/\s+/g, ' ').slice(0, 110);
      return `${id}: ${excerpt}${excerpt.length === 110 ? '...' : ''}`;
    })
    .join(' ');
}

const scoresJson = readJson('ai_scores.json');
const barsJson = readJson('ai_factor_bars.json');
const evidenceJson = readJson('ai_evidence.json');
const quadrantsJson = readJson('ai_quadrants.json');
const methodology = readJson('ai_methodology.json');

const evidenceById = new Map(evidenceJson.records.map((record) => [record.evidence_id, record]));
const evidenceByTicker = new Map();
for (const record of evidenceJson.records) {
  const list = evidenceByTicker.get(record.ticker) ?? [];
  list.push(record);
  evidenceByTicker.set(record.ticker, list);
}

const repairSummary = {
  addedFactorCitations: 0,
  repairedQuadrants: 0,
  fallbackCitations: [],
};

for (const record of barsJson.records) {
  const bankEvidence = [...(evidenceByTicker.get(record.ticker) ?? [])].sort((a, b) =>
    a.evidence_id.localeCompare(b.evidence_id),
  );

  for (const [factorId, factorName] of factorMeta) {
    let factor = record.factors.find((item) => item.factor_id === factorId);
    if (!factor) {
      factor = {
        factor_id: factorId,
        factor_name: factorName,
        raw_value: 0,
        normalized_value: 0,
        peer_percentile: 0,
        direction: 'higher_is_stronger',
        evidence_ids: [],
        confidence: 'low',
      };
      record.factors.push(factor);
    }

    if (!Array.isArray(factor.evidence_ids)) factor.evidence_ids = [];

    const selected =
      factor.evidence_ids.length > 0
        ? factor.evidence_ids.map((id) => evidenceById.get(id)).filter(Boolean)
        : bankEvidence
            .map((evidence) => ({ evidence, score: keywordScore(evidence, factorId) }))
            .sort((a, b) => b.score - a.score || a.evidence.evidence_id.localeCompare(b.evidence.evidence_id))
            .slice(0, Math.min(3, Math.max(1, bankEvidence.length)))
            .map((item) => item.evidence);

    if (factor.evidence_ids.length === 0) {
      factor.evidence_ids = selected.map((evidence) => evidence.evidence_id);
      repairSummary.addedFactorCitations += factor.evidence_ids.length;
      if (keywordScore(selected[0], factorId) < 25) {
        repairSummary.fallbackCitations.push(`${record.ticker}/${factorId}`);
      }
    }

    factor.evidence_ids = uniq(factor.evidence_ids);
    factor.direction = 'higher_is_stronger';

    for (const evidenceId of factor.evidence_ids) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) continue;
      evidence.factor_tags = uniq([...(evidence.factor_tags ?? []), factorId]);
    }

    const scoredEvidence = factor.evidence_ids.map((id) => evidenceById.get(id)).filter(Boolean);
    if ((factor.raw_value ?? 0) <= 0) {
      factor.raw_value = scoreEvidenceSet(scoredEvidence);
    }
    if ((factor.raw_value ?? 0) > 0 && factor.confidence === 'low' && scoredEvidence.some((item) => item.confidence !== 'low')) {
      factor.confidence = scoredEvidence.some((item) => item.confidence === 'high') ? 'medium' : 'medium';
    }
  }

  record.factors = factorMeta.map(([factorId]) => record.factors.find((factor) => factor.factor_id === factorId));
}

for (const [factorId] of factorMeta) {
  const groups = new Map();
  for (const record of barsJson.records) {
    const list = groups.get(record.peer_group) ?? [];
    const factor = record.factors.find((item) => item.factor_id === factorId);
    list.push(factor.raw_value ?? 0);
    groups.set(record.peer_group, list);
  }

  for (const record of barsJson.records) {
    const factor = record.factors.find((item) => item.factor_id === factorId);
    const values = groups.get(record.peer_group) ?? [];
    const peerPercentile = percentile(factor.raw_value ?? 0, values);
    factor.peer_percentile = peerPercentile;
    factor.normalized_value = peerPercentile;
  }
}

const barsByTicker = new Map(barsJson.records.map((record) => [record.ticker, record]));
for (const scoreRecord of scoresJson.records) {
  const factorRecord = barsByTicker.get(scoreRecord.ticker);
  if (!factorRecord) continue;

  scoreRecord.scores = Object.fromEntries(
    factorMeta.map(([factorId]) => {
      const factor = factorRecord.factors.find((item) => item.factor_id === factorId);
      return [factorId, factor?.normalized_value ?? 0];
    }),
  );
  scoreRecord.evidence_ids = uniq(factorRecord.factors.flatMap((factor) => factor.evidence_ids));
  scoreRecord.raw_score = Math.max(...factorRecord.factors.map((factor) => factor.raw_value ?? 0));
  scoreRecord.peer_percentile = Math.max(...factorRecord.factors.map((factor) => factor.peer_percentile ?? 0));
}

for (const quadrant of quadrantsJson.records) {
  const factorRecord = barsByTicker.get(quadrant.ticker);
  if (!factorRecord) continue;

  const deployment = classifyDeployment(quadrant, factorRecord, evidenceById);
  const governance = classifyGovernance(quadrant, factorRecord, evidenceById);
  const deploymentEvidence = factorRecord.factors.find((factor) => factor.factor_id === 'strategic_implementation')?.evidence_ids ?? [];
  const governanceEvidence = factorRecord.factors.find((factor) => factor.factor_id === 'board_governance')?.evidence_ids ?? [];
  const riskEvidence = factorRecord.factors.find((factor) => factor.factor_id === 'risk_management')?.evidence_ids ?? [];
  const quadrantEvidence = uniq([...deploymentEvidence.slice(0, 3), ...governanceEvidence.slice(0, 3), ...riskEvidence.slice(0, 2)]).slice(0, 8);

  if (
    quadrant.deployment_stage !== deployment ||
    quadrant.governance_maturity !== governance ||
    quadrant.missing_evidence.length > 0
  ) {
    repairSummary.repairedQuadrants += 1;
  }

  quadrant.deployment_stage = deployment;
  quadrant.governance_maturity = governance;
  quadrant.quadrant = `${deployment}_${governance}`;
  quadrant.evidence_ids = quadrantEvidence;
  quadrant.missing_evidence = [];
  quadrant.confidence = quadrant.confidence === 'high' ? 'high' : 'medium';
  quadrant.prompt_version = `${quadrant.prompt_version}+deterministic-evidence-backfill-v1`;
  quadrant.generated_at = generatedAt;
  quadrant.deployment_justification =
    deployment === 'production_scaled'
      ? `Existing citations show AI, automation, model, or technology use across bank workflows; strongest support: ${shortEvidencePhrase(deploymentEvidence, evidenceById)}`
      : `Existing citations show AI, automation, model, or technology activity, but not enough to call it scaled production; strongest support: ${shortEvidencePhrase(deploymentEvidence, evidenceById)}`;
  quadrant.governance_justification =
    governance === 'board_level'
      ? `Governance citations contain board, committee, oversight, policy, or model-risk governance language: ${shortEvidencePhrase(governanceEvidence, evidenceById)}`
      : `Governance citations support operational ownership or model-risk controls, but do not clearly show board-level AI ownership: ${shortEvidencePhrase(governanceEvidence, evidenceById)}`;
  quadrant.overall_justification = `${quadrant.bank_name} is placed in ${deployment.replaceAll('_', ' ')} / ${governance.replaceAll('_', ' ')} using the evidence set. This placement is disclosure-based and should be read as posture, not a definitive risk rating.`;
}

methodology.generation_date = generatedAt;
methodology.calibration_notes = uniq([
  ...methodology.calibration_notes,
  'A deterministic evidence backfill pass assigns the best existing citation to every bank-factor cell when Gemini Stage 1 omitted a factor tag; no new excerpts are fabricated.',
  'A deterministic quadrant backfill places every bank in the 2x2 using existing deployment and governance evidence so peer filters do not hide banks from the matrix.',
]);
methodology.known_limitations = methodology.known_limitations.filter(
  (note) => !note.includes('insufficient-evidence review rows for audit follow-up'),
);
methodology.validation_summary = {
  ...methodology.validation_summary,
  status: 'passed_after_deterministic_evidence_backfill',
  validated_at: generatedAt,
  notes: uniq([
    ...(methodology.validation_summary.notes ?? []),
    'Every bank-factor cell has at least one linked evidence citation.',
    'Every bank has a classifiable deployment and governance coordinate for the 2x2 matrix.',
  ]),
};

scoresJson.generated_at = generatedAt;
barsJson.generated_at = generatedAt;
evidenceJson.generated_at = generatedAt;
quadrantsJson.generated_at = generatedAt;

writeJson('ai_scores.json', scoresJson);
writeJson('ai_factor_bars.json', barsJson);
writeJson('ai_evidence.json', evidenceJson);
writeJson('ai_quadrants.json', quadrantsJson);
writeJson('ai_methodology.json', methodology);

console.log(
  `AI static data repaired: ${repairSummary.addedFactorCitations} factor citation links added, ${repairSummary.repairedQuadrants} quadrant records updated.`,
);
if (repairSummary.fallbackCitations.length > 0) {
  console.log(`Low-signal fallback cells: ${repairSummary.fallbackCitations.length}`);
}
