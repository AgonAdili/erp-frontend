/** Building blocks of the overview screens: KPI cards, the legal-entity picker, and a table described by columns. */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useSession } from "@/auth/session";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";

import { Badge, EmptyState, Field } from "./ui";

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" }) {
  return (
    <div className={`card kpi${tone ? ` ${tone}` : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="small muted">{sub}</div> : null}
    </div>
  );
}

/** The user's legal entities; nothing to pick when there is one (the server uses the default). */
export function EntityPicker({ value, onChange, id = "entity-picker" }: {
  value: number | null; onChange: (v: number | null) => void; id?: string;
}) {
  const { session } = useSession();
  const entities = session?.access?.entities ?? [];
  if (entities.length <= 1) return null;
  return (
    <Field label="Правно лице" htmlFor={id}>
      <select id={id} className="input" value={value ?? session?.access?.default_entity_id ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}>
        {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
    </Field>
  );
}

export type Row = Record<string, unknown>;

export interface Column {
  key: string;
  label: string;
  kind?: "money" | "number" | "date" | "datetime" | "badge" | "percent";
  /** A link for the cell: a route built from the row. */
  to?: (row: Row) => string | null;
  render?: (row: Row) => ReactNode;
}

function cell(row: Row, col: Column): ReactNode {
  if (col.render) return col.render(row);
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return <span className="muted">—</span>;
  switch (col.kind) {
    case "money": return formatMoney(v);
    case "number": return formatNumber(v);
    case "percent": return `${formatNumber(v, 1)}%`;
    case "date": return formatDate(v);
    case "datetime": return formatDateTime(v);
    case "badge": return <Badge>{String(v)}</Badge>;
    default: return String(v);
  }
}

const numeric = (c: Column) => c.kind === "money" || c.kind === "number" || c.kind === "percent";

export function DataTable({ rows, columns, empty }: { rows: Row[]; columns: Column[]; empty?: ReactNode }) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{columns.map((c) => <th key={c.key} className={numeric(c) ? "num" : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {columns.map((c) => {
                const content = cell(row, c);
                const to = c.to?.(row);
                return <td key={c.key} className={numeric(c) ? "num" : undefined}>{to ? <Link to={to}>{content}</Link> : content}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card stack">
      <div className="row"><h2 style={{ margin: 0 }}>{title}</h2><span style={{ flex: 1 }} />{actions}</div>
      {children}
    </div>
  );
}
