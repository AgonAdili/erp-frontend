/** Board parts (branding_rules/03 "Figures strip", 05 data visualisation): the flow of a workflow's stages, the
 * figures strip, ranked bars, bullets, meters, a split bar, and a table described by columns. HTML laid out by
 * CSS from shares (0–1) passed as custom properties; colours come from the tokens. */
import { Children, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api, type Query } from "@/api/client";
import { useEntity } from "@/app/prefs";
import { STATUS_LABELS, t } from "@/i18n/mk";
import { formatCompact, formatDate, formatDateTime, formatMoney, formatNumber, formatPercent, num } from "@/lib/format";

import { ArrowDownRight, ArrowUpRight } from "./icons";
import { cssVars, EmptyState, Status, statusTone } from "./ui";

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

/** How many records a filtered list has (page_size=1). */
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

const share = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, v / max)) : 0);

// ── the flow: a workflow's stages as one strip ───────────────────────────────

export interface BandStage {
  key: string;
  label: string;
  count: number | null | undefined;
  to?: string;
  sub?: ReactNode;
  /** Someone is waiting on these: a yellow dot. */
  attention?: boolean;
  /** End of the flow (done): a green dot. */
  done?: boolean;
  danger?: boolean;
}

/** Each stage with its count, linking to the list with the same filter. */
export function StatusBand({ title, stages, total }: { title: string; stages: BandStage[]; total?: ReactNode }) {
  return (
    <section className="ea-flow" aria-label={title}>
      <div className="ea-flow-head">
        <h2>{title}</h2>
        {total !== undefined ? <span className="meta">{total}</span> : null}
      </div>
      <ol className="ea-flow-lane">
        {stages.map((s) => {
          const n = s.count ?? 0;
          const tone = s.danger && n > 0 ? "stop" : s.attention && n > 0 ? "caution" : s.done ? "go" : "neutral";
          const cls = `ea-flow-stage${n === 0 ? " zero" : ""}${s.attention && n > 0 ? " attention" : ""}${s.done ? " done" : ""}${s.danger && n > 0 ? " danger" : ""}`;
          const body = (
            <>
              <span className="b-count">{s.count === null || s.count === undefined ? "—" : formatNumber(n, 0)}</span>
              <span className="b-label"><span className={`ea-dot is-${tone}`} aria-hidden />{s.label}</span>
              {s.sub ? <span className="b-sub">{s.sub}</span> : null}
            </>
          );
          return (
            <li key={s.key} className="contents">
              {s.to ? <Link to={s.to} className={cls} aria-label={`${s.label}: ${n}`}>{body}</Link> : <div className={cls}>{body}</div>}
            </li>
          );
        })}
      </ol>
      <div className="ea-flow-foot" aria-hidden>
        <span className="ea-st"><span className="ea-dot is-caution" />чека нечија одлука</span>
        <span className="ea-st"><span className="ea-dot is-go" />завршено</span>
      </div>
    </section>
  );
}

// ── figures strip ─────────────────────────────────────────────────────────────

/** Balanced columns: up to four in one row, five or six as two rows of three, more in rows of four. */
export function Kpis({ children }: { children: ReactNode }) {
  const n = Children.toArray(children).length;
  const cols = n <= 4 ? Math.max(n, 1) : n <= 6 ? 3 : 4;
  // the last figure spans what its row leaves empty, so the strip stays a closed rectangle
  const fill = n % cols ? cols - (n % cols) + 1 : 1;
  const fillMd = Math.min(cols, 2) === 2 && n % 2 ? 2 : 1;
  return <ul className="ea-figures" style={cssVars({ "--cols": cols, "--cols-md": Math.min(cols, 2), "--fill": fill, "--fill-md": fillMd })}>{children}</ul>;
}

/** One figure: a mono label (linking to its filtered list), the value with its unit, the change coloured by
 * meaning, and a hint line. A missing value reads "нема податоци". */
