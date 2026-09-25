import Link from "next/link";

export default function ReceiptNotFound() {
  return (
    <main className="rook-page">
      <Link href="/" className="rook-mark">
        ROOK
      </Link>
      <h1>Receipt not found</h1>
      <p className="rook-muted">That record is not on this public book, or it belongs to someone else.</p>
    </main>
  );
}
