/** Finance overviews: the cash book month and six-month trend with loans and the income forecast; payables
 * and receivables by age with the largest partners and what falls due in the next two weeks. */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Page as ApiPage, Row } from "@/api/types";
import { ColumnChart } from "@/charts";
import { asRows, DataTable, HBars, Kpi, Kpis, Meter, useOverview, type Data } from "@/components/dashboard";
import { Badge, LinkButton, Panel } from "@/components/ui";
import { MONTHS } from "@/i18n/mk";
import { addDays, formatCompact, formatDate, formatMoney, formatNumber, num, todayISO } from "@/lib/format";

import { listUrl, Overview } from "./common";

export function FinanceOverview() {
  const q = useOverview<Data>("/finance/cashbook/dashboard/");
  const loans = useOverview<Data>("/finance/loans/summary/");
  const now = new Date();
  const forecast = useOverview<Data>("/finance/forecasts/summary/", { year: now.getFullYear(), month: now.getMonth() + 1 });
  return (
    <Overview title="Финансии" q={q} actions={<>
      <LinkButton to="/payables">Обврски</LinkButton>
      <LinkButton to="/receivables">Побарувања</LinkButton>
      <LinkButton to="/finance/cashbook/new" variant="primary">Нова ставка во благајна</LinkButton>
    </>}>
      {(d) => {
        const trend = asRows(d.trend).map((r) => ({ label: String(r.label), income: num(r.income), expense: num(r.expense), result: num(r.income) - num(r.expense) }));
        const res = num(d.month.result);
        const upcoming = asRows(loans.data?.upcoming);
        return (
          <>
            <Kpis>
              <Kpi label={`Приливи, ${MONTHS[now.getMonth()].toLowerCase()}`} value={formatCompact(d.month.income)} unit="ден." trend={trend.map((r) => r.income)} />
              <Kpi label={`Одливи, ${MONTHS[now.getMonth()].toLowerCase()}`} value={formatCompact(d.month.expense)} unit="ден." trend={trend.map((r) => r.expense)} />
              <Kpi label="Резултат на месецот" value={formatCompact(res)} unit="ден." sub={`${formatNumber(d.month.margin_pct, 1)}% од приливите`} tone={res < 0 ? "alarm" : undefined} />
              <Kpi label="Долг кон добавувачи" value={formatCompact(d.vendor_debt.open)} unit="ден." sub={`${d.vendor_debt.overdue} задоцнети · ${d.vendor_debt.due_7_days} доспеваат за 7 дена`}
                tone={d.vendor_debt.overdue ? "attention" : undefined} to="/payables" />
              <Kpi label="Побарувања" value={formatCompact(d.receivables_open)} unit="ден." sub="отворени излезни фактури" to="/receivables" />
              <Kpi label="Кредити" value={formatCompact(d.loans.balance)} unit="ден." sub={`рати ${formatCompact(d.loans.monthly)} ден. месечно`} to="/finance/loans" />
            </Kpis>
            <Panel title="Приливи, одливи и резултат" sub="Дневна благајна по месец, денари">
              <ColumnChart title="Приливи, одливи и резултат по месец" data={trend}
                series={[{ key: "income", name: "Приливи" }, { key: "expense", name: "Одливи" }, { key: "result", name: "Резултат", line: true, color: "var(--ink)" }]} />
            </Panel>
            <div className="grid-3">
              <Panel title="Наплата наспроти план" sub={`${MONTHS[now.getMonth()]} ${now.getFullYear()}`}>
                <div className="stack-sm">
                  <div className="row-tight"><span className="k-value num" style={{ fontSize: 28, fontWeight: 600 }}>{formatNumber(d.forecast.progress_pct, 0)}%</span>
                    <span className="small muted">{formatMoney(d.forecast.realized)} од {formatMoney(d.forecast.expected)} ден.</span></div>
                  <Meter value={num(d.forecast.progress_pct)} label="Наплата наспроти план" />
                  {forecast.data ? <span className="xs muted">Планирани фактурирања: {formatMoney(forecast.data.billings_planned)} ден. · отстапување {formatMoney(forecast.data.deviance)} ден.</span> : null}
                </div>
              </Panel>
              <Panel title="Најголеми приливи по проект">
                <HBars rows={asRows(d.top_projects).map((r) => ({ key: String(r.project_id), label: String(r.project__name), value: r.total, to: `/projects/projects/${r.project_id}` }))} empty="Нема приливи по проект" />
              </Panel>
              <Panel title="Најголем долг кон добавувачи">
                <HBars color="var(--series-3)" rows={asRows(d.top_vendor_debt).map((r) => ({ key: String(r.supplier_id), label: String(r.supplier__legal_name), value: r.total, to: `/partners/partners/${r.supplier_id}` }))} empty="Нема отворени обврски" />
              </Panel>
            </div>
            <div className="grid-2">
              <Panel title="Последни трансакции" flush actions={<LinkButton to="/finance/cashbook" size="sm">Благајна</LinkButton>}>
                <DataTable rows={asRows(d.recent)} columns={[
                  { key: "date", label: "Датум", kind: "date" },
                  { key: "who", label: "Субјект", render: (r) => String(r.partner__legal_name || r.entity_name || r.description || "—"), to: (r) => `/finance/cashbook/${r.id}` },
                  { key: "transaction_type", label: "Вид", render: (r) => (r.transaction_type === "incoming" ? <Badge tone="success" plain>прилив</Badge> : <Badge plain>одлив</Badge>) },
                  { key: "amount", label: "Износ", kind: "money" }]} />
              </Panel>
              <Panel title="Рати во следните 30 дена" sub={loans.data ? `Вкупен долг ${formatMoney(loans.data.total_debt)} ден.` : undefined} flush>
                <DataTable rows={upcoming} empty="Нема рати во следните 30 дена" columns={[
                  { key: "bank__name", label: "Банка", to: (r) => `/finance/loans/${r.id}` }, { key: "loan_number", label: "Кредит" },
                  { key: "next_payment_date", label: "Датум", kind: "date" }, { key: "monthly_installment", label: "Рата", kind: "money" }]} />
              </Panel>
            </div>
          </>
        );
      }}
    </Overview>
  );
}

