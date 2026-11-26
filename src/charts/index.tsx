/*! @license © 2026 Mia Spasovska. EACore design system (CORE) and front-end specification (FE) — author: Mia Spasovska. All rights reserved unless agreed otherwise in writing. Fingerprint EAC-MS-C226E467F1A53502. */
/** Charts the FE way (FE/08 "Charts", components/columns.html, line.html): HTML first, no chart library. Columns from 0 on
 * round gridlines, lines drawn over them in SVG with non-scaling strokes, labels at 12px, a tooltip on every column and
 * the same numbers as a table one click away (CORE 07: every chart has a data table). Series colours v3: ink, taupe,
 * blue, grey (max 4); status colours only when a caller passes one for a rule. Values reach CSS only as --v, --b, --y. */
import { useId, useState, type CSSProperties, type ReactNode } from "react";

import { BarChart3, Table2 } from "@/components/icons";
import { formatCompact, formatMoney, formatNumber, num } from "@/lib/format";
import { tr } from "@/i18n";

export interface SeriesDef {
  key: string;
  name: string;
  /** A CSS colour token, e.g. "var(--ea-stop)" for a series that is itself a status. */
  color?: string;
  /** Draw as a line over the bars (same axis, same unit). */
  line?: boolean;
}

export type Datum = Record<string, string | number | null | undefined> & { label: string };

/** Series order (CORE charts v3). Kept as an export for callers that colour a legend by index. */
export const SERIES = ["var(--ea-chart-1)", "var(--ea-chart-2)", "var(--ea-chart-3)", "var(--ea-chart-4)"];

type Unit = "money" | "number" | "percent";

function fmt(v: unknown, unit: Unit) {
  if (unit === "percent") return `${formatNumber(v, 1)} %`;
  return unit === "money" ? `${formatMoney(v)} MKD` : formatNumber(v);
}

function tick(v: number, unit: Unit) {
  if (unit === "percent") return `${formatNumber(v, 0)} %`;
  return formatCompact(v);
}

/** 3–5 round gridlines that include 0 (CORE 22: bars start at 0). */
function niceScale(min: number, max: number) {
  const lo = Math.min(0, min), hi = Math.max(0, max);
  const span = hi - lo || 1;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step || step;
  const ticks: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { a, b, ticks };
}

