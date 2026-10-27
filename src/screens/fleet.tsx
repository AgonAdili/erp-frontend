/** Fleet dashboard (v1 fleet home) and the fuel efficiency report. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api, API_BASE, download } from "@/api/client";
import { BarChart, ShareBars } from "@/components/charts";
import { Kpi } from "@/components/dashboard";
import { RelatedSelect } from "@/components/inputs";
import { Alert, Badge, Button, EmptyState, Field, Spinner } from "@/components/ui";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";

const REPORTS = `${API_BASE}/fleet/daily-reports/`;

type Money = string;

interface Dashboard {
  period: string; on: string; from: string; to: string; labels: string[];
  counts: { drivers: number; vehicles: number; open_fines: number; open_fines_total: Money };
  today: { reports: number; drivers: number; payroll: Money;
    missing: { id: number; registration_plates: string; make: string; model: string }[] };
  series: Record<"fuel_bought" | "fuel_consumed" | "consumed_trucks" | "consumed_equipment" | "consumed_cars_vans"
    | "paytoll" | "additional" | "payroll", Money[]> & { drivers: number[] };
  fuel: { bought: Money; consumed: Money; difference: Money };
  drivers: { total: number; average: number; previous: number; change_pct: number };
  costs: { breakdown: Record<string, Money>; documents: Money; total: Money; km: number | string; per_km: Money };
  utilization: { rate: number; vehicles: number; worked: number; idle: number; vehicle_days: number; possible: number; working_days: number };
  incidents: { count: number; total: Money; average: Money };
  top_maintenance: { order__vehicle_id: number; order__vehicle__registration_plates: string; order__vehicle__make: string;
    order__vehicle__model: string; total: Money }[];
  top_incidents: { vehicle_id: number; vehicle__registration_plates: string; vehicle__make: string; vehicle__model: string;
    count: number; total: Money | null }[];
  top_fuel_variance: EfficiencyRow[];
  board: { vehicle: number; registration_plates: string; make: string; model: string; category: string; busy: boolean;
    travel_order: number | null; project: string | null; operator: string | null }[];
  freshness?: { refreshed_at?: string | null; stale?: boolean } | null;
}

interface EfficiencyRow {
  key_id: number; key_label: string; actual_l: Money; expected_l: Money; variance_l: Money; variance_pct: Money;
  actual_cost_mkd: Money; expected_cost_mkd: Money; cost_impact_mkd: Money;
}

const PERIODS: [string, string][] = [
  ["week", "Оваа недела"], ["last_week", "Минатата недела"], ["month", "Овој месец"], ["quarter", "Квартал"],
  ["year", "Оваа година"], ["last_year", "Минатата година"],
];

const BREAKDOWN: [string, string][] = [
  ["fuel", "Гориво"], ["maintenance", "Одржување"], ["payroll", "Плати"], ["tolls", "Патарини"], ["wheels", "Гуми"],
  ["fines", "Казни"], ["additional", "Друго"],
];

const plate = (p: string, make: string, model: string) => `${p} — ${make} ${model}`.trim();

export function FleetDashboard() {
  const [period, setPeriod] = useState("week");
  const [on, setOn] = useState("");
  const q = useQuery({
    queryKey: ["fleet-dashboard", period, on],
    queryFn: () => api.get<Dashboard>(`${REPORTS}dashboard/`, { period, date: on || undefined }),
  });
  const d = q.data;
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Возен парк — преглед</h1>
        <span className="spacer" />
        <Field label="Период" htmlFor="fd-period">
          <select id="fd-period" className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </Field>
        <Field label="Датум" htmlFor="fd-date">
          <input id="fd-date" type="date" className="input" value={on} onChange={(e) => setOn(e.target.value)} />
        </Field>
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <Alert tone="danger">{(q.error as Error).message}</Alert> : d ? (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {formatDate(d.from)} – {formatDate(d.to)}
            {d.freshness?.refreshed_at ? ` · збирни податоци од ${formatDateTime(d.freshness.refreshed_at)}` : ""}
          </p>
          <div className="kpis">
            <Kpi label="Возила" value={d.counts.vehicles} sub={`возачи: ${d.counts.drivers}`} />
            <Kpi label="Извештаи денес" value={d.today.reports}
              sub={`возачи: ${d.today.drivers} · плата ${formatMoney(d.today.payroll)}`} />
            <Kpi label="Без извештај денес" value={d.today.missing.length} />
            <Kpi label="Неплатени казни" value={d.counts.open_fines} sub={formatMoney(d.counts.open_fines_total)} />
            <Kpi label="Трошок по km" value={formatMoney(d.costs.per_km)}
              sub={`${formatNumber(d.costs.km)} km · ${formatMoney(d.costs.total)}`} />
            <Kpi label="Искористеност" value={`${d.utilization.rate}%`}
              sub={`работеле ${d.utilization.worked} / ${d.utilization.vehicles} возила`} />
            <Kpi label="Инциденти" value={d.incidents.count} sub={`штета ${formatMoney(d.incidents.total)}`} />
            <Kpi label="Возачи (дена)" value={d.drivers.total}
              sub={`${d.drivers.change_pct >= 0 ? "+" : ""}${d.drivers.change_pct}% од претходниот период`} />
          </div>

          <div className="grid-2">
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Гориво</h2>
              <BarChart title="Купено и потрошено гориво" labels={d.labels} series={[
                { name: "Купено", values: d.series.fuel_bought }, { name: "Потрошено", values: d.series.fuel_consumed },
              ]} />
              <div className="small">Разлика купено − потрошено: <strong>{formatMoney(d.fuel.difference)}</strong></div>
            </div>
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Потрошено по вид</h2>
              <BarChart title="Потрошено гориво по вид возило" labels={d.labels} series={[
                { name: "Камиони", values: d.series.consumed_trucks },
                { name: "Механизација", values: d.series.consumed_equipment },
                { name: "Возила и комбиња", values: d.series.consumed_cars_vans },
              ]} />
            </div>
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Возачи и плати</h2>
              <BarChart title="Возачи по период" money={false} labels={d.labels} series={[{ name: "Возачи", values: d.series.drivers }]} />
              <BarChart title="Плати на возачи" labels={d.labels} height={120} series={[{ name: "Плати", values: d.series.payroll }]} />
            </div>
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Патни трошоци</h2>
              <BarChart title="Патарини и дополнителни трошоци" labels={d.labels} series={[
                { name: "Патарини", values: d.series.paytoll }, { name: "Дополнителни", values: d.series.additional },
              ]} />
            </div>
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Структура на трошоците</h2>
              <ShareBars rows={BREAKDOWN.map(([k, label]) => ({ label, value: d.costs.breakdown[k] ?? 0 }))} />
              <div className="small muted">Документи за возила во периодот: {formatMoney(d.costs.documents)} (во трошокот по km)</div>
            </div>
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Возила без извештај на {formatDate(d.on)}</h2>
              {!d.today.missing.length ? <EmptyState>Сите возила имаат извештај.</EmptyState> : (
                <table className="table"><tbody>
                  {d.today.missing.map((v) => (
                    <tr key={v.id}><td><Link to={`/assets/vehicles/${v.id}`}>{plate(v.registration_plates, v.make, v.model)}</Link></td></tr>
                  ))}
                </tbody></table>
              )}
            </div>
          </div>

          <div className="grid-2">
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Најголемо отстапување на гориво</h2>
              {!d.top_fuel_variance.length ? <EmptyState /> : (
                <table className="table">
                  <thead><tr><th>Возило</th><th className="num">Потрошено L</th><th className="num">Норма L</th><th className="num">Отстапување</th></tr></thead>
                  <tbody>{d.top_fuel_variance.map((r) => (
                    <tr key={r.key_id}><td>{r.key_label}</td><td className="num">{formatNumber(r.actual_l, 2)}</td>
                      <td className="num">{formatNumber(r.expected_l, 2)}</td>
                      <td className="num"><Badge tone={Number(r.variance_l) > 0 ? "danger" : "success"}>{formatNumber(r.variance_pct, 1)}%</Badge></td></tr>
                  ))}</tbody>
                </table>
              )}
              <Link to="/fleet/efficiency" className="small">Целосен извештај за потрошувачка →</Link>
            </div>
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Најскапо одржување (година)</h2>
              {!d.top_maintenance.length ? <EmptyState /> : (
                <table className="table"><tbody>{d.top_maintenance.map((r) => (
                  <tr key={r.order__vehicle_id}>
                    <td>{plate(r.order__vehicle__registration_plates, r.order__vehicle__make, r.order__vehicle__model)}</td>
                    <td className="num">{formatMoney(r.total)}</td>
                  </tr>
                ))}</tbody></table>
              )}
            </div>
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Најмногу инциденти (година)</h2>
              {!d.top_incidents.length ? <EmptyState /> : (
                <table className="table"><tbody>{d.top_incidents.map((r) => (
                  <tr key={r.vehicle_id}>
                    <td>{plate(r.vehicle__registration_plates, r.vehicle__make, r.vehicle__model)}</td>
                    <td className="num">{r.count}</td><td className="num">{formatMoney(r.total ?? 0)}</td>
                  </tr>
                ))}</tbody></table>
              )}
            </div>
          </div>

          <div className="card stack">
            <h2 style={{ margin: 0 }}>Распоред на возила</h2>
            {!d.board.length ? <EmptyState /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Возило</th><th>Вид</th><th>Статус</th><th>Проект</th><th>Возач / ракувач</th></tr></thead>
                  <tbody>{d.board.map((b) => (
                    <tr key={b.vehicle}>
                      <td><Link to={`/assets/vehicles/${b.vehicle}`}>{plate(b.registration_plates, b.make, b.model)}</Link></td>
                      <td>{b.category}</td>
                      <td>{b.busy ? (
                        <Link to={`/fleet/travel-orders/${b.travel_order}`}><Badge tone="warning">Зафатено</Badge></Link>
                      ) : <Badge tone="success">Слободно</Badge>}</td>
                      <td>{b.project ?? ""}</td>
                      <td>{b.operator ?? ""}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

const monthStart = () => new Date().toISOString().slice(0, 8) + "01";

export function FuelEfficiency() {
  const [filters, setFilters] = useState({ start: monthStart(), end: "", group_by: "vehicle",
    vehicle: null as number | null, driver: null as number | null, project: null as number | null });
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }));
  const query = { ...filters, end: filters.end || undefined };
  const q = useQuery({
    queryKey: ["fleet-efficiency", query],
    queryFn: () => api.get<{ from: string; to: string; rows: EfficiencyRow[]; totals: Record<string, Money> }>(`${REPORTS}efficiency/`, query),
  });
  const cols: [keyof EfficiencyRow, string, number][] = [
    ["actual_l", "Потрошено (L)", 2], ["expected_l", "Очекувано (L)", 2], ["variance_l", "Отстапување (L)", 2],
    ["variance_pct", "Отстапување (%)", 2], ["actual_cost_mkd", "Трошок", 2], ["expected_cost_mkd", "Очекуван трошок", 2],
    ["cost_impact_mkd", "Разлика во трошок", 2],
  ];
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Потрошувачка на гориво наспроти норма</h1>
        <span className="spacer" />
        <Button size="sm" onClick={() => void download(`${REPORTS}efficiency/`, { ...query, export: "csv" })}>Извоз CSV</Button>
      </div>
      <div className="card filter-bar" style={{ borderRadius: "var(--radius)" }}>
        <Field label="Од" htmlFor="fe-start"><input id="fe-start" type="date" className="input" value={filters.start} onChange={(e) => set({ start: e.target.value })} /></Field>
        <Field label="До" htmlFor="fe-end"><input id="fe-end" type="date" className="input" value={filters.end} onChange={(e) => set({ end: e.target.value })} /></Field>
        <Field label="Групирај по" htmlFor="fe-group">
          <select id="fe-group" className="input" value={filters.group_by} onChange={(e) => set({ group_by: e.target.value })}>
            <option value="vehicle">Возило</option><option value="driver">Возач</option>
          </select>
        </Field>
        <Field label="Возило" htmlFor="fe-vehicle"><RelatedSelect id="fe-vehicle" related={{ endpoint: `${API_BASE}/assets/vehicles/` }} value={filters.vehicle} onChange={(v) => set({ vehicle: v })} /></Field>
        <Field label="Возач" htmlFor="fe-driver"><RelatedSelect id="fe-driver" related={{ endpoint: `${API_BASE}/fleet/drivers/` }} value={filters.driver} onChange={(v) => set({ driver: v })} /></Field>
        <Field label="Проект" htmlFor="fe-project"><RelatedSelect id="fe-project" related={{ endpoint: `${API_BASE}/projects/projects/` }} value={filters.project} onChange={(v) => set({ project: v })} /></Field>
      </div>
      <div className="card flush">
        {q.isLoading ? <Spinner /> : !q.data?.rows.length ? <EmptyState /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{filters.group_by === "driver" ? "Возач" : "Возило"}</th>{cols.map(([k, label]) => <th key={k} className="num">{label}</th>)}</tr></thead>
              <tbody>
                {q.data.rows.map((r) => (
                  <tr key={r.key_id}>
                    <td>{r.key_label}</td>
                    {cols.map(([k, , places]) => (
                      <td key={k} className="num" style={k === "variance_pct" && Number(r[k]) > 10 ? { color: "var(--danger)" } : undefined}>
                        {formatNumber(r[k], places)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th>Вкупно</th>{cols.map(([k, , places]) => <th key={k} className="num">{formatNumber(q.data!.totals[k], places)}</th>)}</tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Норма: механизација — работни часови × L/час; останати возила — изминати km / 100 × L/100 km. Очекуваниот трошок
        ја користи цената по литар од извештајот.
      </p>
    </div>
  );
}
