/*! @license © 2026 Mia Spasovska. EACore design system (CORE) and front-end specification (FE) — author: Mia Spasovska. All rights reserved unless agreed otherwise in writing. Fingerprint EAC-MS-C226E467F1A53502. */
/** Building blocks of the module overviews in FE markup: the flow (`.ea-pipe`), figures (`.ea-figures`, GA scorecard: bold
 * number, colour only in the change), sorted bars (`.ea-hbars`), bullets (`.ea-bullet`), a meter, a part-of-whole split and a
 * table described by columns (`.ea-table`). Plain HTML; values go to CSS only as custom properties (--v, --t). */
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api, type Query } from "@/api/client";
import { useEntity } from "@/app/prefs";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatWhole, num } from "@/lib/format";

import { Badge, EmptyState, statusTone } from "./ui";
import { tr } from "@/i18n";

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

/** The module's workflow (FE pipe): one cell per stage with its count; a click opens the list with the same filter.
 * Stages someone has to act on are caution, problems stop (CORE status colours, only as status). */
export function StatusBand({ title, stages, total }: { title: string; stages: BandStage[]; total?: ReactNode }) {
  return (
    <section className="ea-panel ea-band" aria-label={title}>
      <div className="ea-panel-head">
        <div className="ea-panel-ht"><h2 className="ea-panel-title">{title}</h2>{total !== undefined ? <span className="ea-panel-meta">{total}</span> : null}</div>
      </div>
      <ol className="ea-pipe">
        {stages.map((s) => {
          const n = s.count ?? 0;
          const tone = s.danger && n > 0 ? " is-stop" : s.attention && n > 0 ? " is-caution" : "";
          const cls = `${n === 0 ? "is-zero" : ""}${tone}${s.done ? " is-done" : ""}`.trim();
          const body = (
            <>
              <b className="num">{s.count === null || s.count === undefined ? "–" : formatNumber(n, 0)}</b>
              <span>{s.label}</span>
              {s.sub ? <span className="ea-pipe-sub">{s.sub}</span> : null}
            </>
          );
          return (
            <li key={s.key}>
              {s.to ? <Link to={s.to} className={cls || undefined} aria-label={`${s.label}: ${n}`}>{body}</Link> : <span className={`ea-pipe-cell ${cls}`.trim()}>{body}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ── KPI tiles ─────────────────────────────────────────────────────────────────

export function Kpis({ children }: { children: ReactNode }) {
  return <div className="ea-figures" role="list">{children}</div>;
}

/** One figure (FE figure.html): label (mono eyebrow), value with its unit, context, the change against the previous period
 * coloured by meaning (good/bad), never by sign. No sparkline: CORE allows a day tracker only where a rule exists. */
export function Kpi({ label, value, unit, sub, delta, goodWhenUp = true, to, tone }: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  /** Change in percent vs the previous period. */
  delta?: number | null;
  goodWhenUp?: boolean;
  /** Kept for callers; not drawn (CORE v5.3: no sparklines on figures). */
  trend?: number[];
  to?: string;
  tone?: "attention" | "alarm" | "good";
}) {
  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const body = (
    <>
      <span className="ea-figure-l">{label}</span>
      <span className="ea-figure-n">{value ?? "–"}{unit ? <span className="ea-figure-u"> {unit}</span> : null}</span>
      {hasDelta ? (
        <span className="ea-figure-foot">
          <span className={`ea-figure-chg ${delta === 0 ? "" : (delta! > 0) === goodWhenUp ? "is-good" : "is-bad"}`}>
            {delta! > 0 ? "↑ +" : delta! < 0 ? "↓ " : ""}{formatNumber(delta, 1)} %
          </span>
          {sub ? <span className="ea-figure-s">{sub}</span> : null}
        </span>
      ) : sub ? <span className="ea-figure-s">{sub}</span> : null}
    </>
  );
  const cls = `ea-figure${tone === "alarm" ? " is-stop" : tone === "good" ? " is-go" : tone === "attention" ? " is-caution" : ""}`;
  return to ? <Link to={to} className={cls} role="listitem">{body}</Link> : <div className={cls} role="listitem">{body}</div>;
}

/** Money on a dashboard: whole number with the ISO code (CORE 05: 4.323.263 MKD). */
export function money(v: unknown) {
  return formatWhole(v);
}

// ── small charts ──────────────────────────────────────────────────────────────

/** Sorted bars (FE hbars): label, value, share of the total and a bar scaled to the largest. Brand colour; red only
 * when the row breaks a rule (`over`). */
export function HBars({ rows, unit = "money", empty }: {
  rows: { label: ReactNode; value: unknown; to?: string; over?: boolean; key?: string | number; note?: ReactNode }[];
  unit?: "money" | "number" | "percent";
  /** Ignored: CORE draws sorted bars in the brand colour. */
  color?: string;
  empty?: ReactNode;
}) {
  if (!rows.length) return <EmptyState compact title={empty ?? tr("Нема податоци")} />;
  const max = Math.max(...rows.map((r) => Math.abs(num(r.value))), 1);
  const total = rows.reduce((a, r) => a + Math.abs(num(r.value)), 0);
  return (
    <ol className="ea-hbars">
      {rows.map((r, i) => {
        const v = num(r.value);
        const inner = (
          <>
            <span className="ea-hbars-l" title={typeof r.label === "string" ? r.label : undefined}>{r.label}</span>
            <b>{unit === "money" ? `${formatWhole(v)} MKD` : unit === "percent" ? `${formatNumber(v, 1)} %` : formatNumber(v)}{r.note}</b>
            <span className="ea-meta">{unit !== "percent" && total ? `${formatNumber((Math.abs(v) / total) * 100, 0)} %` : ""}</span>
            <span className="ea-hbars-t" aria-hidden><i className={r.over ? "is-stop" : undefined} style={{ "--v": (Math.abs(v) / max).toFixed(3) } as CSSProperties} /></span>
          </>
        );
        return <li key={r.key ?? i}>{r.to ? <Link to={r.to}>{inner}</Link> : <span className="ea-hbars-row">{inner}</span>}</li>;
      })}
    </ol>
  );
}

/** Budget-style bar: actual (dark), committed (light, behind), budget (target tick). */
/** Budget bullet (FE bullet): actual (brand, red when over budget), committed behind it, the budget as the target tick. */
export function Bullet({ budget, actual, committed = 0 }: { budget: number; actual: number; committed?: number }) {
  const scale = Math.max(budget, actual + committed, actual, 1);
  const share = (v: number) => Math.min(1, Math.max(0, v / scale)).toFixed(3);
  return (
    <div className={`ea-bullet${actual > budget && budget > 0 ? " is-stop" : ""}`} role="img"
      aria-label={tr("Остварено {0} MKD, нарачано {1} MKD, буџет {2} MKD", formatMoney(actual), formatMoney(committed), formatMoney(budget))}>
      <span className="ea-bullet-track">
        <span className="ea-bullet-committed" style={{ "--v": share(actual + committed) } as CSSProperties} />
        <span className="ea-bullet-bar" style={{ "--v": share(actual) } as CSSProperties} />
        {budget > 0 ? <span className="ea-bullet-target" style={{ "--t": share(budget) } as CSSProperties} /> : null}
      </span>
    </div>
  );
}

export function Meter({ value, max = 100, warnAt, badAt, label }: { value: number; max?: number; warnAt?: number; badAt?: number; label?: string }) {
  const p = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const tone = badAt !== undefined && p >= badAt ? " bad" : warnAt !== undefined && p >= warnAt ? " warn" : "";
  return (
    <div className={`meter${tone}`} role="meter" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ "--v": (p / 100).toFixed(3) } as CSSProperties} />
    </div>
  );
}

/** Part of a whole (FE split): at most 4 parts in ink, taupe, blue and grey (CORE 22, charts v3); more parts become
 * sorted bars, because a bar with many colours can't be read. */
export function ShareBar({ parts, unit = "number" }: { parts: { label: string; value: unknown; color?: string }[]; unit?: "money" | "number" }) {
  const total = parts.reduce((s, p) => s + Math.max(0, num(p.value)), 0);
  if (!total) return <EmptyState compact title={tr("Нема податоци")} />;
  if (parts.filter((p) => num(p.value) > 0).length > 4) {
    return <HBars unit={unit} rows={[...parts].sort((a, b) => num(b.value) - num(a.value)).map((p) => ({ key: p.label, label: p.label, value: p.value }))} />;
  }
  const fmt = (v: unknown) => (unit === "money" ? `${formatWhole(v)} MKD` : formatNumber(v));
  const shown = parts.filter((p) => num(p.value) > 0);
  return (
    <div className="ea-split">
      <div className="ea-split-bar" role="img" aria-label={shown.map((p) => `${p.label}: ${fmt(p.value)}`).join(", ")}>
        {shown.map((p, i) => (
          <span key={p.label} className={`is-s${i + 1}`} title={`${p.label}: ${fmt(p.value)}`} style={{ "--v": (num(p.value) / total).toFixed(4) } as CSSProperties} />
        ))}
      </div>
      <ul className="ea-legend">
        {shown.map((p, i) => (
          <li key={p.label}>
            <span className={`ea-sw is-s${i + 1}`} aria-hidden />{p.label} <b>{fmt(p.value)}</b>
            <span className="ea-meta">{formatNumber((num(p.value) / total) * 100, 0)} %</span>
          </li>
        ))}
      </ul>
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
  if (v === null || v === undefined || v === "") return <span className="muted-cell">{tr("нема податоци")}</span>;
  switch (col.kind) {
    case "money": return formatMoney(v);
    case "number": return formatNumber(v);
    case "percent": return `${formatNumber(v, 1)} %`;
    case "date": return formatDate(v);
    case "datetime": return formatDateTime(v);
    case "badge": return <Badge plain tone={statusTone(String(v))}>{String(v)}</Badge>;
    default: return String(v);
  }
}

const numeric = (c: Column) => c.kind === "money" || c.kind === "number" || c.kind === "percent";

export function DataTable({ rows, columns, empty, maxHeight, footer }: {
  rows: Row[]; columns: Column[]; empty?: ReactNode; maxHeight?: number; footer?: ReactNode;
}) {
  if (!rows.length) return <EmptyState compact title={empty ?? tr("Нема записи")} />;
  return (
    <div className="table-responsive table-wrap" style={maxHeight ? { maxHeight } : undefined}>
      <table className="table ea-table">
        <thead><tr>{columns.map((c) => <th key={c.key} className={numeric(c) ? "num ea-num" : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {columns.map((c) => {
                const content = cell(row, c);
                const to = c.to?.(row);
                return <td key={c.key} className={[numeric(c) ? "num ea-num" : "", c.className ?? ""].join(" ").trim() || undefined}>{to ? <Link to={to}>{content}</Link> : content}</td>;
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
