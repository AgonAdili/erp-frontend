/** Analytics: contract value, cost and margin across projects, billed vs collected, the cost structure, margin
 * per project, and operational figures (procurement, fuel, vehicle documents). */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { api } from "@/api/client";
import { HBars, Kpi, Kpis, ShareBar, useOverview } from "@/components/dashboard";
import { Badge, Button, EmptyState, Panel, Segmented, useToast } from "@/components/ui";
import { formatCompact, formatDateTime, formatMoney, formatNumber, num } from "@/lib/format";

import { Overview } from "./common";

interface Profitability {
  rows: { id: number; name: string; revenue: string; cost: string; margin: string; margin_pct: number; billed: string; collected: string; uncollected: string; overrun: boolean }[];
  project_count: number;
  tot_rev: string; tot_cost: string; tot_margin: string; tot_margin_pct: number; tot_billed: string; tot_collected: string; tot_uncollected: string;
  overruns: number;
  cost_rows: { label: string; amount: string; pct: number }[];
  calculated_at: string;
}

interface Operations {
  proc_invoiced: string; proc_committed: string; fuel: string; vehicles: number; docs_soon: number; docs_expired: number;
}

type Rank = "margin_pct" | "margin" | "revenue";

export function Analytics() {
  const q = useOverview<Profitability>("/analytics/profitability/", {}, { entity: false });
  const ops = useQuery({ queryKey: ["analytics", "operations"], queryFn: () => api.get<Operations>("/analytics/operations/") });
  const [rank, setRank] = useState<Rank>("margin_pct");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const recalc = async () => {
    setBusy(true);
    try {
      await Promise.all([api.get("/analytics/profitability/", { refresh: 1 }), api.get("/analytics/operations/", { refresh: 1 })]);
      await qc.invalidateQueries({ queryKey: ["overview", "/analytics/profitability/"] });
      await qc.invalidateQueries({ queryKey: ["analytics"] });
      toast("Аналитиката е пресметана повторно", "success");
    } catch (err) {
      toast((err as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Overview title="Аналитика" q={q} entityScoped={false}
      subtitle={q.data ? `Пресметано ${formatDateTime(q.data.calculated_at)} · ${q.data.project_count} проекти` : undefined}
      actions={<Button icon={RefreshCw} busy={busy} onClick={() => void recalc()}>Пресметај повторно</Button>}>
      {(p) => {
        const o = ops.data;
        const rows = [...p.rows].sort((a, b) => num(b[rank]) - num(a[rank]));
        return (
          <>
            <Kpis>
              <Kpi label="Вредност на договори" value={formatCompact(p.tot_rev)} unit="ден." />
              <Kpi label="Трошоци" value={formatCompact(p.tot_cost)} unit="ден." />
              <Kpi label="Маржа" value={formatCompact(p.tot_margin)} unit="ден." sub={`${formatNumber(p.tot_margin_pct, 1)}% од вредноста`} tone={num(p.tot_margin) < 0 ? "alarm" : undefined} />
              <Kpi label="Ненаплатено" value={formatCompact(p.tot_uncollected)} unit="ден." sub={`фактурирано ${formatCompact(p.tot_billed)} · наплатено ${formatCompact(p.tot_collected)}`} />
              <Kpi label="Проекти над буџет" value={formatNumber(p.overruns, 0)} tone={p.overruns ? "alarm" : undefined} to="/budget/portfolio" />
            </Kpis>
            <div className="grid-2">
              <Panel title="Фактурирано и наплатено" sub="Сите проекти">
                <ShareBar unit="money" parts={[
                  { label: "Наплатено", value: p.tot_collected, color: "var(--series-1)" },
                  { label: "Фактурирано, ненаплатено", value: p.tot_uncollected, color: "var(--series-6)" },
                  { label: "Нефактурирано", value: Math.max(0, num(p.tot_rev) - num(p.tot_billed)), color: "var(--series-muted)" },
                ]} />
              </Panel>
              <Panel title="Структура на трошоците">
                <HBars rows={p.cost_rows.map((c) => ({ key: c.label, label: c.label, value: c.amount, note: <span className="xs muted" style={{ marginLeft: 6 }}>{formatNumber(c.pct, 0)}%</span> }))} empty="Нема трошоци" />
              </Panel>
            </div>
            <Panel title="Профитабилност по проект" flush actions={<Segmented label="Рангирај по" value={rank} onChange={setRank}
              options={[{ value: "margin_pct", label: "Маржа %" }, { value: "margin", label: "Маржа" }, { value: "revenue", label: "Вредност" }]} />}>
              {!rows.length ? <EmptyState compact title="Нема проекти" /> : (
                <div className="table-wrap" style={{ maxHeight: 560 }}>
                  <table className="table">
                    <thead><tr><th>Проект</th><th className="num">Вредност</th><th className="num">Трошок</th><th className="num">Маржа</th><th style={{ width: "22%" }}>Маржа %</th><th className="num">Ненаплатено</th></tr></thead>
                    <tbody>
                      {rows.map((r) => {
                        const pct = num(r.margin_pct);
                        return (
                          <tr key={r.id}>
                            <td><Link to={`/projects/projects/${r.id}`}>{r.name}</Link> {r.overrun ? <Badge tone="danger">над буџет</Badge> : null}</td>
                            <td className="num">{formatMoney(r.revenue)}</td>
                            <td className="num">{formatMoney(r.cost)}</td>
                            <td className={`num${num(r.margin) < 0 ? " tone-danger" : ""}`}>{formatMoney(r.margin)}</td>
                            <td>
                              <div className="row-tight">
                                <span className="hb-track" style={{ flex: 1, height: 8, background: "var(--surface-3)", borderRadius: "0 4px 4px 0", position: "relative", overflow: "hidden" }}>
                                  <span style={{ position: "absolute", inset: 0, width: `${Math.min(100, Math.abs(pct))}%`, background: pct < 0 ? "var(--danger)" : "var(--series-1)", borderRadius: "0 4px 4px 0" }} />
                                </span>
                                <span className="num small" style={{ width: 48, textAlign: "right" }}>{formatNumber(pct, 1)}%</span>
                              </div>
                            </td>
                            <td className="num">{formatMoney(r.uncollected)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
            {o ? (
              <Kpis>
                <Kpi label="Набавки (фактурирано)" value={formatCompact(o.proc_invoiced)} unit="ден." sub={`нарачано ${formatCompact(o.proc_committed)} ден.`} to="/procurement" />
                <Kpi label="Гориво" value={formatCompact(o.fuel)} unit="ден." sub={`${o.vehicles} возила`} to="/fleet" />
                <Kpi label="Документи на возила" value={`${o.docs_expired} / ${o.docs_soon}`} sub="истечени / истекуваат" tone={o.docs_expired ? "alarm" : o.docs_soon ? "attention" : undefined} to="/fleet/documents" />
              </Kpis>
            ) : null}
          </>
        );
      }}
    </Overview>
  );
}
