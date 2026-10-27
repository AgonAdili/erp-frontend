/** Nested child rows (invoice lines, order items, diary workforce …): an inline editor and a read-only table. */
import type { FieldMeta, Row } from "@/api/types";
import { t } from "@/i18n/mk";
import { displayValue, isNumericType } from "@/lib/format";

import { FieldInput } from "./inputs";
import { Button } from "./ui";

const HIDDEN = new Set(["id", "created_at", "updated_at", "_label"]);

export function editableChildren(field: FieldMeta): FieldMeta[] {
  return (field.children ?? []).filter((c) => !HIDDEN.has(c.name) && !c.read_only);
}

export function shownChildren(field: FieldMeta): FieldMeta[] {
  return (field.children ?? []).filter((c) => !HIDDEN.has(c.name));
}

type RowValue = Record<string, unknown>;

export function RowsEditor({
  field,
  value,
  onChange,
  errors,
}: {
  field: FieldMeta;
  value: RowValue[];
  onChange: (rows: RowValue[]) => void;
  errors?: unknown;
}) {
  const cols = editableChildren(field);
  const rows = Array.isArray(value) ? value : [];
  const rowErrors = Array.isArray(errors) ? (errors as Record<string, string[]>[]) : [];
  const update = (i: number, name: string, v: unknown) => onChange(rows.map((r, j) => (j === i ? { ...r, [name]: v } : r)));
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="table-wrap" style={{ maxHeight: "none" }}>
        <table className="table">
          <thead>
            <tr>
              {cols.map((c) => <th key={c.name} className={isNumericType(c.type) ? "num" : ""}>{c.label}{c.required ? " *" : ""}</th>)}
              <th aria-label={t.actions} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.name} style={{ minWidth: c.type === "fk" ? 200 : c.type === "text" || c.type === "string" ? 160 : 90 }}>
                    <FieldInput field={c} value={r[c.name]} onChange={(v) => update(i, c.name, v)}
                      invalid={Boolean(rowErrors[i]?.[c.name])}
                      initialLabel={r[`${c.name}_label`] as string | undefined} />
                    {rowErrors[i]?.[c.name] ? <div className="error small">{rowErrors[i][c.name][0]}</div> : null}
                  </td>
                ))}
                <td>
                  <Button size="sm" variant="ghost" aria-label={t.remove}
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button size="sm" onClick={() => onChange([...rows, {}])}>+ {t.add}</Button>
      </div>
    </div>
  );
}

export function RowsTable({ field, rows }: { field: FieldMeta; rows: Row[] }) {
  const cols = shownChildren(field);
  if (!rows?.length) return <span className="muted">{t.none}</span>;
  return (
    <div className="table-wrap" style={{ maxHeight: "none" }}>
      <table className="table">
        <thead>
          <tr>{cols.map((c) => <th key={c.name} className={isNumericType(c.type) ? "num" : ""}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.id as number) ?? i}>
              {cols.map((c) => (
                <td key={c.name} className={isNumericType(c.type) ? "num" : ""}>{displayValue(r, c.name, c.type, c.decimal_places)}</td>
              ))}
            </tr>
          ))}
        </tbody>
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
