import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublicReceipt } from "@/lib/web/load-public";
import { publicPhotoPath, publicRecordsPath } from "@/lib/web/site";
import { toPublicReceipt } from "@/lib/web/records-view";

export const dynamic = "force-dynamic";

export default async function PublicReceiptPage({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username, id } = await params;
  const found = await loadPublicReceipt(username, id);
  if (!found) notFound();

  const rec = toPublicReceipt(found.run);
  const initial = (found.profile.firstName || found.profile.username).slice(0, 1).toUpperCase();
  const bookHref = publicRecordsPath(found.profile.username);

  return (
    <main className="rook-page">
      <div className="rook-top">
        <Link href="/" className="rook-mark">
          ROOK
        </Link>
        <Link href={bookHref} className="rook-kicker">
          ← RECORDS
        </Link>
      </div>

      <section className="rook-profile">
        {found.profile.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="rook-avatar"
            src={publicPhotoPath(found.profile.username)}
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
          <p className="rook-kicker">ROOK RECEIPT</p>
          <h1>
            {rec.symbol} · {rec.side}
          </h1>
          <p className="rook-muted">@{found.profile.username}</p>
        </div>
      </section>

      <p className={`rook-status-lg rook-badge rook-badge-${rec.status.toLowerCase()}`}>{rec.status}</p>

      <ol className="rook-seq">
        <li>THESIS</li>
        <li>INVALIDATION</li>
        <li>CONFIRMATION</li>
        <li>PAPER CALL</li>
        <li>OUTCOME</li>
      </ol>

      <dl className="rook-facts">
        <div>
          <dt>Instrument</dt>
          <dd>{rec.symbol}</dd>
        </div>
        <div>
          <dt>Side</dt>
          <dd>{rec.side}</dd>
        </div>
        <div>
          <dt>Horizon</dt>
          <dd>{rec.horizon}</dd>
        </div>
        <div>
          <dt>P&amp;L</dt>
          <dd className={`rook-pnl rook-pnl-${rec.pnlTone}`}>
            {rec.pnlPct}
            {rec.pnlUsdt ? ` · ${rec.pnlUsdt}` : ""}
          </dd>
        </div>
        <div>
          <dt>Entry</dt>
          <dd>{rec.entry}</dd>
        </div>
        <div>
          <dt>Exit / last</dt>
          <dd>{rec.exit}</dd>
        </div>
        {rec.leverage ? (
          <div>
            <dt>Leverage</dt>
            <dd>{rec.leverage}</dd>
          </div>
        ) : null}
        {rec.margin ? (
          <div>
            <dt>Margin</dt>
            <dd>{rec.margin}</dd>
          </div>
        ) : null}
        {rec.exposure ? (
          <div>
            <dt>Exposure</dt>
            <dd>{rec.exposure}</dd>
          </div>
        ) : null}
        {rec.liquidation ? (
          <div>
            <dt>Estimated liquidation (sim)</dt>
            <dd>{rec.liquidation}</dd>
          </div>
        ) : null}
        <div>
          <dt>Opened</dt>
          <dd>{rec.openedAt}</dd>
        </div>
        {rec.closedAt ? (
          <div>
            <dt>Closed</dt>
            <dd>{rec.closedAt}</dd>
          </div>
        ) : null}
      </dl>

      <h2>Thesis</h2>
      <p>{rec.thesis || "No stored thesis text on this record."}</p>

      <h2>Invalidation</h2>
      <p className="rook-sym">
        {rec.invalidation}
        {rec.invRelation ? ` · ${rec.invRelation}` : ""}
      </p>
      {rec.invNote ? <p className="rook-muted">{rec.invNote}</p> : null}

      {rec.confirmationPrice ? (
        <>
          <h2>Confirmation</h2>
          {rec.confirmationState === "confirmed" ? (
            <p className="rook-badge rook-badge-open">CONFIRMED</p>
          ) : (
            <p className="rook-muted">Still developing</p>
          )}
          {rec.confirmationPrice ? (
            <p className="rook-sym">
              {rec.confirmationPrice}
              {rec.confirmationRelation ? ` · ${rec.confirmationRelation}` : ""}
            </p>
          ) : null}
          {rec.confirmationTrigger ? <p>{rec.confirmationTrigger}</p> : null}
          {rec.confirmationNote ? <p className="rook-muted">I&apos;m right if {rec.confirmationNote}</p> : null}
        </>
      ) : null}

      {rec.warningSigns.length > 0 ? (
        <>
          <h2>Warning signs</h2>
          <ul className="rook-bullets">
            {rec.warningSigns.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>Outcome</h2>
      <p>{rec.closeReason}</p>

      <p className="rook-foot">
        Stored thesis and invalidation from the paper call. Not regenerated. Estimated liquidation
        is an isolated paper simulation, not a Bitget engine copy. Rook never places an order.
      </p>
    </main>
  );
}