export function Kpi({ label, value, unit, sub, delta, goodWhenUp = true, to, tone }: {
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
  const missing = value === null || value === undefined || value === "" || value === "–";
  const cls = tone === "alarm" ? " is-stop" : tone === "attention" ? " is-caution" : tone === "good" ? " is-go" : "";
  const body = (
    <>
      <span className="f-label">{label}</span>
      <span className={`f-value${cls}`}>{missing ? <span className="muted">{t.noData}</span> : value}{unit && !missing ? <span className="unit">{unit}</span> : null}</span>
      {delta !== undefined && delta !== null && Number.isFinite(delta) ? (
        <span className={`ea-change ${delta === 0 ? "flat" : (delta > 0) === goodWhenUp ? "good" : "bad"}`}>
          {delta > 0 ? <ArrowUpRight /> : delta < 0 ? <ArrowDownRight /> : null}
          {delta > 0 ? "+" : ""}{formatPercent(delta, 1)}
        </span>
      ) : null}
      {sub ? <span className="f-hint">{sub}</span> : to ? <span className="f-hint">{t.openList}</span> : null}
    </>
  );
  return <li className="contents">{to ? <Link to={to} className="ea-figure">{body}</Link> : <div className="ea-figure">{body}</div>}</li>;
}

/** Money as a compact figure (short forms from one million). */
export function money(v: unknown) {
  return formatCompact(v);
}

// ── bars, bullets, meters, split ──────────────────────────────────────────────

/** Ranked horizontal bars, longest first; each row may link to its list. */
export function HBars({ rows, unit = "money", empty }: {
  rows: { label: ReactNode; value: unknown; to?: string; over?: boolean; key?: string | number; note?: ReactNode }[];
  unit?: "money" | "number" | "percent";
  color?: string;
  empty?: ReactNode;
}) {
  if (!rows.length) return <EmptyState compact title={empty ?? t.noData} />;
  const max = Math.max(...rows.map((r) => Math.abs(num(r.value))), 1);
  return (
    <div className="bars">
      {rows.map((r, i) => {
        const v = num(r.value);
        return (
          <div key={r.key ?? i} className={`hbar${r.over ? " over" : ""}`} style={cssVars({ "--v": share(Math.abs(v), max) })}>
            <span className="hb-label" title={typeof r.label === "string" ? r.label : undefined}>
              {r.to ? <Link to={r.to}>{r.label}</Link> : r.label}
            </span>
            <span className="hb-track"><span className="hb-fill" /></span>
            <span className="hb-value">{unit === "money" ? formatMoney(v) : unit === "percent" ? formatPercent(v, 1) : formatNumber(v)}{r.note}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Bullet: the bar from 0 is now, the ink tick the target; the light part is committed. */
export function Bullet({ budget, actual, committed = 0 }: { budget: number; actual: number; committed?: number }) {
  const scale = Math.max(budget, actual + committed, actual, 1);
  return (
    <div className="bullet" role="img" aria-label={`Остварено ${formatMoney(actual)}, нарачано ${formatMoney(committed)}, буџет ${formatMoney(budget)}`}>
      <div className="bullet-track" style={cssVars({ "--v": share(actual, scale), "--c": share(actual + committed, scale), "--t": share(budget, scale) })}>
        <span className="bullet-committed" />
        <span className={`bullet-actual${actual > budget && budget > 0 ? " over" : ""}`} />
        {budget > 0 ? <span className="bullet-target" /> : null}
      </div>
    </div>
  );
}

export function Meter({ value, max = 100, warnAt, badAt, label }: { value: number; max?: number; warnAt?: number; badAt?: number; label?: string }) {
  const p = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const tone = badAt !== undefined && p >= badAt ? " bad" : warnAt !== undefined && p >= warnAt ? " warn" : "";
  return (
    <div className={`meter${tone}`} role="meter" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      style={cssVars({ "--v": p / 100 })}>
      <span />
    </div>
  );
}

/** One stacked bar, at most five parts, with the values, unit and share written in the legend. */
export function ShareBar({ parts, unit = "number" }: { parts: { label: string; value: unknown; color?: string }[]; unit?: "money" | "number" }) {
  const sorted = [...parts].filter((p) => num(p.value) > 0).sort((a, b) => num(b.value) - num(a.value));
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((s, p) => s + num(p.value), 0);
  const shown = rest ? [...top, { label: "Останати", value: rest }] : top;
  const total = shown.reduce((s, p) => s + num(p.value), 0);
  if (!total) return <EmptyState compact title={t.noData} />;
  const fmt = (v: unknown) => (unit === "money" ? formatCompact(v) : formatNumber(v));
  const swatch = ["", "c2", "c3", "c4", "c4"];
  return (
    <div className="stack-sm">
      <div className="split" role="img" aria-label={shown.map((p) => `${p.label}: ${fmt(p.value)}`).join(", ")}>
        {shown.map((p) => <span key={p.label} title={`${p.label}: ${fmt(p.value)}`} style={cssVars({ "--v": num(p.value) })} />)}
      </div>
      <div className="legend">
        {shown.map((p, i) => (
          <span key={p.label}>
            <span className={`swatch ${swatch[i]}`} aria-hidden />{p.label}
            <span className="lv">{fmt(p.value)}</span>
            <span className="muted">{formatPercent((num(p.value) / total) * 100, 0)}</span>
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
  to?: (row: Row) => string | null;
  render?: (row: Row) => ReactNode;
  className?: string;
}

function cell(row: Row, col: Column): ReactNode {
  if (col.render) return col.render(row);
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return <span className="muted-cell">—</span>;
  switch (col.kind) {
    case "money": return <span className={num(v) < 0 ? "neg" : undefined}>{formatMoney(v)}</span>;
    case "number": return formatNumber(v);
    case "percent": return formatPercent(v, 1);
    case "date": return formatDate(v);
    case "datetime": return formatDateTime(v);
    case "badge": return <Status tone={statusTone(String(v))}>{STATUS_LABELS[String(v)] ?? String(v)}</Status>;
    default: return String(v);
  }
}

const numeric = (c: Column) => c.kind === "money" || c.kind === "number" || c.kind === "percent";

export function DataTable({ rows, columns, empty, maxHeight, footer }: {
  rows: Row[]; columns: Column[]; empty?: ReactNode; maxHeight?: number; footer?: ReactNode;
}) {
  if (!rows.length) return <EmptyState compact title={empty ?? t.noResults} />;
  return (
    <div className={`table-wrap${maxHeight ? " capped" : ""}`}>
      <table className="table">
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col" className={numeric(c) ? "num" : undefined}>{c.label}{c.kind === "money" ? " (MKD)" : ""}</th>)}</tr></thead>
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

/** Sparklines are not used (05 §1: a day tracker only with a daily rule). Kept as an empty part for callers. */
export function Sparkline(_: { values: number[]; className?: string; height?: number }) {
  return null;
}
