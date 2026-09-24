import Link from "next/link";

export default function PublicNotFound() {
  return (
    <main className="rook-page">
      <Link href="/" className="rook-mark">ROOK</Link>
      <h1>No public Records page</h1>
      <p className="rook-muted">
        That username is not published, or the person has not set a public Telegram username yet.
      </p>
    </main>
  );
}
