/** Renders any report JSON readably: lists of records as tables (with totals and CSV download), records as
 * definition lists, nested blocks as sections, and a ranked bar view for short bucketed lists (aging …).
 * Used for the server's report actions (trial balance, aging, stock valuation …). */
import type { ReactNode } from "react";
import { Download } from "@/components/icons";

import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";

import { HBars } from "./dashboard";
import { Button } from "./ui";
import { tr } from "@/i18n";

const LABELS: Record<string, string> = {
  rows: tr("Редови"), total: tr("Вкупно"), totals: tr("Вкупно"), count: tr("Број"), amount: tr("Износ"), value: tr("Вредност"),
  quantity: tr("Количина"), debit: tr("Должи"), credit: tr("Побарува"), balance: tr("Салдо"), name: tr("Назив"), code: tr("Шифра"),
  date: tr("Датум"), status: tr("Статус"), project: tr("Проект"), employee: tr("Вработен"), item: tr("Артикл"), unit_cost: tr("Ед. цена"),
  fuel: tr("Гориво"), workforce: tr("Работна сила"), cost: tr("Трошок"), liters: tr("Литри"), open: tr("Отворено"), paid: tr("Платено"),
  overdue: tr("Задоцнето"), original: tr("Првично"), from: tr("Од"), to: tr("До"), year: tr("Година"), month: tr("Месец"),
  total_debit: tr("Вкупно должи"), total_credit: tr("Вкупно побарува"), balanced: tr("Избалансирано"), opening: tr("Почетно салдо"),
  closing: tr("Крајно салдо"), account: tr("Конто"), account_code: tr("Конто"), account_name: tr("Назив на конто"), partner: tr("Партнер"),
  description: tr("Опис"), period: tr("Период"), entity: tr("Правно лице"), currency: tr("Валута"), vat: tr("ДДВ"), net: tr("Нето"), gross: tr("Бруто"),
  current: tr("Тековно"), not_due: tr("Не е доспеано"), due_date: tr("Доспева"), days: tr("Денови"), buckets: tr("Периоди"),
  label: tr("Опис"), created: tr("Креирани"), skipped: tr("Прескокнати"), updated: tr("Ажурирани"), errors: tr("Грешки"),
};

function label(key: string): string {
  return LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1)).replace(/_/g, " ");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function scalar(key: string, v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="muted-cell">—</span>;
  if (typeof v === "boolean") return v ? tr("Да") : tr("Не");
  if (typeof v === "number") return Number.isInteger(v) ? formatNumber(v, 0) : formatMoney(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDateTime(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDate(s);
  if (/^-?\d+\.\d{2,4}$/.test(s) && !/(id|code|number)$/.test(key)) return formatMoney(s);
  return s;
}

function isNumberish(v: unknown) {
  return typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v));
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(keys: string[], rows: Record<string, unknown>[], name: string) {
  const lines = [keys.map((k) => csvCell(label(k))).join(";"), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(";"))];
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `${name || "izvestaj"}.csv` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const AMOUNT_KEYS = /^(total|amount|value|balance|open|cost|debit|credit|net|gross)$/;
const ID_LIKE = /(^id$|_id$|code$|number$|^year$|^month$|^sequence$)/;

function Table({ rows, name }: { rows: Record<string, unknown>[]; name: string }) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !k.endsWith("_id") || k === "id")
    .filter((k) => rows.some((r) => !isRecord(r[k]) && !Array.isArray(r[k])));
  const numericKeys = keys.filter((k) => !ID_LIKE.test(k) && rows.every((r) => r[k] == null || isNumberish(r[k])) && rows.some((r) => r[k] != null));
  const sums = Object.fromEntries(numericKeys.map((k) => [k, rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)]));
  const textKey = keys.find((k) => !numericKeys.includes(k) && !ID_LIKE.test(k));
  const amountKey = numericKeys.find((k) => AMOUNT_KEYS.test(k)) ?? numericKeys[0];
  const showBars = rows.length >= 2 && rows.length <= 12 && textKey && amountKey;
  return (
    <div className="stack-sm">
      {showBars ? (
        <div className="ea-panel" style={{ padding: 14 }}>
          <HBars rows={rows.map((r, i) => ({ key: i, label: String(r[textKey!] ?? ""), value: r[amountKey!] }))}
            unit={/count|days|quantity/.test(amountKey!) ? "number" : "money"} />
        </div>
      ) : null}
      <div className="row-tight" style={{ justifyContent: "flex-end" }}>
        <span className="xs muted">{formatNumber(rows.length, 0)}{" "}{tr("редови")}</span>
        <Button size="sm" variant="ghost" icon={Download} onClick={() => downloadCsv(keys, rows, name)}>CSV</Button>
      </div>
      <div className="table-responsive table-wrap" style={{ maxHeight: 460, border: "1px solid var(--ea-line)", borderRadius: "var(--ea-r-control)" }}>
        <table className="table ea-table compact">
          <thead><tr>{keys.map((k) => <th key={k} className={numericKeys.includes(k) ? "num" : ""}>{label(k)}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {keys.map((k) => <td key={k} className={isNumberish(r[k]) && !ID_LIKE.test(k) ? "num" : ""}>{scalar(k, r[k])}</td>)}
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && numericKeys.length ? (
            <tfoot>
              <tr>{keys.map((k, i) => (
                <td key={k} className={numericKeys.includes(k) ? "num" : ""}>
                  {numericKeys.includes(k) ? (Number.isInteger(sums[k]) && !AMOUNT_KEYS.test(k) ? formatNumber(sums[k], 0) : formatMoney(sums[k])) : i === 0 ? tr("Вкупно") : ""}
                </td>
              ))}</tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

export function JsonView({ data, depth = 0, title = "" }: { data: unknown; depth?: number; title?: string }) {
  if (Array.isArray(data)) {
    if (!data.length) return <span className="muted">{tr("Нема записи.")}</span>;
    if (data.every(isRecord)) return <Table rows={data as Record<string, unknown>[]} name={title} />;
    return <ul style={{ margin: 0, paddingLeft: 18 }}>{data.map((v, i) => <li key={i}>{isRecord(v) || Array.isArray(v) ? <JsonView data={v} depth={depth + 1} title={title} /> : scalar("", v)}</li>)}</ul>;
  }
  if (isRecord(data)) {
    const simple = Object.entries(data).filter(([, v]) => !isRecord(v) && !Array.isArray(v));
    const nested = Object.entries(data).filter(([, v]) => isRecord(v) || Array.isArray(v));
    return (
      <div className="stack">
        {simple.length ? (
          <dl className="dl">
            {simple.map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd className={isNumberish(v) ? "num" : undefined}>{scalar(k, v)}</dd></div>)}
          </dl>
        ) : null}
        {nested.map(([k, v]) => (
          <section key={k} className="stack-sm">
            {depth < 3 ? <h3>{label(k)}</h3> : <strong>{label(k)}</strong>}
            <JsonView data={v} depth={depth + 1} title={`${title} ${label(k)}`.trim()} />
          </section>
        ))}
      </div>
    );
  }
  return <>{scalar("", data)}</>;
}
