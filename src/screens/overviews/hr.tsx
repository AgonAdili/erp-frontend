/** People overview: headcount, who is in today, this month's attendance by reason, the payroll run's stage,
 * and pending loans and garnishments. */
import { HBars, Kpi, Kpis, ShareBar, StatusBand, useOverview } from "@/components/dashboard";
import { Alert, LinkButton, Panel } from "@/components/ui";
import { MONTHS } from "@/i18n/mk";
import { formatWhole, formatDateTime, formatMoney, formatNumber, num } from "@/lib/format";

import { listUrl, Overview } from "./common";
import { tr } from "@/i18n";

interface HrData {
  headcount: Record<string, number>;
  today: { present: number; on_leave: number };
  month: { by_reason: Record<string, number>; freshness?: { refreshed_at?: string | null; stale?: boolean } | null };
  payroll: Record<string, { count: number; total: string }>;
  loans_pending: number;
  bailiffs_active: number;
}

const REASON_LABEL: Record<string, string> = {
  PRESENT: tr("Присутни"), PAID_LEAVE: tr("Платено отсуство"), SICK_LEAVE: tr("Боледување"), MATERNITY_LEAVE: tr("Породилно"),
  FUNERAL_LEAVE: tr("Погреб"), UNPAID_LEAVE: tr("Неплатено"), UNANNOUNCED: tr("Неоправдано"),
};

export function HrOverview() {
  const q = useOverview<HrData>("/hr/attendance/dashboard/");
  const now = new Date();
  return (
    <Overview title={tr("Луѓе")} q={q} actions={<>
      <LinkButton to="/hr/attendance-day">{tr("Внеси присуство")}</LinkButton>
      <LinkButton to="/people/employees/new" variant="primary">{tr("Нов вработен")}</LinkButton>
    </>}>
      {(d) => {
        const active = d.headcount.ACTIVE ?? 0;
        const reasons = Object.entries(d.month.by_reason).sort((a, b) => b[1] - a[1]);
        const absent = reasons.filter(([k]) => k !== "PRESENT");
        const pay = (s: string) => d.payroll[s] ?? { count: 0, total: "0" };
        const payTotal = Object.values(d.payroll).reduce((s, p) => s + num(p.total), 0);
        return (
          <>
            <StatusBand title={tr("Плати за {0} {1}", MONTHS[now.getMonth()].toLowerCase(), now.getFullYear())} total={payTotal ? tr("{0} MKD вкупно", formatWhole(payTotal)) : tr("сè уште нема пресметка")} stages={[
              { key: "draft", label: tr("Пресметани (нацрт)"), count: pay("DRAFT").count, attention: true, to: listUrl("hr/payroll", { status: "DRAFT", year: now.getFullYear(), month: now.getMonth() + 1 }),
                sub: num(pay("DRAFT").total) ? `${formatWhole(pay("DRAFT").total)} MKD` : undefined },
              { key: "approved", label: tr("Одобрени"), count: pay("APPROVED").count, to: listUrl("hr/payroll", { status: "APPROVED", year: now.getFullYear(), month: now.getMonth() + 1 }),
                sub: num(pay("APPROVED").total) ? `${formatWhole(pay("APPROVED").total)} MKD` : undefined },
              { key: "paid", label: tr("Исплатени"), count: pay("PAID").count, done: true, to: listUrl("hr/payroll", { status: "PAID", year: now.getFullYear(), month: now.getMonth() + 1 }),
                sub: num(pay("PAID").total) ? `${formatWhole(pay("PAID").total)} MKD` : undefined },
            ]} />
            <Kpis>
              <Kpi label={tr("Активни вработени")} value={formatNumber(active, 0)} sub={tr("{0} на одмор · {1} неактивни", d.headcount.HOLIDAY ?? 0, d.headcount.INACTIVE ?? 0)} to="/people/employees" />
              <Kpi label={tr("Присутни денес")} value={formatNumber(d.today.present, 0)} sub={active ? tr("{0} % од активните", formatNumber((d.today.present / active) * 100, 0)) : undefined} to="/hr/attendance-day" />
              <Kpi label={tr("На отсуство денес")} value={formatNumber(d.today.on_leave, 0)} to="/hr/leave-timeline" />
              <Kpi label={tr("Денови отсуство овој месец")} value={formatNumber(absent.reduce((a, [, v]) => a + v, 0), 0)} sub={absent.length ? tr("најчесто: {0}", (REASON_LABEL[absent[0][0]] ?? absent[0][0]).toLowerCase()) : undefined} to="/hr/leave-timeline" />
              <Kpi label={tr("Заеми за одобрување")} value={formatNumber(d.loans_pending, 0)} tone={d.loans_pending ? "attention" : undefined} to={listUrl("hr/loans", { status: "PENDING" })} />
              <Kpi label={tr("Активни извршувања")} value={formatNumber(d.bailiffs_active, 0)} to={listUrl("hr/bailiffs", { status: "ACTIVE" })} />
            </Kpis>
            {d.month.freshness?.stale ? <Alert tone="info">{tr("Месечните збирови се од")}{" "}{formatDateTime(d.month.freshness.refreshed_at)}{" "}{tr("и се освежуваат во позадина.")}</Alert> : null}
            <div className="grid-2">
              <Panel title={tr("Присуство овој месец")} sub={tr("Денови по вид, сите вработени")}>
                <ShareBar parts={reasons.map(([k, v]) => ({ label: REASON_LABEL[k] ?? k, value: v, color: k === "PRESENT" ? "var(--ea-chart-1)" : undefined }))} />
              </Panel>
              <Panel title={tr("Отсуства овој месец")} sub={tr("Денови по причина")}>
                <HBars unit="number" rows={absent.map(([k, v]) => ({ key: k, label: REASON_LABEL[k] ?? k, value: v, over: k === "UNANNOUNCED" }))} empty={tr("Нема отсуства")} />
              </Panel>
            </div>
            <Panel title={tr("Плати овој месец")} flush actions={<LinkButton to="/hr/payroll" size="sm">{tr("Сите плати")}</LinkButton>}>
              <div className="table-responsive table-wrap">
                <table className="table ea-table">
                  <thead><tr><th>{tr("Статус")}</th><th className="num">{tr("Вработени")}</th><th className="num">{tr("Вкупно")}</th></tr></thead>
                  <tbody>
                    {(["DRAFT", "APPROVED", "PAID"] as const).map((s) => (
                      <tr key={s}><td>{s === "DRAFT" ? tr("Нацрт") : s === "APPROVED" ? tr("Одобрено") : tr("Исплатено")}</td>
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
