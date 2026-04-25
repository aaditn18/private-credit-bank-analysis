export interface Citation {
  marker: number;
  chunk_id: number;
  bank: string;
  doc_type: string;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  section: string | null;
  char_start: number;
  char_end: number;
  text: string;
}

export interface ReasoningStep {
  step_index: number;
  step_type: 'decompose' | 'tool_call' | 'note' | 'synthesize';
  tool_name: string | null;
  tool_arguments: unknown;
  tool_result: unknown;
  summary: string;
}

export interface DriftSignal {
  bank: string;
  concept: string;
  narrative_direction: 'up' | 'down';
  quantitative_direction: 'up' | 'down';
  first_quarter: string;
  last_quarter: string;
  first_value: number;
  last_value: number;
}

export interface SearchResponse {
  run_id: number;
  question: string;
  answer_markdown: string;
  citations: Citation[];
  reasoning_steps: ReasoningStep[];
  disclosure_drift: DriftSignal[];
}

export type AnomalySeverity = 'low' | 'medium' | 'high';

export type AnomalyCategoryKey =
  | 'exposure'
  | 'credit_quality'
  | 'peer_deviation'
  | 'disclosure_nlp'
  | 'events_8k'
  | 'valuation_marks'
  | 'structural'
  | 'macro_divergence';

export type AnomalyTheme = 'private_credit' | 'ai' | 'digital_assets';

export interface AnomalyCitation {
  kind: 'chunk' | 'filing' | 'call_report' | 'event';
  ref_id: number | null;
  label: string | null;
  bank_ticker: string | null;
  quarter: string | null;
  document_id: number | null;
}

export type AnomalySentiment = 'positive' | 'negative' | 'inconclusive';

export interface AnomalyHistoryPoint {
  quarter: string;
  value: number;
}

export interface Anomaly {
  theme: AnomalyTheme;
  category: AnomalyCategoryKey;
  bank_ticker: string;
  severity: AnomalySeverity;
  headline: string;
  detail: string;
  metric_value: number | null;
  peer_median: number | null;
  z_score: number | null;
  quarter: string | null;
  citations: AnomalyCitation[];
  sentiment: AnomalySentiment;
  full_detail: string | null;
  history: AnomalyHistoryPoint[];
}

export interface AnomaliesResponse {
  theme: AnomalyTheme;
  theme_slug: string;
  quarter: string | null;
  peer_group: string | null;
  categories: Record<AnomalyCategoryKey, Anomaly[]>;
  counts: Record<AnomalyCategoryKey, number>;
  total: number;
}

export interface CitationDetail {
  id: number;
  document_id: number;
  bank_ticker: string;
  doc_type: string;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  section_header: string | null;
  char_start: number;
  char_end: number;
  text: string;
  context: string;
  highlight_start: number;
  highlight_end: number;
  source_url: string | null;
  source_path: string;
}
