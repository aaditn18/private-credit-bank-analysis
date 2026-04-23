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
