export type GroqOrg = "A" | "B";

const BASE_URL = "https://api.groq.com/openai/v1";

function keyFor(org: GroqOrg): string | undefined {
  return org === "A" ? process.env.GROQ_API_KEY_A : process.env.GROQ_API_KEY_B;
}

function modelFor(org: GroqOrg): string {
  if (org === "A") return process.env.GROQ_MODEL_A || "openai/gpt-oss-20b";
  return process.env.GROQ_MODEL_B || "openai/gpt-oss-120b";
}

function fallbackModel(org: GroqOrg): string | null {
  if (org === "B") return process.env.GROQ_MODEL_A || "openai/gpt-oss-20b";
  return null;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export class GroqError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GroqError";
  }
}

async function completeOnce(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature ?? 0.3,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    });
    if (res.status === 429) throw new GroqError("rate_limited", 429);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GroqError(`groq_${res.status}:${text.slice(0, 240)}`, res.status);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new GroqError("empty_completion");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

export async function groqComplete(opts: {
  org: GroqOrg;
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const primaryKey = keyFor(opts.org);
  const otherKey = keyFor(opts.org === "A" ? "B" : "A");
  if (!primaryKey && !otherKey) throw new GroqError("missing_groq_keys");

  const models = [modelFor(opts.org)];
  const fb = fallbackModel(opts.org);
  if (fb && fb !== models[0]) models.push(fb);

  const keys: Array<{ key: string; label: string }> = [];
  if (primaryKey) keys.push({ key: primaryKey, label: opts.org });
  if (otherKey) keys.push({ key: otherKey, label: "fallback-org" });

  let lastErr: unknown;
  for (const { key } of keys) {
    for (const model of models) {
      try {
        return await completeOnce({
          apiKey: key,
          model,
          system: opts.system,
          user: opts.user,
          temperature: opts.temperature,
        });
      } catch (err) {
        lastErr = err;
        const status = err instanceof GroqError ? err.status : undefined;
        if (status === 429) {
          await sleep(1000 + Math.floor(Math.random() * 1000));
          try {
            return await completeOnce({
              apiKey: key,
              model,
              system: opts.system,
              user: opts.user,
              temperature: opts.temperature,
            });
          } catch (retryErr) {
            lastErr = retryErr;
          }
        }
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new GroqError("groq_failed");
}
