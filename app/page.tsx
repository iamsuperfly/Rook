import Link from "next/link";
import logo from "./file_00000000d16881f48209a8f881d5cd7f.png";

const logoSrc = typeof logo === "string" ? logo : logo.src;

export default function HomePage() {
  return (
    <main className="rook-home">
      <header className="rook-home-nav">
        <Link href="/" className="rook-home-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" width={36} height={36} className="rook-home-logo-sm" />
          <span>ROOK</span>
        </Link>
        <a className="rook-home-cta" href="https://t.me/getrookbot">
          getrookbot
        </a>
      </header>

      <section className="rook-home-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="Rook" width={120} height={120} className="rook-home-logo" />
        <p className="rook-kicker">CRYPTO MARKETS</p>
        <h1>An adversarial trading desk for crypto markets.</h1>
        <p className="rook-home-lead">
          Build a thesis. Stress-test it. Define what proves it wrong. Define what proves it right.
        </p>
        <p className="rook-muted">
          Rook writes the argument, then tries to break it, before anyone puts size behind it. You decide. Rook never
          places an order.
        </p>
        <a className="rook-home-cta rook-home-cta-lg" href="https://t.me/getrookbot">
          getrookbot
        </a>
      </section>

      <section className="rook-home-grid">
        <article>
          <h2>Thesis</h2>
          <p>A directional argument built from a live public snapshot, then attacked by the other side of the book.</p>
        </article>
        <article>
          <h2>Invalidation</h2>
          <p>
            I&apos;m wrong if… One monitorable condition that proves the argument failed. When that print hits, the
            thesis is called off.
          </p>
        </article>
        <article>
          <h2>Confirmation</h2>
          <p>
            I&apos;m right if… One monitorable condition that proves the argument is playing out. Confirmation is not a
            take-profit and does not close a paper call.
          </p>
        </article>
      </section>

      <section className="rook-home-loop">
        <h2>Desk loop</h2>
        <ol>
          <li>Scout a public ticker — last, 24h range, realized vol, SMA20.</li>
          <li>Bull and Bear argue from that snapshot. No invented prices.</li>
          <li>Judge writes strategy, invalidation, and confirmation.</li>
          <li>Watch both lines. Call it off when invalidation prints.</li>
        </ol>
      </section>

      <section className="rook-home-note">
        <h2>Paper book</h2>
        <p>
          CALL LIVE opens an isolated paper call against public last. Liquidation is a simulation. Records keep the
          stored thesis, not a regenerated one.
        </p>
        <p className="rook-muted">Not financial advice. No execution.</p>
      </section>

      <footer className="rook-foot">Rook · adversarial desk · human decision only</footer>
    </main>
  );
}