function DataTableView({ data, series, unit, title }: { data: Datum[]; series: SeriesDef[]; unit: Unit; title: string }) {
  return (
    <div className="table-responsive ea-ch-table">
      <table className="table ea-table compact">
        <caption className="sr-only">{title}</caption>
        <thead><tr><th scope="col">{tr("Период")}</th>{series.map((s) => <th key={s.key} scope="col" className="num ea-num">{s.name}</th>)}</tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><th scope="row">{d.label}</th>{series.map((s) => <td key={s.key} className="num ea-num">{fmt(d[s.key], unit)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** Columns (grouped or stacked) with optional lines on the same axis. */
export function ColumnChart({
  data, series, unit = "money", stacked, height = 200, title, totals = true, extra,
}: {
  data: Datum[];
  series: SeriesDef[];
  unit?: Unit;
  stacked?: boolean;
  height?: number;
  title: string;
  /** Show each series' period total in the legend. */
  totals?: boolean;
  extra?: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  const coloured = series.map((s, i) => ({ ...s, cls: `is-s${(i % 4) + 1}` }));
  const bars = coloured.filter((s) => !s.line);
  const lines = coloured.filter((s) => s.line);
  const empty = !data.length || data.every((d) => series.every((s) => !num(d[s.key])));

  const values: number[] = [];
  for (const d of data) {
    if (stacked) {
      let pos = 0, neg = 0;
      for (const s of bars) { const v = num(d[s.key]); if (v >= 0) pos += v; else neg += v; }
      values.push(pos, neg);
    } else bars.forEach((s) => values.push(num(d[s.key])));
    lines.forEach((s) => values.push(num(d[s.key])));
  }
  const { a, b, ticks } = niceScale(Math.min(0, ...values), Math.max(0, ...values));
  const y = (v: number) => (v - a) / (b - a);              // 0–1 from the bottom of the plot
  const zero = y(0);
  const n = Math.max(data.length, 1);
  const every = n > 14 ? Math.ceil(n / 12) : 1;            // thin the axis labels, never the bars
  const tip = (d: Datum) => `${d.label}: ${coloured.map((s) => `${s.name} ${fmt(d[s.key], unit)}`).join(" · ")}`;

  return (
    <figure className="ea-chart" aria-labelledby={id}>
      <figcaption id={id} className="sr-only">{title}</figcaption>
      <div className="ea-chart-bar">
        {coloured.length > 1 || totals ? (
          <ul className="ea-legend">
            {coloured.map((s) => (
              <li key={s.key}>
                <span className={`${s.line ? "ea-ln" : "ea-sw"} ${s.cls}`} style={s.color ? vars({ "--c": s.color }) : undefined} aria-hidden />
                {s.name}
                {totals && !s.line ? <b className="num">{unit === "money" ? `${formatCompact(data.reduce((acc, d) => acc + num(d[s.key]), 0))} MKD` : formatNumber(data.reduce((acc, d) => acc + num(d[s.key]), 0))}</b> : null}
              </li>
            ))}
          </ul>
        ) : <span className="ea-board-grow" />}
        {extra}
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-pressed={asTable} aria-label={asTable ? tr("Прикажи график") : tr("Прикажи табела")}
          data-tip={asTable ? tr("Прикажи график") : tr("Прикажи табела")} onClick={() => setAsTable((v) => !v)}>
          {asTable ? <BarChart3 aria-hidden /> : <Table2 aria-hidden />}
        </button>
      </div>
      {asTable ? <DataTableView data={data} series={coloured} unit={unit} title={title} /> : empty ? (
        <div className="ea-empty ea-ch-empty"><p>{tr("Нема податоци за периодот")}</p></div>
      ) : (
        <div className="ea-ch" style={vars({ "--ch-h": `${height}px` })} role="img" aria-label={`${title}: ${data.map(tip).join("; ")}`}>
          <div className="ea-ch-y" aria-hidden>{ticks.map((tv) => <span key={tv} style={vars({ "--y": y(tv).toFixed(4) })}>{tick(tv, unit)}</span>)}</div>
          <div className="ea-ch-plot">
            {ticks.map((tv) => <i key={tv} className={`ea-ch-grid${tv === 0 && a < 0 ? " is-zero" : ""}`} style={vars({ "--y": y(tv).toFixed(4) })} aria-hidden />)}
            <ol className="ea-ch-bars ea-ch-cols" style={vars({ "--n": n })}>
              {data.map((d) => {
                let pos = zero, neg = zero;
                return (
                  <li key={d.label} data-tip={tip(d)} tabIndex={-1}>
                    {stacked ? (
                      <span className="ea-ch-cell">
                        {bars.map((s) => {
                          const v = num(d[s.key]); const h = Math.abs(y(v) - zero);
                          const base = v >= 0 ? pos : neg - h;
                          if (v >= 0) pos += h; else neg -= h;
                          return v ? <span key={s.key} className={`ea-ch-col ${s.cls}`} style={vars({ "--b": base.toFixed(4), "--v": h.toFixed(4), ...(s.color ? { "--c": s.color } : {}) })} /> : null;
                        })}
                      </span>
                    ) : bars.map((s) => {
                      const v = num(d[s.key]); const h = Math.abs(y(v) - zero);
                      return (
                        <span key={s.key} className="ea-ch-cell">
                          {v ? <span className={`ea-ch-col ${s.cls}`} style={vars({ "--b": (v >= 0 ? zero : zero - h).toFixed(4), "--v": h.toFixed(4), ...(s.color ? { "--c": s.color } : {}) })} /> : null}
                        </span>
                      );
                    })}
                  </li>
                );
              })}
            </ol>
            {lines.length ? (
              <svg className="ea-ch-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                {lines.map((s) => (
                  <polyline key={s.key} className={`ea-ch-line ${s.cls}`} style={s.color ? vars({ "--c": s.color }) : undefined}
                    points={data.map((d, i) => `${((i + 0.5) / n) * 100},${100 - y(num(d[s.key])) * 100}`).join(" ")} />
                ))}
              </svg>
            ) : null}
          </div>
          <ol className="ea-ch-xb" style={vars({ "--n": n })} aria-hidden>
            {data.map((d, i) => <li key={d.label}>{i % every === 0 ? d.label : ""}</li>)}
          </ol>
        </div>
      )}
    </figure>
  );
}

/** Lines over time (FE line: 2.5px ink, non-scaling). */
export function TrendChart(props: { data: Datum[]; series: SeriesDef[]; unit?: Unit; height?: number; title: string; totals?: boolean }) {
  return <ColumnChart {...props} series={props.series.map((s) => ({ ...s, line: true }))} totals={props.totals ?? false} />;
}
