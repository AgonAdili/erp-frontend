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
import { addDays, formatWhole, formatDate, formatMoney, formatNumber, num, todayISO } from "@/lib/format";

import { listUrl, Overview } from "./common";
import { tr } from "@/i18n";

export function FinanceOverview() {
  const q = useOverview<Data>("/finance/cashbook/dashboard/");
  const loans = useOverview<Data>("/finance/loans/summary/");
  const now = new Date();
  const forecast = useOverview<Data>("/finance/forecasts/summary/", { year: now.getFullYear(), month: now.getMonth() + 1 });
  return (
    <Overview title={tr("Финансии")} q={q} actions={<>
      <LinkButton to="/payables">{tr("Обврски")}</LinkButton>
      <LinkButton to="/receivables">{tr("Побарувања")}</LinkButton>
      <LinkButton to="/finance/cashbook/new" variant="primary">{tr("Нова ставка во благајна")}</LinkButton>
    </>}>
      {(d) => {
        const trend = asRows(d.trend).map((r) => ({ label: String(r.label), income: num(r.income), expense: num(r.expense), result: num(r.income) - num(r.expense) }));
        const res = num(d.month.result);
        const upcoming = asRows(loans.data?.upcoming);
        return (
          <>
            <Kpis>
              <Kpi label={tr("Приливи, {0}", MONTHS[now.getMonth()].toLowerCase())} value={formatWhole(d.month.income)} unit="MKD" trend={trend.map((r) => r.income)} />
              <Kpi label={tr("Одливи, {0}", MONTHS[now.getMonth()].toLowerCase())} value={formatWhole(d.month.expense)} unit="MKD" trend={trend.map((r) => r.expense)} />
              <Kpi label={tr("Резултат на месецот")} value={formatWhole(res)} unit="MKD" sub={tr("{0} % од приливите", formatNumber(d.month.margin_pct, 1))} tone={res < 0 ? "alarm" : undefined} />
              <Kpi label={tr("Долг кон добавувачи")} value={formatWhole(d.vendor_debt.open)} unit="MKD" sub={tr("{0} задоцнети · {1} доспеваат за 7 дена", d.vendor_debt.overdue, d.vendor_debt.due_7_days)}
                tone={d.vendor_debt.overdue ? "attention" : undefined} to="/payables" />
              <Kpi label={tr("Побарувања")} value={formatWhole(d.receivables_open)} unit="MKD" sub={tr("отворени излезни фактури")} to="/receivables" />
              <Kpi label={tr("Кредити")} value={formatWhole(d.loans.balance)} unit="MKD" sub={tr("рати {0} MKD месечно", formatWhole(d.loans.monthly))} to="/finance/loans" />
            </Kpis>
            <Panel title={tr("Приливи, одливи и резултат")} sub={tr("Дневна благајна по месец, MKD")}>
              <ColumnChart title={tr("Приливи, одливи и резултат по месец")} data={trend}
                series={[{ key: "income", name: tr("Приливи") }, { key: "expense", name: tr("Одливи") }, { key: "result", name: tr("Резултат"), line: true, color: "var(--ea-text)" }]} />
            </Panel>
            <div className="grid-3">
              <Panel title={tr("Наплата наспроти план")} sub={`${MONTHS[now.getMonth()]} ${now.getFullYear()}`}>
                <div className="stack-sm">
                  <div className="row-tight"><span className="k-value num" style={{ fontSize: 28, fontWeight: 600 }}>{formatNumber(d.forecast.progress_pct, 0)} %</span>
                    <span className="small muted">{formatMoney(d.forecast.realized)}{" "}{tr("од")}{" "}{formatMoney(d.forecast.expected)} MKD</span></div>
                  <Meter value={num(d.forecast.progress_pct)} label={tr("Наплата наспроти план")} />
                  {forecast.data ? <span className="xs muted">{tr("Планирани фактурирања:")}{" "}{formatMoney(forecast.data.billings_planned)}{" "}{tr("MKD · отстапување")}{" "}{formatMoney(forecast.data.deviance)} MKD</span> : null}
                </div>
              </Panel>
              <Panel title={tr("Најголеми приливи по проект")}>
                <HBars rows={asRows(d.top_projects).map((r) => ({ key: String(r.project_id), label: String(r.project__name), value: r.total, to: `/projects/projects/${r.project_id}` }))} empty={tr("Нема приливи по проект")} />
              </Panel>
              <Panel title={tr("Најголем долг кон добавувачи")}>
                <HBars color="var(--ea-chart-3)" rows={asRows(d.top_vendor_debt).map((r) => ({ key: String(r.supplier_id), label: String(r.supplier__legal_name), value: r.total, to: `/partners/partners/${r.supplier_id}` }))} empty={tr("Нема отворени обврски")} />
              </Panel>
            </div>
            <div className="grid-2">
              <Panel title={tr("Последни трансакции")} flush actions={<LinkButton to="/finance/cashbook" size="sm">{tr("Благајна")}</LinkButton>}>
                <DataTable rows={asRows(d.recent)} columns={[
                  { key: "date", label: tr("Датум"), kind: "date" },
                  { key: "who", label: tr("Субјект"), render: (r) => String(r.partner__legal_name || r.entity_name || r.description || "—"), to: (r) => `/finance/cashbook/${r.id}` },
                  { key: "transaction_type", label: tr("Вид"), render: (r) => (r.transaction_type === "incoming" ? <Badge tone="success" plain>{tr("прилив")}</Badge> : <Badge plain>{tr("одлив")}</Badge>) },
                  { key: "amount", label: tr("Износ"), kind: "money" }]} />
              </Panel>
              <Panel title={tr("Рати во следните 30 дена")} sub={loans.data ? tr("Вкупен долг {0} MKD", formatMoney(loans.data.total_debt)) : undefined} flush>
                <DataTable rows={upcoming} empty={tr("Нема рати во следните 30 дена")} columns={[
                  { key: "bank__name", label: tr("Банка"), to: (r) => `/finance/loans/${r.id}` }, { key: "loan_number", label: tr("Кредит") },
                  { key: "next_payment_date", label: tr("Датум"), kind: "date" }, { key: "monthly_installment", label: tr("Рата"), kind: "money" }]} />
              </Panel>
            </div>
          </>
        );
      }}
    </Overview>
  );
}

