/** Grid screens: offer approvals inbox (v1 ApprovalInbox), work-order resource board, leave timeline. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { api, API_BASE } from "@/api/client";
import { Kpi, Kpis } from "@/components/dashboard";
import { RelatedSelect } from "@/components/inputs";
import { Badge, Button, EmptyState, ErrorState, Field, IconButton, LinkButton, PageHeader, Panel, Segmented, SkeletonRows, Switch } from "@/components/ui";
import { t } from "@/i18n/mk";
import { Page } from "@/layout/Page";
import { formatCompact, formatDate, formatMoney, todayISO } from "@/lib/format";
import { useInvalidateResource, useMeta } from "@/meta/hooks";

import { ActionButton } from "./actions";

type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ── offer approvals ────────────────────────────────────────────────────────

const OFFERS = `${API_BASE}/offers/offers/`;

export function OfferApprovals() {
  const [mine, setMine] = useState(false);
  const q = useQuery({ queryKey: ["offer-approvals", mine], queryFn: () => api.get<Data>("/offers/offers/approval-inbox/", { mine: mine ? 1 : undefined }) });
  const meta = useMeta(OFFERS);
  const invalidate = useInvalidateResource(OFFERS);
  const decide = (meta.data?.actions ?? []).filter((a) => ["approve", "reject", "return"].includes(a.url_path));
  const rows = (q.data?.rows ?? []) as Data[];
  const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  return (
    <Page title="Одобрување понуди">
      <PageHeader title="Одобрување понуди" subtitle="Понуди што чекаат одобрување пред да се испратат до клиентот"
        actions={<Switch checked={mine} onChange={setMine} label={`Само тие што јас ги одобрувам (${q.data?.count_mine ?? 0})`} />} />
      {q.data ? (
        <Kpis>
          <Kpi label="Чекаат одобрување" value={q.data.count_total} />
          <Kpi label="Чекаат мене" value={q.data.count_mine} tone={q.data.count_mine ? "attention" : undefined} />
          <Kpi label="Вкупна вредност" value={formatCompact(total)} unit="ден." />
        </Kpis>
      ) : null}
      <Panel flush>
        {q.isLoading ? <SkeletonRows rows={6} cols={6} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !rows.length ? (
          <EmptyState title="Нема понуди што чекаат одобрување">{mine ? "Исклучете „Само тие што јас ги одобрувам“ за да ги видите сите." : undefined}</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Понуда</th><th>Клиент</th><th>Ниво</th><th>Зошто треба одобрување</th><th className="num">Вкупно</th><th aria-label={t.actions} /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap"><Link to={`/offers/offers/${r.id}`}>{r.offer_number || `#${r.id}`}</Link>{r.special ? <> <Badge tone="warning">посебно</Badge></> : null}
                      {r.prepared_by ? <div className="xs muted">{r.prepared_by}</div> : null}</td>
                    <td>{r.client}</td>
                    <td><Badge tone="info" plain>{r.level_label || r.level}</Badge></td>
                    <td className="small wrap">{(r.reasons as string[]).length ? (r.reasons as string[]).join("; ") : <span className="muted">според износот</span>}</td>
                    <td className="num">{formatMoney(r.total)}</td>
                    <td className="right nowrap">
                      {r.can_approve && meta.data ? (
                        <div className="row-tight" style={{ justifyContent: "flex-end" }}>
                          {decide.map((a) => (
                            <ActionButton key={a.name} meta={meta.data!} action={a} row={{ id: r.id, status: r.status, version: r.version }}
                              variant={a.url_path === "approve" ? "primary" : "default"} onDone={() => { void q.refetch(); invalidate(); }} />
                          ))}
                        </div>
                      ) : <span className="small muted">одобрува друго ниво</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}

// ── resource board ─────────────────────────────────────────────────────────

function Cell({ day }: { day: Data }) {
  if (!day.work_orders.length) return <td className="board-cell" />;
  return (
    <td className={`board-cell${day.conflict ? " conflict" : " busy"}`} title={day.conflict ? "Ист ресурс на два налози во ист ден" : undefined}>
      {day.work_orders.map((w: Data) => (
        <Link key={w.id} to={`/workorders/work-orders/${w.id}`} className="board-item">
          <span className="strong small">{w.wo_number || `#${w.id}`}</span>
          <span className="xs muted truncate" style={{ display: "block" }}>{w.project}</span>
        </Link>
      ))}
    </td>
  );
}

export function ResourceBoard() {
  const [week, setWeek] = useState("");
  const q = useQuery({ queryKey: ["resource-board", week], queryFn: () => api.get<Data>("/workorders/work-orders/resource-board/", { week: week || undefined }), placeholderData: (p) => p });
  const d = q.data;
  const conflicts = d ? [...d.vehicles, ...d.workers].reduce((s: number, r: Data) => s + r.days.filter((x: Data) => x.conflict).length, 0) : 0;
  const grid = (title: string, list: Data[]) => (
    <Panel title={title} sub={`${list.length} распоредени`} flush>
      <div className="table-wrap">
        <table className="table board lined">
          <thead><tr><th className="sticky-col">{title}</th>{d!.days.map((day: Data) => (
            <th key={day.date} className={day.is_today ? "today" : undefined}>{day.label} <span className="muted">{formatDate(day.date).slice(0, 5)}</span></th>
          ))}</tr></thead>
          <tbody>
            {list.length ? list.map((r) => (
              <tr key={r.id}><th scope="row" className="sticky-col">{r.name}</th>{r.days.map((day: Data) => <Cell key={day.date} day={day} />)}</tr>
            )) : <tr><td colSpan={8}><EmptyState compact title="Нема распоредени оваа недела" /></td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  );
  return (
    <Page title="Распоред на ресурси">
      <PageHeader title="Распоред на ресурси" subtitle={d ? d.label : "Возила, машини и работници по ден"}
        actions={d ? <>
          <IconButton label="Претходна недела" icon={ChevronLeft} variant="default" onClick={() => setWeek(d.prev_week)} />
          <Button onClick={() => setWeek("")}>Оваа недела</Button>
          <IconButton label="Следна недела" icon={ChevronRight} variant="default" onClick={() => setWeek(d.next_week)} />
        </> : null} />
      {q.isLoading ? <SkeletonRows rows={8} cols={8} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : d ? <>
        <div className="legend">
          <span><span className="swatch" style={{ background: "var(--success-soft)", border: "1px solid var(--success)" }} />распореден</span>
          <span><span className="swatch" style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)" }} />двојно резервиран{conflicts ? <strong className="tone-danger"> ({conflicts})</strong> : null}</span>
        </div>
        {grid("Возила и машини", d.vehicles)}
        {grid("Работници", d.workers)}
      </> : null}
    </Page>
  );
}

// ── leave timeline ─────────────────────────────────────────────────────────

const SCALES = [{ value: "month", label: "Месец" }, { value: "quarter", label: "Квартал" }, { value: "year", label: "Година" }, { value: "range", label: "Период" }];

export function LeaveTimeline() {
  const today = todayISO();
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
    enabled: scale !== "range" || Boolean(range.from && range.to), placeholderData: (p) => p });
  const d = q.data;
  const move = (dir: 1 | -1) => {
    if (!d) return;
    if (d.scale === "range") setRange({ from: dir > 0 ? d.next_from : d.prev_from, to: dir > 0 ? d.next_to : d.prev_to });
    else setAnchor(dir > 0 ? d.next_anchor : d.prev_anchor);
  };
  return (
    <Page title="Распоред на отсуства">
      <PageHeader title="Распоред на отсуства" subtitle={d?.period_label ?? "Кој е отсутен и кога"}
        actions={<LinkButton to="/hr/leaves/new" variant="primary">Ново отсуство</LinkButton>} />
      <Panel>
        <div className="toolbar">
          <div className="field"><span className="label">Приказ</span><Segmented label="Приказ" value={scale} onChange={setScale} options={SCALES} /></div>
          {scale === "range" ? <>
            <Field label={t.from} htmlFor="lt-from"><input id="lt-from" type="date" className="input" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></Field>
            <Field label={t.to} htmlFor="lt-to"><input id="lt-to" type="date" className="input" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></Field>
          </> : (
            <div className="field"><span className="label">{t.period}</span>
              <div className="row-tight">
                <IconButton label="Претходен период" icon={ChevronLeft} variant="default" disabled={!d} onClick={() => move(-1)} />
                <Button onClick={() => setAnchor(today)}>{t.today}</Button>
                <IconButton label="Следен период" icon={ChevronRight} variant="default" disabled={!d} onClick={() => move(1)} />
              </div>
            </div>
          )}
          <div style={{ minWidth: 220 }}>
            <Field label="Оддел" htmlFor="lt-dept">
              <RelatedSelect id="lt-dept" related={{ endpoint: `${API_BASE}/org/departments/` }} value={department} onChange={(v) => setDepartment(v)} placeholder="Сите оддели" />
            </Field>
          </div>
          <div className="field" style={{ justifyContent: "flex-end", paddingBottom: 6 }}>
            <Switch checked={everyone} onChange={setEveryone} label="И вработените без отсуство" />
          </div>
        </div>
      </Panel>
      {scale === "range" && !(range.from && range.to) ? <Panel><EmptyState title="Изберете период">Најмногу 186 дена.</EmptyState></Panel> : null}
      {q.isLoading ? <SkeletonRows rows={8} cols={10} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : d ? <>
        <div className="legend">
          {d.legend.map((l: Data) => <span key={l.category}><span className={`swatch leave-${String(l.category).toLowerCase()}`} />{l.label}</span>)}
        </div>
        {!d.rows.length ? <Panel><EmptyState title="Нема отсуства во периодот" /></Panel> : (
          <Panel flush>
            <div className="table-wrap">
              <table className="table timeline">
                <thead>
                  {d.month_groups.length ? <tr><th className="sticky-col" />{d.month_groups.map((g: Data, i: number) => <th key={i} colSpan={g.span} className="month-group">{g.label}</th>)}</tr> : null}
                  <tr><th className="sticky-col">Вработен</th>{d.columns.map((c: Data, i: number) => (
                    <th key={i} className={`${c.is_weekend ? "weekend" : ""}${c.is_current ? " today" : ""}`}>{c.label}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {d.rows.map((r: Data) => (
                    <tr key={r.employee}>
                      <th scope="row" className="sticky-col nowrap">{r.employee_name}</th>
                      {r.cells.map((c: Data, i: number) => (
                        <td key={i} className={`${c.is_weekend ? "weekend" : ""}${c.is_current ? " today" : ""}${c.category ? ` leave-${String(c.category).toLowerCase()}` : ""}`}
                          title={c.category ? `${c.category_label} ${c.range}` : undefined} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </> : null}
    </Page>
  );
}
