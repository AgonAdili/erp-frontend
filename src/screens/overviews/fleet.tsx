/** Fleet overview for a period: today on site, fuel bought vs consumed, consumption by vehicle type, costs and
 * their structure, utilization, and the vehicles that stand out (fuel variance, maintenance, incidents). */
import { useState } from "react";
import { Link } from "react-router-dom";

import { ColumnChart } from "@/charts";
import { HBars, Kpi, Kpis, Meter, ShareBar, StatusBand, useOverview } from "@/components/dashboard";
import { Badge, EmptyState, LinkButton, Panel, Segmented } from "@/components/ui";
import { formatCompact, formatDate, formatDateTime, formatMoney, formatNumber, num } from "@/lib/format";

import { Overview } from "./common";

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
  { value: "week", label: "Недела" }, { value: "last_week", label: "Мин. недела" }, { value: "month", label: "Месец" },
  { value: "quarter", label: "Квартал" }, { value: "year", label: "Година" }, { value: "last_year", label: "Мин. година" },
];

const BREAKDOWN: [string, string][] = [
  ["fuel", "Гориво"], ["maintenance", "Одржување"], ["payroll", "Плати"], ["tolls", "Патарини"], ["wheels", "Гуми"],
  ["fines", "Казни"], ["additional", "Друго"],
];

const plate = (p: string, make: string, model: string) => `${p} · ${make} ${model}`.trim();

