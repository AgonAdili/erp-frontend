/** People overview: headcount, who is in today, this month's attendance by reason, the payroll run's stage,
 * and pending loans and garnishments. */
import { HBars, Kpi, Kpis, ShareBar, StatusBand, useOverview } from "@/components/dashboard";
import { Alert, LinkButton, Panel } from "@/components/ui";
import { MONTHS } from "@/i18n/mk";
import { formatCompact, formatDateTime, formatMoney, formatNumber, num } from "@/lib/format";

import { listUrl, Overview } from "./common";

interface HrData {
  headcount: Record<string, number>;
  today: { present: number; on_leave: number };
  month: { by_reason: Record<string, number>; freshness?: { refreshed_at?: string | null; stale?: boolean } | null };
  payroll: Record<string, { count: number; total: string }>;
  loans_pending: number;
  bailiffs_active: number;
}

const REASON_LABEL: Record<string, string> = {
  PRESENT: "Присутни", PAID_LEAVE: "Платено отсуство", SICK_LEAVE: "Боледување", MATERNITY_LEAVE: "Породилно",
  FUNERAL_LEAVE: "Погреб", UNPAID_LEAVE: "Неплатено", UNANNOUNCED: "Неоправдано",
};

export function HrOverview() {
  const q = useOverview<HrData>("/hr/attendance/dashboard/");
  const now = new Date();
  return (
    <Overview title="Луѓе" q={q} actions={<>
      <LinkButton to="/hr/attendance-day">Внеси присуство</LinkButton>
      <LinkButton to="/people/employees/new" variant="primary">Нов вработен</LinkButton>
    </>}>
      {(d) => {
        const active = d.headcount.ACTIVE ?? 0;
        const reasons = Object.entries(d.month.by_reason).sort((a, b) => b[1] - a[1]);
        const absent = reasons.filter(([k]) => k !== "PRESENT");
        const pay = (s: string) => d.payroll[s] ?? { count: 0, total: "0" };
        const payTotal = Object.values(d.payroll).reduce((s, p) => s + num(p.total), 0);
        return (
          <>
            <StatusBand title={`Плати за ${MONTHS[now.getMonth()].toLowerCase()} ${now.getFullYear()}`} total={payTotal ? `${formatCompact(payTotal)} ден. вкупно` : "сè уште нема пресметка"} stages={[
              { key: "draft", label: "Пресметани (нацрт)", count: pay("DRAFT").count, attention: true, to: listUrl("hr/payroll", { status: "DRAFT", year: now.getFullYear(), month: now.getMonth() + 1 }),
                sub: num(pay("DRAFT").total) ? `${formatCompact(pay("DRAFT").total)} ден.` : undefined },
              { key: "approved", label: "Одобрени", count: pay("APPROVED").count, to: listUrl("hr/payroll", { status: "APPROVED", year: now.getFullYear(), month: now.getMonth() + 1 }),
                sub: num(pay("APPROVED").total) ? `${formatCompact(pay("APPROVED").total)} ден.` : undefined },
              { key: "paid", label: "Исплатени", count: pay("PAID").count, done: true, to: listUrl("hr/payroll", { status: "PAID", year: now.getFullYear(), month: now.getMonth() + 1 }),
                sub: num(pay("PAID").total) ? `${formatCompact(pay("PAID").total)} ден.` : undefined },
            ]} />
            <Kpis>
              <Kpi label="Активни вработени" value={formatNumber(active, 0)} sub={`${d.headcount.HOLIDAY ?? 0} на одмор · ${d.headcount.INACTIVE ?? 0} неактивни`} to="/people/employees" />
              <Kpi label="Присутни денес" value={formatNumber(d.today.present, 0)} sub={active ? `${formatNumber((d.today.present / active) * 100, 0)}% од активните` : undefined} to="/hr/attendance-day" />
              <Kpi label="На отсуство денес" value={formatNumber(d.today.on_leave, 0)} to="/hr/leave-timeline" />
              <Kpi label="Денови отсуство овој месец" value={formatNumber(absent.reduce((a, [, v]) => a + v, 0), 0)} sub={absent.length ? `најчесто: ${(REASON_LABEL[absent[0][0]] ?? absent[0][0]).toLowerCase()}` : undefined} to="/hr/leave-timeline" />
              <Kpi label="Заеми за одобрување" value={formatNumber(d.loans_pending, 0)} tone={d.loans_pending ? "attention" : undefined} to={listUrl("hr/loans", { status: "PENDING" })} />
              <Kpi label="Активни извршувања" value={formatNumber(d.bailiffs_active, 0)} to={listUrl("hr/bailiffs", { status: "ACTIVE" })} />
            </Kpis>
            {d.month.freshness?.stale ? <Alert tone="info">Месечните збирови се од {formatDateTime(d.month.freshness.refreshed_at)} и се освежуваат во позадина.</Alert> : null}
            <div className="grid-2">
              <Panel title="Присуство овој месец" sub="Денови по вид, сите вработени">
                <ShareBar parts={reasons.map(([k, v]) => ({ label: REASON_LABEL[k] ?? k, value: v, color: k === "PRESENT" ? "var(--series-1)" : undefined }))} />
              </Panel>
              <Panel title="Отсуства овој месец" sub="Денови по причина">
                <HBars unit="number" rows={absent.map(([k, v]) => ({ key: k, label: REASON_LABEL[k] ?? k, value: v, over: k === "UNANNOUNCED" }))} empty="Нема отсуства" />
              </Panel>
            </div>
            <Panel title="Плати овој месец" flush actions={<LinkButton to="/hr/payroll" size="sm">Сите плати</LinkButton>}>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Статус</th><th className="num">Вработени</th><th className="num">Вкупно</th></tr></thead>
                  <tbody>
                    {(["DRAFT", "APPROVED", "PAID"] as const).map((s) => (
                      <tr key={s}><td>{s === "DRAFT" ? "Нацрт" : s === "APPROVED" ? "Одобрено" : "Исплатено"}</td>
                        <td className="num">{formatNumber(pay(s).count, 0)}</td><td className="num">{formatMoney(pay(s).total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}
