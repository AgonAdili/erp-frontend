/** Module overview screens (v1 dashboards): offers, procurement, accounting, finance, work orders. */
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { BarChart } from "@/components/charts";
import { DataTable, EntityPicker, Kpi, Section, type Row } from "@/components/dashboard";
import { Alert, Badge, Spinner } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";

type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function useOverview(path: string, query: Record<string, string | number | null | undefined> = {}) {
  return useQuery({ queryKey: ["overview", path, query], queryFn: () => api.get<Data>(path, query) });
}

function Frame({ title, q, actions, children }: {
  title: string; q: { isLoading: boolean; error: unknown; data?: Data }; actions?: ReactNode; children: (d: Data) => ReactNode;
}) {
  return (
    <div className="stack">
      <div className="page-head"><h1>{title}</h1><span className="spacer" />{actions}</div>
      {q.isLoading ? <Spinner /> : q.error ? <Alert tone="danger">{(q.error as Error).message}</Alert> : q.data ? children(q.data) : null}
    </div>
  );
}

const rows = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : []);

// ── offers ─────────────────────────────────────────────────────────────────

export function OffersDashboard() {
  const q = useOverview("/offers/offers/dashboard/");
  const offer = (r: Row) => `/offers/offers/${r.id}`;
  return (
    <Frame title="Понуди — преглед" q={q} actions={<>
      <Link className="btn sm" to="/offers/approvals">Одобрувања</Link>
      <Link className="btn sm" to="/offers/offers">Сите понуди</Link>
    </>}>
      {(d) => <>
        <div className="kpis">
          <Kpi label="Нови барања" value={d.requests.NEW} sub={`појаснување ${d.requests.NEEDS_CLARIFICATION} · теренски ${d.requests.SITE_VISIT_REQUIRED}`} />
          <Kpi label="Подготвени за калкулација" value={d.requests.READY_FOR_CALCULATION} />
          <Kpi label="Понуди во изработка" value={d.offers.draft} sub={`чекаат одобрување ${d.offers.pending}`} />
          <Kpi label="Испратени / прифатени" value={`${d.offers.sent} / ${d.offers.accepted}`} sub={`одбиени ${d.offers.rejected} · истечени ${d.offers.expired}`} />
          <Kpi label="Вредност испратени" value={formatMoney(d.sent_value)} />
          <Kpi label="Вредност прифатени" value={formatMoney(d.accepted_value)} tone="good" />
          <Kpi label="Конверзија" value={`${d.conversion_rate}%`} />
          <Kpi label="Маржа (прифатени)" value={formatMoney(d.margin)} sub={`${d.margin_rate}%`} />
        </div>
        <div className="grid-2">
          <Section title="Задоцнети следења">
            <DataTable rows={rows(d.followups_overdue)} columns={[
              { key: "offer_number", label: "Понуда", to: (r) => `/offers/offers/${r.offer}` },
              { key: "client", label: "Клиент" }, { key: "followup_date", label: "Рок", kind: "date" },
              { key: "responsible", label: "Одговорен" }]} />
          </Section>
          <Section title="Следења денес">
            <DataTable rows={rows(d.followups_today)} columns={[
              { key: "offer_number", label: "Понуда", to: (r) => `/offers/offers/${r.offer}` },
              { key: "client", label: "Клиент" }, { key: "responsible", label: "Одговорен" }]} />
          </Section>
          <Section title="Истекуваат во 7 дена">
            <DataTable rows={rows(d.expiring)} columns={[
              { key: "offer_number", label: "Понуда", to: offer }, { key: "client", label: "Клиент" },
              { key: "valid_until", label: "Важи до", kind: "date" }, { key: "total", label: "Вкупно", kind: "money" }]} />
          </Section>
          <Section title="Чекаат одобрување">
            <DataTable rows={rows(d.pending_approval)} columns={[
              { key: "offer_number", label: "Понуда", to: offer }, { key: "client", label: "Клиент" },
              { key: "status_label", label: "Статус" }, { key: "total", label: "Вкупно", kind: "money" }]} />
          </Section>
          <Section title="Последни барања">
            <DataTable rows={rows(d.latest_requests)} columns={[
              { key: "number", label: "Барање", to: (r) => `/offers/requests/${r.id}` }, { key: "client", label: "Клиент" },
              { key: "status_label", label: "Статус" }, { key: "created_at", label: "Внесено", kind: "datetime" }]} />
          </Section>
        </div>
      </>}
    </Frame>
  );
}

// ── procurement ────────────────────────────────────────────────────────────

