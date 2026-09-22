export const BTN = {
  newThesis: "NEW THESIS",
  myWatches: "MY WATCHES",
  myPaper: "MY PAPER",
  records: "RECORDS",
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
  callLive: "CALL LIVE",
  reject: "REJECT",
  refresh: "REFRESH",
  openReport: "OPEN REPORT",
  callOff: "CALL OFF",
  keep: "KEEP WATCHING",
  stopPaper: "STOP PAPER",
  wallet: "WALLET",
  claim: "CLAIM",
  addMargin: "ADD MARGIN",
  stress: "STRESS TEST",
  alerts: "ALERTS ON/OFF",
  interval: "CHECK EVERY 15m / 1h / 4h",
} as const;

export type BtnLabel = (typeof BTN)[keyof typeof BTN];

const MAIN_LABELS = new Set<string>([
  BTN.newThesis,
  BTN.myWatches,
  BTN.myPaper,
  BTN.wallet,
  BTN.records,
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
      [{ text: BTN.myPaper }, { text: BTN.wallet }],
      [{ text: BTN.records }, { text: BTN.checkNow }],
      [{ text: BTN.lastReport }, { text: BTN.settings }],
      [{ text: BTN.help }],
    ],
    resize_keyboard: true,
    is_persistent: false,
    input_field_placeholder: "Use the buttons — Rook never places an order",
  };
}

export type DeskTextRoute =
  | "home"
  | "help"
  | "settings"
  | "thesis"
  | "watches"
  | "paper"
  | "wallet"
  | "records"
  | "last"
  | "check"
  | "other";

export function deskTextRoute(text: string): DeskTextRoute {
  const t = text.trim();
  if (t === "/start" || t === BTN.mainMenu || t === "/menu") return "home";
  if (t === "/help" || t === BTN.help) return "help";
  if (t === "/settings" || t === BTN.settings) return "settings";
  if (t === "/thesis" || t === BTN.newThesis) return "thesis";
  if (t === BTN.myWatches || t === "/watches") return "watches";
  if (t === BTN.myPaper || t === "/paper") return "paper";
  if (t === BTN.wallet || t === "/wallet") return "wallet";
  if (t === BTN.records || t === "/records") return "records";
  if (t === BTN.lastReport || t === "/last") return "last";
  if (t === BTN.checkNow || t === "/check") return "check";
  return "other";
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
  paperAct: (act: string, id: string) => `p:${act}:${id}`,
  paperDir: (s: string) => `pd:${s}`,
  paperMargin: (n: string) => `pm:${n}`,
  paperLev: (n: number) => `pl:${n}`,
  paperAdd: (n: string, id: string) => `pa:${n}:${id}`,
  paperStress: (id: string) => `ps:${id}`,
  wallet: "nav:wallet",
  claimInit: "pw:init",
  claimDaily: "pw:daily",
  records: "nav:records",
  myPaper: "nav:paper",
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
      { text: BTN.callLive, callback_data: CB.card("live") },
    ],
    [{ text: BTN.reject, callback_data: CB.card("reject") }],
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
    [{ text: BTN.callLive, callback_data: CB.watchAct("live", watchId) }],
    [{ text: BTN.keep, callback_data: CB.watchAct("keep", watchId) }],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function paperKeyboard(id: string) {
  return inline([
    [
      { text: BTN.addMargin, callback_data: CB.paperAct("add", id) },
      { text: BTN.stress, callback_data: CB.paperStress(id) },
    ],
    [{ text: BTN.stopPaper, callback_data: CB.paperAct("stop", id) }],
    [{ text: BTN.myPaper, callback_data: CB.myPaper }],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function paperMarginKeyboard() {
  return inline([
    [
      { text: "50", callback_data: CB.paperMargin("50") },
      { text: "100", callback_data: CB.paperMargin("100") },
      { text: "250", callback_data: CB.paperMargin("250") },
    ],
    [{ text: BTN.wallet, callback_data: CB.wallet }],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function paperLeverageKeyboard() {
  return inline([
    [
      { text: "1x", callback_data: CB.paperLev(1) },
      { text: "2x", callback_data: CB.paperLev(2) },
      { text: "3x", callback_data: CB.paperLev(3) },
    ],
    [
      { text: "5x", callback_data: CB.paperLev(5) },
      { text: "10x", callback_data: CB.paperLev(10) },
    ],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function paperAddMarginKeyboard(id: string) {
  return inline([
    [
      { text: "+25", callback_data: CB.paperAdd("25", id) },
      { text: "+50", callback_data: CB.paperAdd("50", id) },
      { text: "+100", callback_data: CB.paperAdd("100", id) },
    ],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function walletKeyboard(opts: { canClaimInitial: boolean; canClaimDaily: boolean }) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (opts.canClaimInitial) rows.push([{ text: "CLAIM 10,000", callback_data: CB.claimInit }]);
  if (opts.canClaimDaily) rows.push([{ text: "CLAIM 1,000", callback_data: CB.claimDaily }]);
  rows.push([{ text: BTN.myPaper, callback_data: CB.myPaper }]);
  rows.push([{ text: BTN.mainMenu, callback_data: CB.menu }]);
  return inline(rows);
}

export function paperBiasKeyboard() {
  return inline([
    [
      { text: BTN.long, callback_data: CB.paperDir("long") },
      { text: BTN.short, callback_data: CB.paperDir("short") },
    ],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function paperLimitKeyboard() {
  return inline([
    [{ text: BTN.myPaper, callback_data: CB.myPaper }],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}

export function openPaperEmptyKeyboard() {
  return inline([
    [{ text: BTN.records, callback_data: CB.records }],
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

export function paperListKeyboard(ids: string[]) {
  const rows = ids.slice(0, 8).map((id, i) => [
    { text: `PAPER #${i + 1}`, callback_data: CB.paperAct("open", id) },
    { text: BTN.stopPaper, callback_data: CB.paperAct("stop", id) },
  ]);
  rows.push([{ text: BTN.records, callback_data: CB.records }]);
  rows.push([{ text: BTN.mainMenu, callback_data: CB.menu }]);
  return inline(rows);
}

export function recordsListKeyboard(ids: string[]) {
  const rows = ids.slice(0, 8).map((id, i) => [
    { text: `RECORD #${i + 1}`, callback_data: CB.paperAct("open", id) },
  ]);
  rows.push([{ text: BTN.myPaper, callback_data: CB.myPaper }]);
  rows.push([{ text: BTN.mainMenu, callback_data: CB.menu }]);
  return inline(rows);
}

export function recordDetailKeyboard() {
  return inline([
    [{ text: BTN.records, callback_data: CB.records }],
    [{ text: BTN.myPaper, callback_data: CB.myPaper }],
    [{ text: BTN.mainMenu, callback_data: CB.menu }],
  ]);
}
