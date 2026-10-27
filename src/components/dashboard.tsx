/** Building blocks of the module overviews: the status band, KPI tiles, ranked bars, bullet bars, meters,
 * sparklines, and a table described by columns. Plain HTML/SVG — no chart library needed for these. */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { api, type Query } from "@/api/client";
import { useEntity } from "@/app/prefs";
import { formatCompact, formatDate, formatDateTime, formatMoney, formatNumber, num } from "@/lib/format";

import { Badge, EmptyState, statusTone } from "./ui";

// ── data ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Data = Record<string, any>;

/** GET an overview endpoint for the active legal entity (when the endpoint takes one). */
export function useOverview<T = Data>(path: string, query: Query = {}, opts: { entity?: boolean; enabled?: boolean } = {}) {
  const entity = useEntity();
  const q: Query = { ...(opts.entity === false ? {} : { legal_entity: entity }), ...query };
  return useQuery({
    queryKey: ["overview", path, q],
    queryFn: ({ signal }) => api.get<T>(path, q, signal),
    enabled: opts.enabled ?? true,
    placeholderData: (prev) => prev,
  });
}

/** How many records a filtered list has (page_size=1); for band and KPI counts no overview endpoint gives. */
export function useCount(endpoint: string, query: Query = {}, enabled = true) {
  return useQuery({
    queryKey: ["count", endpoint, query],
    queryFn: ({ signal }) => api.get<{ count: number }>(endpoint, { ...query, page_size: 1 }, signal),
    select: (d) => d.count,
    enabled,
    staleTime: 60_000,
  });
}

export const asRows = (v: unknown): Data[] => (Array.isArray(v) ? (v as Data[]) : []);

// ── status band ───────────────────────────────────────────────────────────────

export interface BandStage {
  key: string;
  label: string;
  count: number | null | undefined;
  to?: string;
  sub?: ReactNode;
  /** Someone is waiting on these: amber marking. */
  attention?: boolean;
  /** End of the flow (done). */
  done?: boolean;
  danger?: boolean;
}

/** The module's workflow as a lane: one segment per stage, its count, the road marking telling its state. */
export function StatusBand({ title, stages, total }: { title: string; stages: BandStage[]; total?: ReactNode }) {
  return (
    <section className="band" aria-label={title}>
      <div className="band-head">
        <h2>{title}</h2>
        {total !== undefined ? <span className="band-total">{total}</span> : null}
      </div>
      <ol className="band-lane" style={{ listStyle: "none", margin: 0 }}>
        {stages.map((s) => {
          const n = s.count ?? 0;
          const cls = `band-stage${n === 0 ? " zero" : ""}${s.attention && n > 0 ? " attention" : ""}${s.done ? " done" : ""}${s.danger && n > 0 ? " danger" : ""}`;
          const body = (
            <>
              <span className="b-count">{s.count === null || s.count === undefined ? "–" : formatNumber(n, 0)}</span>
              <span className="b-label">{s.label}</span>
              {s.sub ? <span className="b-sub">{s.sub}</span> : null}
            </>
          );
          return (
            <li key={s.key} style={{ display: "contents" }}>
              {s.to ? <Link to={s.to} className={cls} aria-label={`${s.label}: ${n}`}>{body}</Link> : <div className={cls}>{body}</div>}
            </li>
          );
        })}
      </ol>
      <div className="band-foot" aria-hidden>
        <span><span className="legend-dash" />во тек</span>
        <span><span className="legend-amber" />чека нечија одлука</span>
      </div>
    </section>
  );
}

// ── KPI tiles ─────────────────────────────────────────────────────────────────

export function Kpis({ children }: { children: ReactNode }) {
  return <div className="kpis">{children}</div>;
}

/** One figure: label, value (+unit), what it covers, an optional change and trend. */
export function Kpi({ label, value, unit, sub, delta, goodWhenUp = true, trend, to, tone }: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  /** Change in percent vs the previous period. */
  delta?: number | null;
  goodWhenUp?: boolean;
  trend?: number[];
  to?: string;
  tone?: "attention" | "alarm" | "good";
}) {
  const body = (
    <>
      <span className="k-label">{label}</span>
      <span className="k-value">{value ?? "–"}{unit ? <span className="unit">{unit}</span> : null}</span>
      {delta !== undefined && delta !== null && Number.isFinite(delta) ? (
        <span className={`k-delta ${delta === 0 ? "" : (delta > 0) === goodWhenUp ? "good" : "bad"}`}>
          {delta > 0 ? <ArrowUpRight aria-hidden /> : delta < 0 ? <ArrowDownRight aria-hidden /> : null}
          {delta > 0 ? "+" : ""}{formatNumber(delta, 1)}%
          <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>{sub}</span>
        </span>
      ) : sub ? <span className="k-sub">{sub}</span> : null}
      {trend && trend.length > 1 && trend.some((v) => v !== 0) ? <Sparkline values={trend} className="k-spark" /> : null}
    </>
  );
  const cls = `kpi${tone ? ` ${tone}` : ""}`;
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Money as a compact figure with the currency. */
export function money(v: unknown) {
  return formatCompact(v);
}

// ── small charts ──────────────────────────────────────────────────────────────

export function Sparkline({ values, className, height = 28 }: { values: number[]; className?: string; height?: number }) {
  const w = 120;
  const max = Math.max(...values), min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 2 - ((v - min) / span) * (height - 4)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className={className} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden>
      <path d={d} fill="none" stroke="var(--series-muted)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--accent)" />
    </svg>
  );
}