export function ProcurementDashboard() {
  const q = useOverview("/procurement/requests/dashboard/");
  return (
    <Frame title="Набавка — преглед" q={q} actions={<Link className="btn sm" to="/procurement/requests">Барања</Link>}>
      {(d) => <>
        <div className="kpis">
          <Kpi label="Нови барања (нацрт)" value={d.requests.new} sub={`вратени ${d.requests.returned}`} />
          <Kpi label="Чекаат одобрување" value={d.requests.pending_approval} />
          <Kpi label="Потребна набавка" value={d.requests.procurement_required} sub={`финансиска проверка ${d.requests.finance_review}`} />
          <Kpi label="Одобрени за нарачка" value={d.requests.approved_for_po} />
          <Kpi label="Итни (отворени)" value={d.requests.emergency} />
          <Kpi label="Нарачки издадени / чекаат испорака" value={`${d.orders.issued} / ${d.orders.delivery_pending}`} sub={formatMoney(d.orders.value_open)} />
          <Kpi label="Делумни испораки / проблеми со квалитет" value={`${d.receipts.partial} / ${d.receipts.quality_issues}`} />
          <Kpi label="Фактури: за проверка / оспорени" value={`${d.invoices.to_check} / ${d.invoices.disputed}`} sub={`за плаќање ${d.invoices.ready_for_payment}`} />
          <Kpi label="Неплатено" value={formatMoney(d.invoices.unpaid_value)} />
        </div>
        <Section title="Последни барања">
          <DataTable rows={rows(d.latest_requests)} columns={[
            { key: "request_number", label: "Барање", to: (r) => `/procurement/requests/${r.id}` },
            { key: "status", label: "Статус", kind: "badge" },
            { key: "is_emergency", label: "Итно", render: (r) => (r.is_emergency ? <Badge tone="danger">итно</Badge> : null) },
            { key: "created_at", label: "Внесено", kind: "datetime" }]} />
        </Section>
      </>}
    </Frame>
  );
}

// ── accounting ─────────────────────────────────────────────────────────────

export function AccountingDashboard() {
  const [entity, setEntity] = useState<number | null>(null);
  const q = useOverview("/accounting/ledger/dashboard/", { legal_entity: entity });
  return (
    <Frame title="Сметководство — преглед" q={q} actions={<EntityPicker value={entity} onChange={setEntity} />}>
      {(d) => <>
        {d.unbalanced_drafts ? <Alert tone="warning">Нерамнотежни нацрт-налози: {d.unbalanced_drafts}</Alert> : null}
        <div className="kpis">
          <Kpi label="Отворен период" value={d.period ? d.period.name : "—"}
            sub={`затворање: ${d.close_tasks.done} / ${d.close_tasks.total} задачи`} />
          <Kpi label="Книжени овој месец" value={d.posted_this_month} sub={`нацрти ${d.drafts}`} />
          <Kpi label="Обврски (отворено)" value={formatMoney(d.payables.open)} sub={`задоцнети ${d.payables.overdue} од ${d.payables.count}`} />
          <Kpi label="Побарувања (отворено)" value={formatMoney(d.receivables.open)} sub={`задоцнети ${d.receivables.overdue} од ${d.receivables.count}`} />
          <Kpi label="Нето позиција" value={formatMoney(d.net_position)} />
          <Kpi label="ДДВ овој месец" value={formatMoney(d.vat.net)} sub={`влезен ${formatMoney(d.vat.input_vat)} · излезен ${formatMoney(d.vat.output_vat)}`} />
          <Kpi label="Основни средства (сегашна вредност)" value={formatMoney(d.net_book_value)} sub={`амортизација овој месец ${formatMoney(d.depreciation_this_month)}`} />
          <Kpi label="Влезни фактури за книжење" value={d.ap_awaiting_posting} />
        </div>
        <div className="row">
          <Link className="btn sm" to="/accounting/journal-entries">Налози</Link>
          <Link className="btn sm" to="/accounting/ledger">Главна книга</Link>
          <Link className="btn sm" to="/accounting/fiscal-periods">Затворање месец</Link>
          <Link className="btn sm" to="/payables/open-items">Обврски</Link>
          <Link className="btn sm" to="/receivables/open-items">Побарувања</Link>
        </div>
      </>}
    </Frame>
  );
}

// ── finance ────────────────────────────────────────────────────────────────

