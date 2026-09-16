/**
 * Bitget Agent Hub signal stack.
 * Official public MCP from @bitget-ai/bitget-signal installer:
 *   https://datahub.noxiaohao.com/mcp
 */

const DEFAULT_MCP = process.env.BITGET_SIGNAL_MCP ?? "https://datahub.noxiaohao.com/mcp";

function parseSseJson(text: string): unknown {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      const raw = trimmed.slice(5).trim();
      if (raw) return JSON.parse(raw);
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function mcpCall(method: string, params: Record<string, unknown>, sessionId?: string): Promise<{ sessionId: string; body: unknown }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const res = await fetch(DEFAULT_MCP, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now() % 1_000_000, method, params }),
    signal: AbortSignal.timeout(12_000),
  });
  const sid = res.headers.get("mcp-session-id") ?? sessionId ?? "";
  const text = await res.text();
  return { sessionId: sid, body: parseSseJson(text) };
}

function toolText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const result = (body as { result?: { content?: Array<{ text?: string }> } }).result;
  const content = result?.content;
  if (Array.isArray(content)) {
    return content.map((c) => c.text ?? "").filter(Boolean).join("\n");
  }
  try {
    return JSON.stringify(result ?? body).slice(0, 4000);
  } catch {
    return "";
  }
}

export async function collectSignalBrief(symbol: string): Promise<string> {
  const needle = symbol.replace(/USDT$/i, "").replace(/^R/i, "").toLowerCase();
  const coinId = needle === "btc" ? "bitcoin" : needle === "eth" ? "ethereum" : needle;

  try {
    const init = await mcpCall("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "rook", version: "1.0.0" },
    });
    const sid = init.sessionId;
    const chunks: string[] = [];

    const sentiment = await mcpCall("tools/call", { name: "sentiment_index", arguments: { action: "current" } }, sid);
    const sText = toolText(sentiment.body);
    if (sText) chunks.push(`SENTIMENT\n${sText.slice(0, 800)}`);

    const market = await mcpCall(
      "tools/call",
      { name: "crypto_market", arguments: { action: "price", coin_ids: coinId === "nvda" ? "bitcoin" : coinId, vs_currency: "usd" } },
      sid,
    );
    const mText = toolText(market.body);
    if (mText) chunks.push(`MARKET\n${mText.slice(0, 800)}`);

    const news = await mcpCall("tools/call", { name: "tradfi_news", arguments: { action: "crypto_news", limit: 8 } }, sid);
    const nText = toolText(news.body);
    if (nText && !/FINNHUB_API_KEY|error|requires/i.test(nText)) chunks.push(`NEWS\n${nText.slice(0, 1200)}`);

    if (!chunks.length) return "no external headlines available";
    return [`bitget-signal MCP (${DEFAULT_MCP})`, `symbol ${symbol}`, ...chunks].join("\n\n");
  } catch (err) {
    console.warn("[signal] mcp failed", err);
    return "no external headlines available";
  }
}
