/** Portfolio-wide screens: budget vs actual for every project, and the analytics dashboard. */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { Alert, Badge, Button, Spinner } from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/format";

interface BudgetRow {
  project: number;
  project_name: string;
  budget: number | null;
  total_budget: string;
  total_actual: string;
  committed: string;
  pct: number;
  overrun: boolean;
  alert: boolean;
}

export function BudgetPortfolio() {
  const q = useQuery({ queryKey: ["budget-portfolio"], queryFn: () => api.get<{ rows: BudgetRow[] }>("/budget/budgets/portfolio/") });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <Alert tone="danger">{(q.error as Error).message}</Alert>;
  return (
    <div className="stack">
      <div className="page-head"><h1>Буџет по проекти</h1></div>
      <div className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Проект</th><th className="num">Буџет</th><th className="num">Потрошено</th><th className="num">Нарачано</th><th className="num">%</th><th /></tr></thead>
            <tbody>
              {q.data!.rows.map((r) => (
                <tr key={r.project}>
                  <td>{r.budget ? <Link to={`/budget/budgets/${r.budget}`}>{r.project_name}</Link> : <Link to={`/projects/projects/${r.project}`}>{r.project_name}</Link>}</td>
                  <td className="num">{formatMoney(r.total_budget)}</td>
                  <td className="num">{formatMoney(r.total_actual)}</td>
                  <td className="num">{formatMoney(r.committed)}</td>
                  <td className="num">{r.pct}%</td>
                  <td>{r.overrun ? <Badge tone="danger">надминат</Badge> : r.alert ? <Badge tone="warning">праг</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface Profitability {
  rows: { id: number; name: string; revenue: string; cost: string; margin: string; margin_pct: number; billed: string; collected: string; uncollected: string; overrun: boolean }[];
  project_count: number;
  tot_rev: string; tot_cost: string; tot_margin: string; tot_margin_pct: number; tot_billed: string; tot_collected: string; tot_uncollected: string;
  overruns: number;
  cost_rows: { label: string; amount: string; pct: number }[];
  calculated_at: string;
}

interface Operations {
  proc_invoiced: string; proc_committed: string; fuel: string; vehicles: number; docs_soon: number; docs_expired: number;
}

function Bar({ pct }: { pct: number }) {
  return (
    <div style={{ background: "var(--rule)", borderRadius: 4, height: 8, width: 160 }}>
      <div style={{ background: "var(--accent-2)", width: `${Math.min(100, Math.max(0, pct))}%`, height: 8, borderRadius: 4 }} />
    </div>
  );
}

export function Analytics() {
  const prof = useQuery({ queryKey: ["analytics", "profitability"], queryFn: () => api.get<Profitability>("/analytics/profitability/") });
  const ops = useQuery({ queryKey: ["analytics", "operations"], queryFn: () => api.get<Operations>("/analytics/operations/") });
  if (prof.isLoading) return <Spinner />;
  if (prof.error) return <Alert tone="danger">{(prof.error as Error).message}</Alert>;
  const p = prof.data!;
  const o = ops.data;
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Аналитика</h1>
        <span className="spacer" />
        <span className="small muted">Пресметано {formatDateTime(p.calculated_at)}</span>
        <Button size="sm" onClick={async () => {
          await Promise.all([api.get("/analytics/profitability/", { refresh: 1 }), api.get("/analytics/operations/", { refresh: 1 })]);
          void prof.refetch(); void ops.refetch();
        }}>Освежи</Button>
      </div>
      <div className="kpis">
        <div className="card kpi"><div className="label">Вредност на договори</div><div className="value">{formatMoney(p.tot_rev)}</div></div>
        <div className="card kpi"><div className="label">Трошоци</div><div className="value">{formatMoney(p.tot_cost)}</div></div>
        <div className="card kpi"><div className="label">Маржа</div><div className="value">{formatMoney(p.tot_margin)} ({p.tot_margin_pct}%)</div></div>
        <div className="card kpi"><div className="label">Фактурирано / наплатено</div><div className="value">{formatMoney(p.tot_billed)} / {formatMoney(p.tot_collected)}</div></div>
        <div className="card kpi"><div className="label">Проекти над буџет</div><div className="value">{p.overruns}</div></div>
        {o ? <>
          <div className="card kpi"><div className="label">Набавки (фактурирано)</div><div className="value">{formatMoney(o.proc_invoiced)}</div></div>
          <div className="card kpi"><div className="label">Гориво</div><div className="value">{formatMoney(o.fuel)}</div></div>
          <div className="card kpi"><div className="label">Документи: истекуваат / истечени</div><div className="value">{o.docs_soon} / {o.docs_expired}</div></div>
        </> : null}
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Структура на трошоците</h2>
          <table className="table"><tbody>
            {p.cost_rows.map((c) => <tr key={c.label}><td>{c.label}</td><td><Bar pct={c.pct} /></td><td className="num">{formatMoney(c.amount)}</td></tr>)}
          </tbody></table>
        </div>
        <div className="card">
          <h2>Профитабилност по проект</h2>
          <table className="table">
            <thead><tr><th>Проект</th><th className="num">Приход</th><th className="num">Трошок</th><th className="num">Маржа %</th></tr></thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/projects/projects/${r.id}`}>{r.name}</Link> {r.overrun ? <Badge tone="danger">!</Badge> : null}</td>
                  <td className="num">{formatMoney(r.revenue)}</td>
                  <td className="num">{formatMoney(r.cost)}</td>
                  <td className="num">{r.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
