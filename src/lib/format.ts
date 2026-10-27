/** Display formatting (Macedonian conventions, as v1: 12.345,67 and dd.mm.yyyy). */
import type { FieldType } from "@/api/types";

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
  const a = Math.abs(n);
  if (a < 10_000) return group(n, 0, 0);
  if (a < 1_000_000) return `${group(n / 1_000, 0, a < 100_000 ? 1 : 0)} илј.`;
  if (a < 1_000_000_000) return `${group(n / 1_000_000, 0, 1)} мил.`;
  return `${group(n / 1_000_000_000, 0, 1)} млрд.`;
}

export function formatPercent(value: unknown, places = 1): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? `${formatNumber(n, places)}%` : String(value);
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

/** "Пред 5 мин", "вчера", or the date — for activity and notifications. */
export function formatRelative(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "сега";
  if (diff < 3600) return `пред ${Math.floor(diff / 60)} мин`;
  if (diff < 86400 && new Date().getDate() === d.getDate()) return `пред ${Math.floor(diff / 3600)} ч`;
  if (diff < 172800) return `вчера ${formatDateTime(value).slice(11)}`;
  return formatDateTime(value);
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
      return typeof value === "string" ? value : JSON.stringify(value);
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
