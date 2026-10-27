/** Offers overview: the request → offer flow, values and conversion, the six-month trend, and what needs
 * someone's attention (approvals, expiring offers, follow-ups). */
import { ColumnChart } from "@/charts";
import { asRows, DataTable, Kpi, Kpis, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Badge, LinkButton, Panel } from "@/components/ui";
import { formatCompact, formatDate, formatNumber, num } from "@/lib/format";

import { listUrl, Overview } from "./common";

export function OffersOverview() {
  const q = useOverview<Data>("/offers/offers/dashboard/");
  const offer = (r: Data) => `/offers/offers/${r.id}`;
  return (
    <Overview title="Понуди" q={q} actions={<>
      <LinkButton to="/offers/approvals">Одобрување понуди</LinkButton>
      <LinkButton to="/offers/requests/new" variant="primary">Ново барање</LinkButton>
    </>}>
      {(d) => {
        const trend = asRows(d.trend);
        return (
          <>
            <StatusBand title="Од барање до договор" total={`${formatNumber(num(d.offers.sent) + num(d.offers.accepted), 0)} испратени или прифатени`} stages={[
              { key: "new", label: "Нови барања", count: num(d.requests.NEW), to: listUrl("offers/requests", { status: "NEW" }),
                sub: d.requests.NEEDS_CLARIFICATION ? `${d.requests.NEEDS_CLARIFICATION} за појаснување` : undefined },
              { key: "site", label: "Увид на терен", count: d.requests.SITE_VISIT_REQUIRED, to: listUrl("offers/requests", { status: "SITE_VISIT_REQUIRED" }) },
              { key: "calc", label: "За калкулација", count: d.requests.READY_FOR_CALCULATION, attention: true, to: listUrl("offers/requests", { status: "READY_FOR_CALCULATION" }) },
              { key: "draft", label: "Понуди во изработка", count: d.offers.draft, to: listUrl("offers/offers", { status: "DRAFT" }) },
              { key: "pending", label: "Чекаат одобрување", count: d.offers.pending, attention: true, to: "/offers/approvals" },
              { key: "sent", label: "Испратени", count: d.offers.sent, to: listUrl("offers/offers", { status: "SENT" }) },
              { key: "won", label: "Прифатени", count: d.offers.accepted, done: true, to: listUrl("offers/offers", { status: "ACCEPTED" }),
                sub: `одбиени ${d.offers.rejected} · истечени ${d.offers.expired}` },
            ]} />
            <Kpis>
              <Kpi label="Вредност на испратени" value={formatCompact(d.sent_value)} unit="ден." trend={trend.map((r) => num(r.sent))} sub="сите испратени понуди" />
              <Kpi label="Вредност на прифатени" value={formatCompact(d.accepted_value)} unit="ден." trend={trend.map((r) => num(r.accepted))} sub="прифатени и претворени" />
              <Kpi label="Конверзија" value={formatNumber(d.conversion_rate, 1)} unit="%" sub="прифатени од испратени" />
              <Kpi label="Маржа на прифатени" value={formatCompact(d.margin)} unit="ден." sub={`${formatNumber(d.margin_rate, 1)}% од приходот`} />
            </Kpis>
            <Panel title="Испратени и прифатени по месец" sub="Вредност во денари, последни 6 месеци">
              <ColumnChart title="Испратени и прифатени понуди по месец" data={trend.map((r) => ({ label: String(r.label), sent: num(r.sent), accepted: num(r.accepted) }))}
                series={[{ key: "sent", name: "Испратени" }, { key: "accepted", name: "Прифатени" }]} />
            </Panel>
            <div className="grid-2">
              <Panel title="Чекаат одобрување" sub="Понуди што не можат да се испратат без одобрување" flush
                actions={<LinkButton to="/offers/approvals" size="sm">Отвори одобрувања</LinkButton>}>
                <DataTable rows={asRows(d.pending_approval)} empty="Нема понуди што чекаат одобрување" columns={[
                  { key: "offer_number", label: "Понуда", to: offer }, { key: "client", label: "Клиент" },
                  { key: "total", label: "Вкупно", kind: "money" }]} />
              </Panel>
              <Panel title="Истекуваат во следните 7 дена" flush>
                <DataTable rows={asRows(d.expiring)} empty="Ниедна понуда не истекува оваа недела" columns={[
                  { key: "offer_number", label: "Понуда", to: offer }, { key: "client", label: "Клиент" },
                  { key: "valid_until", label: "Важи до", kind: "date" }, { key: "total", label: "Вкупно", kind: "money" }]} />
              </Panel>
              <Panel title="Задоцнети следења" flush>
                <DataTable rows={asRows(d.followups_overdue)} empty="Нема задоцнети следења" columns={[
                  { key: "offer_number", label: "Понуда", to: (r) => `/offers/offers/${r.offer}` },
                  { key: "client", label: "Клиент" }, { key: "followup_date", label: "Рок", kind: "date", render: (r) => <Badge tone="danger">{formatDate(r.followup_date)}</Badge> },
                  { key: "responsible", label: "Одговорен" }]} />
              </Panel>
              <Panel title="Следења денес" flush>
                <DataTable rows={asRows(d.followups_today)} empty="Нема следења за денес" columns={[
                  { key: "offer_number", label: "Понуда", to: (r) => `/offers/offers/${r.offer}` },
                  { key: "client", label: "Клиент" }, { key: "responsible", label: "Одговорен" }]} />
              </Panel>
            </div>
            <Panel title="Последни барања за понуда" flush actions={<LinkButton to="/offers/requests" size="sm">Сите барања</LinkButton>}>
              <DataTable rows={asRows(d.latest_requests)} columns={[
                { key: "number", label: "Барање", to: (r) => `/offers/requests/${r.id}` }, { key: "client", label: "Клиент" },
                { key: "status_label", label: "Статус", render: (r) => <Badge tone={r.status === "NEW" ? "info" : r.status === "READY_FOR_CALCULATION" ? "warning" : ""}>{String(r.status_label)}</Badge> },
                { key: "created_at", label: "Внесено", kind: "datetime" }]} />
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}
