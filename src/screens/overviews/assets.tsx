/** Fixed assets overview: the register by class (cost, depreciation, net book value), the asset lifecycle, open
 * depreciation runs, transfers, disposals and stocktakes, and the assets a depreciation run would skip. */
import { API_BASE } from "@/api/client";
import { ColumnChart } from "@/charts";
import { DataTable, Kpi, Kpis, StatusBand, useCount, useOverview, type Data } from "@/components/dashboard";
import { LinkButton, Panel } from "@/components/ui";
import { formatWhole, formatMoney, formatNumber, num } from "@/lib/format";

import { listUrl, Overview } from "./common";
import { tr } from "@/i18n";

const FA = "assets/fixed-assets";

function useStatusCount(path: string, status: string) {
  return useCount(`${API_BASE}/${path}/`, { status }).data;
}

export function AssetsOverview() {
  const q = useOverview<Data[]>(`/${FA}/summary/`);
  const attention = useOverview<Data[]>(`/${FA}/attention/`);
  const draft = useStatusCount(FA, "DRAFT");
  const active = useStatusCount(FA, "ACTIVE");
  const runs = useStatusCount("assets/depreciation-runs", "DRAFT");
  const transfers = useStatusCount("assets/transfers", "DRAFT");
  const disposals = useStatusCount("assets/disposals", "DRAFT");
  const stocktakes = useStatusCount("assets/stocktakes", "COUNTING");
  return (
    <Overview title={tr("Основни средства")} q={q} actions={<>
      <LinkButton to="/assets/depreciation-runs">{tr("Амортизација")}</LinkButton>
      <LinkButton to={`/${FA}/new`} variant="primary">{tr("Ново средство")}</LinkButton>
    </>}>
      {(rows) => {
        const tot = rows.reduce((s, r) => ({ n: s.n + num(r.n), cost: s.cost + num(r.cost), accum: s.accum + num(r.accum), nbv: s.nbv + num(r.nbv) }), { n: 0, cost: 0, accum: 0, nbv: 0 });
        return (
          <>
            <StatusBand title={tr("Што е отворено")} stages={[
              { key: "draft", label: tr("Средства во нацрт"), count: draft, attention: true, to: listUrl(FA, { status: "DRAFT" }) },
              { key: "active", label: tr("Активни средства"), count: active, done: true, to: listUrl(FA, { status: "ACTIVE" }) },
              { key: "runs", label: tr("Амортизации за книжење"), count: runs, attention: true, to: listUrl("assets/depreciation-runs", { status: "DRAFT" }) },
              { key: "transfers", label: tr("Преноси во нацрт"), count: transfers, to: listUrl("assets/transfers", { status: "DRAFT" }) },
              { key: "disposals", label: tr("Отуѓувања во нацрт"), count: disposals, to: listUrl("assets/disposals", { status: "DRAFT" }) },
              { key: "stocktake", label: tr("Пописи во тек"), count: stocktakes, to: listUrl("assets/stocktakes", { status: "COUNTING" }) },
            ]} />
            <Kpis>
              <Kpi label={tr("Набавна вредност")} value={formatWhole(tot.cost)} unit="MKD" sub={tr("{0} средства во регистарот", formatNumber(tot.n, 0))} />
              <Kpi label={tr("Акумулирана амортизација")} value={formatWhole(tot.accum)} unit="MKD" sub={tot.cost ? tr("{0} % отпишано", formatNumber((tot.accum / tot.cost) * 100, 1)) : undefined} />
              <Kpi label={tr("Сегашна вредност")} value={formatWhole(tot.nbv)} unit="MKD" />
              <Kpi label={tr("Без услови за амортизација")} value={attention.data ? formatNumber(attention.data.length, 0) : "…"} sub={tr("ќе бидат прескокнати")}
                tone={attention.data?.length ? "attention" : undefined} />
            </Kpis>
            <Panel title={tr("По класа на средства")} sub={tr("Сегашна вредност и акумулирана амортизација (заедно: набавна вредност)")}>
              <ColumnChart title={tr("Средства по класа")} stacked data={rows.map((r) => ({ label: String(r.asset_class__name ?? r.asset_class__code ?? "—"), nbv: num(r.nbv), accum: num(r.accum) }))}
                series={[{ key: "nbv", name: tr("Сегашна вредност") }, { key: "accum", name: tr("Амортизирано") }]} />
            </Panel>
            <div className="grid-2">
              <Panel title={tr("Регистар по класа")} flush>
                <DataTable rows={rows} columns={[
                  { key: "asset_class__name", label: tr("Класа"), render: (r) => String(r.asset_class__name ?? r.asset_class__code ?? "—") },
                  { key: "n", label: tr("Број"), kind: "number" }, { key: "cost", label: tr("Набавна"), kind: "money" },
                  { key: "nbv", label: tr("Сегашна"), kind: "money" }]}
                  footer={rows.length > 1 ? <tfoot><tr><td>{tr("Вкупно")}</td><td className="num">{formatNumber(tot.n, 0)}</td><td className="num">{formatMoney(tot.cost)}</td><td className="num">{formatMoney(tot.nbv)}</td></tr></tfoot> : undefined} />
              </Panel>
              <Panel title={tr("Ќе бидат прескокнати при амортизација")} sub={tr("Активни средства на кои им недостасува податок")} flush>
                <DataTable rows={attention.data ?? []} maxHeight={380} empty={tr("Сите активни средства се подготвени")} columns={[
                  { key: "asset_code", label: tr("Шифра"), to: (r) => `/${FA}/${r.id}` }, { key: "asset_name", label: tr("Средство") },
                  { key: "reason", label: tr("Причина"), className: "small" }]} />
              </Panel>
            </div>
          </>
        );
      }}
    </Overview>
  );
}
