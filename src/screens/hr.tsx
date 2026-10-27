/** HR tools: attendance for one day for everyone (v1 attendance_bulk), one employee's month, and the month's
 * attendance KPIs for everyone. */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Save } from "lucide-react";

import { api, ApiError, API_BASE } from "@/api/client";
import { HBars, Kpi, Kpis } from "@/components/dashboard";
import { RelatedSelect } from "@/components/inputs";
import { Alert, Button, EmptyState, ErrorState, Field, IconButton, PageHeader, Panel, SkeletonRows, useToast } from "@/components/ui";
import { MONTHS, t } from "@/i18n/mk";
import { Page } from "@/layout/Page";
import { addDays, formatDate, formatNumber, num, todayISO, weekdayName } from "@/lib/format";

interface DayRow {
  employee: number;
  employee_name: string;
  check_in: string | null;
  check_out: string | null;
  meal_amount: string | null;
  is_missing: boolean;
  missing_reason: string;
  project: number | null;
  from_leave: boolean;
  disciplinary_actions: { value: string; label: string }[];
  disciplinary_action?: string;
}

const REASONS: [string, string][] = [
  ["PAID_LEAVE", "Платено отсуство"], ["SICK_LEAVE", "Боледување"], ["MATERNITY_LEAVE", "Породилно"],
  ["FUNERAL_LEAVE", "Погреб"], ["UNPAID_LEAVE", "Неплатено"], ["UNANNOUNCED", "Неоправдано"],
];

const DEFAULT_IN = "07:00";
const DEFAULT_OUT = "15:00";

function SaveBar({ dirty, saving, onSave, children }: { dirty: boolean; saving: boolean; onSave: () => void; children?: React.ReactNode }) {
  return (
    <div className="save-bar" style={{ margin: 0, borderRadius: "0 0 var(--r-lg) var(--r-lg)" }}>
      {dirty ? <span className="dirty">{t.unsaved}</span> : <span className="xs muted">Сите промени се зачувани</span>}
      {children}
      <span className="spacer" />
      <Button variant="primary" icon={Save} busy={saving} disabled={!dirty} onClick={onSave}>{t.save}</Button>
    </div>
  );
}

