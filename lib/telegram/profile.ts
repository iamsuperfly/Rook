const API = "https://api.telegram.org";

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export async function fetchTelegramPhotoFileId(userId: number): Promise<string | null> {
  const t = token();
  if (!t) return null;
  try {
    const res = await fetch(`${API}/bot${t}/getUserProfilePhotos?user_id=${userId}&limit=1`);
    const json = (await res.json()) as {
      ok: boolean;
      result?: { photos?: Array<Array<{ file_id: string; width: number }>> };
    };
    if (!json.ok) return null;
    const set = json.result?.photos?.[0];
    if (!set?.length) return null;
    const largest = [...set].sort((a, b) => b.width - a.width)[0];
    return largest?.file_id ?? null;
  } catch (err) {
    console.warn("[tg] getUserProfilePhotos", err);
    return null;
  }
}

export async function fetchTelegramFile(fileId: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const t = token();
  if (!t) return null;
  try {
    const metaRes = await fetch(`${API}/bot${t}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const meta = (await metaRes.json()) as { ok: boolean; result?: { file_path?: string } };
    const path = meta.result?.file_path;
    if (!meta.ok || !path) return null;
    const fileRes = await fetch(`${API}/file/bot${t}/${path}`);
    if (!fileRes.ok) return null;
    const bytes = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get("content-type") || "image/jpeg";
    return { bytes, contentType };
  } catch (err) {
    console.warn("[tg] getFile", err);
    return null;
  }
}