export function FinanceDashboard() {
  const q = useOverview("/finance/cashbook/dashboard/");
  return (
    <Frame title="Финансии — преглед" q={q} actions={<Link className="btn sm" to="/finance/cashbook">Благајна</Link>}>
      {(d) => <>
        <div className="kpis">
          <Kpi label="Приливи овој месец" value={formatMoney(d.month.income)} />
          <Kpi label="Одливи овој месец" value={formatMoney(d.month.expense)} />
          <Kpi label="Резултат" value={formatMoney(d.month.result)} sub={`${d.month.margin_pct}%`} tone={Number(d.month.result) >= 0 ? "good" : undefined} />
          <Kpi label="Долг кон добавувачи" value={formatMoney(d.vendor_debt.open)} sub={`задоцнети ${d.vendor_debt.overdue} · за 7 дена ${d.vendor_debt.due_7_days}`} />
          <Kpi label="Побарувања (отворено)" value={formatMoney(d.receivables_open)} />
          <Kpi label="Кредити (салдо)" value={formatMoney(d.loans.balance)} sub={`месечни рати ${formatMoney(d.loans.monthly)}`} />
          <Kpi label="Наплата наспроти план" value={`${d.forecast.progress_pct}%`} sub={`${formatMoney(d.forecast.realized)} / ${formatMoney(d.forecast.expected)}`} />
        </div>
        <div className="grid-2">
          <Section title="Приливи и одливи (6 месеци)">
            <BarChart title="Приливи и одливи" labels={rows(d.trend).map((t) => String(t.label))} series={[
              { name: "Приливи", values: rows(d.trend).map((t) => t.income as string) },
              { name: "Одливи", values: rows(d.trend).map((t) => t.expense as string) }]} />
          </Section>
          <Section title="Најголеми приходи по проект">
            <DataTable rows={rows(d.top_projects)} columns={[
              { key: "project__name", label: "Проект", to: (r) => `/projects/projects/${r.project_id}` },
              { key: "total", label: "Приход", kind: "money" }]} />
          </Section>
          <Section title="Најголем долг кон добавувачи">
            <DataTable rows={rows(d.top_vendor_debt)} columns={[
              { key: "supplier__legal_name", label: "Добавувач", to: (r) => `/partners/partners/${r.supplier_id}` },
              { key: "total", label: "Отворено", kind: "money" }]} />
          </Section>
          <Section title="Последни трансакции">
            <DataTable rows={rows(d.recent)} columns={[
              { key: "date", label: "Датум", kind: "date" },
              { key: "transaction_type", label: "Вид", render: (r) => (r.transaction_type === "incoming" ? "Прилив" : "Одлив") },
              { key: "who", label: "Субјект", render: (r) => String(r.partner__legal_name || r.entity_name || "") },
              { key: "amount", label: "Износ", kind: "money" }]} />
          </Section>
        </div>
      </>}
    </Frame>
  );
}

// ── work orders ────────────────────────────────────────────────────────────

export function WorkOrdersDashboard() {
  const q = useOverview("/workorders/work-orders/dashboard/");
  const wo = (r: Row) => `/workorders/work-orders/${r.id}`;
  return (
    <Frame title="Работни налози — преглед" q={q} actions={<>
      <Link className="btn sm" to="/workorders/resource-board">Распоред на ресурси</Link>
      <Link className="btn sm" to="/workorders/work-orders">Сите налози</Link>
    </>}>
      {(d) => <>
        <div className="kpis">
          <Kpi label="Оперативен преглед" value={d.pending.review} />
          <Kpi label="Логистика" value={d.pending.logistics} />
          <Kpi label="Материјали" value={d.pending.materials} />
          <Kpi label="Безбедност (HSE)" value={d.pending.hse} />
          <Kpi label="Конечно одобрување" value={d.pending.final} />
        </div>
        {rows(d.status_summary).length ? (
          <div className="row">{rows(d.status_summary).map((s) => <Badge key={String(s.status)}>{String(s.label)}: {String(s.count)}</Badge>)}</div>
        ) : null}
        <Section title="План за неделата">
          <div className="week-plan">
            {rows(d.week).map((day) => (
              <div key={String(day.date)} className={`week-day${day.is_today ? " today" : ""}`}>
                <div className="small"><strong>{String(day.day)}</strong> {formatDate(day.date)}{day.is_tomorrow ? <Badge tone="info">утре</Badge> : null}</div>
                {rows(day.work_orders).length ? rows(day.work_orders).map((w) => (
                  <Link key={String(w.id)} to={wo(w)} className="week-item">
                    <span className="mono">{String(w.wo_number || `#${w.id}`)}</span> {String(w.project)}
                    <div className="small muted">{String(w.status_label)}</div>
                  </Link>
                )) : <div className="small muted">—</div>}
              </div>
            ))}
          </div>
        </Section>
        <Section title="Чекаат ваша акција">
          <DataTable rows={rows(d.my_actions)} empty="Нема налози што чекаат ваша акција." columns={[
            { key: "wo_number", label: "Налог", to: wo }, { key: "project", label: "Проект" },
            { key: "work_date", label: "Датум", kind: "date" }, { key: "status_label", label: "Статус" },
            { key: "responsible", label: "Одговорен" }]} />
        </Section>
      </>}
    </Frame>
  );
}
