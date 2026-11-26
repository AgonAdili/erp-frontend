/** Fuel consumption against the norm, per vehicle or driver, for a period. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "@/components/icons";

import { api, API_BASE, download } from "@/api/client";
import { HBars, Kpi, Kpis } from "@/components/dashboard";
import { RelatedSelect } from "@/components/inputs";
import { Button, EmptyState, ErrorState, Field, PageHeader, Panel, Segmented, SkeletonRows, useToast } from "@/components/ui";
import { Page } from "@/layout/Page";
import { formatWhole, formatMoney, formatNumber, monthStartISO, num } from "@/lib/format";
import { tr } from "@/i18n";

const REPORTS = `${API_BASE}/fleet/daily-reports/`;

type Money = string;

interface EfficiencyRow {
  key_id: number; key_label: string; actual_l: Money; expected_l: Money; variance_l: Money; variance_pct: Money;
  actual_cost_mkd: Money; expected_cost_mkd: Money; cost_impact_mkd: Money;
}

export function FuelEfficiency() {
  const [filters, setFilters] = useState({ start: monthStartISO(), end: "", group_by: "vehicle",
    vehicle: null as number | null, driver: null as number | null, project: null as number | null });
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }));
  const query = { ...filters, end: filters.end || undefined };
  const toast = useToast();
  const q = useQuery({
    queryKey: ["fleet-efficiency", query],
    queryFn: () => api.get<{ from: string; to: string; rows: EfficiencyRow[]; totals: Record<string, Money> }>(`${REPORTS}efficiency/`, query),
    placeholderData: (prev) => prev,
  });
  const cols: [keyof EfficiencyRow, string, number][] = [
    ["actual_l", tr("Потрошено L"), 2], ["expected_l", tr("Норма L"), 2], ["variance_l", tr("Отстапување L"), 2],
    ["variance_pct", tr("Отстапување %"), 1], ["actual_cost_mkd", tr("Трошок"), 2], ["expected_cost_mkd", tr("Според норма"), 2],
    ["cost_impact_mkd", tr("Разлика во трошок"), 2],
  ];
  const rows = q.data?.rows ?? [];
  const t = q.data?.totals ?? {};
  const worst = [...rows].sort((a, b) => num(b.variance_pct) - num(a.variance_pct)).slice(0, 10);
  const who = filters.group_by === "driver" ? tr("Возач") : tr("Возило");
  return (
    <Page title={tr("Потрошувачка наспроти норма")}>
      <PageHeader title={tr("Потрошувачка на гориво наспроти норма")}
        subtitle={tr("Механизација: работни часови × L/час. Останати возила: km / 100 × L/100 km. Трошокот е по цената од извештајот.")}
        actions={<Button icon={Download} onClick={() => void download(`${REPORTS}efficiency/`, { ...query, export: "csv" }).catch((e: Error) => toast(e.message, "danger"))}>{tr("Извези CSV")}</Button>} />
      <Panel>
        <div className="toolbar">
          <Field label={tr("Од")} htmlFor="fe-start"><input id="fe-start" type="date" className="form-control" value={filters.start} onChange={(e) => set({ start: e.target.value })} /></Field>
          <Field label={tr("До")} htmlFor="fe-end"><input id="fe-end" type="date" className="form-control" value={filters.end} onChange={(e) => set({ end: e.target.value })} /></Field>
          <div className="ea-field"><span className="label">{tr("Групирај по")}</span>
            <Segmented label={tr("Групирај по")} value={filters.group_by} onChange={(v) => set({ group_by: v })} options={[{ value: "vehicle", label: tr("Возило") }, { value: "driver", label: tr("Возач") }]} />
          </div>
          <Field label={tr("Возило")} htmlFor="fe-vehicle"><RelatedSelect id="fe-vehicle" related={{ endpoint: `${API_BASE}/assets/vehicles/` }} value={filters.vehicle} placeholder={tr("Сите")} onChange={(v) => set({ vehicle: v })} /></Field>
          <Field label={tr("Возач")} htmlFor="fe-driver"><RelatedSelect id="fe-driver" related={{ endpoint: `${API_BASE}/fleet/drivers/` }} value={filters.driver} placeholder={tr("Сите")} onChange={(v) => set({ driver: v })} /></Field>
          <Field label={tr("Проект")} htmlFor="fe-project"><RelatedSelect id="fe-project" related={{ endpoint: `${API_BASE}/projects/projects/` }} value={filters.project} placeholder={tr("Сите")} onChange={(v) => set({ project: v })} /></Field>
        </div>
      </Panel>
      {q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
      {q.data ? (
        <Kpis>
          <Kpi label={tr("Потрошено")} value={formatNumber(t.actual_l, 0)} unit="L" sub={tr("норма {0} L", formatNumber(t.expected_l, 0))} />
          <Kpi label={tr("Отстапување")} value={formatNumber(t.variance_l, 0)} unit="L" sub={num(t.expected_l) ? tr("{0}{1} % наспроти нормата", num(t.variance_l) > 0 ? "+" : "", formatNumber((num(t.variance_l) / num(t.expected_l)) * 100, 1)) : undefined}
            tone={num(t.variance_l) > 0 ? "attention" : undefined} />
          <Kpi label={tr("Трошок за гориво")} value={formatWhole(t.actual_cost_mkd)} unit="MKD" />
          <Kpi label={tr("Разлика во трошок")} value={formatWhole(t.cost_impact_mkd)} unit="MKD" tone={num(t.cost_impact_mkd) > 0 ? "alarm" : undefined} />
        </Kpis>
      ) : null}
      {worst.length ? (
        <Panel title={tr("Најголемо отстапување по {0}", who.toLowerCase())} sub={tr("Процент над (црвено) или под нормата")}>
          <HBars unit="percent" rows={worst.map((r) => ({ key: r.key_id, label: r.key_label, value: r.variance_pct, over: num(r.variance_l) > 0 }))} />
        </Panel>
      ) : null}
      <Panel flush title={tr("Детали")}>
        {q.isLoading ? <SkeletonRows rows={6} cols={6} /> : !rows.length ? <EmptyState title={tr("Нема извештаи за периодот")}>{tr("Променете го периодот или филтрите.")}</EmptyState> : (
          <div className="table-responsive table-wrap" style={{ maxHeight: "calc(100vh - 260px)" }}>
            <table className="table ea-table">
              <thead><tr><th className="sticky-col">{who}</th>{cols.map(([k, label]) => <th key={k} className="num">{label}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key_id}>
                    <td className="sticky-col">{r.key_label}</td>
                    {cols.map(([k, , places]) => (
                      <td key={k} className={`num${(k === "variance_pct" && num(r[k]) > 10) || (k === "cost_impact_mkd" && num(r[k]) > 0) ? " tone-danger" : ""}`}>
                        {k.endsWith("_mkd") ? formatMoney(r[k]) : formatNumber(r[k], places)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="sticky-col">{tr("Вкупно")}</td>{cols.map(([k, , places]) => <td key={k} className="num">{k.endsWith("_mkd") ? formatMoney(t[k]) : formatNumber(t[k], places)}</td>)}</tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
