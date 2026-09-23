import { spawn } from "node:child_process";
import path from "node:path";
import type { DebateBundle, Horizon, JudgeReport, MarketSnapshot, Side } from "@/lib/types";
import { applyAuthoritativeInvalidation } from "./invalidation";
import { parseJudgeReport } from "./judge";

export function crewEnabled(): boolean {
  const v = (process.env.CREW_ENABLED ?? "true").toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

export function crewHttpUrl(): string | null {
  const raw = (process.env.CREW_HTTP_URL ?? "").trim().replace(/\/$/, "");
  return raw.length ? raw : null;
}

function crewHttpHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = (process.env.CREW_HTTP_SECRET ?? "").trim();
  if (secret) headers.authorization = `Bearer ${secret}`;
  return headers;
}

export async function runCrewHttp(opts: {
  symbol: string;
  horizon: Horizon;
  side: Side;
  snapshot: MarketSnapshot;
  timeoutMs?: number;
}): Promise<JudgeReport> {
  const base = crewHttpUrl();
  if (!base) throw new Error("crew_http_unconfigured");
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/debate`, {
      method: "POST",
      headers: crewHttpHeaders(),
      body: JSON.stringify({
        symbol: opts.symbol,
        horizon: opts.horizon,
        side: opts.side,
        snapshot: opts.snapshot,
      }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`crew_http_${res.status}:${text.slice(0, 400)}`);
    return applyAuthoritativeInvalidation(parseJudgeReport(text, opts.symbol, opts.horizon), opts.snapshot);
  } finally {
    clearTimeout(timer);
  }
}

export async function runCrewPython(opts: {
  symbol: string;
  horizon: Horizon;
  side: Side;
  snapshot: MarketSnapshot;
  timeoutMs?: number;
}): Promise<JudgeReport> {
  const py = process.env.CREW_PYTHON ?? "python3";
  const script = process.env.CREW_SCRIPT ?? path.join(process.cwd(), "crew", "crew.py");
  const payload = JSON.stringify({
    symbol: opts.symbol,
    horizon: opts.horizon,
    side: opts.side,
    snapshot: opts.snapshot,
  });

  return new Promise((resolve, reject) => {
    const child = spawn(py, [script, "--json"], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("crew_timeout"));
    }, opts.timeoutMs ?? 90_000);

    child.stdout.on("data", (d) => {
      out += String(d);
    });
    child.stderr.on("data", (d) => {
      err += String(d);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out.trim()) {
        reject(new Error(`crew_exit_${code}:${err.slice(0, 400)}`));
        return;
      }
      resolve(applyAuthoritativeInvalidation(parseJudgeReport(out, opts.symbol, opts.horizon), opts.snapshot));
    });
    child.stdin.write(payload);
    child.stdin.end();
  });
}

export async function runCrewEngine(opts: {
  symbol: string;
  horizon: Horizon;
  side: Side;
  snapshot: MarketSnapshot;
  timeoutMs?: number;
}): Promise<JudgeReport> {
  if (crewHttpUrl()) return runCrewHttp(opts);
  return runCrewPython(opts);
}

export async function debateViaCrew(opts: {
  symbol: string;
  horizon: Horizon;
  side: Side;
  snapshot: MarketSnapshot;
  news: string;
}): Promise<DebateBundle | null> {
  if (!crewEnabled()) return null;
  try {
    const report = await runCrewEngine({
      symbol: opts.symbol,
      horizon: opts.horizon,
      side: opts.side,
      snapshot: opts.snapshot,
    });
    report.symbol = opts.snapshot.symbol;
    report.horizon = opts.horizon;
    return {
      snapshot: opts.snapshot,
      news: opts.news,
      bullBear: `${report.bull_summary}\n\n${report.bear_summary}`,
      report,
    };
  } catch (err) {
    console.warn("[crew-bridge] crew engine failed, caller should fallback", err);
    return null;
  }
}
