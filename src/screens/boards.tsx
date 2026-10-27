/** Grid screens: offer approvals inbox (v1 ApprovalInbox), work-order resource board, leave timeline. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api, API_BASE } from "@/api/client";
import { RelatedSelect } from "@/components/inputs";
import { Alert, Badge, Button, EmptyState, Field, Spinner } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { useInvalidateResource, useMeta } from "@/meta/hooks";

import { ActionButton } from "./actions";

type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const iso = (d: Date) => d.toISOString().slice(0, 10);

// ── offer approvals ────────────────────────────────────────────────────────

const OFFERS = `${API_BASE}/offers/offers/`;

export function OfferApprovals() {
  const [mine, setMine] = useState(false);
  const q = useQuery({ queryKey: ["offer-approvals", mine], queryFn: () => api.get<Data>("/offers/offers/approval-inbox/", { mine: mine ? 1 : undefined }) });
  const meta = useMeta(OFFERS);
  const invalidate = useInvalidateResource(OFFERS);
  const decide = (meta.data?.actions ?? []).filter((a) => ["approve", "reject", "return"].includes(a.url_path));
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Одобрувања на понуди</h1>
        <span className="spacer" />
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Само мои ({q.data?.count_mine ?? 0})
        </label>
      </div>
      {q.isLoading ? <Spinner /> : !q.data?.rows.length ? <EmptyState>Нема понуди што чекаат одобрување.</EmptyState> : (
        <div className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Понуда</th><th>Клиент</th><th>Статус</th><th>Ниво</th><th>Причини</th><th className="num">Вкупно</th><th /></tr></thead>
              <tbody>
                {q.data.rows.map((r: Data) => (
                  <tr key={r.id}>
                    <td><Link to={`/offers/offers/${r.id}`}>{r.offer_number || `#${r.id}`}</Link>{r.special ? <> <Badge tone="warning">посебно</Badge></> : null}</td>
                    <td>{r.client}</td>
                    <td>{r.status_label}</td>
                    <td>{r.level_label || r.level}</td>
                    <td className="small">{(r.reasons as string[]).join("; ")}</td>
                    <td className="num">{formatMoney(r.total)}</td>
                    <td className="nowrap">
                      {r.can_approve && meta.data ? decide.map((a) => (
                        <ActionButton key={a.name} meta={meta.data!} action={a} row={{ id: r.id, status: r.status, version: r.version }}
                          onDone={() => { void q.refetch(); invalidate(); }} />
                      )) : <span className="small muted">друго ниво</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── resource board ─────────────────────────────────────────────────────────

function Cell({ day }: { day: Data }) {
  if (!day.work_orders.length) return <td className="board-cell" />;
  return (
    <td className={`board-cell${day.conflict ? " conflict" : " busy"}`} title={day.conflict ? "Двојно резервирано" : undefined}>
      {day.work_orders.map((w: Data) => (
        <Link key={w.id} to={`/workorders/work-orders/${w.id}`} className="board-item">
          <span className="mono">{w.wo_number || `#${w.id}`}</span>
          <div className="small muted">{w.project}</div>
        </Link>
      ))}
    </td>
  );
}

export function ResourceBoard() {
  const [week, setWeek] = useState("");
  const q = useQuery({ queryKey: ["resource-board", week], queryFn: () => api.get<Data>("/workorders/work-orders/resource-board/", { week: week || undefined }) });
  const d = q.data;
  const grid = (title: string, list: Data[]) => (
    <div className="card flush">
      <div className="table-wrap">
        <table className="table board">
          <thead><tr><th>{title}</th>{d!.days.map((day: Data) => <th key={day.date} className={day.is_today ? "today" : undefined}>{day.label} {formatDate(day.date).slice(0, 5)}</th>)}</tr></thead>
          <tbody>
            {list.length ? list.map((r) => (
              <tr key={r.id}><th scope="row">{r.name}</th>{r.days.map((day: Data) => <Cell key={day.date} day={day} />)}</tr>
            )) : <tr><td colSpan={8} className="muted" style={{ textAlign: "center" }}>Нема распоредени.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Распоред на ресурси</h1>
        <span className="spacer" />
        {d ? <>
          <Button size="sm" onClick={() => setWeek(d.prev_week)}>← Претходна</Button>
          <strong>{d.label}</strong>
          <Button size="sm" onClick={() => setWeek(d.next_week)}>Следна →</Button>
          <Button size="sm" onClick={() => setWeek("")}>Оваа недела</Button>
        </> : null}
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <Alert tone="danger">{(q.error as Error).message}</Alert> : d ? <>
        <p className="small muted" style={{ margin: 0 }}>Црвено: ист ресурс на два налози во ист ден.</p>
        {grid("Возила / машини", d.vehicles)}
        {grid("Работници", d.workers)}
      </> : null}
    </div>
  );
}

// ── leave timeline ─────────────────────────────────────────────────────────

const SCALES: [string, string][] = [["month", "Месец"], ["quarter", "Квартал (по недели)"], ["year", "Година"], ["range", "Период"]];

export function LeaveTimeline() {
  const today = iso(new Date());
  const [scale, setScale] = useState("month");
  const [anchor, setAnchor] = useState(today);
  const [range, setRange] = useState({ from: "", to: "" });
  const [department, setDepartment] = useState<number | null>(null);
  const [everyone, setEveryone] = useState(false);
  const query = {
    scale: scale === "range" ? undefined : scale, anchor,
    from: scale === "range" ? range.from || undefined : undefined, to: scale === "range" ? range.to || undefined : undefined,
    department: department ?? undefined, all_employees: everyone ? 1 : undefined,
  };
  const q = useQuery({ queryKey: ["leave-timeline", query], queryFn: () => api.get<Data>("/hr/leaves/timeline/", query),
    enabled: scale !== "range" || Boolean(range.from && range.to) });
  const d = q.data;
  const move = (dir: 1 | -1) => {
    if (!d) return;
    if (d.scale === "range") setRange({ from: dir > 0 ? d.next_from : d.prev_from, to: dir > 0 ? d.next_to : d.prev_to });
    else setAnchor(dir > 0 ? d.next_anchor : d.prev_anchor);
  };
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Отсуства — распоред</h1>
        <span className="spacer" />
        <Field label="Приказ" htmlFor="lt-scale">
          <select id="lt-scale" className="input" value={scale} onChange={(e) => setScale(e.target.value)}>
            {SCALES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </Field>
        {scale === "range" ? <>
          <Field label="Од" htmlFor="lt-from"><input id="lt-from" type="date" className="input" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></Field>
          <Field label="До" htmlFor="lt-to"><input id="lt-to" type="date" className="input" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></Field>
        </> : null}
        <Field label="Одделение" htmlFor="lt-dept">
          <RelatedSelect id="lt-dept" related={{ endpoint: `${API_BASE}/org/departments/` }} value={department} onChange={(v) => setDepartment(v)} placeholder="Сите" />
        </Field>
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} /> Сите вработени</label>
      </div>
      {scale === "range" && !(range.from && range.to) ? <p className="muted">Изберете период (најмногу 186 дена).</p> : null}
      {q.isLoading ? <Spinner /> : d ? <>
        <div className="row">
          <Button size="sm" onClick={() => move(-1)}>←</Button>
          <strong>{d.period_label}</strong>
          <Button size="sm" onClick={() => move(1)}>→</Button>
          {d.scale !== "range" ? <Button size="sm" onClick={() => setAnchor(today)}>Денес</Button> : null}
          <span style={{ flex: 1 }} />
          {d.legend.map((l: Data) => <span key={l.category} className={`leave-chip leave-${String(l.category).toLowerCase()}`}>{l.label}</span>)}
        </div>
        {!d.rows.length ? <EmptyState>Нема отсуства во периодот.</EmptyState> : (
          <div className="card flush">
            <div className="table-wrap">
              <table className="table timeline">
                <thead>
                  {d.month_groups.length ? <tr><th />{d.month_groups.map((g: Data, i: number) => <th key={i} colSpan={g.span} className="small">{g.label}</th>)}</tr> : null}
                  <tr><th>Вработен</th>{d.columns.map((c: Data, i: number) => <th key={i} className={`${c.is_weekend ? "weekend" : ""}${c.is_current ? " today" : ""}`}>{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {d.rows.map((r: Data) => (
                    <tr key={r.employee}>
                      <th scope="row" className="nowrap">{r.employee_name}</th>
                      {r.cells.map((c: Data, i: number) => (
                        <td key={i} className={`${c.is_weekend ? "weekend" : ""}${c.category ? ` leave-${String(c.category).toLowerCase()}` : ""}`}
                          title={c.category ? `${c.category_label} ${c.range}` : undefined} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </> : null}
    </div>
  );
}