/** Ranked horizontal bars: label, bar scaled to the largest, value. */
export function HBars({ rows, unit = "money", color, empty }: {
  rows: { label: ReactNode; value: unknown; to?: string; over?: boolean; key?: string | number; note?: ReactNode }[];
  unit?: "money" | "number" | "percent";
  color?: string;
  empty?: ReactNode;
}) {
  if (!rows.length) return <EmptyState compact title={empty ?? "Нема податоци"} />;
  const max = Math.max(...rows.map((r) => Math.abs(num(r.value))), 1);
  return (
    <div className="bars">
      {rows.map((r, i) => {
        const v = num(r.value);
        return (
          <div key={r.key ?? i} className={`hbar${r.over ? " over" : ""}`}>
            <span className="hb-label" title={typeof r.label === "string" ? r.label : undefined}>
              {r.to ? <Link to={r.to}>{r.label}</Link> : r.label}
            </span>
            <span className="hb-track"><span className="hb-fill" style={{ width: `${(Math.abs(v) / max) * 100}%`, background: r.over ? undefined : color }} /></span>
            <span className="hb-value">{unit === "money" ? formatMoney(v) : unit === "percent" ? `${formatNumber(v, 1)}%` : formatNumber(v)}{r.note}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Budget-style bar: actual (dark), committed (light, behind), budget (target tick). */
export function Bullet({ budget, actual, committed = 0 }: { budget: number; actual: number; committed?: number }) {
  const scale = Math.max(budget, actual + committed, actual, 1);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <div className="bullet" role="img" aria-label={`Остварено ${formatMoney(actual)}, нарачано ${formatMoney(committed)}, буџет ${formatMoney(budget)}`}>
      <div className="bullet-track">
        <span className="bullet-committed" style={{ width: pct(actual + committed) }} />
        <span className={`bullet-actual${actual > budget && budget > 0 ? " over" : ""}`} style={{ width: pct(actual) }} />
        {budget > 0 ? <span className="bullet-target" style={{ left: `calc(${pct(budget)} - 1px)` }} /> : null}
      </div>
    </div>
  );
}

export function Meter({ value, max = 100, warnAt, badAt, label }: { value: number; max?: number; warnAt?: number; badAt?: number; label?: string }) {
  const p = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const tone = badAt !== undefined && p >= badAt ? " bad" : warnAt !== undefined && p >= warnAt ? " warn" : "";
  return (
    <div className={`meter${tone}`} role="meter" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${p}%` }} />
    </div>
  );
}

/** A single 100% bar split into parts, with a legend (status mix, cost structure). */
export function ShareBar({ parts, unit = "number" }: { parts: { label: string; value: unknown; color?: string }[]; unit?: "money" | "number" }) {
  const total = parts.reduce((s, p) => s + Math.max(0, num(p.value)), 0);
  const colors = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)", "var(--series-muted)"];
  if (!total) return <EmptyState compact title="Нема податоци" />;
  return (
    <div className="stack-sm">
      <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", gap: 2, background: "var(--surface)" }} role="img"
        aria-label={parts.map((p) => `${p.label}: ${unit === "money" ? formatMoney(p.value) : formatNumber(p.value)}`).join(", ")}>
        {parts.map((p, i) => num(p.value) > 0 ? (
          <span key={p.label} title={`${p.label}: ${unit === "money" ? formatMoney(p.value) : formatNumber(p.value)}`}
            style={{ flex: `${num(p.value)} 0 0`, background: p.color ?? colors[i % colors.length], minWidth: 3 }} />
        ) : null)}
      </div>
      <div className="legend" style={{ marginBottom: 0 }}>
        {parts.map((p, i) => (
          <span key={p.label}>
            <span className="swatch" style={{ background: p.color ?? colors[i % colors.length] }} aria-hidden />{p.label}
            <span className="lv">{unit === "money" ? formatCompact(p.value) : formatNumber(p.value)}</span>
            <span className="muted xs">{formatNumber((num(p.value) / total) * 100, 0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── table by columns ──────────────────────────────────────────────────────────

export type Row = Record<string, unknown>;

export interface Column {
  key: string;
  label: string;
  kind?: "money" | "number" | "date" | "datetime" | "badge" | "percent";
  /** A link for the cell: a route built from the row. */
  to?: (row: Row) => string | null;
  render?: (row: Row) => ReactNode;
  className?: string;
}

function cell(row: Row, col: Column): ReactNode {
  if (col.render) return col.render(row);
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return <span className="muted-cell">—</span>;
  switch (col.kind) {
    case "money": return formatMoney(v);
    case "number": return formatNumber(v);
    case "percent": return `${formatNumber(v, 1)}%`;
    case "date": return formatDate(v);
    case "datetime": return formatDateTime(v);
    case "badge": return <Badge tone={statusTone(String(v))}>{String(v)}</Badge>;
    default: return String(v);
  }
}

const numeric = (c: Column) => c.kind === "money" || c.kind === "number" || c.kind === "percent";

export function DataTable({ rows, columns, empty, maxHeight, footer }: {
  rows: Row[]; columns: Column[]; empty?: ReactNode; maxHeight?: number; footer?: ReactNode;
}) {
  if (!rows.length) return <EmptyState compact title={empty ?? "Нема записи"} />;
  return (
    <div className="table-wrap" style={maxHeight ? { maxHeight } : undefined}>
      <table className="table">
        <thead><tr>{columns.map((c) => <th key={c.key} className={numeric(c) ? "num" : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {columns.map((c) => {
                const content = cell(row, c);
                const to = c.to?.(row);
                return <td key={c.key} className={[numeric(c) ? "num" : "", c.className ?? ""].join(" ").trim() || undefined}>{to ? <Link to={to}>{content}</Link> : content}</td>;
              })}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  );
}

/** Percent change of `current` vs `previous` (null when there's no base). */
export function change(current: unknown, previous: unknown): number | null {
  const a = num(current), b = num(previous);
  if (!b) return null;
  return ((a - b) / Math.abs(b)) * 100;
}
