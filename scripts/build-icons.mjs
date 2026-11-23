// Builds the one icon sprite (public/icons/solar.svg) from Solar "-linear" icons (480 Design, CC BY 4.0).
// The app names its icons; ICONS maps each name to its Solar glyph. Run: node scripts/build-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const set = require("@iconify-json/solar/icons.json");

export const ICONS = {
  AlertTriangle: "danger-triangle", Archive: "archive", ArrowDown: "arrow-down", ArrowDownRight: "arrow-right-down",
  ArrowRight: "arrow-right", ArrowUp: "arrow-up", ArrowUpRight: "arrow-right-up", BarChart3: "chart-2", Bell: "bell",
  BookOpen: "book-2", Building2: "buildings-2", ChartLine: "graph-up", Check: "check-circle", CheckCheck: "check-read",
  CheckCircle2: "check-circle", ChevronDown: "alt-arrow-down", ChevronLeft: "alt-arrow-left", ChevronRight: "alt-arrow-right",
  ChevronsUpDown: "sort-vertical", Circle: "record-circle", Clock: "clock-circle", Columns3: "table-columns-split",
  Compass: "compass", Construction: "ruler-cross-pen", Copy: "copy", CornerUpLeft: "undo-left", Download: "download-minimalistic",
  ExternalLink: "square-arrow-right-up", Eye: "eye", EyeOff: "eye-closed", FileSignature: "bill-list",
  FileSpreadsheet: "document", FileText: "document-text", Filter: "filter", Handshake: "hand-shake", HardHat: "sledgehammer",
  History: "history", Hourglass: "hourglass", House: "home-2", Inbox: "inbox", Info: "info-circle", Keyboard: "keyboard",
  LayoutGrid: "widget", Lock: "lock-keyhole", LogIn: "login-3", LogOut: "logout-3", Menu: "hamburger-menu",
  MessageSquare: "chat-round-dots", Monitor: "monitor", Moon: "moon", MoreHorizontal: "menu-dots",
  PanelLeftClose: "double-alt-arrow-left", PanelLeftOpen: "double-alt-arrow-right", Paperclip: "paperclip", Pencil: "pen",
  Pin: "pin", Plus: "add-circle", Printer: "printer-minimalistic", RefreshCw: "refresh", Rows3: "list", Rows4: "list-check-minimalistic",
  Save: "diskette", Search: "minimalistic-magnifier", SearchX: "minimalistic-magnifier-close", Send: "plain",
  Settings: "settings", ShoppingCart: "cart-3", SlidersHorizontal: "tuning-2", Star: "star", Sun: "sun", Table2: "table",
  Trash2: "trash-bin-minimalistic", Truck: "delivery", Upload: "upload-minimalistic", User: "user", Users: "users-group-rounded",
  Wallet: "wallet", Warehouse: "box", X: "close-circle", XCircle: "close-circle", Calendar: "calendar-minimalistic",
  Bookmark: "bookmark", Question: "question-circle",
};

const glyphs = [...new Set(Object.values(ICONS))];
const missing = glyphs.filter((g) => !set.icons[`${g}-linear`]);
if (missing.length) throw new Error(`Missing Solar glyphs: ${missing.join(", ")}`);
const w = set.width ?? 24, h = set.height ?? 24;
const symbols = glyphs.map((g) => {
  const icon = set.icons[`${g}-linear`];
  return `<symbol id="${g}" viewBox="0 0 ${icon.width ?? w} ${icon.height ?? h}">${icon.body}</symbol>`;
});
// the EACore mark, solid in the current ink (the brand is ink: no gradient, no hue)
const mark = readFileSync(new URL("./eacore-mark.paths", import.meta.url), "utf8").trim().split(/\r?\n/)
  .map((d) => `<path d=${d} fill="currentColor"/>`).join("");
symbols.push(`<symbol id="eacore-mark" viewBox="0 0 82.46 70.87">${mark}</symbol>`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg"><!-- Solar Icons by 480 Design, CC BY 4.0 -->${symbols.join("")}</svg>\n`;
writeFileSync(new URL("../public/icons/solar.svg", import.meta.url), svg);
writeFileSync(new URL("../src/components/icon-names.json", import.meta.url), JSON.stringify(ICONS, null, 1) + "\n");
console.log(`${glyphs.length} glyphs`);
