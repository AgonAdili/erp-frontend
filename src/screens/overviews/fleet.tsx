/** Fleet overview for a period: today on site, fuel bought vs consumed, consumption by vehicle type, costs and
 * their structure, utilization, and the vehicles that stand out (fuel variance, maintenance, incidents). */
import { useState } from "react";
import { Link } from "react-router-dom";

import { ColumnChart } from "@/charts";
import { HBars, Kpi, Kpis, Meter, ShareBar, StatusBand, useOverview } from "@/components/dashboard";
import { Badge, EmptyState, LinkButton, Panel, Segmented } from "@/components/ui";
import { formatWhole, formatDate, formatDateTime, formatMoney, formatNumber, num } from "@/lib/format";

import { Overview } from "./common";
import { tr } from "@/i18n";

type Money = string;

interface EfficiencyRow {
  key_id: number; key_label: string; actual_l: Money; expected_l: Money; variance_l: Money; variance_pct: Money;
}

interface Dashboard {
  period: string; on: string; from: string; to: string; labels: string[];
  counts: { drivers: number; vehicles: number; open_fines: number; open_fines_total: Money };
  today: { reports: number; drivers: number; payroll: Money; missing: { id: number; registration_plates: string; make: string; model: string }[] };
  series: Record<"fuel_bought" | "fuel_consumed" | "consumed_trucks" | "consumed_equipment" | "consumed_cars_vans"
    | "paytoll" | "additional" | "payroll", Money[]> & { drivers: number[] };
  fuel: { bought: Money; consumed: Money; difference: Money };
  drivers: { total: number; average: number; previous: number; change_pct: number };
  costs: { breakdown: Record<string, Money>; documents: Money; total: Money; km: number | string; per_km: Money };
  utilization: { rate: number; vehicles: number; worked: number; idle: number; vehicle_days: number; possible: number; working_days: number };
  incidents: { count: number; total: Money; average: Money };
  top_maintenance: { order__vehicle_id: number; order__vehicle__registration_plates: string; order__vehicle__make: string; order__vehicle__model: string; total: Money }[];
  top_incidents: { vehicle_id: number; vehicle__registration_plates: string; vehicle__make: string; vehicle__model: string; count: number; total: Money | null }[];
  top_fuel_variance: EfficiencyRow[];
  board: { vehicle: number; registration_plates: string; make: string; model: string; category: string; busy: boolean;
    travel_order: number | null; project: string | null; operator: string | null }[];
  freshness?: { refreshed_at?: string | null; stale?: boolean } | null;
}

const PERIODS: { value: string; label: string }[] = [
  { value: "week", label: tr("Недела") }, { value: "last_week", label: tr("Мин. недела") }, { value: "month", label: tr("Месец") },
  { value: "quarter", label: tr("Квартал") }, { value: "year", label: tr("Година") }, { value: "last_year", label: tr("Мин. година") },
];

const BREAKDOWN: [string, string][] = [
  ["fuel", tr("Гориво")], ["maintenance", tr("Одржување")], ["payroll", tr("Плати")], ["tolls", tr("Патарини")], ["wheels", tr("Гуми")],
  ["fines", tr("Казни")], ["additional", tr("Друго")],
];

const plate = (p: string, make: string, model: string) => `${p} · ${make} ${model}`.trim();

