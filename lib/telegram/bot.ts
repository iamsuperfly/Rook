import { mainReplyKeyboard } from "./keyboards";

const API = "https://api.telegram.org";

export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TgChat {
  id: number;
  type: string;
}

export interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
}

export interface TgCallback {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallback;
}

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("missing_telegram_bot_token");
  return t;
}

async function call(method: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!json.ok) {
    console.error("[tg]", method, json.description);
    throw new Error(json.description || `telegram_${method}_failed`);
  }
  return json.result;
}

export async function sendMessage(
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: extra.reply_markup ?? mainReplyKeyboard(),
    ...extra,
  });
}

export async function answerCallback(id: string, text?: string): Promise<void> {
  try {
    await call("answerCallbackQuery", {
      callback_query_id: id,
      text: text?.slice(0, 180),
      show_alert: false,
    });
  } catch (err) {
    console.warn("[tg] answerCallback", err);
  }
}

export async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: unknown,
): Promise<void> {
  try {
    await call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });
  } catch (err) {
    console.warn("[tg] edit failed, sending new", err);
    await sendMessage(chatId, text, replyMarkup ? { reply_markup: replyMarkup } : {});
  }
}
