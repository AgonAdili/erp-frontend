/** Analytics: contract value, cost and margin across projects, billed vs collected, the cost structure, margin
 * per project, and operational figures (procurement, fuel, vehicle documents). */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "@/components/icons";

import { api } from "@/api/client";
import { HBars, Kpi, Kpis, ShareBar, useOverview } from "@/components/dashboard";
import { Badge, Button, EmptyState, Panel, Segmented, useToast } from "@/components/ui";
import { formatWhole, formatDateTime, formatMoney, formatNumber, num } from "@/lib/format";

import { Overview } from "./common";
import { tr } from "@/i18n";

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
      toast(tr("Аналитиката е пресметана повторно"), "success");
    } catch (err) {
      toast((err as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Overview title={tr("Аналитика")} q={q} entityScoped={false}
      subtitle={q.data ? tr("Пресметано {0} · {1} проекти", formatDateTime(q.data.calculated_at), q.data.project_count) : undefined}
      actions={<Button icon={RefreshCw} busy={busy} onClick={() => void recalc()}>{tr("Пресметај повторно")}</Button>}>
      {(p) => {
        const o = ops.data;
        const rows = [...p.rows].sort((a, b) => num(b[rank]) - num(a[rank]));
        return (
          <>
            <Kpis>
              <Kpi label={tr("Вредност на договори")} value={formatWhole(p.tot_rev)} unit="MKD" />
              <Kpi label={tr("Трошоци")} value={formatWhole(p.tot_cost)} unit="MKD" />
              <Kpi label={tr("Маржа")} value={formatWhole(p.tot_margin)} unit="MKD" sub={tr("{0} % од вредноста", formatNumber(p.tot_margin_pct, 1))} tone={num(p.tot_margin) < 0 ? "alarm" : undefined} />
              <Kpi label={tr("Ненаплатено")} value={formatWhole(p.tot_uncollected)} unit="MKD" sub={tr("фактурирано {0} · наплатено {1}", formatWhole(p.tot_billed), formatWhole(p.tot_collected))} />
              <Kpi label={tr("Проекти над буџет")} value={formatNumber(p.overruns, 0)} tone={p.overruns ? "alarm" : undefined} to="/budget/portfolio" />
            </Kpis>
            <div className="grid-2">
              <Panel title={tr("Фактурирано и наплатено")} sub={tr("Сите проекти")}>
                <ShareBar unit="money" parts={[
                  { label: tr("Наплатено"), value: p.tot_collected, color: "var(--ea-chart-1)" },
                  { label: tr("Фактурирано, ненаплатено"), value: p.tot_uncollected, color: "var(--ea-line-strong)" },
                  { label: tr("Нефактурирано"), value: Math.max(0, num(p.tot_rev) - num(p.tot_billed)), color: "var(--ea-chart-4)" },
                ]} />
              </Panel>
              <Panel title={tr("Структура на трошоците")}>
                <HBars rows={p.cost_rows.map((c) => ({ key: c.label, label: c.label, value: c.amount, note: <span className="xs muted" style={{ marginLeft: 6 }}>{formatNumber(c.pct, 0)} %</span> }))} empty={tr("Нема трошоци")} />
              </Panel>
            </div>
            <Panel title={tr("Профитабилност по проект")} flush actions={<Segmented label={tr("Рангирај по")} value={rank} onChange={setRank}
              options={[{ value: "margin_pct", label: tr("Маржа %") }, { value: "margin", label: tr("Маржа") }, { value: "revenue", label: tr("Вредност") }]} />}>
              {!rows.length ? <EmptyState compact title={tr("Нема проекти")} /> : (
                <div className="table-responsive table-wrap" style={{ maxHeight: 560 }}>
                  <table className="table ea-table">
                    <thead><tr><th>{tr("Проект")}</th><th className="num">{tr("Вредност")}</th><th className="num">{tr("Трошок")}</th><th className="num">{tr("Маржа")}</th><th style={{ width: "22%" }}>{tr("Маржа %")}</th><th className="num">{tr("Ненаплатено")}</th></tr></thead>
                    <tbody>
                      {rows.map((r) => {
                        const pct = num(r.margin_pct);
                        return (
                          <tr key={r.id}>
                            <td><Link to={`/projects/projects/${r.id}`}>{r.name}</Link> {r.overrun ? <Badge tone="danger">{tr("над буџет")}</Badge> : null}</td>
                            <td className="num">{formatMoney(r.revenue)}</td>
                            <td className="num">{formatMoney(r.cost)}</td>
                            <td className={`num${num(r.margin) < 0 ? " tone-danger" : ""}`}>{formatMoney(r.margin)}</td>
                            <td>
                              <div className="row-tight">
                                <span className="hb-track" style={{ flex: 1, height: 8, background: "var(--ea-subtle)", borderRadius: "0 4px 4px 0", position: "relative", overflow: "hidden" }}>
                                  <span style={{ position: "absolute", inset: 0, width: `${Math.min(100, Math.abs(pct))} %`, background: pct < 0 ? "var(--ea-stop)" : "var(--ea-chart-1)", borderRadius: "0 4px 4px 0" }} />
                                </span>
                                <span className="num small" style={{ width: 48, textAlign: "right" }}>{formatNumber(pct, 1)} %</span>
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
                <Kpi label={tr("Набавки (фактурирано)")} value={formatWhole(o.proc_invoiced)} unit="MKD" sub={tr("нарачано {0} MKD", formatWhole(o.proc_committed))} to="/procurement" />
                <Kpi label={tr("Гориво")} value={formatWhole(o.fuel)} unit="MKD" sub={tr("{0} возила", o.vehicles)} to="/fleet" />
                <Kpi label={tr("Документи на возила")} value={`${o.docs_expired} / ${o.docs_soon}`} sub={tr("истечени / истекуваат")} tone={o.docs_expired ? "alarm" : o.docs_soon ? "attention" : undefined} to="/fleet/documents" />
              </Kpis>
            ) : null}
          </>
        );
      }}
    </Overview>
  );
}
