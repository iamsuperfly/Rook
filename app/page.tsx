export default function HomePage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px 96px" }}>
      <p style={{ letterSpacing: "0.18em", fontSize: 12, color: "#8b8370" }}>BITGET AI BASE CAMP S2 · DESK TRACK</p>
      <h1 style={{ fontSize: 56, lineHeight: 1, margin: "12px 0 16px" }}>ROOK</h1>
      <p style={{ fontSize: 20, color: "#cfc6b0", maxWidth: 620 }}>
        Rook is an AI trading desk that doesn&apos;t just build a thesis — it tries to destroy it before you put money
        behind it. Then it watches the invalidation after the cash session.
      </p>
      <p style={{ color: "#9a917c" }}>
        Bitget tokenized US names and related USDT markets. Explicit invalidation. Human decides.{" "}
        <b>Rook never places an order.</b>
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <a
          href="https://t.me/getrookbot"
          style={{
            background: "#d7ff3c",
            color: "#111",
            padding: "12px 18px",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Open @getrookbot
        </a>
        <a
          href="https://github.com/iamsuperfly/Rook"
          style={{
            border: "1px solid #3a372e",
            color: "#e8e4d8",
            padding: "12px 18px",
            textDecoration: "none",
          }}
        >
          GitHub
        </a>
      </div>
      <section style={{ marginTop: 48, color: "#b7ae99", lineHeight: 1.6 }}>
        <h2 style={{ color: "#e8e4d8" }}>Desk loop</h2>
        <ol>
          <li>Scout Bitget public last / 24h / realized vol / SMA20</li>
          <li>Bull and Bear argue from that snapshot</li>
          <li>Judge writes invalidation and “I am wrong if…”</li>
          <li>Watch after hours. Call it off when the line is hit</li>
        </ol>
        <p>
          Not financial advice. No execution. Two Groq orgs, deterministic cron path, Telegram buttons like Sentry.
        </p>
      </section>
    </main>
  );
}
