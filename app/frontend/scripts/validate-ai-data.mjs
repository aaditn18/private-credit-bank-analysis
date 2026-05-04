import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data', 'ai');

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), 'utf8'));
}

const scores = readJson('ai_scores.json').records;
const factorBars = readJson('ai_factor_bars.json').records;
const evidence = readJson('ai_evidence.json').records;
const quadrants = readJson('ai_quadrants.json').records;
const timelines = readJson('ai_timeline.json').records;

const failures = [];
const evidenceIds = new Set();
const evidenceById = new Map();
const canonicalFactorIds = [
  'board_governance',
  'strategic_implementation',
  'risk_management',
  'leadership_acumen',
  'growth_profitability',
  'compliance',
  'strategic_risk',
];

for (const record of evidence) {
  if (evidenceIds.has(record.evidence_id)) {
    failures.push(`Duplicate evidence_id: ${record.evidence_id}`);
  }
  evidenceIds.add(record.evidence_id);
  evidenceById.set(record.evidence_id, record);
}

function assertEvidenceIds(context, ids) {
  const seen = new Set();
  for (const id of ids ?? []) {
    if (seen.has(id)) failures.push(`${context} repeats evidence_id ${id}`);
    seen.add(id);
    if (!evidenceIds.has(id)) failures.push(`${context} references missing evidence_id ${id}`);
  }
}

function assertUniqueTickers(context, records) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.ticker)) failures.push(`${context} repeats ticker ${record.ticker}`);
    seen.add(record.ticker);
  }
  return seen;
}

function assertSameTickerSet(context, actualSet, expectedSet) {
  for (const ticker of expectedSet) {
    if (!actualSet.has(ticker)) failures.push(`${context} missing ticker ${ticker}`);
  }
  for (const ticker of actualSet) {
    if (!expectedSet.has(ticker)) failures.push(`${context} has unexpected ticker ${ticker}`);
  }
}

const scoreTickers = assertUniqueTickers('scores', scores);
const factorTickers = assertUniqueTickers('factor bars', factorBars);
const quadrantTickers = assertUniqueTickers('quadrants', quadrants);
const timelineTickers = assertUniqueTickers('timelines', timelines);

assertSameTickerSet('factor bars', factorTickers, scoreTickers);
assertSameTickerSet('quadrants', quadrantTickers, scoreTickers);
assertSameTickerSet('timelines', timelineTickers, scoreTickers);

for (const record of scores) {
  assertEvidenceIds(`score ${record.ticker}`, record.evidence_ids);

  const scoreFactorIds = Object.keys(record.scores ?? {});
  for (const factorId of canonicalFactorIds) {
    if (!scoreFactorIds.includes(factorId)) failures.push(`Score missing canonical factor: ${record.ticker}/${factorId}`);
  }
  for (const factorId of scoreFactorIds) {
    if (!canonicalFactorIds.includes(factorId)) failures.push(`Score has unexpected factor: ${record.ticker}/${factorId}`);
  }
}

for (const record of factorBars) {
  const factorIds = record.factors.map((factor) => factor.factor_id);
  for (const factorId of canonicalFactorIds) {
    if (!factorIds.includes(factorId)) failures.push(`Missing canonical factor: ${record.ticker}/${factorId}`);
  }
  for (const factorId of factorIds) {
    if (!canonicalFactorIds.includes(factorId)) failures.push(`Unexpected factor: ${record.ticker}/${factorId}`);
  }
  if (new Set(factorIds).size !== factorIds.length) {
    failures.push(`Duplicate factor id in bank record: ${record.ticker}`);
  }

  for (const factor of record.factors) {
    assertEvidenceIds(`factor ${record.ticker}/${factor.factor_id}`, factor.evidence_ids);

    if (factor.evidence_ids.length === 0) {
      failures.push(`Factor lacks required citation: ${record.ticker}/${factor.factor_id}`);
    }

    for (const id of factor.evidence_ids) {
      if (!evidenceById.get(id)?.factor_tags?.includes(factor.factor_id)) {
        failures.push(`Factor citation lacks matching evidence tag: ${record.ticker}/${factor.factor_id}/${id}`);
      }
    }

    if ((factor.normalized_value ?? 0) > 0 && factor.evidence_ids.length === 0) {
      failures.push(`Nonzero factor lacks evidence: ${record.ticker}/${factor.factor_id}`);
    }
  }
}

for (const record of quadrants) {
  assertEvidenceIds(`quadrant ${record.ticker}`, record.evidence_ids);

  if (record.deployment_stage === 'insufficient_evidence') {
    failures.push(`Quadrant deployment axis is not plotted: ${record.ticker}`);
  }

  if (record.governance_maturity === 'insufficient_evidence') {
    failures.push(`Quadrant governance axis is not plotted: ${record.ticker}`);
  }

  if (record.evidence_ids.length === 0) {
    failures.push(`Quadrant lacks required citation: ${record.ticker}`);
  }

  if ((record.missing_evidence ?? []).length > 0) {
    failures.push(`Quadrant still reports missing evidence: ${record.ticker}`);
  }

  const governanceIsClassified = record.governance_maturity !== 'insufficient_evidence';
  const boardFactor = factorBars
    .find((bars) => bars.ticker === record.ticker)
    ?.factors.find((factor) => factor.factor_id === 'board_governance');

  if (governanceIsClassified && (boardFactor?.evidence_ids.length ?? 0) === 0) {
    failures.push(`Classified governance lacks board_governance evidence: ${record.ticker}`);
  }
}

for (const record of timelines) {
  for (const quarter of record.quarters) {
    assertEvidenceIds(`timeline ${record.ticker}/${quarter.period}`, quarter.evidence_ids);

    const resolvedCount = [...new Set(quarter.evidence_ids)].filter((id) => evidenceIds.has(id)).length;
    if (resolvedCount !== quarter.evidence_ids.length) {
      failures.push(
        `Timeline count mismatch for ${record.ticker}/${quarter.period}: ${quarter.evidence_ids.length} ids, ${resolvedCount} resolved`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`AI data validation failed with ${failures.length} issue(s):`);
  for (const failure of failures.slice(0, 100)) console.error(`- ${failure}`);
  if (failures.length > 100) console.error(`... ${failures.length - 100} more`);
  process.exit(1);
}

console.log(
  `AI data validation passed: ${scores.length} scores, ${factorBars.length} factor bars, ${quadrants.length} quadrants, ${timelines.length} timelines, ${evidence.length} evidence records.`,
);
