/** Grouped bar chart in plain SVG (no chart library): one group per label, one bar per series, a legend,
 * and the exact value on hover. */
import { formatMoney, formatNumber } from "@/lib/format";

export interface Series {
  name: string;
  values: (number | string)[];
  color?: string;
}

const PALETTE = ["var(--accent)", "var(--accent-2)", "#c08a2b", "#6b7f99", "#a0522d"];

export function BarChart({
  labels, series, money = true, height = 180, title,
}: {
  labels: string[];
  series: Series[];
  money?: boolean;
  height?: number;
  title: string;
}) {
  const nums = series.map((s) => s.values.map((v) => Number(v) || 0));
  const max = Math.max(1, ...nums.flat());
  const W = 360, H = height * 0.6, pad = 18, groupW = (W - pad) / Math.max(1, labels.length);
  const barW = Math.max(3, Math.min(18, (groupW - 8) / Math.max(1, series.length)));
  const fmt = (v: number) => (money ? formatMoney(v) : formatNumber(v));
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H + pad}`} role="img" aria-label={title}
        style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1={pad} x2={W} y1={H} y2={H} stroke="var(--rule-strong)" />
        {labels.map((label, i) => {
          const x0 = pad + i * groupW + (groupW - barW * series.length) / 2;
          return (
            <g key={label}>
              {nums.map((vals, s) => {
                const h = (vals[i] / max) * (H - 8);
                return (
                  <rect key={s} x={x0 + s * barW} y={H - h} width={barW - 2} height={h} rx={2}
                    fill={series[s].color ?? PALETTE[s % PALETTE.length]}>
                    <title>{`${label} · ${series[s].name}: ${fmt(vals[i])}`}</title>
                  </rect>
                );
              })}
              <text x={pad + i * groupW + groupW / 2} y={H + 13} textAnchor="middle" fontSize="10" fill="var(--ink-mute)">{label}</text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 ? (
        <figcaption className="row small" style={{ gap: 12 }}>
          {series.map((s, i) => (
            <span key={s.name} className="row" style={{ gap: 4 }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: s.color ?? PALETTE[i % PALETTE.length], display: "inline-block" }} />
              {s.name}: {fmt(nums[i].reduce((a, b) => a + b, 0))}
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Horizontal share bars (label, bar, amount). */
export function ShareBars({ rows }: { rows: { label: string; value: number | string }[] }) {
  const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0) || 1;
  return (
    <table className="table"><tbody>
      {rows.map((r) => {
        const pct = ((Number(r.value) || 0) / total) * 100;
        return (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td style={{ width: "40%" }}>
              <div style={{ background: "var(--rule)", borderRadius: 4, height: 8 }} title={`${pct.toFixed(1)}%`}>
                <div style={{ background: "var(--accent-2)", width: `${pct}%`, height: 8, borderRadius: 4 }} />
              </div>
            </td>
            <td className="num">{formatMoney(r.value)}</td>
          </tr>
        );
      })}
    </tbody></table>
  );
}
