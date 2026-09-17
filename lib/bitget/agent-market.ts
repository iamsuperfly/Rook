/**
 * Agent Hub market adapter (read-only).
 * Uses Bitget public REST the same way bitget-agent-sdk market verbs do.
 * Does not import trade/account surfaces. No API key.
 */

const BASE = process.env.BITGET_BASE ?? "https://api.bitget.com";

export async function agentHubTicker(symbol: string): Promise<{
  symbol: string;
  last: number;
  change24h: string | null;
  source: string;
} | null> {
  try {
    const url = `${BASE}/api/v2/spot/market/tickers?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { code?: string; data?: Array<{ symbol?: string; lastPr?: string; change24h?: string }> };
    if (body.code !== "00000" || !body.data?.[0]?.lastPr) return null;
    const row = body.data[0];
    return {
      symbol: row.symbol ?? symbol,
      last: Number(row.lastPr),
      change24h: row.change24h ?? null,
      source: "agent-hub-public-ticker",
    };
  } catch {
    return null;
  }
}
