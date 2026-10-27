/** Renders any report JSON readably: lists of records as tables, records as definition lists, nested blocks
 * as sections. Used for the server's report actions (trial balance, aging, stock valuation …). */
import type { ReactNode } from "react";

import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

const LABELS: Record<string, string> = {
  rows: "Редови", total: "Вкупно", totals: "Вкупно", count: "Број", amount: "Износ", value: "Вредност",
  quantity: "Количина", debit: "Должи", credit: "Побарува", balance: "Салдо", name: "Назив", code: "Шифра",
  date: "Датум", status: "Статус", project: "Проект", employee: "Вработен", item: "Артикл", unit_cost: "Ед. цена",
  fuel: "Гориво", workforce: "Работна сила", cost: "Трошок", liters: "Литри", open: "Отворено", paid: "Платено",
  overdue: "Задоцнето", original: "Првично", from: "Од", to: "До", year: "Година", month: "Месец",
  total_debit: "Вкупно должи", total_credit: "Вкупно побарува", balanced: "Избалансирано", opening: "Почетно салдо",
  closing: "Крајно салдо", account: "Конто", account_code: "Конто", account_name: "Назив на конто", partner: "Партнер",
  description: "Опис", period: "Период", entity: "Правно лице", currency: "Валута", vat: "ДДВ", net: "Нето", gross: "Бруто",
};

function label(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, " ");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function scalar(key: string, v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="muted">—</span>;
  if (typeof v === "boolean") return v ? "Да" : "Не";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("mk-MK") : formatMoney(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDateTime(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDate(s);
  if (/^-?\d+\.\d{2,4}$/.test(s) && !/(id|code|number)$/.test(key)) return formatMoney(s);
  return s;
}

function isNumberish(v: unknown) {
  return typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v));
}

function Table({ rows }: { rows: Record<string, unknown>[] }) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !k.endsWith("_id") || k === "id")
    .filter((k) => rows.some((r) => !isRecord(r[k]) && !Array.isArray(r[k])));
  return (
    <div className="table-wrap" style={{ maxHeight: 480 }}>
      <table className="table">
        <thead><tr>{keys.map((k) => <th key={k} className={rows.every((r) => r[k] == null || isNumberish(r[k])) ? "num" : ""}>{label(k)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map((k) => <td key={k} className={isNumberish(r[k]) ? "num" : ""}>{scalar(k, r[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JsonView({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (Array.isArray(data)) {
    if (!data.length) return <span className="muted">Нема записи.</span>;
    if (data.every(isRecord)) return <Table rows={data as Record<string, unknown>[]} />;
    return <ul>{data.map((v, i) => <li key={i}>{isRecord(v) || Array.isArray(v) ? <JsonView data={v} depth={depth + 1} /> : scalar("", v)}</li>)}</ul>;
  }
  if (isRecord(data)) {
    const simple = Object.entries(data).filter(([, v]) => !isRecord(v) && !Array.isArray(v));
    const nested = Object.entries(data).filter(([, v]) => isRecord(v) || Array.isArray(v));
    return (
      <div className="stack">
        {simple.length ? (
          <dl className="dl">
            {simple.map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd>{scalar(k, v)}</dd></div>)}
          </dl>
        ) : null}
        {nested.map(([k, v]) => (
          <section key={k} className="stack" style={{ gap: 6 }}>
            {depth < 3 ? <h3 style={{ margin: 0 }}>{label(k)}</h3> : <strong>{label(k)}</strong>}
            <JsonView data={v} depth={depth + 1} />
          </section>
        ))}
      </div>
    );
  }
  return <>{scalar("", data)}</>;
}
