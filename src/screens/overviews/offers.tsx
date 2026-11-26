/** Offers overview: the request → offer flow, values and conversion, the six-month trend, and what needs
 * someone's attention (approvals, expiring offers, follow-ups). */
import { ColumnChart } from "@/charts";
import { asRows, DataTable, Kpi, Kpis, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Badge, LinkButton, Panel } from "@/components/ui";
import { formatWhole, formatDate, formatNumber, num } from "@/lib/format";

import { listUrl, Overview } from "./common";
import { tr } from "@/i18n";

export function OffersOverview() {
  const q = useOverview<Data>("/offers/offers/dashboard/");
  const offer = (r: Data) => `/offers/offers/${r.id}`;
  return (
    <Overview title={tr("Понуди")} q={q} actions={<>
      <LinkButton to="/offers/approvals">{tr("Одобрување понуди")}</LinkButton>
      <LinkButton to="/offers/requests/new" variant="primary">{tr("Ново барање")}</LinkButton>
    </>}>
      {(d) => {
        const trend = asRows(d.trend);
        return (
          <>
            <StatusBand title={tr("Од барање до договор")} total={tr("{0} испратени или прифатени", formatNumber(num(d.offers.sent) + num(d.offers.accepted), 0))} stages={[
              { key: "new", label: tr("Нови барања"), count: num(d.requests.NEW), to: listUrl("offers/requests", { status: "NEW" }),
                sub: d.requests.NEEDS_CLARIFICATION ? tr("{0} за појаснување", d.requests.NEEDS_CLARIFICATION) : undefined },
              { key: "site", label: tr("Увид на терен"), count: d.requests.SITE_VISIT_REQUIRED, to: listUrl("offers/requests", { status: "SITE_VISIT_REQUIRED" }) },
              { key: "calc", label: tr("За калкулација"), count: d.requests.READY_FOR_CALCULATION, attention: true, to: listUrl("offers/requests", { status: "READY_FOR_CALCULATION" }) },
              { key: "draft", label: tr("Понуди во изработка"), count: d.offers.draft, to: listUrl("offers/offers", { status: "DRAFT" }) },
              { key: "pending", label: tr("Чекаат одобрување"), count: d.offers.pending, attention: true, to: "/offers/approvals" },
              { key: "sent", label: tr("Испратени"), count: d.offers.sent, to: listUrl("offers/offers", { status: "SENT" }) },
              { key: "won", label: tr("Прифатени"), count: d.offers.accepted, done: true, to: listUrl("offers/offers", { status: "ACCEPTED" }),
                sub: tr("одбиени {0} · истечени {1}", d.offers.rejected, d.offers.expired) },
            ]} />
            <Kpis>
              <Kpi label={tr("Вредност на испратени")} value={formatWhole(d.sent_value)} unit="MKD" trend={trend.map((r) => num(r.sent))} sub={tr("сите испратени понуди")} />
              <Kpi label={tr("Вредност на прифатени")} value={formatWhole(d.accepted_value)} unit="MKD" trend={trend.map((r) => num(r.accepted))} sub={tr("прифатени и претворени")} />
              <Kpi label={tr("Конверзија")} value={formatNumber(d.conversion_rate, 1)} unit="%" sub={tr("прифатени од испратени")} />
              <Kpi label={tr("Маржа на прифатени")} value={formatWhole(d.margin)} unit="MKD" sub={tr("{0} % од приходот", formatNumber(d.margin_rate, 1))} />
            </Kpis>
            <Panel title={tr("Испратени и прифатени по месец")} sub={tr("Вредност во MKD, последни 6 месеци")}>
              <ColumnChart title={tr("Испратени и прифатени понуди по месец")} data={trend.map((r) => ({ label: String(r.label), sent: num(r.sent), accepted: num(r.accepted) }))}
                series={[{ key: "sent", name: tr("Испратени") }, { key: "accepted", name: tr("Прифатени") }]} />
            </Panel>
            <div className="grid-2">
              <Panel title={tr("Чекаат одобрување")} sub={tr("Понуди што не можат да се испратат без одобрување")} flush
                actions={<LinkButton to="/offers/approvals" size="sm">{tr("Отвори одобрувања")}</LinkButton>}>
                <DataTable rows={asRows(d.pending_approval)} empty={tr("Нема понуди што чекаат одобрување")} columns={[
                  { key: "offer_number", label: tr("Понуда"), to: offer }, { key: "client", label: tr("Клиент") },
                  { key: "total", label: tr("Вкупно"), kind: "money" }]} />
              </Panel>
              <Panel title={tr("Истекуваат во следните 7 дена")} flush>
                <DataTable rows={asRows(d.expiring)} empty={tr("Ниедна понуда не истекува оваа недела")} columns={[
                  { key: "offer_number", label: tr("Понуда"), to: offer }, { key: "client", label: tr("Клиент") },
                  { key: "valid_until", label: tr("Важи до"), kind: "date" }, { key: "total", label: tr("Вкупно"), kind: "money" }]} />
              </Panel>
              <Panel title={tr("Задоцнети следења")} flush>
                <DataTable rows={asRows(d.followups_overdue)} empty={tr("Нема задоцнети следења")} columns={[
                  { key: "offer_number", label: tr("Понуда"), to: (r) => `/offers/offers/${r.offer}` },
                  { key: "client", label: tr("Клиент") }, { key: "followup_date", label: tr("Рок"), kind: "date", render: (r) => <Badge tone="danger">{formatDate(r.followup_date)}</Badge> },
                  { key: "responsible", label: tr("Одговорен") }]} />
              </Panel>
              <Panel title={tr("Следења денес")} flush>
                <DataTable rows={asRows(d.followups_today)} empty={tr("Нема следења за денес")} columns={[
                  { key: "offer_number", label: tr("Понуда"), to: (r) => `/offers/offers/${r.offer}` },
                  { key: "client", label: tr("Клиент") }, { key: "responsible", label: tr("Одговорен") }]} />
              </Panel>
            </div>
            <Panel title={tr("Последни барања за понуда")} flush actions={<LinkButton to="/offers/requests" size="sm">{tr("Сите барања")}</LinkButton>}>
              <DataTable rows={asRows(d.latest_requests)} columns={[
                { key: "number", label: tr("Барање"), to: (r) => `/offers/requests/${r.id}` }, { key: "client", label: tr("Клиент") },
                { key: "status_label", label: tr("Статус"), render: (r) => <Badge tone={r.status === "NEW" ? "info" : r.status === "READY_FOR_CALCULATION" ? "warning" : ""}>{String(r.status_label)}</Badge> },
                { key: "created_at", label: tr("Внесено"), kind: "datetime" }]} />
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}
