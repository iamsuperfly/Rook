const DEFAULT_BASE = process.env.BITGET_BASE ?? "https://api.bitget.com";

export interface BitgetTicker {
  symbol: string;
  lastPr?: string;
  bidPr?: string;
  askPr?: string;
  high24h?: string;
  low24h?: string;
  change24h?: string;
  changeUtc24h?: string;
  baseVolume?: string;
  quoteVolume?: string;
  usdtVolume?: string;
}

export interface BitgetCandle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  baseVol: number;
  quoteVol: number;
}

async function getJson(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; body: unknown }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

function isSuccess(body: unknown): body is { code: string; data: unknown } {
  return Boolean(body && typeof body === "object" && "code" in body && (body as { code: string }).code === "00000");
}

export async function fetchTicker(symbol: string, base = DEFAULT_BASE): Promise<{ ticker: BitgetTicker; source: string }> {
  const v2 = `${base}/api/v2/spot/market/tickers?symbol=${encodeURIComponent(symbol)}`;
  const first = await getJson(v2);
  if (isSuccess(first.body) && Array.isArray((first.body as { data: unknown }).data) && (first.body as { data: BitgetTicker[] }).data[0]) {
    console.info("[bitget] ticker v2 ok", symbol);
    return { ticker: (first.body as { data: BitgetTicker[] }).data[0], source: "v2/spot/market/tickers" };
  }

  const v3 = `${base}/api/v3/market/tickers?symbol=${encodeURIComponent(symbol)}`;
  const second = await getJson(v3);
  if (isSuccess(second.body)) {
    const data = (second.body as { data: unknown }).data;
    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row === "object") {
      console.info("[bitget] ticker v3 ok", symbol);
      return { ticker: row as BitgetTicker, source: "v3/market/tickers" };
    }
  }

  throw new Error(`ticker_not_found:${symbol}`);
}

export async function fetchCandles(
  symbol: string,
  granularity = "1h",
  limit = 48,
  base = DEFAULT_BASE,
): Promise<{ candles: BitgetCandle[]; source: string }> {
  const attempts = [
    `${base}/api/v2/spot/market/candles?symbol=${encodeURIComponent(symbol)}&granularity=${granularity}&limit=${limit}`,
    `${base}/api/v2/spot/market/candles?symbol=${encodeURIComponent(symbol)}&granularity=${granularity.toUpperCase()}&limit=${limit}`,
    `${base}/api/v3/market/candles?symbol=${encodeURIComponent(symbol)}&granularity=${granularity}&limit=${limit}`,
  ];

  for (const url of attempts) {
    const res = await getJson(url);
    if (!isSuccess(res.body)) continue;
    const raw = (res.body as { data: unknown }).data;
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const candles = raw.map(parseCandle).filter((c): c is BitgetCandle => c !== null);
    if (candles.length === 0) continue;
    candles.sort((a, b) => a.ts - b.ts);
    console.info("[bitget] candles ok", symbol, url.includes("/v3/") ? "v3" : "v2");
    return { candles, source: url.includes("/v3/") ? "v3/market/candles" : "v2/spot/market/candles" };
  }

  return { candles: [], source: "none" };
}

function parseCandle(row: unknown): BitgetCandle | null {
  if (Array.isArray(row) && row.length >= 5) {
    const ts = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const baseVol = Number(row[5] ?? 0);
    const quoteVol = Number(row[6] ?? 0);
    if (![ts, open, high, low, close].every(Number.isFinite)) return null;
    return { ts, open, high, low, close, baseVol, quoteVol };
  }
  if (row && typeof row === "object") {
    const o = row as Record<string, unknown>;
    const ts = Number(o.ts ?? o.timestamp);
    const open = Number(o.open);
    const high = Number(o.high);
    const low = Number(o.low);
    const close = Number(o.close);
    if (![ts, open, high, low, close].every(Number.isFinite)) return null;
    return {
      ts,
      open,
      high,
      low,
      close,
      baseVol: Number(o.baseVol ?? o.baseVolume ?? 0),
      quoteVol: Number(o.quoteVol ?? o.quoteVolume ?? 0),
    };
  }
  return null;
}
