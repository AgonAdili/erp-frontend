/** Procurement overview: the request → order → receipt → invoice lane, money committed and unpaid, monthly
 * ordered value, the largest suppliers, and the latest requests. */
import { ColumnChart } from "@/charts";
import { asRows, DataTable, HBars, Kpi, Kpis, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Badge, LinkButton, Panel, statusTone } from "@/components/ui";
import { formatWhole, formatNumber, num } from "@/lib/format";

import { listUrl, Overview, useChoiceLabels } from "./common";
import { tr } from "@/i18n";

export function ProcurementOverview() {
  const q = useOverview<Data>("/procurement/requests/dashboard/");
  const statusLabel = useChoiceLabels("procurement/requests");
  return (
    <Overview title={tr("Набавка")} q={q} actions={<LinkButton to="/procurement/requests/new" variant="primary">{tr("Ново барање за материјали")}</LinkButton>}>
      {(d) => {
        const trend = asRows(d.spend_trend);
        return (
          <>
            <StatusBand title={tr("Од барање до плаќање")} stages={[
              { key: "draft", label: tr("Нацрти"), count: d.requests.new, to: listUrl("procurement/requests", { status: "DRAFT" }),
                sub: d.requests.returned ? tr("{0} вратени", d.requests.returned) : undefined },
              { key: "approval", label: tr("Чекаат одобрување"), count: d.requests.pending_approval, attention: true, to: listUrl("procurement/requests", { status: "SUBMITTED" }) },
              { key: "proc", label: tr("Потребна набавка"), count: d.requests.procurement_required, attention: true, to: listUrl("procurement/requests", { status: "PROCUREMENT_REQUIRED" }),
                sub: d.requests.finance_review ? tr("{0} финансиска проверка", d.requests.finance_review) : undefined },
              { key: "po", label: tr("Одобрени за нарачка"), count: d.requests.approved_for_po, attention: true, to: listUrl("procurement/requests", { status: "APPROVED_FOR_PO" }) },
              { key: "issued", label: tr("Издадени нарачки"), count: d.orders.issued, to: listUrl("procurement/purchase-orders", { status: "ISSUED" }) },
              { key: "delivery", label: tr("Чекаат испорака"), count: d.orders.delivery_pending, to: listUrl("procurement/purchase-orders", { status: "CONFIRMED" }) },
              { key: "check", label: tr("Фактури за проверка"), count: d.invoices.to_check, attention: true, to: listUrl("procurement/invoices", { match_status: "NOT_CHECKED" }) },
              { key: "pay", label: tr("Подготвени за плаќање"), count: d.invoices.ready_for_payment, done: true, to: listUrl("procurement/invoices", { status: "READY_FOR_PAYMENT" }) },
            ]} />
            <Kpis>
              <Kpi label={tr("Отворени нарачки")} value={formatWhole(d.orders.value_open)} unit="MKD" sub={tr("нарачано, сè уште неиспорачано")} trend={trend.map((r) => num(r.ordered))} />
              <Kpi label={tr("Неплатени фактури")} value={formatWhole(d.invoices.unpaid_value)} unit="MKD" sub={tr("{0} оспорени", d.invoices.disputed)} tone={d.invoices.disputed ? "attention" : undefined} />
              <Kpi label={tr("Итни барања")} value={formatNumber(d.requests.emergency, 0)} sub={tr("отворени, означени како итни")} tone={d.requests.emergency ? "alarm" : undefined}
                to={listUrl("procurement/requests", { is_emergency: "true" })} />
              <Kpi label={tr("Проблеми при прием")} value={formatNumber(num(d.receipts.partial) + num(d.receipts.quality_issues), 0)}
                sub={tr("{0} делумни · {1} квалитет", d.receipts.partial, d.receipts.quality_issues)} tone={d.receipts.quality_issues ? "attention" : undefined} />
            </Kpis>
            <div className="grid-2">
              <Panel title={tr("Нарачано по месец")} sub={tr("Вредност со ДДВ на издадените нарачки")}>
                <ColumnChart title={tr("Нарачано по месец")} data={trend.map((r) => ({ label: String(r.label), ordered: num(r.ordered) }))}
                  series={[{ key: "ordered", name: tr("Нарачано") }]} />
              </Panel>
              <Panel title={tr("Најголеми добавувачи")} sub={tr("Последни 12 месеци")}>
                <HBars rows={asRows(d.top_suppliers).map((s) => ({ key: String(s.supplier_id), label: String(s.supplier__legal_name), value: s.total,
                  to: `/partners/partners/${s.supplier_id}` }))} empty={tr("Нема нарачки во последната година")} />
              </Panel>
            </div>
            <Panel title={tr("Последни барања")} flush actions={<LinkButton to="/procurement/requests" size="sm">{tr("Сите барања")}</LinkButton>}>
              <DataTable rows={asRows(d.latest_requests)} columns={[
                { key: "request_number", label: tr("Барање"), to: (r) => `/procurement/requests/${r.id}`, render: (r) => String(r.request_number || `#${r.id}`) },
                { key: "status", label: tr("Статус"), render: (r) => <Badge tone={statusTone(String(r.status))}>{statusLabel(r.status)}</Badge> },
                { key: "is_emergency", label: tr("Итно"), render: (r) => (r.is_emergency ? <Badge tone="danger">{tr("итно")}</Badge> : null) },
                { key: "created_at", label: tr("Внесено"), kind: "datetime" }]} />
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}
