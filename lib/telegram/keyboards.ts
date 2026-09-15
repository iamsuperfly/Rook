export const BTN = {
  newThesis: "NEW THESIS",
  myWatches: "MY WATCHES",
  lastReport: "LAST REPORT",
  checkNow: "CHECK NOW",
  settings: "SETTINGS",
  help: "HELP",
  mainMenu: "MAIN MENU",
  h24: "24h",
  h7d: "7d",
  h30d: "30d",
  long: "LONG",
  short: "SHORT",
  decide: "YOU DECIDE",
  nvda: "NVDA",
  tsla: "TSLA",
  aapl: "AAPL",
  btc: "BTC",
  typeSymbol: "TYPE SYMBOL",
  bull: "BULL CASE",
  bear: "BEAR CASE",
  wrong: "I AM WRONG IF",
  watch: "WATCH THIS",
  reject: "REJECT",
  refresh: "REFRESH",
  openReport: "OPEN REPORT",
  callOff: "CALL OFF",
  keep: "KEEP WATCHING",
  alerts: "ALERTS ON/OFF",
  interval: "CHECK EVERY 15m / 1h / 4h",
} as const;

export type BtnLabel = (typeof BTN)[keyof typeof BTN];

const MAIN_LABELS = new Set<string>([
  BTN.newThesis,
  BTN.myWatches,
  BTN.lastReport,
  BTN.checkNow,
  BTN.settings,
  BTN.help,
  BTN.mainMenu,
]);

export function isMainMenuLabel(text: string): boolean {
  return MAIN_LABELS.has(text.trim());
}

export function mainReplyKeyboard() {
  return {
    keyboard: [
      [{ text: BTN.newThesis }, { text: BTN.myWatches }],
      [{ text: BTN.lastReport }, { text: BTN.checkNow }],
      [{ text: BTN.settings }, { text: BTN.help }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Use the buttons — Rook never places an order",
  };
}

function inline(rows: Array<Array<{ text: string; callback_data: string }>>) {
  return { inline_keyboard: rows };
}

export const CB = {
  menu: "nav:menu",
  help: "nav:help",
  settings: "nav:settings",
  horizon: (h: string) => `th:h:${h}`,
  side: (s: string) => `th:s:${s}`,
  market: (m: string) => `th:m:${m}`,
  card: (k: string) => `card:${k}`,
  watchAct: (act: string, id: string) => `w:${act}:${id}`,
  setAlerts: "set:alerts",
  setEvery: "set:every",
} as const;

export function horizonKeyboard() {
  return inline([
    [
      { text: BTN.h24, callback_data: CB.horizon("24h") },
      { text: BTN.h7d, callback_data: CB.horizon("7d") },
      { text: BTN.h30d, callback_data: CB.horizon("30d") },
    ],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function sideKeyboard() {
  return inline([
    [
      { text: BTN.long, callback_data: CB.side("long") },
      { text: BTN.short, callback_data: CB.side("short") },
      { text: BTN.decide, callback_data: CB.side("decide") },
    ],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function marketKeyboard() {
  return inline([
    [
      { text: BTN.nvda, callback_data: CB.market("NVDA") },
      { text: BTN.tsla, callback_data: CB.market("TSLA") },
      { text: BTN.aapl, callback_data: CB.market("AAPL") },
      { text: BTN.btc, callback_data: CB.market("BTC") },
    ],
    [{ text: BTN.typeSymbol, callback_data: CB.market("CUSTOM") }],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function thesisKeyboard() {
  return inline([
    [
      { text: BTN.bull, callback_data: CB.card("bull") },
      { text: BTN.bear, callback_data: CB.card("bear") },
    ],
    [{ text: BTN.wrong, callback_data: CB.card("wrong") }],
    [
      { text: BTN.watch, callback_data: CB.card("watch") },
      { text: BTN.reject, callback_data: CB.card("reject") },
    ],
    [{ text: BTN.refresh, callback_data: CB.card("refresh") }],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function watchAlertKeyboard(watchId: string) {
  return inline([
    [
      { text: BTN.openReport, callback_data: CB.watchAct("open", watchId) },
      { text: BTN.callOff, callback_data: CB.watchAct("off", watchId) },
    ],
    [{ text: BTN.keep, callback_data: CB.watchAct("keep", watchId) }],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function settingsKeyboard() {
  return inline([
    [{ text: BTN.alerts, callback_data: CB.setAlerts }],
    [{ text: BTN.interval, callback_data: CB.setEvery }],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function watchesListKeyboard(ids: string[]) {
  const rows = ids.slice(0, 8).map((id, i) => [
    { text: `${BTN.openReport} #${i + 1}`, callback_data: CB.watchAct("open", id) },
    { text: BTN.callOff, callback_data: CB.watchAct("off", id) },
  ]);
  rows.push([{ text: BTN.mainMenu, callback_data: CB.menu }]);
  return inline(rows);
}
