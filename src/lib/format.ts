/** Display formatting (Macedonian conventions, as v1: 12.345,67 and dd.mm.yyyy). */
import type { FieldType } from "@/api/types";
import { STATUS_LABELS } from "@/i18n/mk";

/** Grouping and decimals done here, not by Intl: browsers without Macedonian locale data (Chrome, Edge) would
 * silently fall back to 1,234.56. */
function group(n: number, minFrac: number, maxFrac: number): string {
  const neg = n < 0 || Object.is(n, -0);
  const fixed = Math.abs(n).toFixed(maxFrac);
  let [int, frac = ""] = fixed.split(".");
  while (frac.length > minFrac && frac.endsWith("0")) frac = frac.slice(0, -1);
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const out = frac ? `${int},${frac}` : int;
  return neg && /[1-9]/.test(out) ? `−${out}` : out;
}

export function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? group(n, 2, 2) : String(value);
}

/** "1.234.567,00 MKD": an amount with its ISO code after it (07 §3); the code comes from the record. */
export function formatAmount(value: unknown, currency = "MKD"): string {
  const s = formatMoney(value);
  return s ? `${s} ${currency || "MKD"}` : "—";
}

/** "4.323.263 MKD": whole amounts for boards and summaries. */
export function formatAmountWhole(value: unknown, currency = "MKD"): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${group(n, 0, 0)} ${currency || "MKD"}` : String(value);
}

export function formatNumber(value: unknown, places?: number): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return places === undefined ? group(n, 0, 3) : group(n, places, places);
}

export function formatDate(value: unknown): string {
  if (!value) return "";
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}

export function formatDateTime(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 4.200.000 → "4,2 мил." — for hero figures and axis ticks, never in tables. */
export function formatCompact(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  // short forms only from one million up (07 §3)
  const a = Math.abs(n);
  if (a < 1_000_000) return group(n, 0, 0);
  if (a < 1_000_000_000) return `${group(n / 1_000_000, 0, 2)} млн`;
  return `${group(n / 1_000_000_000, 0, 2)} млрд`;
}

export function formatPercent(value: unknown, places = 1): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? `${formatNumber(n, places)} %` : String(value);
}

/** A number from an API decimal string; 0 for empty. */
export function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** A Date as yyyy-mm-dd in local time (toISOString would give yesterday shortly after midnight in UTC+1/+2). */
export function isoLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return isoLocal(new Date());
}

export function monthStartISO(): string {
  const d = new Date();
  return isoLocal(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoLocal(new Date(y, m - 1, d + days));
}

/** "пред 6 дена" up to seven days, then the date; a future time is never relative (07 §5). */
export function formatRelative(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 0) return formatDateTime(value);
  if (diff < 60) return "сега";
  if (diff < 3600) return `пред ${Math.floor(diff / 60)} мин`;
  if (diff < 86400) return `пред ${Math.floor(diff / 3600)} ч`;
  const days = Math.floor(diff / 86400);
  if (days <= 7) return days === 1 ? "пред 1 ден" : `пред ${days} дена`;
  return formatDate(isoLocal(d));
}

export function formatTime(value: unknown): string {
  if (!value) return "";
  return String(value).slice(0, 5);
}

/** Text for a cell / detail value of a given metadata type; row gives `<name>_label` / `<name>_display`. */
export function displayValue(row: Record<string, unknown>, name: string, type: FieldType, places?: number): string {
  const display = row[`${name}_display`];
  if (display !== undefined && display !== null && display !== "") return String(display);
  const label = row[`${name}_label`];
  if (label !== undefined && label !== null && label !== "") return String(label);
  const labels = row[`${name}_labels`];
  if (Array.isArray(labels)) return labels.join(", ");
  const value = getPath(row, name);
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" && /(^status$|_status$|^state$)/.test(name) && STATUS_LABELS[value]) return STATUS_LABELS[value];
  switch (type) {
    case "boolean":
      return value ? "Да" : "Не";
    case "date":
      return formatDate(value);
    case "datetime":
      return formatDateTime(value);
    case "time":
      return formatTime(value);
    case "decimal":
      return places === 2 || places === undefined ? formatMoney(value) : formatNumber(value, places);
    case "integer":
      // years, numbers and codes are identifiers, not quantities: no thousands separator
      return /(year|^number|_number|code|sequence|^id|_id|month|day)$/i.test(name) ? String(value) : formatNumber(value, 0);
    case "file": {
      const f = value as { name?: string };
      return f && typeof f === "object" ? f.name ?? "" : String(value);
    }
    case "json":
      if (typeof value === "string") return value;
      // a list of plain values reads as a list, not as code
      if (Array.isArray(value) && value.every((v) => v === null || typeof v !== "object")) return value.filter((v) => v != null && v !== "").join(", ");
      return JSON.stringify(value);
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

/** `a__b` paths (list columns over relations) — the API returns flat fields, so fall back to `<a>_label`. */
export function getPath(row: Record<string, unknown>, path: string): unknown {
  if (path in row) return row[path];
  if (path.includes("__")) {
    const [head] = path.split("__");
    return row[`${head}_label`] ?? row[head];
  }
  return undefined;
}

export function isNumericType(type: FieldType): boolean {
  return type === "decimal" || type === "integer";
}

const WEEKDAYS = ["недела", "понеделник", "вторник", "среда", "четврток", "петок", "сабота"];
const MONTHS_LOWER = ["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"];

export function weekdayName(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

/** "вторник, 27 октомври 2026" */
export function formatLongDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_LOWER[d.getMonth()]} ${d.getFullYear()}`;
}
