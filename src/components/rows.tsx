/** Nested child rows (invoice lines, order items, diary workforce …): an inline editor and a read-only table,
 * both with totals for numeric columns. */
import { Plus, Trash2 } from "lucide-react";

import type { FieldMeta, Row } from "@/api/types";
import { t } from "@/i18n/mk";
import { displayValue, formatMoney, formatNumber, isNumericType, num } from "@/lib/format";

import { FieldInput } from "./inputs";
import { Button, EmptyState, IconButton } from "./ui";

const HIDDEN = new Set(["id", "created_at", "updated_at", "_label"]);
const SUMMABLE = /(amount|total|value|price_total|net|gross|vat|cost|quantity|qty|hours|liters|km)$/;

export function editableChildren(field: FieldMeta): FieldMeta[] {
  return (field.children ?? []).filter((c) => !HIDDEN.has(c.name) && !c.read_only);
}

export function shownChildren(field: FieldMeta): FieldMeta[] {
  return (field.children ?? []).filter((c) => !HIDDEN.has(c.name) && !c.hidden);
}

type RowValue = Record<string, unknown>;

function totalsRow(cols: FieldMeta[], rows: RowValue[]) {
  const sum = cols.map((c) => (c.type === "decimal" && SUMMABLE.test(c.name) ? rows.reduce((s, r) => s + num(r[c.name]), 0) : null));
  return sum.some((s) => s !== null) ? sum : null;
}

export function RowsEditor({ field, value, onChange, errors }: {
  field: FieldMeta; value: RowValue[]; onChange: (rows: RowValue[]) => void; errors?: unknown;
}) {
  const cols = editableChildren(field);
  const rows = Array.isArray(value) ? value : [];
  const rowErrors = Array.isArray(errors) ? (errors as Record<string, string[]>[]) : [];
  const update = (i: number, name: string, v: unknown) => onChange(rows.map((r, j) => (j === i ? { ...r, [name]: v } : r)));
  const sums = totalsRow(cols, rows);
  return (
    <div className="stack-sm rows-editor">
      {rows.length ? (
        <div className="table-wrap" style={{ border: "1px solid var(--rule)", borderRadius: "var(--r)" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }} className="num">#</th>
                {cols.map((c) => <th key={c.name} className={isNumericType(c.type) ? "num" : ""}>{c.label}{c.required ? <span className="tone-danger"> *</span> : null}</th>)}
                <th aria-label={t.actions} style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="num muted">{i + 1}</td>
                  {cols.map((c) => (
                    <td key={c.name} style={{ minWidth: c.type === "fk" ? 220 : c.type === "text" || c.type === "string" ? 180 : c.type === "boolean" ? 60 : 110 }}>
                      {c.type === "boolean" ? (
                        <input type="checkbox" checked={Boolean(r[c.name])} aria-label={`${c.label} ${i + 1}`}
                          onChange={(e) => update(i, c.name, e.target.checked)} />
                      ) : (
                        <FieldInput field={c} value={r[c.name]} onChange={(v) => update(i, c.name, v)}
                          invalid={Boolean(rowErrors[i]?.[c.name])} initialLabel={r[`${c.name}_label`] as string | undefined} />
                      )}
                      {rowErrors[i]?.[c.name] ? <div className="field"><span className="error">{rowErrors[i][c.name][0]}</span></div> : null}
                    </td>
                  ))}
                  <td>
                    <IconButton label={`${t.remove} ${i + 1}`} icon={Trash2} size="sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} />
                  </td>
                </tr>
              ))}
            </tbody>
            {sums ? (
              <tfoot>
                <tr><td /> {cols.map((c, i) => <td key={c.name} className="num">{sums[i] !== null ? formatMoney(sums[i]) : ""}</td>)}<td /></tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : <div className="panel"><EmptyState compact title="Нема ставки" /></div>}
      <div>
        <Button size="sm" icon={Plus} onClick={() => onChange([...rows, {}])}>Додај ставка</Button>
      </div>
    </div>
  );
}

export function RowsTable({ field, rows }: { field: FieldMeta; rows: Row[] }) {
  const cols = shownChildren(field);
  if (!rows?.length) return <EmptyState compact title="Нема ставки" />;
  const sums = totalsRow(cols, rows);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th style={{ width: 36 }} className="num">#</th>{cols.map((c) => <th key={c.name} className={isNumericType(c.type) ? "num" : ""}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.id as number) ?? i}>
              <td className="num muted">{i + 1}</td>
              {cols.map((c) => (
                <td key={c.name} className={isNumericType(c.type) ? "num" : ""}>{displayValue(r, c.name, c.type, c.decimal_places) || <span className="muted-cell">—</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {sums && rows.length > 1 ? (
          <tfoot>
            <tr><td className="xs">{formatNumber(rows.length, 0)}</td>{cols.map((c, i) => <td key={c.name} className="num">{sums[i] !== null ? formatMoney(sums[i]) : ""}</td>)}</tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** Rows as the API expects them: file refs → ids, empty strings on optional fields dropped. */
export function rowsPayload(field: FieldMeta, rows: RowValue[]): RowValue[] {
  const cols = editableChildren(field);
  return rows.map((r) => {
    const out: RowValue = {};
    if (r.id) out.id = r.id;
    for (const c of cols) {
      let v = r[c.name];
      if (v && typeof v === "object" && !Array.isArray(v) && c.type === "file") v = (v as { id: number }).id;
      if (v === "" || v === undefined) {
        if (c.required) out[c.name] = v ?? null;
        continue;
      }
      out[c.name] = v;
    }
    return out;
  });
}
