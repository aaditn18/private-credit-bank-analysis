export type AIConfidence = 'high' | 'medium' | 'low';

export type AIFactorId =
  | 'board_governance'
  | 'strategic_implementation'
  | 'risk_management'
  | 'leadership_acumen'
  | 'growth_profitability'
  | 'compliance'
  | 'strategic_risk';

export type AIDeploymentStage =
  | 'production_scaled'
  | 'experimenting_piloting'
  | 'insufficient_evidence';

export type AIGovernanceMaturity =
  | 'board_level'
  | 'operational_ownership_only'
  | 'insufficient_evidence';

export type AIDisclosurePosture =
  | 'absent'
  | 'generic'
  | 'emerging'
  | 'specific'
  | 'mature';

export interface AIJsonEnvelope<T> {
  schema_version: string;
  generated_at?: string;
  records: T[];
}

export interface AIScoreRecord {
  ticker: string;
  bank_name: string;
  peer_group: string;
  quarter_or_period: string;
  scores: Record<AIFactorId, number>;
  raw_score: number | null;
  peer_percentile: number | null;
  evidence_ids: string[];
  confidence: AIConfidence;
  limitations: string[];
}

export interface AIFactorBar {
  factor_id: AIFactorId;
  factor_name: string;
  raw_value: number | null;
  normalized_value: number | null;
  peer_percentile: number | null;
  direction: string;
  evidence_ids: string[];
  confidence: AIConfidence;
}

export interface AIFactorBarsRecord {
  ticker: string;
  peer_group: string;
  factors: AIFactorBar[];
}

export interface AIEvidenceRecord {
  evidence_id: string;
  ticker: string;
  bank_name: string;
  source_type: string | null;
  document_id: number | string | null;
  document_title: string | null;
  filing_type: string | null;
  accession_or_source_id: string | null;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  section: string | null;
  excerpt: string;
  excerpt_start_char: number | null;
  excerpt_end_char: number | null;
  ai_relevance: number | string | null;
  factor_tags: AIFactorId[];
  p_tier: string | null;
  confidence: AIConfidence;
  notes: string | null;
}

export interface AIQuadrantRecord {
  ticker: string;
  bank_name: string;
  peer_group: string;
  deployment_stage: AIDeploymentStage;
  governance_maturity: AIGovernanceMaturity;
  quadrant: string;
  deployment_justification: string;
  governance_justification: string;
  overall_justification: string;
  confidence: AIConfidence;
  evidence_ids: string[];
  missing_evidence: string[];
  generated_at: string;
  model_name: string;
  prompt_version: string;
}

export interface AITimelineQuarter {
  period: string;
  disclosure_posture: AIDisclosurePosture;
  posture_reason: string;
  evidence_ids: string[];
  confidence: AIConfidence;
  regulatory_events: string[];
}

export interface AITimelineRecord {
  ticker: string;
  quarters: AITimelineQuarter[];
}

export interface AIMethodology {
  schema_version: string;
  generation_date: string;
  model_names: string[];
  prompt_versions: string[];
  scoring_definitions: Record<string, string>;
  quadrant_axis_definitions: Record<string, string>;
  known_limitations: string[];
  calibration_notes: string[];
  validation_summary: {
    status: string;
    validated_at: string;
    validator_version: string;
    notes: string[];
  };
}

export interface AIBankBundle {
  score: AIScoreRecord;
  bars: AIFactorBarsRecord | null;
  quadrant: AIQuadrantRecord | null;
  timeline: AITimelineRecord | null;
  topEvidence: AIEvidenceRecord[];
}
