/** Display formatting (Macedonian conventions, as v1: 12.345,67 and dd.mm.yyyy). */
import type { FieldType } from "@/api/types";

const number2 = new Intl.NumberFormat("mk-MK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("mk-MK", { maximumFractionDigits: 0 });

export function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? number2.format(n) : String(value);
}

export function formatNumber(value: unknown, places?: number): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (places === 0) return integer.format(n);
  const fmt = new Intl.NumberFormat("mk-MK", { minimumFractionDigits: places ?? 0, maximumFractionDigits: places ?? 3 });
  return fmt.format(n);
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
      return formatNumber(value, 0);
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
