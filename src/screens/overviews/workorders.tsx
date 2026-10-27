/** Work orders overview: the approval stages as a lane, open orders by stage, this week's plan, and the orders
 * waiting on the current user. */
import { Link } from "react-router-dom";

import { asRows, DataTable, ShareBar, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Badge, EmptyState, LinkButton, Panel, statusTone } from "@/components/ui";
import { formatDate, num } from "@/lib/format";

import { listUrl, Overview } from "./common";

const WO = "workorders/work-orders";

export function WorkOrdersOverview() {
  const q = useOverview<Data>("/workorders/work-orders/dashboard/");
  const wo = (r: Data) => `/${WO}/${r.id}`;
  return (
    <Overview title="Работни налози" q={q} actions={<>
      <LinkButton to="/workorders/resource-board">Распоред на ресурси</LinkButton>
      <LinkButton to={`/${WO}/new`} variant="primary">Нов налог</LinkButton>
    </>}>
      {(d) => {
        const mine = asRows(d.my_actions);
        const week = asRows(d.week);
        const summary = asRows(d.status_summary);
        return (
          <>
            <StatusBand title="Одобрување на налози" total={mine.length ? `${mine.length} чекаат ваша акција` : "ништо не чека на вас"} stages={[
              { key: "review", label: "Оперативен преглед", count: d.pending.review, attention: true, to: listUrl(WO, { status: "SUBMITTED" }) },
              { key: "log", label: "Логистика", count: d.pending.logistics, attention: true, to: listUrl(WO, { status: "PENDING_LOGISTICS" }) },
              { key: "mat", label: "Материјали", count: d.pending.materials, attention: true, to: listUrl(WO, { status: "PENDING_MATERIALS" }) },
              { key: "hse", label: "Безбедност (HSE)", count: d.pending.hse, attention: true, to: listUrl(WO, { status: "PENDING_HSE" }) },
              { key: "final", label: "Конечно одобрување", count: d.pending.final, attention: true, to: listUrl(WO, { status: "READY_FOR_APPROVAL" }) },
            ]} />
            <div className="grid-2">
              <Panel title="Чекаат ваша акција" sub="Налози каде што следниот чекор е ваш" flush>
                <DataTable rows={mine} empty="Нема налози што чекаат на вас" columns={[
                  { key: "wo_number", label: "Налог", to: wo, render: (r) => String(r.wo_number || `#${r.id}`) }, { key: "project", label: "Проект" },
                  { key: "work_date", label: "Датум", kind: "date" },
                  { key: "status_label", label: "Статус", render: (r) => <Badge tone={statusTone(String(r.status ?? ""))}>{String(r.status_label)}</Badge> }]} />
              </Panel>
              <Panel title="Отворени налози по фаза">
                {summary.length ? <ShareBar parts={summary.map((s) => ({ label: String(s.label), value: num(s.count) }))} />
                  : <EmptyState compact title="Нема отворени налози" />}
              </Panel>
            </div>
            <Panel title="План за неделата" sub={week.length ? `${formatDate(week[0].date)} – ${formatDate(week[week.length - 1].date)}` : undefined}>
              <div className="week-plan">
                {week.map((day) => (
                  <section key={String(day.date)} className={`week-day${day.is_today ? " today" : ""}`} aria-label={`${day.day} ${formatDate(day.date)}`}>
                    <header className="week-day-head">
                      <strong>{String(day.day)}</strong>
                      <span className="xs muted">{formatDate(day.date).slice(0, 5)}</span>
                      {day.is_today ? <Badge tone="accent" plain>денес</Badge> : day.is_tomorrow ? <Badge plain>утре</Badge> : null}
                    </header>
                    {asRows(day.work_orders).length ? asRows(day.work_orders).map((w) => (
                      <Link key={String(w.id)} to={wo(w)} className="week-item">
                        <span className="strong">{String(w.wo_number || `#${w.id}`)}</span>
                        <span className="truncate small">{String(w.project ?? "")}</span>
                        <span className="xs muted">{String(w.status_label ?? "")}</span>
                      </Link>
                    )) : <span className="xs muted">Слободно</span>}
                  </section>
                ))}
              </div>
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}