export function FleetOverview() {
  const [period, setPeriod] = useState("week");
  const [on, setOn] = useState("");
  const q = useOverview<Dashboard>("/fleet/daily-reports/dashboard/", { period, date: on || undefined });
  const series = (d: Dashboard, keys: [keyof Dashboard["series"], string][]) =>
    d.labels.map((label, i) => Object.fromEntries([["label", label], ...keys.map(([k]) => [k, num(d.series[k][i])])]) as { label: string });
  return (
    <Overview title="Возен парк" q={q}
      subtitle={q.data ? `${formatDate(q.data.from)} – ${formatDate(q.data.to)}${q.data.freshness?.refreshed_at ? ` · збирни податоци од ${formatDateTime(q.data.freshness.refreshed_at)}` : ""}` : undefined}
      actions={<>
        <Segmented label="Период" value={period} onChange={setPeriod} options={PERIODS} />
        <input type="date" className="input" aria-label="На датум" title="На датум" value={on} onChange={(e) => setOn(e.target.value)} style={{ width: 150 }} />
        <LinkButton to="/fleet/efficiency">Потрошувачка наспроти норма</LinkButton>
      </>}>
      {(d) => {
        const busy = d.board.filter((b) => b.busy).length;
        return (
          <>
            <StatusBand title={`На терен, ${formatDate(d.on)}`} stages={[
              { key: "veh", label: "Возила во паркот", count: d.counts.vehicles, to: "/assets/vehicles" },
              { key: "busy", label: "Ангажирани (патен налог)", count: busy, to: "/fleet/travel-orders" },
              { key: "rep", label: "Дневни извештаи", count: d.today.reports, done: true, to: "/fleet/daily-reports", sub: `${d.today.drivers} возачи` },
              { key: "missing", label: "Без извештај", count: d.today.missing.length, attention: true },
              { key: "fines", label: "Неплатени казни", count: d.counts.open_fines, danger: true, to: "/fleet/fines", sub: formatMoney(d.counts.open_fines_total) },
            ]} />
            <Kpis>
              <Kpi label="Трошок по километар" value={formatMoney(d.costs.per_km)} unit="ден." sub={`${formatNumber(d.costs.km, 0)} km · ${formatCompact(d.costs.total)} ден. вкупно`} />
              <Kpi label="Искористеност" value={formatNumber(d.utilization.rate, 1)} unit="%" sub={`работеле ${d.utilization.worked} од ${d.utilization.vehicles} возила`} />
              <Kpi label="Гориво: купено − потрошено" value={formatCompact(d.fuel.difference)} unit="ден." sub={`купено ${formatCompact(d.fuel.bought)} · потрошено ${formatCompact(d.fuel.consumed)}`} />
              <Kpi label="Возачо-денови" value={formatNumber(d.drivers.total, 0)} delta={d.drivers.change_pct} sub="наспроти претходниот период" trend={d.series.drivers.map(num)} />
              <Kpi label="Инциденти" value={formatNumber(d.incidents.count, 0)} sub={`штета ${formatMoney(d.incidents.total)} ден.`} tone={d.incidents.count ? "attention" : undefined} />
            </Kpis>
            <div className="grid-2">
              <Panel title="Гориво" sub="Купено и потрошено, денари">
                <ColumnChart title="Купено и потрошено гориво" data={series(d, [["fuel_bought", ""], ["fuel_consumed", ""]])}
                  series={[{ key: "fuel_bought", name: "Купено" }, { key: "fuel_consumed", name: "Потрошено" }]} />
              </Panel>
              <Panel title="Потрошено гориво по вид" sub="Денари">
                <ColumnChart title="Потрошено гориво по вид возило" stacked data={series(d, [["consumed_trucks", ""], ["consumed_equipment", ""], ["consumed_cars_vans", ""]])}
                  series={[{ key: "consumed_trucks", name: "Камиони" }, { key: "consumed_equipment", name: "Механизација" }, { key: "consumed_cars_vans", name: "Возила и комбиња" }]} />
              </Panel>
              <Panel title="Плати на возачи и патни трошоци" sub="Денари">
                <ColumnChart title="Плати, патарини и дополнителни трошоци" stacked data={series(d, [["payroll", ""], ["paytoll", ""], ["additional", ""]])}
                  series={[{ key: "payroll", name: "Плати" }, { key: "paytoll", name: "Патарини" }, { key: "additional", name: "Дополнителни" }]} />
              </Panel>
              <Panel title="Структура на трошоците" sub={`Документи за возила: ${formatMoney(d.costs.documents)} ден. (вклучени во трошокот по km)`}>
                <div className="stack">
                  <ShareBar unit="money" parts={BREAKDOWN.map(([k, label]) => ({ label, value: d.costs.breakdown[k] ?? 0 }))} />
                  <div className="stack-sm">
                    <div className="row-tight small"><span style={{ flex: 1 }}>Искористеност на возилата</span><span className="num strong">{formatNumber(d.utilization.rate, 1)}%</span></div>
                    <Meter value={d.utilization.rate} label="Искористеност" />
                    <span className="xs muted">{d.utilization.vehicle_days} возило-денови од можни {d.utilization.possible} ({d.utilization.working_days} работни дена)</span>
                  </div>
                </div>
              </Panel>
            </div>
            <div className="grid-3">
              <Panel title="Најголемо отстапување на гориво" sub="Наспроти норма" actions={<LinkButton to="/fleet/efficiency" size="sm">Целиот извештај</LinkButton>}>
                <HBars unit="percent" rows={d.top_fuel_variance.map((r) => ({ key: r.key_id, label: r.key_label, value: r.variance_pct, over: num(r.variance_l) > 0 }))} empty="Нема отстапувања" />
              </Panel>
              <Panel title="Најскапо одржување" sub="Оваа година">
                <HBars rows={d.top_maintenance.map((r) => ({ key: r.order__vehicle_id, label: plate(r.order__vehicle__registration_plates, r.order__vehicle__make, r.order__vehicle__model),
                  value: r.total, to: `/assets/vehicles/${r.order__vehicle_id}` }))} empty="Нема трошоци за одржување" />
              </Panel>
              <Panel title="Најмногу инциденти" sub="Оваа година, штета во денари">
                <HBars rows={d.top_incidents.map((r) => ({ key: r.vehicle_id, label: `${plate(r.vehicle__registration_plates, r.vehicle__make, r.vehicle__model)} (${r.count})`,
                  value: r.total ?? 0, to: `/assets/vehicles/${r.vehicle_id}` }))} empty="Нема инциденти" />
              </Panel>
            </div>
            <div className="grid-2">
              <Panel title={`Без дневен извештај на ${formatDate(d.on)}`} flush>
                {!d.today.missing.length ? <EmptyState compact title="Сите возила имаат извештај" /> : (
                  <div className="table-wrap" style={{ maxHeight: 360 }}><table className="table"><tbody>
                    {d.today.missing.map((v) => (
                      <tr key={v.id}><td><Link to={`/assets/vehicles/${v.id}`}>{plate(v.registration_plates, v.make, v.model)}</Link></td>
                        <td className="right"><LinkButton size="sm" to="/fleet/daily-reports/new">Внеси извештај</LinkButton></td></tr>
                    ))}
                  </tbody></table></div>
                )}
              </Panel>
              <Panel title="Распоред на возила" sub={`${busy} ангажирани · ${d.board.length - busy} слободни`} flush>
                {!d.board.length ? <EmptyState compact /> : (
                  <div className="table-wrap" style={{ maxHeight: 360 }}>
                    <table className="table">
                      <thead><tr><th>Возило</th><th>Статус</th><th>Проект</th><th>Возач / ракувач</th></tr></thead>
                      <tbody>{d.board.map((b) => (
                        <tr key={b.vehicle}>
                          <td><Link to={`/assets/vehicles/${b.vehicle}`}>{plate(b.registration_plates, b.make, b.model)}</Link><div className="xs muted">{b.category}</div></td>
                          <td>{b.busy ? <Link to={`/fleet/travel-orders/${b.travel_order}`}><Badge tone="warning">ангажирано</Badge></Link> : <Badge tone="success">слободно</Badge>}</td>
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
