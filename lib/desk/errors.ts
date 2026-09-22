/** Turn Supabase / Telegram / unknown throws into a readable line. */
export function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const rec = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [rec.message, rec.details, rec.hint, rec.code]
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => String(x));
    if (parts.length) return parts.join(" — ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown";
  }
}
