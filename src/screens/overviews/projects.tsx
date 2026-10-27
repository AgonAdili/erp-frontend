/** Projects overview (open projects: value, executed, invoiced, deadlines) and the budget portfolio
 * (budget vs actual vs committed for every project). */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { Bullet, Kpi, Kpis, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Badge, EmptyState, ErrorState, LinkButton, PageHeader, Panel, Segmented, SkeletonPanel } from "@/components/ui";
import { Page } from "@/layout/Page";
import { formatCompact, formatDate, formatMoney, formatNumber, num } from "@/lib/format";
import { useStored } from "@/app/prefs";

import { listUrl, Overview } from "./common";

const P = "projects/projects";

export function ProjectsOverview() {
  const q = useOverview<Data>("/projects/projects/portfolio/");
  return (
    <Overview title="Проекти" q={q} actions={<>
      <LinkButton to="/budget/portfolio">Буџет по проекти</LinkButton>
      <LinkButton to={`/${P}/new`} variant="primary">Нов проект</LinkButton>
    </>}>
      {(d) => {
        const rows = (d.rows ?? []) as Data[];
        const value = num(d.value_open), executed = num(d.executed_open), invoiced = num(d.invoiced_open);
        return (
          <>
            <StatusBand title="Проекти по статус" total={`${formatNumber(d.total, 0)} вкупно`} stages={[
              { key: "active", label: "Активни", count: d.by_status.ACTIVE, to: listUrl(P, { status: "ACTIVE" }),
                sub: d.overdue ? `${d.overdue} по рокот` : undefined, danger: false },
              { key: "hold", label: "Паузирани", count: d.by_status.ON_HOLD, attention: true, to: listUrl(P, { status: "ON_HOLD" }) },
              { key: "done", label: "Завршени", count: d.by_status.FINISHED, done: true, to: listUrl(P, { status: "FINISHED" }) },
            ]} />
            <Kpis>
              <Kpi label="Вредност на отворените" value={formatCompact(value)} unit="ден." sub={`${rows.length} активни и паузирани`} />
              <Kpi label="Изведено" value={formatCompact(executed)} unit="ден." sub={value ? `${formatNumber((executed / value) * 100, 1)}% од вредноста` : undefined} />
              <Kpi label="Фактурирано (платени ситуации)" value={formatCompact(invoiced)} unit="ден." sub={executed ? `${formatNumber((invoiced / executed) * 100, 1)}% од изведеното` : undefined} />
              <Kpi label="По договорениот рок" value={formatNumber(d.overdue, 0)} sub="отворени проекти со поминат рок" tone={d.overdue ? "alarm" : undefined} />
            </Kpis>
            <Panel title="Отворени проекти" sub="Изведено (темно) и фактурирано наспроти вредноста (линија)" flush>
              {!rows.length ? <EmptyState compact title="Нема отворени проекти" /> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Проект</th><th>Инвеститор</th><th className="num">Вредност</th><th style={{ width: "26%" }}>Извршување</th><th className="num">Изведено</th><th>Рок</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={String(r.id)}>
                          <td><Link to={`/${P}/${r.id}`}>{String(r.name)}</Link>{r.code ? <div className="xs muted">{String(r.code)}</div> : null}</td>
                          <td className="small">{String(r.customer || "") || <span className="muted-cell">—</span>}</td>
                          <td className="num">{formatMoney(r.value)}</td>
                          <td><Bullet budget={num(r.value)} actual={num(r.invoiced)} committed={Math.max(0, num(r.executed) - num(r.invoiced))} /></td>
                          <td className="num">{formatNumber(r.progress_pct, 1)}%</td>
                          <td className="nowrap">{r.deadline ? <Badge tone={r.overdue ? "danger" : ""} plain={!r.overdue}>{formatDate(r.deadline)}</Badge> : <span className="muted-cell">—</span>}
                            {r.status === "ON_HOLD" ? <div><Badge tone="warning">паузиран</Badge></div> : null}</td>
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
    <Page title="Буџет по проекти">
      <PageHeader title="Буџет по проекти" subtitle="Потрошено и нарачано наспроти планираниот буџет"
        actions={<LinkButton to="/budget/budgets/new" variant="primary">Нов буџет</LinkButton>} />
      {q.isLoading ? <SkeletonPanel height={360} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
        <>
          <Kpis>
            <Kpi label="Вкупен буџет" value={formatCompact(tot.b)} unit="ден." sub={`${rows.length} проекти`} />
            <Kpi label="Потрошено" value={formatCompact(tot.a)} unit="ден." sub={tot.b ? `${formatNumber((tot.a / tot.b) * 100, 1)}% од буџетот` : undefined} />
            <Kpi label="Нарачано, неплатено" value={formatCompact(tot.c)} unit="ден." />
            <Kpi label="Надминати / близу прагот" value={`${over} / ${near}`} tone={over ? "alarm" : near ? "attention" : undefined} />
          </Kpis>
          <Panel title="Проекти" flush actions={<Segmented label="Подреди" value={sort} onChange={setSort}
            options={[{ value: "pct", label: "% искористеност" }, { value: "budget", label: "Буџет" }, { value: "name", label: "Име" }]} />}>
            {!rows.length ? <EmptyState compact title="Нема буџети" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Проект</th><th style={{ width: "30%" }}>Искористеност</th><th className="num">Буџет</th><th className="num">Потрошено</th><th className="num">Нарачано</th><th className="num">%</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.project}>
                        <td>
                          <Link to={r.budget ? `/budget/budgets/${r.budget}` : `/${P}/${r.project}`}>{r.project_name}</Link>{" "}
                          {r.overrun ? <Badge tone="danger">надминат</Badge> : r.alert ? <Badge tone="warning">близу прагот</Badge> : null}
                        </td>
                        <td><Bullet budget={num(r.total_budget)} actual={num(r.total_actual)} committed={num(r.committed)} /></td>
                        <td className="num">{formatMoney(r.total_budget)}</td>
                        <td className="num">{formatMoney(r.total_actual)}</td>
                        <td className="num">{formatMoney(r.committed)}</td>
                        <td className={`num${r.overrun ? " tone-danger strong" : ""}`}>{formatNumber(r.pct, 0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>Вкупно</td><td /><td className="num">{formatMoney(tot.b)}</td><td className="num">{formatMoney(tot.a)}</td><td className="num">{formatMoney(tot.c)}</td>
                    <td className="num">{tot.b ? `${formatNumber((tot.a / tot.b) * 100, 0)}%` : ""}</td></tr></tfoot>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}
