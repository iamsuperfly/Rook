import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublicBook } from "@/lib/web/load-public";
import { publicPhotoPath, publicReceiptPath } from "@/lib/web/site";
import { fmtSignedPct, recordsStats, toPublicCard } from "@/lib/web/records-view";

export const dynamic = "force-dynamic";

export default async function PublicRecordsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const book = await loadPublicBook(username);
  if (!book) notFound();

  const closed = book.closed.filter((r) => r.status !== "open");
  const stats = recordsStats(closed);
  const cards = closed.map(toPublicCard);
  const initial = (book.profile.firstName || book.profile.username).slice(0, 1).toUpperCase();

  return (
    <main className="rook-page">
      <div className="rook-top">
        <Link href="/" className="rook-mark">
          ROOK
        </Link>
        <p className="rook-kicker">PUBLIC RECORDS</p>
      </div>

      <section className="rook-profile">
        {book.profile.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="rook-avatar"
            src={publicPhotoPath(book.profile.username)}
            alt=""
            width={64}
            height={64}
          />
        ) : (
          <div className="rook-avatar rook-avatar-fallback" aria-hidden>
            {initial}
          </div>
        )}
        <div>
          <h1>{book.profile.firstName || book.profile.username}</h1>
          <p className="rook-muted">@{book.profile.username}</p>
          <p className="rook-muted">Paper desk · no real orders</p>
        </div>
      </section>

      <section className="rook-stats" aria-label="Records summary">
        <div>
          <span className="rook-stat-n">{stats.closed}</span>
          <span className="rook-stat-l">closed calls</span>
        </div>
        <div>
          <span className="rook-stat-n">{stats.wins}</span>
          <span className="rook-stat-l">wins</span>
        </div>
        <div>
          <span className="rook-stat-n">{stats.losses}</span>
          <span className="rook-stat-l">losses</span>
        </div>
        <div>
          <span className="rook-stat-n">{stats.liquidated}</span>
          <span className="rook-stat-l">liquidated</span>
        </div>
      </section>
      {(stats.avgWinner !== null || stats.avgLoser !== null) && (
        <p className="rook-meta">
          {stats.avgWinner !== null ? `Avg winner ${fmtSignedPct(stats.avgWinner)}` : ""}
          {stats.avgWinner !== null && stats.avgLoser !== null ? " · " : ""}
          {stats.avgLoser !== null ? `Avg loser ${fmtSignedPct(stats.avgLoser)}` : ""}
        </p>
      )}
      <p className="rook-meta">
        Wins and losses count directional closed calls with a stored P&amp;L. Legacy or unscored
        rows stay in the list. Liquidated is a close status, counted separately.
      </p>

      <h2>History</h2>
      {cards.length === 0 ? (
        <p className="rook-empty">No closed paper calls yet. Stopped, invalidated, and liquidated calls land here.</p>
      ) : (
        <ul className="rook-list">
          {cards.map((card) => (
            <li key={card.id}>
              <Link className="rook-row" href={publicReceiptPath(book.profile.username, card.id)}>
                <div className="rook-row-top">
                  <span className="rook-sym">{card.symbol}</span>
                  <span className={`rook-pnl rook-pnl-${card.pnlTone}`}>
                    {card.pnlPct}
                    {card.pnlUsdt ? ` · ${card.pnlUsdt}` : ""}
                  </span>
                </div>
                <div className="rook-row-sub">
                  <span>
                    {card.side} · {card.horizon}
                    <span className={`rook-badge rook-badge-${card.status.toLowerCase()}`}>
                      {card.status}
                    </span>
                  </span>
                  <span className="rook-muted">
                    {card.entry}
                    {card.exit ? ` → ${card.exit}` : ""}
                  </span>
                </div>
                <p className="rook-meta">{card.closedAt ?? card.openedAt}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="rook-foot">Paper simulation · Rook never places an order.</p>
    </main>
  );
}
