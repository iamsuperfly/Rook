import type { Conversation } from "@/lib/types";

const store = new Map<number, Conversation>();

export function getConv(chatId: number): Conversation {
  return store.get(chatId) ?? { step: "idle" };
}

export function setConv(chatId: number, next: Conversation): Conversation {
  store.set(chatId, next);
  return next;
}

export function patchConv(chatId: number, patch: Partial<Conversation>): Conversation {
  const cur = getConv(chatId);
  const next = { ...cur, ...patch };
  store.set(chatId, next);
  return next;
}

export function clearConv(chatId: number): void {
  store.delete(chatId);
}
