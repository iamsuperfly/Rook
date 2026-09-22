export type Horizon = "24h" | "7d" | "30d";
export type Side = "long" | "short" | "decide";
export type Bias = "long" | "short" | "none";
export type DeskAction = "watch" | "reject" | "call_off" | "hold";
export type CheckEvery = "15m" | "1h" | "4h";
export type PaperStatus = "open" | "stopped" | "invalidated" | "liquidated";

export interface MarketSnapshot {
  symbol: string;
  last: number;
  bid: number | null;
  ask: number | null;
  change24hPct: number;
  high24h: number | null;
  low24h: number | null;
  volumeBase: number | null;
  volumeQuote: number | null;
  realizedVol24hPct: number | null;
  sma20: number | null;
  source: string;
  asOf: string;
}

export interface JudgeReport {
  symbol: string;
  horizon: Horizon;
  bias: Bias;
  confidence: number;
  strategy: string;
  bull_summary: string;
  bear_summary: string;
  catalysts: string[];
  risks: string[];
  i_am_wrong_if: string[];
  invalidation_price: number | null;
  invalidation_note: string;
  action: DeskAction;
  reason: string;
  evidence_quality: number;
  raw_text?: string;
  parse_error?: boolean;
}

export interface InvalidationBlob {
  price: number | null;
  note: string;
  rules: string[];
}

export interface WatchRow {
  id: string;
  chat_id: number;
  symbol: string;
  horizon: Horizon;
  side: string;
  active: boolean;
  last_price: number | null;
  last_confidence: number | null;
  last_action: string | null;
  last_thesis: JudgeReport | null;
  invalidation: InvalidationBlob | null;
  created_at: string;
  updated_at: string;
}

export interface PaperRunRow {
  id: string;
  chat_id: number;
  watch_id: string | null;
  symbol: string;
  horizon: Horizon;
  side: string;
  status: PaperStatus;
  entry_price: number;
  last_price: number | null;
  pnl_pct: number | null;
  pnl_usdt?: number | null;
  margin_usdt?: number | null;
  leverage?: number | null;
  exposure_usdt?: number | null;
  /** Applied 005 column. */
  liquidation_price?: number | null;
  /** Legacy alias if an older row ever stored this name. */
  liq_price?: number | null;
  thesis: JudgeReport;
  invalidation: InvalidationBlob | null;
  opened_at: string;
  closed_at: string | null;
  close_reason: string | null;
  updated_at: string;
}

export interface PaperAccountRow {
  chat_id: number;
  available_usdt: number;
  /** Applied 005 column. */
  initial_claimed: boolean;
  last_daily_claim_at: string | null;
  updated_at: string;
}

export interface UserRow {
  chat_id: number;
  alerts_on: boolean;
  check_every: CheckEvery;
  created_at: string;
}

export type ConvStep =
  | "idle"
  | "await_horizon"
  | "await_side"
  | "await_market"
  | "await_custom_symbol"
  | "await_paper_margin"
  | "await_paper_leverage"
  | "await_add_margin";

export interface PendingPaper {
  report: JudgeReport;
  watchId: string | null;
  side?: string;
  entry?: number;
  marginUsdt?: number;
}

export interface Conversation {
  step: ConvStep;
  horizon?: Horizon;
  side?: Side;
  symbol?: string;
  lastReport?: JudgeReport;
  lastWatchId?: string;
  lastPaperId?: string;
  pendingPaper?: PendingPaper;
}

export interface DebateBundle {
  snapshot: MarketSnapshot;
  news: string;
  bullBear: string;
  report: JudgeReport;
}

export const DISCLAIMER =
  "Rook does not place trades. Not financial advice. Human decision only.";
