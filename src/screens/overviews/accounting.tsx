/** Accounting overview for one legal entity: what blocks the month close, postings, AP / AR position, VAT
 * by month and fixed assets. */
import { ColumnChart } from "@/charts";
import { asRows, Kpi, Kpis, Meter, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Alert, LinkButton, Panel } from "@/components/ui";
import { formatCompact, formatMoney, formatNumber, num } from "@/lib/format";

import { listUrl, Overview } from "./common";

export function AccountingOverview() {
  const q = useOverview<Data>("/accounting/ledger/dashboard/");
  return (
    <Overview title="Сметководство" q={q} actions={<>
      <LinkButton to="/accounting/ledger">Главна книга</LinkButton>
      <LinkButton to="/accounting/journal-entries/new" variant="primary">Нов налог</LinkButton>
    </>}>
      {(d) => {
        const vat = asRows(d.vat_trend).map((r) => ({ label: String(r.label), input_vat: num(r.input_vat), output_vat: num(r.output_vat), net: num(r.net) }));
        const tasks = d.close_tasks as { done: number; total: number };
        return (
          <>
            {d.unbalanced_drafts ? (
              <Alert tone="warning" title={`Нерамнотежни нацрт-налози: ${d.unbalanced_drafts}`}
                action={<LinkButton size="sm" to={listUrl("accounting/journal-entries", { status: "DRAFT" })}>Прегледај</LinkButton>}>
                Должи и побарува не се еднакви; налозите не можат да се книжат додека не се порамнат.
              </Alert>
            ) : null}
            <StatusBand title={d.period ? `Период ${d.period.name}` : "Нема отворен период за денес"} total={tasks.total ? `затворање: ${tasks.done} од ${tasks.total} задачи` : undefined} stages={[
              { key: "ap", label: "Влезни фактури за книжење", count: d.ap_awaiting_posting, attention: true, to: listUrl("payables/invoices", { posting_status: "NOT_POSTED" }) },
              { key: "drafts", label: "Нацрт налози", count: d.drafts, attention: true, to: listUrl("accounting/journal-entries", { status: "DRAFT" }) },
              { key: "unbalanced", label: "Нерамнотежни", count: d.unbalanced_drafts, danger: true, to: listUrl("accounting/journal-entries", { status: "DRAFT" }) },
              { key: "posted", label: "Книжени овој месец", count: d.posted_this_month, done: true, to: listUrl("accounting/journal-entries", { status: "POSTED" }) },
              { key: "close", label: "Задачи за затворање", count: tasks.total - tasks.done, attention: tasks.total > tasks.done, to: "/accounting/close-tasks",
                sub: tasks.total ? `${tasks.done} завршени` : "нема листа" },
            ]} />
            <Kpis>
              <Kpi label="Обврски (отворено)" value={formatCompact(d.payables.open)} unit="ден." sub={`${d.payables.overdue} задоцнети од ${d.payables.count}`} to="/payables"
                tone={d.payables.overdue ? "attention" : undefined} />
              <Kpi label="Побарувања (отворено)" value={formatCompact(d.receivables.open)} unit="ден." sub={`${d.receivables.overdue} задоцнети од ${d.receivables.count}`} to="/receivables"
                tone={d.receivables.overdue ? "attention" : undefined} />
              <Kpi label="Нето позиција" value={formatCompact(d.net_position)} unit="ден." sub="побарувања минус обврски" tone={num(d.net_position) < 0 ? "alarm" : undefined} />
              <Kpi label="ДДВ овој месец" value={formatCompact(d.vat.net)} unit="ден." sub={`излезен ${formatCompact(d.vat.output_vat)} · влезен ${formatCompact(d.vat.input_vat)}`} />
              <Kpi label="Основни средства" value={formatCompact(d.net_book_value)} unit="ден." sub={`амортизација овој месец ${formatCompact(d.depreciation_this_month)}`} to="/assets" />
            </Kpis>
            <div className="grid-2">
              <Panel title="ДДВ по месец" sub="Влезен и излезен ДДВ по датум на книжење; линијата е обврската">
                <ColumnChart title="Влезен и излезен ДДВ по месец" data={vat}
                  series={[{ key: "output_vat", name: "Излезен" }, { key: "input_vat", name: "Влезен" }, { key: "net", name: "Обврска", line: true, color: "var(--ink)" }]} />
              </Panel>
              <Panel title="Затворање на месецот" sub={d.period ? String(d.period.name) : "Нема отворен период"}
                actions={<LinkButton to="/accounting/fiscal-periods" size="sm">Периоди</LinkButton>}>
                <div className="stack">
                  <div className="row-tight"><span className="num" style={{ fontSize: 28, fontWeight: 600 }}>{tasks.done}</span>
                    <span className="muted">од {tasks.total} задачи завршени</span></div>
                  <Meter value={tasks.done} max={tasks.total || 1} label="Затворање на месецот" />
                  <dl className="fact-list">
                    <div><dt>Обврски кон добавувачи</dt><dd className="num">{formatMoney(d.payables.open)}</dd></div>
                    <div><dt>Побарувања од купувачи</dt><dd className="num">{formatMoney(d.receivables.open)}</dd></div>
                    <div><dt>Книжени налози овој месец</dt><dd className="num">{formatNumber(d.posted_this_month, 0)}</dd></div>
                  </dl>
                  <div className="row-tight" style={{ flexWrap: "wrap" }}>
                    <LinkButton size="sm" to="/accounting/close-tasks">Задачи</LinkButton>
                    <LinkButton size="sm" to="/accounting/vat-entries">Книга на ДДВ</LinkButton>
                    <LinkButton size="sm" to="/accounting/accounts">Контен план</LinkButton>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        );
      }}
    </Overview>
  );
}