export function FleetOverview() {
  const [period, setPeriod] = useState("week");
  const [on, setOn] = useState("");
  const q = useOverview<Dashboard>("/fleet/daily-reports/dashboard/", { period, date: on || undefined });
  const series = (d: Dashboard, keys: [keyof Dashboard["series"], string][]) =>
    d.labels.map((label, i) => Object.fromEntries([["label", label], ...keys.map(([k]) => [k, num(d.series[k][i])])]) as { label: string });
  return (
    <Overview title={tr("Возен парк")} q={q}
      subtitle={q.data ? `${formatDate(q.data.from)} – ${formatDate(q.data.to)}${q.data.freshness?.refreshed_at ? tr(" · збирни податоци од {0}", formatDateTime(q.data.freshness.refreshed_at)) : ""}` : undefined}
      actions={<>
        <Segmented label={tr("Период")} value={period} onChange={setPeriod} options={PERIODS} />
        <input type="date" className="form-control" aria-label={tr("На датум")} title={tr("На датум")} value={on} onChange={(e) => setOn(e.target.value)} style={{ width: 150 }} />
        <LinkButton to="/fleet/efficiency">{tr("Потрошувачка наспроти норма")}</LinkButton>
      </>}>
      {(d) => {
        const busy = d.board.filter((b) => b.busy).length;
        return (
          <>
            <StatusBand title={tr("На терен, {0}", formatDate(d.on))} stages={[
              { key: "veh", label: tr("Возила во паркот"), count: d.counts.vehicles, to: "/assets/vehicles" },
              { key: "busy", label: tr("Ангажирани (патен налог)"), count: busy, to: "/fleet/travel-orders" },
              { key: "rep", label: tr("Дневни извештаи"), count: d.today.reports, done: true, to: "/fleet/daily-reports", sub: tr("{0} возачи", d.today.drivers) },
              { key: "missing", label: tr("Без извештај"), count: d.today.missing.length, attention: true },
              { key: "fines", label: tr("Неплатени казни"), count: d.counts.open_fines, danger: true, to: "/fleet/fines", sub: formatMoney(d.counts.open_fines_total) },
            ]} />
            <Kpis>
              <Kpi label={tr("Трошок по километар")} value={formatMoney(d.costs.per_km)} unit="MKD" sub={tr("{0} km · {1} MKD вкупно", formatNumber(d.costs.km, 0), formatWhole(d.costs.total))} />
              <Kpi label={tr("Искористеност")} value={formatNumber(d.utilization.rate, 1)} unit="%" sub={tr("работеле {0} од {1} возила", d.utilization.worked, d.utilization.vehicles)} />
              <Kpi label={tr("Гориво: купено − потрошено")} value={formatWhole(d.fuel.difference)} unit="MKD" sub={tr("купено {0} · потрошено {1}", formatWhole(d.fuel.bought), formatWhole(d.fuel.consumed))} />
              <Kpi label={tr("Возачо-денови")} value={formatNumber(d.drivers.total, 0)} delta={d.drivers.change_pct} sub={tr("наспроти претходниот период")} trend={d.series.drivers.map(num)} />
              <Kpi label={tr("Инциденти")} value={formatNumber(d.incidents.count, 0)} sub={tr("штета {0} MKD", formatMoney(d.incidents.total))} tone={d.incidents.count ? "attention" : undefined} />
            </Kpis>
            <div className="grid-2">
              <Panel title={tr("Гориво")} sub={tr("Купено и потрошено, MKD")}>
                <ColumnChart title={tr("Купено и потрошено гориво")} data={series(d, [["fuel_bought", ""], ["fuel_consumed", ""]])}
                  series={[{ key: "fuel_bought", name: tr("Купено") }, { key: "fuel_consumed", name: tr("Потрошено") }]} />
              </Panel>
              <Panel title={tr("Потрошено гориво по вид")} sub={tr("Денари")}>
                <ColumnChart title={tr("Потрошено гориво по вид возило")} stacked data={series(d, [["consumed_trucks", ""], ["consumed_equipment", ""], ["consumed_cars_vans", ""]])}
                  series={[{ key: "consumed_trucks", name: tr("Камиони") }, { key: "consumed_equipment", name: tr("Механизација") }, { key: "consumed_cars_vans", name: tr("Возила и комбиња") }]} />
              </Panel>
              <Panel title={tr("Плати на возачи и патни трошоци")} sub={tr("Денари")}>
                <ColumnChart title={tr("Плати, патарини и дополнителни трошоци")} stacked data={series(d, [["payroll", ""], ["paytoll", ""], ["additional", ""]])}
                  series={[{ key: "payroll", name: tr("Плати") }, { key: "paytoll", name: tr("Патарини") }, { key: "additional", name: tr("Дополнителни") }]} />
              </Panel>
              <Panel title={tr("Структура на трошоците")} sub={tr("Документи за возила: {0} MKD (вклучени во трошокот по km)", formatMoney(d.costs.documents))}>
                <div className="stack">
                  <ShareBar unit="money" parts={BREAKDOWN.map(([k, label]) => ({ label, value: d.costs.breakdown[k] ?? 0 }))} />
                  <div className="stack-sm">
                    <div className="row-tight small"><span style={{ flex: 1 }}>{tr("Искористеност на возилата")}</span><span className="num strong">{formatNumber(d.utilization.rate, 1)} %</span></div>
                    <Meter value={d.utilization.rate} label={tr("Искористеност")} />
                    <span className="xs muted">{d.utilization.vehicle_days}{" "}{tr("возило-денови од можни")}{" "}{d.utilization.possible} ({d.utilization.working_days}{" "}{tr("работни дена)")}</span>
                  </div>
                </div>
              </Panel>
            </div>
            <div className="grid-3">
              <Panel title={tr("Најголемо отстапување на гориво")} sub={tr("Наспроти норма")} actions={<LinkButton to="/fleet/efficiency" size="sm">{tr("Целиот извештај")}</LinkButton>}>
                <HBars unit="percent" rows={d.top_fuel_variance.map((r) => ({ key: r.key_id, label: r.key_label, value: r.variance_pct, over: num(r.variance_l) > 0 }))} empty={tr("Нема отстапувања")} />
              </Panel>
              <Panel title={tr("Најскапо одржување")} sub={tr("Оваа година")}>
                <HBars rows={d.top_maintenance.map((r) => ({ key: r.order__vehicle_id, label: plate(r.order__vehicle__registration_plates, r.order__vehicle__make, r.order__vehicle__model),
                  value: r.total, to: `/assets/vehicles/${r.order__vehicle_id}` }))} empty={tr("Нема трошоци за одржување")} />
              </Panel>
              <Panel title={tr("Најмногу инциденти")} sub={tr("Оваа година, штета во MKD")}>
                <HBars rows={d.top_incidents.map((r) => ({ key: r.vehicle_id, label: `${plate(r.vehicle__registration_plates, r.vehicle__make, r.vehicle__model)} (${r.count})`,
                  value: r.total ?? 0, to: `/assets/vehicles/${r.vehicle_id}` }))} empty={tr("Нема инциденти")} />
              </Panel>
            </div>
            <div className="grid-2">
              <Panel title={tr("Без дневен извештај на {0}", formatDate(d.on))} flush>
                {!d.today.missing.length ? <EmptyState compact title={tr("Сите возила имаат извештај")} /> : (
                  <div className="table-responsive table-wrap" style={{ maxHeight: 360 }}><table className="table ea-table"><tbody>
                    {d.today.missing.map((v) => (
                      <tr key={v.id}><td><Link to={`/assets/vehicles/${v.id}`}>{plate(v.registration_plates, v.make, v.model)}</Link></td>
                        <td className="right"><LinkButton size="sm" to="/fleet/daily-reports/new">{tr("Внеси извештај")}</LinkButton></td></tr>
                    ))}
                  </tbody></table></div>
                )}
              </Panel>
              <Panel title={tr("Распоред на возила")} sub={tr("{0} ангажирани · {1} слободни", busy, d.board.length - busy)} flush>
                {!d.board.length ? <EmptyState compact /> : (
                  <div className="table-responsive table-wrap" style={{ maxHeight: 360 }}>
                    <table className="table ea-table">
                      <thead><tr><th>{tr("Возило")}</th><th>{tr("Статус")}</th><th>{tr("Проект")}</th><th>{tr("Возач / ракувач")}</th></tr></thead>
                      <tbody>{d.board.map((b) => (
                        <tr key={b.vehicle}>
                          <td><Link to={`/assets/vehicles/${b.vehicle}`}>{plate(b.registration_plates, b.make, b.model)}</Link><div className="xs muted">{b.category}</div></td>
                          <td>{b.busy ? <Link to={`/fleet/travel-orders/${b.travel_order}`}><Badge tone="warning">{tr("ангажирано")}</Badge></Link> : <Badge tone="success">{tr("слободно")}</Badge>}</td>
                          <td className="small">{b.project ?? ""}</td>
                          <td className="small">{b.operator ?? ""}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          </>
        );
      }}
    </Overview>
  );
}
