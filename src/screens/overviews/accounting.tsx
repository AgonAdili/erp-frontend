/** Accounting overview for one legal entity: what blocks the month close, postings, AP / AR position, VAT
 * by month and fixed assets. */
import { ColumnChart } from "@/charts";
import { asRows, Kpi, Kpis, Meter, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Alert, LinkButton, Panel } from "@/components/ui";
import { formatWhole, formatMoney, formatNumber, num } from "@/lib/format";

import { listUrl, Overview } from "./common";
import { tr } from "@/i18n";

export function AccountingOverview() {
  const q = useOverview<Data>("/accounting/ledger/dashboard/");
  return (
    <Overview title={tr("Сметководство")} q={q} actions={<>
      <LinkButton to="/accounting/ledger">{tr("Главна книга")}</LinkButton>
      <LinkButton to="/accounting/journal-entries/new" variant="primary">{tr("Нов налог")}</LinkButton>
    </>}>
      {(d) => {
        const vat = asRows(d.vat_trend).map((r) => ({ label: String(r.label), input_vat: num(r.input_vat), output_vat: num(r.output_vat), net: num(r.net) }));
        const tasks = d.close_tasks as { done: number; total: number };
        return (
          <>
            {d.unbalanced_drafts ? (
              <Alert tone="warning" title={tr("Нерамнотежни нацрт-налози: {0}", d.unbalanced_drafts)}
                action={<LinkButton size="sm" to={listUrl("accounting/journal-entries", { status: "DRAFT" })}>{tr("Прегледај")}</LinkButton>}>
                {tr("Должи и побарува не се еднакви; налозите не можат да се книжат додека не се порамнат.")}
              </Alert>
            ) : null}
            <StatusBand title={d.period ? tr("Период {0}", d.period.name) : tr("Нема отворен период за денес")} total={tasks.total ? tr("затворање: {0} од {1} задачи", tasks.done, tasks.total) : undefined} stages={[
              { key: "ap", label: tr("Влезни фактури за книжење"), count: d.ap_awaiting_posting, attention: true, to: listUrl("payables/invoices", { posting_status: "NOT_POSTED" }) },
              { key: "drafts", label: tr("Нацрт налози"), count: d.drafts, attention: true, to: listUrl("accounting/journal-entries", { status: "DRAFT" }) },
              { key: "unbalanced", label: tr("Нерамнотежни"), count: d.unbalanced_drafts, danger: true, to: listUrl("accounting/journal-entries", { status: "DRAFT" }) },
              { key: "posted", label: tr("Книжени овој месец"), count: d.posted_this_month, done: true, to: listUrl("accounting/journal-entries", { status: "POSTED" }) },
              { key: "close", label: tr("Задачи за затворање"), count: tasks.total - tasks.done, attention: tasks.total > tasks.done, to: "/accounting/close-tasks",
                sub: tasks.total ? tr("{0} завршени", tasks.done) : tr("нема листа") },
            ]} />
            <Kpis>
              <Kpi label={tr("Обврски (отворено)")} value={formatWhole(d.payables.open)} unit="MKD" sub={tr("{0} задоцнети од {1}", d.payables.overdue, d.payables.count)} to="/payables"
                tone={d.payables.overdue ? "attention" : undefined} />
              <Kpi label={tr("Побарувања (отворено)")} value={formatWhole(d.receivables.open)} unit="MKD" sub={tr("{0} задоцнети од {1}", d.receivables.overdue, d.receivables.count)} to="/receivables"
                tone={d.receivables.overdue ? "attention" : undefined} />
              <Kpi label={tr("Нето позиција")} value={formatWhole(d.net_position)} unit="MKD" sub={tr("побарувања минус обврски")} tone={num(d.net_position) < 0 ? "alarm" : undefined} />
              <Kpi label={tr("ДДВ овој месец")} value={formatWhole(d.vat.net)} unit="MKD" sub={tr("излезен {0} · влезен {1}", formatWhole(d.vat.output_vat), formatWhole(d.vat.input_vat))} />
              <Kpi label={tr("Основни средства")} value={formatWhole(d.net_book_value)} unit="MKD" sub={tr("амортизација овој месец {0}", formatWhole(d.depreciation_this_month))} to="/assets" />
            </Kpis>
            <div className="grid-2">
              <Panel title={tr("ДДВ по месец")} sub={tr("Влезен и излезен ДДВ по датум на книжење; линијата е обврската")}>
                <ColumnChart title={tr("Влезен и излезен ДДВ по месец")} data={vat}
                  series={[{ key: "output_vat", name: tr("Излезен") }, { key: "input_vat", name: tr("Влезен") }, { key: "net", name: tr("Обврска"), line: true, color: "var(--ea-text)" }]} />
              </Panel>
              <Panel title={tr("Затворање на месецот")} sub={d.period ? String(d.period.name) : tr("Нема отворен период")}
                actions={<LinkButton to="/accounting/fiscal-periods" size="sm">{tr("Периоди")}</LinkButton>}>
                <div className="stack">
                  <div className="row-tight"><span className="num" style={{ fontSize: 28, fontWeight: 600 }}>{tasks.done}</span>
                    <span className="muted">{tr("од")}{" "}{tasks.total}{" "}{tr("задачи завршени")}</span></div>
                  <Meter value={tasks.done} max={tasks.total || 1} label={tr("Затворање на месецот")} />
                  <dl className="fact-list">
                    <div><dt>{tr("Обврски кон добавувачи")}</dt><dd className="num">{formatMoney(d.payables.open)}</dd></div>
                    <div><dt>{tr("Побарувања од купувачи")}</dt><dd className="num">{formatMoney(d.receivables.open)}</dd></div>
                    <div><dt>{tr("Книжени налози овој месец")}</dt><dd className="num">{formatNumber(d.posted_this_month, 0)}</dd></div>
                  </dl>
                  <div className="row-tight" style={{ flexWrap: "wrap" }}>
                    <LinkButton size="sm" to="/accounting/close-tasks">{tr("Задачи")}</LinkButton>
                    <LinkButton size="sm" to="/accounting/vat-entries">{tr("Книга на ДДВ")}</LinkButton>
                    <LinkButton size="sm" to="/accounting/accounts">{tr("Контен план")}</LinkButton>
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
