import type { DeskAction, Horizon, JudgeReport } from "@/lib/types";

const ACTIONS = new Set<DeskAction>(["watch", "reject", "call_off", "hold"]);
const BIASES = new Set(["long", "short", "none"]);
const HORIZONS = new Set(["24h", "7d", "30d"]);

export function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((s) => s.trim().length > 0);
}

function clampInt(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseJudgeReport(text: string, fallbackSymbol: string, fallbackHorizon: Horizon): JudgeReport {
  const blob = extractJsonObject(text);
  if (!blob) {
    return {
      symbol: fallbackSymbol,
      horizon: fallbackHorizon,
      bias: "none",
      confidence: 0,
      strategy: text.slice(0, 1200),
      bull_summary: "",
      bear_summary: "",
      catalysts: [],
      risks: [],
      i_am_wrong_if: [],
      invalidation_price: null,
      invalidation_note: "",
      confirmation_price: null,
      confirmation_trigger: "",
      confirmation_note: "",
      action: "reject",
      reason: "parse_error",
      evidence_quality: 0,
      raw_text: text,
      parse_error: true,
    };
  }

  try {
    const j = JSON.parse(blob) as Record<string, unknown>;
    const actionRaw = String(j.action ?? "reject").toLowerCase() as DeskAction;
    const biasRaw = String(j.bias ?? "none").toLowerCase();
    const horizonRaw = String(j.horizon ?? fallbackHorizon);
    return {
      symbol: String(j.symbol ?? fallbackSymbol).toUpperCase(),
      horizon: (HORIZONS.has(horizonRaw) ? horizonRaw : fallbackHorizon) as Horizon,
      bias: (BIASES.has(biasRaw) ? biasRaw : "none") as JudgeReport["bias"],
      confidence: clampInt(j.confidence),
      strategy: String(j.strategy ?? ""),
      bull_summary: String(j.bull_summary ?? ""),
      bear_summary: String(j.bear_summary ?? ""),
      catalysts: asStringArray(j.catalysts),
      risks: asStringArray(j.risks),
      i_am_wrong_if: asStringArray(j.i_am_wrong_if),
      invalidation_price: asNum(j.invalidation_price),
      invalidation_note: String(j.invalidation_note ?? ""),
      confirmation_price: asNum(j.confirmation_price),
      confirmation_trigger: String(j.confirmation_trigger ?? ""),
      confirmation_note: String(j.confirmation_note ?? j.i_am_right_if ?? ""),
      action: ACTIONS.has(actionRaw) ? actionRaw : "reject",
      reason: String(j.reason ?? ""),
      evidence_quality: clampInt(j.evidence_quality),
      raw_text: text,
    };
  } catch {
    return {
      symbol: fallbackSymbol,
      horizon: fallbackHorizon,
      bias: "none",
      confidence: 0,
      strategy: text.slice(0, 1200),
      bull_summary: "",
      bear_summary: "",
      catalysts: [],
      risks: [],
      i_am_wrong_if: [],
      invalidation_price: null,
      invalidation_note: "",
      confirmation_price: null,
      confirmation_trigger: "",
      confirmation_note: "",
      action: "reject",
      reason: "parse_error",
      evidence_quality: 0,
      raw_text: text,
      parse_error: true,
    };
  }
}