// ── payables & receivables ───────────────────────────────────────────────────

const BUCKETS: [string, string][] = [["current", "Не е доспеано"], ["1-30", "1–30 дена"], ["31-60", "31–60 дена"], ["61-90", "61–90 дена"], ["over-90", "Над 90 дена"]];

function AgingOverview({ kind }: { kind: "payables" | "receivables" }) {
  const payables = kind === "payables";
  const path = `${kind}/open-items`;
  const party = payables ? "supplier" : "customer";
  const q = useOverview<Data>(`/${path}/aging/`, {}, { entity: false });
  const today = todayISO();
  const due = useQuery({
    queryKey: ["list", `/api/v1/${path}/`, "due14", today],
    queryFn: () => api.get<ApiPage<Row>>(`/${path}/`, { due_date__gte: today, due_date__lte: addDays(today, 14), ordering: "due_date", page_size: 12 }),
  });
  const title = payables ? "Обврски кон добавувачи" : "Побарувања од купувачи";
  return (
    <Overview title={title} q={q} entityScoped={false} actions={<>
      <LinkButton to={`/${path}`}>Сите отворени ставки</LinkButton>
      <LinkButton to={payables ? "/payables/payments/new" : "/receivables/receipts/new"} variant="primary">{payables ? "Ново плаќање" : "Нова наплата"}</LinkButton>
    </>}>
      {(d) => {
        const totals = d.totals as Record<string, string>;
        const overdue = BUCKETS.slice(1).reduce((s, [k]) => s + num(totals[k]), 0);
        const rows = asRows(d.rows);
        const dueRows = (due.data?.results ?? []).filter((r) => num(r.open_amount) > 0);
        return (
          <>
            <Kpis>
              <Kpi label="Вкупно отворено" value={formatCompact(d.total)} unit="ден." sub={`${rows.length} ${payables ? "добавувачи" : "купувачи"}`} />
              <Kpi label="Задоцнето" value={formatCompact(overdue)} unit="ден." sub={num(d.total) ? `${formatNumber((overdue / num(d.total)) * 100, 1)}% од отвореното` : undefined}
                tone={overdue ? "attention" : undefined} />
              <Kpi label="Над 90 дена" value={formatCompact(totals["over-90"])} unit="ден." tone={num(totals["over-90"]) ? "alarm" : undefined} />
              <Kpi label="Доспева во 14 дена" value={due.data ? formatCompact(dueRows.reduce((s, r) => s + num(r.open_amount), 0)) : "…"} unit="ден." sub={`${dueRows.length} ставки`} />
            </Kpis>
            <div className="grid-2">
              <Panel title="Старост на отвореното" sub="Денари по денови по доспевањето">
                <ColumnChart title="Старост на отворените ставки" totals={false}
                  data={BUCKETS.map(([k, label]) => ({ label, amount: num(totals[k]) }))}
                  series={[{ key: "amount", name: "Отворено", color: payables ? "var(--series-3)" : "var(--series-2)" }]} />
              </Panel>
              <Panel title={payables ? "Најголеми добавувачи" : "Најголеми купувачи"} sub="Отворено, задоцнетото означено">
                <HBars rows={rows.slice(0, 8).map((r) => {
                  const late = BUCKETS.slice(1).reduce((s, [k]) => s + num((r.buckets as Record<string, string>)[k]), 0);
                  return { key: String(r.partner_id), label: String(r.name), value: r.total, over: late > num(r.total) / 2,
                    to: r.partner_id ? listUrl(path, { [party]: String(r.partner_id) }) : undefined };
                })} empty="Нема отворени ставки" />
              </Panel>
            </div>
            <Panel title="Доспева во следните 14 дена" flush>
              <DataTable rows={dueRows} empty="Ништо не доспева во следните 14 дена" columns={[
                { key: "invoice_number", label: "Фактура", to: (r) => `/${path}/${r.id}`, render: (r) => String(r.invoice_number || `#${r.id}`) },
                { key: party, label: payables ? "Добавувач" : "Купувач", render: (r) => String(r[`${party}_label`] ?? r.counterparty_label ?? "") },
                { key: "due_date", label: "Доспева", render: (r) => formatDate(r.due_date) },
                { key: "open_amount", label: "Отворено", kind: "money" }]} />
            </Panel>
            <Panel title="По партнер и старост" flush>
              <div className="table-wrap" style={{ maxHeight: 480 }}>
                <table className="table">
                  <thead><tr><th>{payables ? "Добавувач" : "Купувач"}</th>{BUCKETS.map(([k, l]) => <th key={k} className="num">{l}</th>)}<th className="num">Вкупно</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={String(r.partner_id)}>
                        <td>{r.partner_id ? <Link to={listUrl(path, { [party]: String(r.partner_id) })}>{String(r.name)}</Link> : String(r.name)}</td>
                        {BUCKETS.map(([k], i) => {
                          const v = num((r.buckets as Record<string, string>)[k]);
                          return <td key={k} className={`num${v && i >= 3 ? " tone-danger" : ""}`}>{v ? formatMoney(v) : <span className="muted-cell">—</span>}</td>;
                        })}
                        <td className="num strong">{formatMoney(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {rows.length > 1 ? <tfoot><tr><td>Вкупно</td>{BUCKETS.map(([k]) => <td key={k} className="num">{formatMoney(totals[k])}</td>)}<td className="num">{formatMoney(d.total)}</td></tr></tfoot> : null}
                </table>
              </div>
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}

export function PayablesOverview() {
  return <AgingOverview kind="payables" />;
}

export function ReceivablesOverview() {
  return <AgingOverview kind="receivables" />;
}
