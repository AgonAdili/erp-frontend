/** Archive overview: the document lifecycle lane, registrations per month, registers, direction, and what
 * expires or reaches its retention date. */
import { ColumnChart } from "@/charts";
import { asRows, DataTable, HBars, Kpi, Kpis, ShareBar, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { LinkButton, Panel } from "@/components/ui";
import { formatNumber, num } from "@/lib/format";

import { listUrl, Overview } from "./common";

const D = "dms/documents";
const DIRECTION: Record<string, string> = { IN: "Влезни", OUT: "Излезни", INTERNAL: "Внатрешни" };

export function DmsOverview() {
  const q = useOverview<Data>(`/${D}/summary/`);
  return (
    <Overview title="Архива" q={q} actions={<>
      <LinkButton to="/dms/center">Центар за документи</LinkButton>
      <LinkButton to={`/${D}/new`} variant="primary">Заведи документ</LinkButton>
    </>}>
      {(d) => {
        const s = d.by_status as Record<string, number>;
        const trend = asRows(d.trend);
        return (
          <>
            <StatusBand title="Тек на документите" total={`${formatNumber(d.total, 0)} живи документи`} stages={[
              { key: "draft", label: "Нацрт", count: s.DRAFT, to: listUrl(D, { status: "DRAFT" }) },
              { key: "verify", label: "Во проверка", count: s.UNDER_VERIFICATION, attention: true, to: listUrl(D, { status: "UNDER_VERIFICATION" }) },
              { key: "approval", label: "Чека одобрување", count: s.PENDING_APPROVAL, attention: true, to: listUrl(D, { status: "PENDING_APPROVAL" }) },
              { key: "approved", label: "Одобрени", count: num(s.APPROVED) + num(s.FINALIZED) + num(s.SIGNED), to: listUrl(D, { status: "APPROVED" }) },
              { key: "active", label: "Активни", count: num(s.ACTIVE) + num(s.SENT) + num(s.RECEIVED), done: true, to: listUrl(D, { status: "ACTIVE" }) },
              { key: "archived", label: "Архивирани", count: num(s.ARCHIVED) + num(s.CLOSED), done: true, to: listUrl(D, { status: "ARCHIVED" }) },
              { key: "disposal", label: "За излачување", count: s.PENDING_DISPOSAL, attention: true, to: listUrl(D, { status: "PENDING_DISPOSAL" }) },
            ]} />
            <Kpis>
              <Kpi label="Заведени овој месец" value={formatNumber(trend.at(-1)?.registered ?? 0, 0)} trend={trend.map((r) => num(r.registered))} />
              <Kpi label="Истекуваат во 30 дена" value={formatNumber(asRows(d.expiring).length, 0)} tone={asRows(d.expiring).length ? "attention" : undefined} />
              <Kpi label="Истечени" value={formatNumber(d.expired, 0)} tone={d.expired ? "alarm" : undefined} />
              <Kpi label="Рок за чување поминат" value={formatNumber(d.retention_due, 0)} sub="кандидати за излачување" tone={d.retention_due ? "attention" : undefined} />
            </Kpis>
            <div className="grid-2">
              <Panel title="Заведени документи по месец" sub="По датум на документот">
                <ColumnChart title="Заведени документи по месец" unit="number" data={trend.map((r) => ({ label: String(r.label), registered: num(r.registered) }))}
                  series={[{ key: "registered", name: "Заведени" }]} />
              </Panel>
              <Panel title="По регистар и насока">
                <div className="stack">
                  <ShareBar parts={Object.entries(d.by_direction as Record<string, number>).map(([k, v]) => ({ label: DIRECTION[k] ?? k, value: v }))} />
                  <HBars unit="number" rows={asRows(d.by_register).map((r) => ({ key: String(r.register_id), label: String(r.register__name), value: r.count,
                    to: listUrl(D, { register: String(r.register_id) }) }))} empty="Нема заведени документи" />
                </div>
              </Panel>
            </div>
            <Panel title="Истекуваат во следните 30 дена" flush>
              <DataTable rows={asRows(d.expiring)} empty="Ниеден документ не истекува наскоро" columns={[
                { key: "archive_number", label: "Архивски број", to: (r) => `/${D}/${r.id}`, render: (r) => String(r.archive_number || `#${r.id}`) },
                { key: "subject", label: "Предмет" }, { key: "expiry_date", label: "Важи до", kind: "date" }]} />
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}