export function AttendanceDay() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<DayRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const q = useQuery({
    queryKey: ["attendance-day", date],
    queryFn: () => api.get<{ rows: DayRow[] }>("/hr/attendance/day/", { date }),
  });
  useEffect(() => { if (q.data) { setRows(q.data.rows); setDirty(false); } }, [q.data]);
  const update = (i: number, patch: Partial<DayRow>) => { setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r))); setDirty(true); };
  const fillDefaults = () => {
    setRows((list) => list.map((r) => (r.from_leave || r.is_missing || r.check_in || r.check_out ? r : { ...r, check_in: DEFAULT_IN, check_out: DEFAULT_OUT })));
    setDirty(true);
  };
  const go = (days: number) => {
    if (dirty && !window.confirm(t.leaveText)) return;
    setDate((d) => addDays(d, days));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = rows.filter((r) => !r.from_leave).map((r) => ({
        employee: r.employee, check_in: r.is_missing ? null : r.check_in || null, check_out: r.is_missing ? null : r.check_out || null,
        is_missing: r.is_missing, missing_reason: r.is_missing ? r.missing_reason || null : null,
        meal_amount: r.meal_amount || null, project: r.project, disciplinary_action: r.disciplinary_action || null,
      }));
      const res = await api.post<{ saved: number; deleted: number; skipped_leave: number }>("/hr/attendance/day/", { date, rows: payload });
      toast(`Присуството за ${formatDate(date)} е зачувано`, "success", { description: `${res.saved} зачувани · ${res.deleted} отстранети` });
      setDirty(false);
      void q.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const present = rows.filter((r) => !r.is_missing && !r.from_leave && (r.check_in || r.check_out)).length;
  const absent = rows.filter((r) => r.is_missing).length;
  const leave = rows.filter((r) => r.from_leave).length;
  const empty = rows.length - present - absent - leave;
  const weekday = weekdayName(new Date(`${date}T12:00:00`));

  return (
    <Page title="Присуство по ден">
      <PageHeader title="Присуство по ден" subtitle={`${weekday}, ${formatDate(date)}`}
        actions={<>
          <IconButton label="Претходен ден" icon={ChevronLeft} variant="default" onClick={() => go(-1)} />
          <input type="date" className="input" aria-label={t.date} value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
          <IconButton label="Следен ден" icon={ChevronRight} variant="default" onClick={() => go(1)} />
          <Button onClick={() => setDate(todayISO())}>{t.today}</Button>
        </>} />
      <Kpis>
        <Kpi label="Присутни" value={formatNumber(present, 0)} />
        <Kpi label="Отсутни" value={formatNumber(absent, 0)} tone={rows.some((r) => r.is_missing && r.missing_reason === "UNANNOUNCED") ? "alarm" : undefined} />
        <Kpi label="На отсуство (одобрено)" value={formatNumber(leave, 0)} />
        <Kpi label="Без внес" value={formatNumber(empty, 0)} tone={empty ? "attention" : undefined} />
      </Kpis>
      {error ? <Alert tone="danger" title="Присуството не е зачувано">{error}</Alert> : null}
      <Panel flush title="Вработени" sub="Вработените на одобрено отсуство се пополнуваат автоматски"
        actions={<Button size="sm" icon={Clock} disabled={!empty} onClick={fillDefaults}>Пополни {DEFAULT_IN}–{DEFAULT_OUT} за {empty} без внес</Button>}>
        {q.isLoading ? <SkeletonRows rows={10} cols={6} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !rows.length ? (
          <EmptyState title="Нема активни вработени" />
        ) : (
          <div className="table-wrap" style={{ maxHeight: "calc(100vh - 420px)" }}>
            <table className="table compact">
              <thead>
                <tr><th className="sticky-col">Вработен</th><th>Доаѓање</th><th>Заминување</th><th>Отсутен</th><th>Причина</th><th>Мерка</th><th>Проект</th><th className="num">Оброк</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.employee} style={r.from_leave ? { opacity: 0.6 } : undefined}>
                    <td className="sticky-col nowrap">{r.employee_name}{r.from_leave ? <div className="xs muted">на отсуство</div> : null}</td>
                    <td><input type="time" className="input sm" disabled={r.from_leave || r.is_missing} value={r.check_in?.slice(0, 5) ?? ""}
                      onChange={(e) => update(i, { check_in: e.target.value })} aria-label={`${r.employee_name}: доаѓање`} /></td>
                    <td><input type="time" className="input sm" disabled={r.from_leave || r.is_missing} value={r.check_out?.slice(0, 5) ?? ""}
                      onChange={(e) => update(i, { check_out: e.target.value })} aria-label={`${r.employee_name}: заминување`} /></td>
                    <td className="center-text"><input type="checkbox" disabled={r.from_leave} checked={r.is_missing}
                      onChange={(e) => update(i, { is_missing: e.target.checked })} aria-label={`${r.employee_name}: отсутен`} /></td>
                    <td>
                      <select className="input sm" disabled={r.from_leave || !r.is_missing} value={r.missing_reason}
                        onChange={(e) => update(i, { missing_reason: e.target.value })} aria-label={`${r.employee_name}: причина`}>
                        <option value="">{t.none}</option>
                        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td>
                      {r.is_missing && r.missing_reason === "UNANNOUNCED" ? (
                        <select className="input sm" value={r.disciplinary_action ?? ""} aria-label={`${r.employee_name}: дисциплинска мерка`}
                          onChange={(e) => update(i, { disciplinary_action: e.target.value })}>
                          <option value="">{t.none}</option>
                          {r.disciplinary_actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      ) : null}
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <RelatedSelect related={{ endpoint: `${API_BASE}/projects/projects/` }} value={r.project}
                        disabled={r.from_leave || r.is_missing} onChange={(v) => update(i, { project: v })} />
                    </td>
                    <td><input className="input sm num" inputMode="decimal" style={{ width: 90 }} disabled={r.from_leave || r.is_missing}
                      value={r.meal_amount ?? ""} onChange={(e) => update(i, { meal_amount: e.target.value })} aria-label={`${r.employee_name}: оброк`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />
      </Panel>
    </Page>
  );
}

interface MonthDay {
  date: string;
  day_name: string;
  is_working_day: boolean;
  is_holiday: boolean;
  check_in: string | null;
  check_out: string | null;
  is_missing: boolean;
  missing_reason: string;
  meal_amount: string | null;
  project: number | null;
  from_leave: boolean;
}

function monthValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function AttendanceMonth() {
  const now = new Date();
  const [employee, setEmployee] = useState<number | null>(null);
  const [ym, setYm] = useState(monthValue(now.getFullYear(), now.getMonth() + 1));
  const [year, month] = ym.split("-").map(Number);
  const [days, setDays] = useState<MonthDay[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const q = useQuery({
    queryKey: ["attendance-month", employee, year, month],
    queryFn: () => api.get<{ days: MonthDay[] }>("/hr/attendance/month/", { employee, year, month }),
    enabled: employee !== null && Boolean(year && month),
  });
  useEffect(() => { if (q.data) { setDays(q.data.days); setDirty(false); } }, [q.data]);
  const update = (i: number, patch: Partial<MonthDay>) => { setDays((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d))); setDirty(true); };
  const fillWorkdays = () => {
    setDays((list) => list.map((d) => (!d.is_working_day || d.is_holiday || d.from_leave || d.is_missing || d.check_in || d.check_out ? d
      : { ...d, check_in: DEFAULT_IN, check_out: DEFAULT_OUT })));
    setDirty(true);
  };
  const shift = (delta: number) => {
    const idx = year * 12 + month - 1 + delta;
    setYm(monthValue(Math.floor(idx / 12), (idx % 12) + 1));
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = days.filter((d) => !d.from_leave).map((d) => ({
        date: d.date, check_in: d.is_missing ? null : d.check_in || null, check_out: d.is_missing ? null : d.check_out || null,
        is_missing: d.is_missing, missing_reason: d.is_missing ? d.missing_reason || null : null,
        meal_amount: d.meal_amount || null, project: d.project,
      }));
      const res = await api.post<{ saved: number; deleted: number }>("/hr/attendance/month/", { employee, year, month, days: payload });
      toast(`Присуството за ${MONTHS[month - 1].toLowerCase()} е зачувано`, "success", { description: `${res.saved} дена` });
      setDirty(false);
      void q.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };
  const worked = days.filter((d) => !d.is_missing && (d.check_in || d.check_out)).length;
  const workdays = days.filter((d) => d.is_working_day && !d.is_holiday).length;
  const missing = days.filter((d) => d.is_missing).length;
  const unfilled = days.filter((d) => d.is_working_day && !d.is_holiday && !d.from_leave && !d.is_missing && !d.check_in && !d.check_out).length;
  return (
    <Page title="Присуство по месец">
      <PageHeader title="Присуство по месец" subtitle="Целиот месец за еден вработен"
        actions={<>
          <div style={{ minWidth: 280 }}>
            <Field label="Вработен" htmlFor="am-emp">
              <RelatedSelect id="am-emp" related={{ endpoint: `${API_BASE}/people/employees/` }} value={employee} onChange={(v) => setEmployee(v)} placeholder="Изберете вработен" />
            </Field>
          </div>
          <Field label={t.month} htmlFor="am-month">
            <div className="row-tight">
              <IconButton label="Претходен месец" icon={ChevronLeft} variant="default" onClick={() => shift(-1)} />
              <input id="am-month" type="month" className="input" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} style={{ width: 160 }} />
              <IconButton label="Следен месец" icon={ChevronRight} variant="default" onClick={() => shift(1)} />
            </div>
          </Field>
        </>} />
      {error ? <Alert tone="danger" title="Присуството не е зачувано">{error}</Alert> : null}
      {employee === null ? (
        <Panel><EmptyState title="Изберете вработен">Ќе се прикаже секој ден од месецот за внес или поправка.</EmptyState></Panel>
      ) : (
        <>
          <Kpis>
            <Kpi label="Работни денови" value={formatNumber(workdays, 0)} sub={`${MONTHS[month - 1]} ${year}`} />
            <Kpi label="Одработени" value={formatNumber(worked, 0)} />
            <Kpi label="Отсуства" value={formatNumber(missing, 0)} />
            <Kpi label="Без внес" value={formatNumber(unfilled, 0)} tone={unfilled ? "attention" : undefined} />
          </Kpis>
          <Panel flush title={`${MONTHS[month - 1]} ${year}`}
            actions={<Button size="sm" icon={Clock} disabled={!unfilled} onClick={fillWorkdays}>Пополни {DEFAULT_IN}–{DEFAULT_OUT} за {unfilled} работни дена</Button>}>
            {q.isLoading ? <SkeletonRows rows={10} cols={6} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
              <div className="table-wrap" style={{ maxHeight: "calc(100vh - 420px)" }}>
                <table className="table compact">
                  <thead><tr><th>Датум</th><th>Ден</th><th>Доаѓање</th><th>Заминување</th><th>Отсутен</th><th>Причина</th><th>Проект</th><th className="num">Оброк</th></tr></thead>
                  <tbody>
                    {days.map((d, i) => {
                      const off = !d.is_working_day || d.is_holiday;
                      return (
                        <tr key={d.date} className={off ? "off-day" : undefined} style={d.from_leave ? { opacity: 0.6 } : undefined}>
                          <td className="nowrap num">{formatDate(d.date)}</td>
                          <td className="small">{d.day_name}{d.is_holiday ? <span className="tone-warning"> · празник</span> : null}{d.from_leave ? <span className="muted"> · отсуство</span> : null}</td>
                          <td><input type="time" className="input sm" disabled={d.from_leave || d.is_missing} value={d.check_in?.slice(0, 5) ?? ""}
                            onChange={(e) => update(i, { check_in: e.target.value })} aria-label={`${formatDate(d.date)}: доаѓање`} /></td>
                          <td><input type="time" className="input sm" disabled={d.from_leave || d.is_missing} value={d.check_out?.slice(0, 5) ?? ""}
                            onChange={(e) => update(i, { check_out: e.target.value })} aria-label={`${formatDate(d.date)}: заминување`} /></td>
                          <td className="center-text"><input type="checkbox" disabled={d.from_leave} checked={d.is_missing}
                            onChange={(e) => update(i, { is_missing: e.target.checked })} aria-label={`${formatDate(d.date)}: отсутен`} /></td>
                          <td>
                            <select className="input sm" disabled={d.from_leave || !d.is_missing} value={d.missing_reason}
                              onChange={(e) => update(i, { missing_reason: e.target.value })} aria-label={`${formatDate(d.date)}: причина`}>
                              <option value="">{t.none}</option>
                              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </td>
                          <td style={{ minWidth: 220 }}>
                            <RelatedSelect related={{ endpoint: `${API_BASE}/projects/projects/` }} value={d.project}
                              disabled={d.from_leave || d.is_missing} onChange={(v) => update(i, { project: v })} />
                          </td>
                          <td><input className="input sm num" inputMode="decimal" style={{ width: 90 }} disabled={d.from_leave || d.is_missing}
                            value={d.meal_amount ?? ""} onChange={(e) => update(i, { meal_amount: e.target.value })} aria-label={`${formatDate(d.date)}: оброк`} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />
          </Panel>
        </>
      )}
    </Page>
  );
}

interface KpiRow {
  employee: number;
  employee_name: string;
  expected_working_days: number;
  actual_working_days: number;
  attendance_percentage: string;
  missing_days: number;
  total_overtime_hours: string;
  approved_overtime_hours: string;
  total_late_hours: string;
  total_early_leave_hours: string;
}

const KPI_COLS: [keyof KpiRow, string][] = [
  ["expected_working_days", "Работни дена"], ["actual_working_days", "Одработени"], ["attendance_percentage", "Присуство"],
  ["missing_days", "Отсуства"], ["total_overtime_hours", "Прекувремено (ч)"], ["approved_overtime_hours", "Одобрено (ч)"],
  ["total_late_hours", "Доцнење (ч)"], ["total_early_leave_hours", "Порано заминување (ч)"],
];

const BANDS: [string, (p: number) => boolean][] = [
  ["100% и повеќе", (p) => p >= 100], ["95–99%", (p) => p >= 95 && p < 100], ["90–94%", (p) => p >= 90 && p < 95],
  ["80–89%", (p) => p >= 80 && p < 90], ["Под 80%", (p) => p < 80],
];

/** Live KPIs of a month for everyone (v1 KPI dashboard): sortable, low attendance marked, store a row. */
export function KpiMonth() {
  const now = new Date();
  const [ym, setYm] = useState(monthValue(now.getFullYear(), now.getMonth() + 1));
  const [year, month] = ym.split("-").map(Number);
  const [department, setDepartment] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: keyof KpiRow; desc: boolean }>({ key: "employee_name", desc: false });
  const [storing, setStoring] = useState<number | null>(null);
  const toast = useToast();
  const q = useQuery({
    queryKey: ["kpi-month", year, month, department],
    queryFn: () => api.get<{ rows: KpiRow[] }>("/hr/kpi/month/", { year, month, department }),
    placeholderData: (prev) => prev,
  });
  const rows = useMemo(() => [...(q.data?.rows ?? [])].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    const cmp = typeof x === "string" && isNaN(Number(x)) ? String(x).localeCompare(String(y), "mk") : Number(x) - Number(y);
    return sort.desc ? -cmp : cmp;
  }), [q.data, sort]);
  const avg = (key: keyof KpiRow) => (rows.length ? rows.reduce((s, r) => s + Number(r[key]), 0) / rows.length : 0);
  const sum = (key: keyof KpiRow) => rows.reduce((s, r) => s + Number(r[key]), 0);
  const header = (key: keyof KpiRow, label: string, isNum = true) => (
    <th className={`sortable ${isNum ? "num" : ""}`} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"} tabIndex={0}
      onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : isNum }))}
      onKeyDown={(e) => { if (e.key === "Enter") setSort((s) => ({ key, desc: s.key === key ? !s.desc : isNum })); }}>
      {label}{sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
    </th>
  );
  const store = async (employee: number, name: string) => {
    setStoring(employee);
    try {
      await api.post("/hr/kpi/calculate/", { employee, year, month });
      toast(`Показателите за ${name} се зачувани`, "success");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    } finally {
      setStoring(null);
    }
  };
  const low = rows.filter((r) => num(r.attendance_percentage) < 90);
  return (
    <Page title="Показатели по месец">
      <PageHeader title="Показатели по месец" subtitle="Пресметано од присуството во живо; „Зачувај“ го запишува месецот во показателите"
        actions={<>
          <Field label={t.month} htmlFor="kpi-month"><input id="kpi-month" type="month" className="input" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} /></Field>
          <div style={{ minWidth: 220 }}>
            <Field label="Оддел" htmlFor="kpi-dept">
              <RelatedSelect id="kpi-dept" related={{ endpoint: `${API_BASE}/org/departments/` }} value={department} onChange={(v) => setDepartment(v)} placeholder="Сите оддели" />
            </Field>
          </div>
        </>} />
      {q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
      {rows.length ? (
        <>
          <Kpis>
            <Kpi label="Просечно присуство" value={formatNumber(avg("attendance_percentage"), 1)} unit="%" sub={`${rows.length} вработени`} />
            <Kpi label="Под 90% присуство" value={formatNumber(low.length, 0)} tone={low.length ? "attention" : undefined} />
            <Kpi label="Прекувремено" value={formatNumber(sum("total_overtime_hours"), 0)} unit="ч" sub={`одобрено ${formatNumber(sum("approved_overtime_hours"), 0)} ч`} />
            <Kpi label="Доцнење" value={formatNumber(sum("total_late_hours"), 0)} unit="ч" />
          </Kpis>
          <Panel title="Распределба на присуството" sub="Број на вработени по процент на присуство">
            <HBars unit="number" rows={BANDS.map(([label, test]) => ({ key: label, label, value: rows.filter((r) => test(num(r.attendance_percentage))).length,
              over: label === "Под 80%" }))} />
          </Panel>
        </>
      ) : null}
      <Panel flush title="Вработени">
        {q.isLoading ? <SkeletonRows rows={10} cols={7} /> : !rows.length ? <EmptyState title="Нема активни вработени" /> : (
          <div className="table-wrap" style={{ maxHeight: "calc(100vh - 300px)" }}>
            <table className="table">
              <thead>
                <tr>{header("employee_name", "Вработен", false)}{KPI_COLS.map(([k, label]) => <React.Fragment key={k}>{header(k, label)}</React.Fragment>)}<th /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employee}>
                    <td><Link to={`/people/employees/${r.employee}`}>{r.employee_name}</Link></td>
                    {KPI_COLS.map(([k]) => (
                      <td key={k} className={`num${k === "attendance_percentage" && num(r[k]) < 90 ? " tone-danger strong" : ""}`}>
                        {k === "attendance_percentage" ? `${formatNumber(r[k], 1)}%` : formatNumber(r[k], k.endsWith("days") ? 0 : 2)}
                      </td>
                    ))}
                    <td className="right"><Button size="sm" busy={storing === r.employee} onClick={() => void store(r.employee, r.employee_name)}
                      title="Пресметај и зачувај го месецот">Зачувај</Button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Вкупно / просек ({rows.length})</td>
                  {KPI_COLS.map(([k]) => (
                    <td key={k} className="num">{k === "attendance_percentage" ? `${formatNumber(avg(k), 1)}%` : formatNumber(sum(k), k.endsWith("days") ? 0 : 2)}</td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
