/** Procurement overview: the request → order → receipt → invoice lane, money committed and unpaid, monthly
 * ordered value, the largest suppliers, and the latest requests. */
import { ColumnChart } from "@/charts";
import { asRows, DataTable, HBars, Kpi, Kpis, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Badge, LinkButton, Panel, statusTone } from "@/components/ui";
import { formatCompact, formatNumber, num } from "@/lib/format";

import { listUrl, Overview, useChoiceLabels } from "./common";

export function ProcurementOverview() {
  const q = useOverview<Data>("/procurement/requests/dashboard/");
  const statusLabel = useChoiceLabels("procurement/requests");
  return (
    <Overview title="Набавка" q={q} actions={<LinkButton to="/procurement/requests/new" variant="primary">Ново барање за материјали</LinkButton>}>
      {(d) => {
        const trend = asRows(d.spend_trend);
        return (
          <>
            <StatusBand title="Од барање до плаќање" stages={[
              { key: "draft", label: "Нацрти", count: d.requests.new, to: listUrl("procurement/requests", { status: "DRAFT" }),
                sub: d.requests.returned ? `${d.requests.returned} вратени` : undefined },
              { key: "approval", label: "Чекаат одобрување", count: d.requests.pending_approval, attention: true, to: listUrl("procurement/requests", { status: "SUBMITTED" }) },
              { key: "proc", label: "Потребна набавка", count: d.requests.procurement_required, attention: true, to: listUrl("procurement/requests", { status: "PROCUREMENT_REQUIRED" }),
                sub: d.requests.finance_review ? `${d.requests.finance_review} финансиска проверка` : undefined },
              { key: "po", label: "Одобрени за нарачка", count: d.requests.approved_for_po, attention: true, to: listUrl("procurement/requests", { status: "APPROVED_FOR_PO" }) },
              { key: "issued", label: "Издадени нарачки", count: d.orders.issued, to: listUrl("procurement/purchase-orders", { status: "ISSUED" }) },
              { key: "delivery", label: "Чекаат испорака", count: d.orders.delivery_pending, to: listUrl("procurement/purchase-orders", { status: "CONFIRMED" }) },
              { key: "check", label: "Фактури за проверка", count: d.invoices.to_check, attention: true, to: listUrl("procurement/invoices", { match_status: "NOT_CHECKED" }) },
              { key: "pay", label: "Подготвени за плаќање", count: d.invoices.ready_for_payment, done: true, to: listUrl("procurement/invoices", { status: "READY_FOR_PAYMENT" }) },
            ]} />
            <Kpis>
              <Kpi label="Отворени нарачки" value={formatCompact(d.orders.value_open)} unit="ден." sub="нарачано, сè уште неиспорачано" trend={trend.map((r) => num(r.ordered))} />
              <Kpi label="Неплатени фактури" value={formatCompact(d.invoices.unpaid_value)} unit="ден." sub={`${d.invoices.disputed} оспорени`} tone={d.invoices.disputed ? "attention" : undefined} />
              <Kpi label="Итни барања" value={formatNumber(d.requests.emergency, 0)} sub="отворени, означени како итни" tone={d.requests.emergency ? "alarm" : undefined}
                to={listUrl("procurement/requests", { is_emergency: "true" })} />
              <Kpi label="Проблеми при прием" value={formatNumber(num(d.receipts.partial) + num(d.receipts.quality_issues), 0)}
                sub={`${d.receipts.partial} делумни · ${d.receipts.quality_issues} квалитет`} tone={d.receipts.quality_issues ? "attention" : undefined} />
            </Kpis>
            <div className="grid-2">
              <Panel title="Нарачано по месец" sub="Вредност со ДДВ на издадените нарачки">
                <ColumnChart title="Нарачано по месец" data={trend.map((r) => ({ label: String(r.label), ordered: num(r.ordered) }))}
                  series={[{ key: "ordered", name: "Нарачано" }]} />
              </Panel>
              <Panel title="Најголеми добавувачи" sub="Последни 12 месеци">
                <HBars rows={asRows(d.top_suppliers).map((s) => ({ key: String(s.supplier_id), label: String(s.supplier__legal_name), value: s.total,
                  to: `/partners/partners/${s.supplier_id}` }))} empty="Нема нарачки во последната година" />
              </Panel>
            </div>
            <Panel title="Последни барања" flush actions={<LinkButton to="/procurement/requests" size="sm">Сите барања</LinkButton>}>
              <DataTable rows={asRows(d.latest_requests)} columns={[
                { key: "request_number", label: "Барање", to: (r) => `/procurement/requests/${r.id}`, render: (r) => String(r.request_number || `#${r.id}`) },
                { key: "status", label: "Статус", render: (r) => <Badge tone={statusTone(String(r.status))}>{statusLabel(r.status)}</Badge> },
                { key: "is_emergency", label: "Итно", render: (r) => (r.is_emergency ? <Badge tone="danger">итно</Badge> : null) },
                { key: "created_at", label: "Внесено", kind: "datetime" }]} />
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}
