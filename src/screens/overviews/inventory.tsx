/** Inventory overview: stock value, items below their minimum, value received and issued per month, the
 * warehouses with the most movement, and the most valuable items. */
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { useEntity } from "@/app/prefs";
import { ColumnChart } from "@/charts";
import { asRows, DataTable, HBars, Kpi, Kpis, useOverview, type Data } from "@/components/dashboard";
import { LinkButton, Panel } from "@/components/ui";
import { formatCompact, formatNumber, num } from "@/lib/format";

import { Overview } from "./common";

const MOVES = "/inventory/movements/";

export function InventoryOverview() {
  const entity = useEntity();
  const q = useOverview<Data>(`${MOVES}trend/`);
  const low = useQuery({ queryKey: ["stock-levels", entity, null, true], queryFn: () => api.get<Data[]>(`${MOVES}levels/`, { legal_entity: entity, low: 1 }) });
  const valuation = useQuery({ queryKey: ["stock-valuation", entity, null, ""], queryFn: () => api.get<{ rows: Data[]; total: string }>(`${MOVES}valuation/`, { legal_entity: entity }) });
  return (
    <Overview title="Магацин" q={q} actions={<>
      <LinkButton to="/inventory/stock">Залиха и вреднување</LinkButton>
      <LinkButton to="/inventory/documents/new" variant="primary">Нов документ</LinkButton>
    </>}>
      {(d) => {
        const trend = asRows(d.trend);
        const lowRows = low.data ?? [];
        const top = [...(valuation.data?.rows ?? [])].sort((a, b) => num(b.value) - num(a.value)).slice(0, 10);
        const unreliable = (valuation.data?.rows ?? []).filter((r) => !r.reliable).length;
        return (
          <>
            <Kpis>
              <Kpi label="Вредност на залихата" value={valuation.data ? formatCompact(valuation.data.total) : "…"} unit="ден."
                sub={unreliable ? `${unreliable} артикли со несигурна цена` : "по просечна набавна цена"} tone={unreliable ? "attention" : undefined} to="/inventory/stock" />
              <Kpi label="Под минимална залиха" value={low.data ? formatNumber(lowRows.length, 0) : "…"} sub="артикли за повторна нарачка"
                tone={lowRows.length ? "attention" : undefined} to="/inventory/stock" />
              <Kpi label="Движења овој месец" value={formatNumber(d.this_month.count, 0)} sub={`${d.this_month.in} приеми · ${d.this_month.out} издавања`} />
              <Kpi label="Примено овој месец" value={formatCompact(trend.at(-1)?.in_value)} unit="ден." trend={trend.map((r) => num(r.in_value))} />
            </Kpis>
            <Panel title="Примено и издадено по месец" sub="Вредност по набавна цена, последни 6 месеци">
              <ColumnChart title="Примено и издадено по месец" data={trend.map((r) => ({ label: String(r.label), in_value: num(r.in_value), out_value: num(r.out_value) }))}
                series={[{ key: "in_value", name: "Примено" }, { key: "out_value", name: "Издадено" }]} />
            </Panel>
            <div className="grid-2">
              <Panel title="Под минимална залиха" flush actions={<LinkButton to="/inventory/stock" size="sm">Барање за набавка</LinkButton>}>
                <DataTable rows={lowRows.slice(0, 10)} maxHeight={360} empty="Сите артикли се над минимумот" columns={[
                  { key: "name", label: "Артикл", to: (r) => `/catalog/items/${r.item}` },
                  { key: "quantity", label: "Залиха", kind: "number" }, { key: "reorder_level", label: "Минимум", kind: "number" },
                  { key: "unit", label: "Ед." }]} />
              </Panel>
              <Panel title="Магацини со најголем промет" sub="Вредност на движењата, последни 6 месеци">
                <HBars rows={asRows(d.warehouses).map((w) => ({ key: String(w.warehouse_id), label: String(w.warehouse__name), value: w.value,
                  to: `/catalog/warehouses/${w.warehouse_id}` }))} empty="Нема движења" />
              </Panel>
            </div>
            <Panel title="Највредни артикли на залиха">
              <HBars rows={top.map((r) => ({ key: String(r.item), label: String(r.item_name), value: r.value, to: `/catalog/items/${r.item}` }))}
                empty={valuation.isLoading ? "Се вчитува…" : "Нема залиха"} />
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}
