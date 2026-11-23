/** Cartesian charts (Recharts) in one style: hairline grid, 24px-max bars with rounded data ends, 2px lines,
 * one y-axis, a legend for two or more series, a hover tooltip with exact values, and a table view. Series
 * colours come in the validated order (--series-1…6) and follow the series, never its rank. */
import { useId, useState, type ReactNode } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from "recharts";
import { BarChart3, Table2 } from "@/components/icons";

import { cssVars } from "@/components/ui";
import { formatCompact, formatMoney, formatNumber, formatPercent, num } from "@/lib/format";

export interface SeriesDef {
  key: string;
  name: string;
  color?: string;
  /** Draw as a line over the bars (same axis, same unit). */
  line?: boolean;
}

export type Datum = Record<string, string | number | null | undefined> & { label: string };

export const SERIES = ["var(--ea-chart-1)", "var(--ea-chart-2)", "var(--ea-chart-3)", "var(--ea-chart-4)", "var(--ea-chart-4)", "var(--ea-chart-4)"];

function fmt(v: unknown, unit: "money" | "number" | "percent") {
  if (unit === "percent") return `${formatPercent(v, 1)}`;
  return unit === "money" ? formatMoney(v) : formatNumber(v);
}

function ChartTooltip({ active, payload, label, unit }: TooltipContentProps<number, string> & { unit: "money" | "number" | "percent" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tt-title">{label}</div>
      {payload.map((p) => (
        <div className="tt-row" key={String(p.dataKey)}>
          <span className="row-tight"><span className="swatch var" style={cssVars({ "--c": String(p.color ?? p.fill) })} />{p.name}</span>
          <span>{fmt(p.value, unit)}</span>
        </div>
      ))}
    </div>
  );
}

function DataTableView({ data, series, unit, title }: { data: Datum[]; series: SeriesDef[]; unit: "money" | "number" | "percent"; title: string }) {
  return (
    <div className="table-wrap short">
      <table className="table compact">
        <caption className="sr-only">{title}</caption>
        <thead><tr><th>{""}</th>{series.map((s) => <th key={s.key} className="num">{s.name}</th>)}</tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><td>{d.label}</td>{series.map((s) => <td key={s.key} className="num">{fmt(d[s.key], unit)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Columns (grouped or stacked) with optional lines on the same axis. */
export function ColumnChart({
  data, series, unit = "money", stacked, height = 240, title, totals = true, extra,
}: {
  data: Datum[];
  series: SeriesDef[];
  unit?: "money" | "number" | "percent";
  stacked?: boolean;
  height?: number;
  title: string;
  /** Show each series' period total in the legend. */
  totals?: boolean;
  extra?: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? SERIES[i % SERIES.length] }));
  const bars = colored.filter((s) => !s.line);
  const hasNegative = data.some((d) => colored.some((s) => num(d[s.key]) < 0));
  const empty = !data.length || data.every((d) => colored.every((s) => !num(d[s.key])));
  return (
    <figure className="chart" aria-labelledby={id}>
      <figcaption id={id} className="sr-only">{title}</figcaption>
      <div className="row items-start">
        {colored.length > 1 || totals ? (
          <div className="legend flex-1">
            {colored.map((s) => (
              <span key={s.key}>
                {s.line ? <span aria-hidden className="line-key" style={cssVars({ "--c": s.color })} />
                  : <span className="swatch var" style={cssVars({ "--c": s.color })} aria-hidden />}
                {s.name}
                {totals && !s.line ? <span className="lv">{unit === "money" ? formatCompact(data.reduce((a, d) => a + num(d[s.key]), 0)) : formatNumber(data.reduce((a, d) => a + num(d[s.key]), 0))}</span> : null}
              </span>
            ))}
          </div>
        ) : <span className="spacer" />}
        {extra}
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-pressed={asTable} aria-label={asTable ? "Прикажи график" : "Прикажи табела"}
          title={asTable ? "Прикажи график" : "Прикажи табела"} onClick={() => setAsTable((v) => !v)}>
          {asTable ? <BarChart3 aria-hidden /> : <Table2 aria-hidden />}
        </button>
      </div>
      {asTable ? <DataTableView data={data} series={colored} unit={unit} title={title} /> : empty ? (
        <div className="empty compact h-var" style={cssVars({ "--h": `${height}px` })}><span className="empty-text">Нема податоци за периодот.</span></div>
      ) : (
        <div className="h-var" style={cssVars({ "--h": `${height}px` })}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--ea-line-strong)" }} interval="preserveStartEnd" minTickGap={8} tickMargin={6} />
              <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (unit === "percent" ? `${v}%` : formatCompact(v))} />
              {hasNegative ? <ReferenceLine y={0} stroke="var(--ea-line-strong)" /> : null}
              <Tooltip cursor={{ fill: "var(--ea-subtle)" }} content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} unit={unit} />} />
              {bars.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} maxBarSize={24} stackId={stacked ? "a" : undefined}
                  radius={stacked ? (i === bars.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
                  stroke={stacked ? "var(--ea-surface)" : undefined} strokeWidth={stacked ? 2 : 0} isAnimationActive={false} />
              ))}
              {colored.filter((s) => s.line).map((s) => (
                <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} type="monotone"
                  activeDot={{ r: 4, stroke: "var(--ea-surface)", strokeWidth: 2 }} isAnimationActive={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

/** Lines over time (2px, end dot on hover). */
export function TrendChart(props: { data: Datum[]; series: SeriesDef[]; unit?: "money" | "number" | "percent"; height?: number; title: string; totals?: boolean }) {
  return <ColumnChart {...props} series={props.series.map((s) => ({ ...s, line: true }))} totals={props.totals ?? false} />;
}