// ── payables & receivables ───────────────────────────────────────────────────

const BUCKETS: [string, string][] = [["current", tr("Не е доспеано")], ["1-30", tr("1–30 дена")], ["31-60", tr("31–60 дена")], ["61-90", tr("61–90 дена")], ["over-90", tr("Над 90 дена")]];

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
  const title = payables ? tr("Обврски кон добавувачи") : tr("Побарувања од купувачи");
  return (
    <Overview title={title} q={q} entityScoped={false} actions={<>
      <LinkButton to={`/${path}`}>{tr("Сите отворени ставки")}</LinkButton>
      <LinkButton to={payables ? "/payables/payments/new" : "/receivables/receipts/new"} variant="primary">{payables ? tr("Ново плаќање") : tr("Нова наплата")}</LinkButton>
    </>}>
      {(d) => {
        const totals = d.totals as Record<string, string>;
        const overdue = BUCKETS.slice(1).reduce((s, [k]) => s + num(totals[k]), 0);
        const rows = asRows(d.rows);
        const dueRows = (due.data?.results ?? []).filter((r) => num(r.open_amount) > 0);
        return (
          <>
            <Kpis>
              <Kpi label={tr("Вкупно отворено")} value={formatWhole(d.total)} unit="MKD" sub={`${rows.length} ${payables ? tr("добавувачи") : tr("купувачи")}`} />
              <Kpi label={tr("Задоцнето")} value={formatWhole(overdue)} unit="MKD" sub={num(d.total) ? tr("{0} % од отвореното", formatNumber((overdue / num(d.total)) * 100, 1)) : undefined}
                tone={overdue ? "attention" : undefined} />
              <Kpi label={tr("Над 90 дена")} value={formatWhole(totals["over-90"])} unit="MKD" tone={num(totals["over-90"]) ? "alarm" : undefined} />
              <Kpi label={tr("Доспева во 14 дена")} value={due.data ? formatWhole(dueRows.reduce((s, r) => s + num(r.open_amount), 0)) : "…"} unit="MKD" sub={tr("{0} ставки", dueRows.length)} />
            </Kpis>
            <div className="grid-2">
              <Panel title={tr("Старост на отвореното")} sub={tr("Денари по денови по доспевањето")}>
                <ColumnChart title={tr("Старост на отворените ставки")} totals={false}
                  data={BUCKETS.map(([k, label]) => ({ label, amount: num(totals[k]) }))}
                  series={[{ key: "amount", name: tr("Отворено"), color: payables ? "var(--ea-chart-3)" : "var(--ea-chart-2)" }]} />
              </Panel>
              <Panel title={payables ? tr("Најголеми добавувачи") : tr("Најголеми купувачи")} sub={tr("Отворено, задоцнетото означено")}>
                <HBars rows={rows.slice(0, 8).map((r) => {
                  const late = BUCKETS.slice(1).reduce((s, [k]) => s + num((r.buckets as Record<string, string>)[k]), 0);
                  return { key: String(r.partner_id), label: String(r.name), value: r.total, over: late > num(r.total) / 2,
                    to: r.partner_id ? listUrl(path, { [party]: String(r.partner_id) }) : undefined };
                })} empty={tr("Нема отворени ставки")} />
              </Panel>
            </div>
            <Panel title={tr("Доспева во следните 14 дена")} flush>
              <DataTable rows={dueRows} empty={tr("Ништо не доспева во следните 14 дена")} columns={[
                { key: "invoice_number", label: tr("Фактура"), to: (r) => `/${path}/${r.id}`, render: (r) => String(r.invoice_number || `#${r.id}`) },
                { key: party, label: payables ? tr("Добавувач") : tr("Купувач"), render: (r) => String(r[`${party}_label`] ?? r.counterparty_label ?? "") },
                { key: "due_date", label: tr("Доспева"), render: (r) => formatDate(r.due_date) },
                { key: "open_amount", label: tr("Отворено"), kind: "money" }]} />
            </Panel>
            <Panel title={tr("По партнер и старост")} flush>
              <div className="table-responsive table-wrap" style={{ maxHeight: 480 }}>
                <table className="table ea-table">
                  <thead><tr><th>{payables ? tr("Добавувач") : tr("Купувач")}</th>{BUCKETS.map(([k, l]) => <th key={k} className="num">{l}</th>)}<th className="num">{tr("Вкупно")}</th></tr></thead>
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
                  {rows.length > 1 ? <tfoot><tr><td>{tr("Вкупно")}</td>{BUCKETS.map(([k]) => <td key={k} className="num">{formatMoney(totals[k])}</td>)}<td className="num">{formatMoney(d.total)}</td></tr></tfoot> : null}
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
