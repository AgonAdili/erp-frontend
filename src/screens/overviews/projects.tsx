/** Projects overview (open projects: value, executed, invoiced, deadlines) and the budget portfolio
 * (budget vs actual vs committed for every project). */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { Bullet, Kpi, Kpis, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Badge, EmptyState, ErrorState, LinkButton, PageHeader, Panel, Segmented, SkeletonPanel } from "@/components/ui";
import { Page } from "@/layout/Page";
import { formatWhole, formatDate, formatMoney, formatNumber, num } from "@/lib/format";
import { useStored } from "@/app/prefs";

import { listUrl, Overview } from "./common";
import { tr } from "@/i18n";

const P = "projects/projects";

export function ProjectsOverview() {
  const q = useOverview<Data>("/projects/projects/portfolio/");
  return (
    <Overview title={tr("Проекти")} q={q} actions={<>
      <LinkButton to="/budget/portfolio">{tr("Буџет по проекти")}</LinkButton>
      <LinkButton to={`/${P}/new`} variant="primary">{tr("Нов проект")}</LinkButton>
    </>}>
      {(d) => {
        const rows = (d.rows ?? []) as Data[];
        const value = num(d.value_open), executed = num(d.executed_open), invoiced = num(d.invoiced_open);
        return (
          <>
            <StatusBand title={tr("Проекти по статус")} total={tr("{0} вкупно", formatNumber(d.total, 0))} stages={[
              { key: "active", label: tr("Активни"), count: d.by_status.ACTIVE, to: listUrl(P, { status: "ACTIVE" }),
                sub: d.overdue ? tr("{0} по рокот", d.overdue) : undefined, danger: false },
              { key: "hold", label: tr("Паузирани"), count: d.by_status.ON_HOLD, attention: true, to: listUrl(P, { status: "ON_HOLD" }) },
              { key: "done", label: tr("Завршени"), count: d.by_status.FINISHED, done: true, to: listUrl(P, { status: "FINISHED" }) },
            ]} />
            <Kpis>
              <Kpi label={tr("Вредност на отворените")} value={formatWhole(value)} unit="MKD" sub={tr("{0} активни и паузирани", rows.length)} />
              <Kpi label={tr("Изведено")} value={formatWhole(executed)} unit="MKD" sub={value ? tr("{0} % од вредноста", formatNumber((executed / value) * 100, 1)) : undefined} />
              <Kpi label={tr("Фактурирано (платени ситуации)")} value={formatWhole(invoiced)} unit="MKD" sub={executed ? tr("{0} % од изведеното", formatNumber((invoiced / executed) * 100, 1)) : undefined} />
              <Kpi label={tr("По договорениот рок")} value={formatNumber(d.overdue, 0)} sub={tr("отворени проекти со поминат рок")} tone={d.overdue ? "alarm" : undefined} />
            </Kpis>
            <Panel title={tr("Отворени проекти")} sub={tr("Изведено (темно) и фактурирано наспроти вредноста (линија)")} flush>
              {!rows.length ? <EmptyState compact title={tr("Нема отворени проекти")} /> : (
                <div className="table-responsive table-wrap">
                  <table className="table ea-table">
                    <thead><tr><th>{tr("Проект")}</th><th>{tr("Инвеститор")}</th><th className="num">{tr("Вредност")}</th><th style={{ width: "26%" }}>{tr("Извршување")}</th><th className="num">{tr("Изведено")}</th><th>{tr("Рок")}</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={String(r.id)}>
                          <td><Link to={`/${P}/${r.id}`}>{String(r.name)}</Link>{r.code ? <div className="xs muted">{String(r.code)}</div> : null}</td>
                          <td className="small">{String(r.customer || "") || <span className="muted-cell">—</span>}</td>
                          <td className="num">{formatMoney(r.value)}</td>
                          <td><Bullet budget={num(r.value)} actual={num(r.invoiced)} committed={Math.max(0, num(r.executed) - num(r.invoiced))} /></td>
                          <td className="num">{formatNumber(r.progress_pct, 1)} %</td>
                          <td className="nowrap">{r.deadline ? <Badge tone={r.overdue ? "danger" : ""} plain={!r.overdue}>{formatDate(r.deadline)}</Badge> : <span className="muted-cell">—</span>}
                            {r.status === "ON_HOLD" ? <div><Badge tone="warning">{tr("паузиран")}</Badge></div> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}

interface BudgetRow {
  project: number; project_name: string; budget: number | null; total_budget: string; total_actual: string;
  committed: string; pct: number; overrun: boolean; alert: boolean;
}

type Sort = "pct" | "budget" | "name";

export function BudgetPortfolio() {
  const q = useQuery({ queryKey: ["budget-portfolio"], queryFn: () => api.get<{ rows: BudgetRow[] }>("/budget/budgets/portfolio/") });
  const [sort, setSort] = useStored<Sort>("budgetSort", "pct");
  const rows = [...(q.data?.rows ?? [])].sort((a, b) =>
    sort === "name" ? a.project_name.localeCompare(b.project_name, "mk") : sort === "budget" ? num(b.total_budget) - num(a.total_budget) : b.pct - a.pct);
  const tot = rows.reduce((s, r) => ({ b: s.b + num(r.total_budget), a: s.a + num(r.total_actual), c: s.c + num(r.committed) }), { b: 0, a: 0, c: 0 });
  const over = rows.filter((r) => r.overrun).length, near = rows.filter((r) => r.alert && !r.overrun).length;
  return (
    <Page title={tr("Буџет по проекти")}>
      <PageHeader title={tr("Буџет по проекти")} subtitle={tr("Потрошено и нарачано наспроти планираниот буџет")}
        actions={<LinkButton to="/budget/budgets/new" variant="primary">{tr("Нов буџет")}</LinkButton>} />
      {q.isLoading ? <SkeletonPanel height={360} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
        <>
          <Kpis>
            <Kpi label={tr("Вкупен буџет")} value={formatWhole(tot.b)} unit="MKD" sub={tr("{0} проекти", rows.length)} />
            <Kpi label={tr("Потрошено")} value={formatWhole(tot.a)} unit="MKD" sub={tot.b ? tr("{0} % од буџетот", formatNumber((tot.a / tot.b) * 100, 1)) : undefined} />
            <Kpi label={tr("Нарачано, неплатено")} value={formatWhole(tot.c)} unit="MKD" />
            <Kpi label={tr("Надминати / близу прагот")} value={`${over} / ${near}`} tone={over ? "alarm" : near ? "attention" : undefined} />
          </Kpis>
          <Panel title={tr("Проекти")} flush actions={<Segmented label={tr("Подреди")} value={sort} onChange={setSort}
            options={[{ value: "pct", label: tr("% искористеност") }, { value: "budget", label: tr("Буџет") }, { value: "name", label: tr("Име") }]} />}>
            {!rows.length ? <EmptyState compact title={tr("Нема буџети")} /> : (
              <div className="table-responsive table-wrap">
                <table className="table ea-table">
                  <thead><tr><th>{tr("Проект")}</th><th style={{ width: "30%" }}>{tr("Искористеност")}</th><th className="num">{tr("Буџет")}</th><th className="num">{tr("Потрошено")}</th><th className="num">{tr("Нарачано")}</th><th className="num">%</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.project}>
                        <td>
                          <Link to={r.budget ? `/budget/budgets/${r.budget}` : `/${P}/${r.project}`}>{r.project_name}</Link>{" "}
                          {r.overrun ? <Badge tone="danger">{tr("надминат")}</Badge> : r.alert ? <Badge tone="warning">{tr("близу прагот")}</Badge> : null}
                        </td>
                        <td><Bullet budget={num(r.total_budget)} actual={num(r.total_actual)} committed={num(r.committed)} /></td>
                        <td className="num">{formatMoney(r.total_budget)}</td>
                        <td className="num">{formatMoney(r.total_actual)}</td>
                        <td className="num">{formatMoney(r.committed)}</td>
                        <td className={`num${r.overrun ? " tone-danger strong" : ""}`}>{formatNumber(r.pct, 0)} %</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>{tr("Вкупно")}</td><td /><td className="num">{formatMoney(tot.b)}</td><td className="num">{formatMoney(tot.a)}</td><td className="num">{formatMoney(tot.c)}</td>
                    <td className="num">{tot.b ? `${formatNumber((tot.a / tot.b) * 100, 0)} %` : ""}</td></tr></tfoot>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}
