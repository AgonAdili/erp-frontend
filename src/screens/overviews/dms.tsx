/** Archive overview: the document lifecycle lane, registrations per month, registers, direction, and what
 * expires or reaches its retention date. */
import { ColumnChart } from "@/charts";
import { asRows, DataTable, HBars, Kpi, Kpis, ShareBar, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { LinkButton, Panel } from "@/components/ui";
import { formatNumber, num } from "@/lib/format";

import { listUrl, Overview } from "./common";
import { tr } from "@/i18n";

const D = "dms/documents";
const DIRECTION: Record<string, string> = { IN: tr("Влезни"), OUT: tr("Излезни"), INTERNAL: tr("Внатрешни") };

export function DmsOverview() {
  const q = useOverview<Data>(`/${D}/summary/`);
  return (
    <Overview title={tr("Архива")} q={q} actions={<>
      <LinkButton to="/dms/center">{tr("Центар за документи")}</LinkButton>
      <LinkButton to={`/${D}/new`} variant="primary">{tr("Заведи документ")}</LinkButton>
    </>}>
      {(d) => {
        const s = d.by_status as Record<string, number>;
        const trend = asRows(d.trend);
        return (
          <>
            <StatusBand title={tr("Тек на документите")} total={tr("{0} живи документи", formatNumber(d.total, 0))} stages={[
              { key: "draft", label: tr("Нацрт"), count: s.DRAFT, to: listUrl(D, { status: "DRAFT" }) },
              { key: "verify", label: tr("Во проверка"), count: s.UNDER_VERIFICATION, attention: true, to: listUrl(D, { status: "UNDER_VERIFICATION" }) },
              { key: "approval", label: tr("Чека одобрување"), count: s.PENDING_APPROVAL, attention: true, to: listUrl(D, { status: "PENDING_APPROVAL" }) },
              { key: "approved", label: tr("Одобрени"), count: num(s.APPROVED) + num(s.FINALIZED) + num(s.SIGNED), to: listUrl(D, { status: "APPROVED" }) },
              { key: "active", label: tr("Активни"), count: num(s.ACTIVE) + num(s.SENT) + num(s.RECEIVED), done: true, to: listUrl(D, { status: "ACTIVE" }) },
              { key: "archived", label: tr("Архивирани"), count: num(s.ARCHIVED) + num(s.CLOSED), done: true, to: listUrl(D, { status: "ARCHIVED" }) },
              { key: "disposal", label: tr("За излачување"), count: s.PENDING_DISPOSAL, attention: true, to: listUrl(D, { status: "PENDING_DISPOSAL" }) },
            ]} />
            <Kpis>
              <Kpi label={tr("Заведени овој месец")} value={formatNumber(trend.at(-1)?.registered ?? 0, 0)} trend={trend.map((r) => num(r.registered))} />
              <Kpi label={tr("Истекуваат во 30 дена")} value={formatNumber(asRows(d.expiring).length, 0)} tone={asRows(d.expiring).length ? "attention" : undefined} />
              <Kpi label={tr("Истечени")} value={formatNumber(d.expired, 0)} tone={d.expired ? "alarm" : undefined} />
              <Kpi label={tr("Рок за чување поминат")} value={formatNumber(d.retention_due, 0)} sub={tr("кандидати за излачување")} tone={d.retention_due ? "attention" : undefined} />
            </Kpis>
            <div className="grid-2">
              <Panel title={tr("Заведени документи по месец")} sub={tr("По датум на документот")}>
                <ColumnChart title={tr("Заведени документи по месец")} unit="number" data={trend.map((r) => ({ label: String(r.label), registered: num(r.registered) }))}
                  series={[{ key: "registered", name: tr("Заведени") }]} />
              </Panel>
              <Panel title={tr("По регистар и насока")}>
                <div className="stack">
                  <ShareBar parts={Object.entries(d.by_direction as Record<string, number>).map(([k, v]) => ({ label: DIRECTION[k] ?? k, value: v }))} />
                  <HBars unit="number" rows={asRows(d.by_register).map((r) => ({ key: String(r.register_id), label: String(r.register__name), value: r.count,
                    to: listUrl(D, { register: String(r.register_id) }) }))} empty={tr("Нема заведени документи")} />
                </div>
              </Panel>
            </div>
            <Panel title={tr("Истекуваат во следните 30 дена")} flush>
              <DataTable rows={asRows(d.expiring)} empty={tr("Ниеден документ не истекува наскоро")} columns={[
                { key: "archive_number", label: tr("Архивски број"), to: (r) => `/${D}/${r.id}`, render: (r) => String(r.archive_number || `#${r.id}`) },
                { key: "subject", label: tr("Предмет") }, { key: "expiry_date", label: tr("Важи до"), kind: "date" }]} />
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}
