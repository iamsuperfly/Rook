const FALLBACK_HOST = "https://rook-virid.vercel.app";

export function publicSiteUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  const prod = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim().replace(/^https?:\/\//, "");
  if (prod) return `https://${prod.replace(/\/$/, "")}`;
  const preview = (process.env.VERCEL_URL ?? "").trim().replace(/^https?:\/\//, "");
  if (preview) return `https://${preview.replace(/\/$/, "")}`;
  return FALLBACK_HOST;
}

export function normalizePublicUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{5,32}$/.test(cleaned)) return null;
  return cleaned;
}

export function publicRecordsPath(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

export function publicReceiptPath(username: string, recordId: string): string {
  return `/u/${encodeURIComponent(username)}/receipt/${encodeURIComponent(recordId)}`;
}

export function publicRecordsUrl(username: string): string {
  return `${publicSiteUrl()}${publicRecordsPath(username)}`;
}

export function publicReceiptUrl(username: string, recordId: string): string {
  return `${publicSiteUrl()}${publicReceiptPath(username, recordId)}`;
}

export function publicPhotoPath(username: string): string {
  return `/api/u/${encodeURIComponent(username)}/photo`;
}
