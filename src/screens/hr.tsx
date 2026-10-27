/** HR custom screens: attendance for one day for everyone (v1 attendance_bulk) and the HR dashboard. */
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, ApiError, API_BASE } from "@/api/client";
import { RelatedSelect } from "@/components/inputs";
import { Alert, Button, Field, Spinner, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceDay() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<DayRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const q = useQuery({
    queryKey: ["attendance-day", date],
    queryFn: () => api.get<{ rows: DayRow[] }>("/hr/attendance/day/", { date }),
  });
  useEffect(() => { if (q.data) setRows(q.data.rows); }, [q.data]);
  const update = (i: number, patch: Partial<DayRow>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

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
      toast(`${t.saved} ${res.saved} / ${res.deleted}`);
      void q.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Присуство за ден</h1>
        <Field label="Датум" htmlFor="att-date">
          <input id="att-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <span className="spacer" />
        <Button variant="primary" busy={saving} onClick={save}>{t.save}</Button>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="card flush">
        {q.isLoading ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Вработен</th><th>Доаѓање</th><th>Заминување</th><th>Отсутен</th><th>Причина</th><th>Мерка</th><th>Проект</th><th className="num">Оброк</th></tr>
              </thead>
              <tbody>
                {!rows.length ? <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 24 }}>Нема активни вработени.</td></tr> : null}
                {rows.map((r, i) => (
                  <tr key={r.employee} style={r.from_leave ? { opacity: 0.6 } : undefined}>
                    <td>{r.employee_name}{r.from_leave ? <div className="small muted">од отсуство</div> : null}</td>
                    <td><input type="time" className="input" disabled={r.from_leave || r.is_missing} value={r.check_in?.slice(0, 5) ?? ""}
                      onChange={(e) => update(i, { check_in: e.target.value })} aria-label={`${r.employee_name} доаѓање`} /></td>
                    <td><input type="time" className="input" disabled={r.from_leave || r.is_missing} value={r.check_out?.slice(0, 5) ?? ""}
                      onChange={(e) => update(i, { check_out: e.target.value })} aria-label={`${r.employee_name} заминување`} /></td>
                    <td><input type="checkbox" disabled={r.from_leave} checked={r.is_missing}
                      onChange={(e) => update(i, { is_missing: e.target.checked })} aria-label={`${r.employee_name} отсутен`} /></td>
                    <td>
                      <select className="input" disabled={r.from_leave || !r.is_missing} value={r.missing_reason}
                        onChange={(e) => update(i, { missing_reason: e.target.value })} aria-label="Причина">
                        <option value="">{t.none}</option>
                        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td>
                      {r.is_missing && r.missing_reason === "UNANNOUNCED" ? (
                        <select className="input" value={r.disciplinary_action ?? ""} aria-label="Дисциплинска мерка"
                          onChange={(e) => update(i, { disciplinary_action: e.target.value })}>
                          <option value="">{t.none}</option>
                          {r.disciplinary_actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      ) : null}
                    </td>
                    <td style={{ minWidth: 200 }}>
                      <RelatedSelect related={{ endpoint: `${API_BASE}/projects/projects/` }} value={r.project}
                        disabled={r.from_leave || r.is_missing} onChange={(v) => update(i, { project: v })} />
                    </td>
                    <td><input className="input" inputMode="decimal" style={{ width: 80 }} disabled={r.from_leave || r.is_missing}
                      value={r.meal_amount ?? ""} onChange={(e) => update(i, { meal_amount: e.target.value })} aria-label="Оброк" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface HrDashboardData {
  headcount: Record<string, number>;
  today: { present: number; on_leave: number };
  month: { by_reason: Record<string, number> };
  payroll: Record<string, { count: number; total: string }>;
  loans_pending: number;
  bailiffs_active: number;
}

const REASON_LABEL: Record<string, string> = Object.fromEntries([["PRESENT", "Присутни"], ...REASONS]);

export function HrDashboard() {
  const q = useQuery({ queryKey: ["hr-dashboard"], queryFn: () => api.get<HrDashboardData>("/hr/attendance/dashboard/") });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <Alert tone="danger">{(q.error as Error).message}</Alert>;
  const d = q.data!;
  return (
    <div className="stack">
      <div className="page-head"><h1>Човечки ресурси — преглед</h1></div>
      <div className="kpis">
        <div className="card kpi"><div className="label">Активни вработени</div><div className="value">{d.headcount.ACTIVE ?? 0}</div></div>
        <div className="card kpi"><div className="label">Присутни денес</div><div className="value">{d.today.present}</div></div>
        <div className="card kpi"><div className="label">На отсуство денес</div><div className="value">{d.today.on_leave}</div></div>
        <div className="card kpi"><div className="label">Заеми за одобрување</div><div className="value">{d.loans_pending}</div></div>
        <div className="card kpi"><div className="label">Активни извршувања</div><div className="value">{d.bailiffs_active}</div></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Овој месец (денови)</h2>
          <table className="table"><tbody>
            {Object.entries(d.month.by_reason).map(([k, v]) => <tr key={k}><td>{REASON_LABEL[k] ?? k}</td><td className="num">{v}</td></tr>)}
          </tbody></table>
        </div>
        <div className="card">
          <h2>Плати овој месец</h2>
          <table className="table"><tbody>
            {Object.entries(d.payroll).map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v.count}</td><td className="num">{v.total}</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
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

export function AttendanceMonth() {
  const now = new Date();
  const [employee, setEmployee] = useState<number | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<MonthDay[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const q = useQuery({
    queryKey: ["attendance-month", employee, year, month],
    queryFn: () => api.get<{ days: MonthDay[] }>("/hr/attendance/month/", { employee, year, month }),
    enabled: employee !== null,
  });
  useEffect(() => { if (q.data) setDays(q.data.days); }, [q.data]);
  const update = (i: number, patch: Partial<MonthDay>) => setDays((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)));
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
      toast(`${t.saved} ${res.saved}`);
      void q.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Присуство за месец</h1>
        <div style={{ minWidth: 260 }}>
          <Field label="Вработен">
            <RelatedSelect related={{ endpoint: `${API_BASE}/people/employees/` }} value={employee} onChange={(v) => setEmployee(v)} />
          </Field>
        </div>
        <Field label="Година" htmlFor="am-year">
          <input id="am-year" className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100 }} />
        </Field>
        <Field label="Месец" htmlFor="am-month">
          <input id="am-month" className="input" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: 80 }} />
        </Field>
        <span className="spacer" />
        <Button variant="primary" busy={saving} disabled={employee === null} onClick={save}>{t.save}</Button>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {employee === null ? <div className="card muted">Изберете вработен.</div> : q.isLoading ? <Spinner /> : (
        <div className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Датум</th><th>Ден</th><th>Доаѓање</th><th>Заминување</th><th>Отсутен</th><th>Причина</th><th>Проект</th><th>Оброк</th></tr></thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d.date} style={{ background: !d.is_working_day || d.is_holiday ? "var(--surface-2)" : undefined, opacity: d.from_leave ? 0.6 : 1 }}>
                    <td className="nowrap">{d.date.split("-").reverse().join(".")}</td>
                    <td className="small">{d.day_name}{d.is_holiday ? " · празник" : ""}</td>
                    <td><input type="time" className="input" disabled={d.from_leave || d.is_missing} value={d.check_in?.slice(0, 5) ?? ""}
                      onChange={(e) => update(i, { check_in: e.target.value })} aria-label={`${d.date} доаѓање`} /></td>
                    <td><input type="time" className="input" disabled={d.from_leave || d.is_missing} value={d.check_out?.slice(0, 5) ?? ""}
                      onChange={(e) => update(i, { check_out: e.target.value })} aria-label={`${d.date} заминување`} /></td>
                    <td><input type="checkbox" disabled={d.from_leave} checked={d.is_missing}
                      onChange={(e) => update(i, { is_missing: e.target.checked })} aria-label={`${d.date} отсутен`} /></td>
                    <td>
                      <select className="input" disabled={d.from_leave || !d.is_missing} value={d.missing_reason}
                        onChange={(e) => update(i, { missing_reason: e.target.value })} aria-label="Причина">
                        <option value="">{t.none}</option>
                        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 200 }}>
                      <RelatedSelect related={{ endpoint: `${API_BASE}/projects/projects/` }} value={d.project}
                        disabled={d.from_leave || d.is_missing} onChange={(v) => update(i, { project: v })} />
                    </td>
                    <td><input className="input" inputMode="decimal" style={{ width: 80 }} disabled={d.from_leave || d.is_missing}
                      value={d.meal_amount ?? ""} onChange={(e) => update(i, { meal_amount: e.target.value })} aria-label="Оброк" /></td>
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

const MONTH_NAMES = ["Јануари", "Февруари", "Март", "Април", "Мај", "Јуни", "Јули", "Август", "Септември", "Октомври",
  "Ноември", "Декември"];

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
  ["expected_working_days", "Работни денови"], ["actual_working_days", "Одработени"], ["attendance_percentage", "Присуство %"],
  ["missing_days", "Отсуства"], ["total_overtime_hours", "Прекувремено (ч)"], ["approved_overtime_hours", "Одобрено (ч)"],
  ["total_late_hours", "Доцнење (ч)"], ["total_early_leave_hours", "Порано заминување (ч)"],
];

/** Live KPIs of a month for everyone (v1 KPI dashboard): sortable, low attendance marked, store a row. */
export function KpiMonth() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [department, setDepartment] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: keyof KpiRow; desc: boolean }>({ key: "employee_name", desc: false });
  const [storing, setStoring] = useState<number | null>(null);
  const toast = useToast();
  const q = useQuery({
    queryKey: ["kpi-month", year, month, department],
    queryFn: () => api.get<{ rows: KpiRow[] }>("/hr/kpi/month/", { year, month, department }),
  });
  const rows = [...(q.data?.rows ?? [])].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    const cmp = typeof x === "string" && isNaN(Number(x)) ? String(x).localeCompare(String(y), "mk") : Number(x) - Number(y);
    return sort.desc ? -cmp : cmp;
  });
  const avg = (key: keyof KpiRow) => (rows.length ? rows.reduce((s, r) => s + Number(r[key]), 0) / rows.length : 0);
  const sum = (key: keyof KpiRow) => rows.reduce((s, r) => s + Number(r[key]), 0);
  const header = (key: keyof KpiRow, label: string, num = true) => (
    <th className={num ? "num" : undefined} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : undefined}>
      <button type="button" className="link-button" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : num }))}>
        {label}{sort.key === key ? (sort.desc ? " ▾" : " ▴") : ""}
      </button>
    </th>
  );
  const store = async (employee: number) => {
    setStoring(employee);
    try {
      await api.post("/hr/kpi/calculate/", { employee, year, month });
      toast(t.saved);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    } finally {
      setStoring(null);
    }
  };
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Показатели по месец</h1>
        <span className="spacer" />
        <Field label="Година" htmlFor="kpi-year">
          <input id="kpi-year" type="number" className="input" style={{ width: 100 }} value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </Field>
        <Field label="Месец" htmlFor="kpi-month">
          <select id="kpi-month" className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </Field>
        <Field label="Одделение" htmlFor="kpi-dept">
          <RelatedSelect id="kpi-dept" related={{ endpoint: `${API_BASE}/org/departments/` }} value={department}
            onChange={(v) => setDepartment(v)} placeholder="Сите" />
        </Field>
      </div>
      <div className="card flush">
        {q.isLoading ? <Spinner /> : q.error ? <Alert tone="danger">{(q.error as Error).message}</Alert> : !rows.length ? (
          <p className="muted" style={{ textAlign: "center", padding: 24, margin: 0 }}>Нема активни вработени.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>{header("employee_name", "Вработен", false)}{KPI_COLS.map(([k, label]) => <React.Fragment key={k}>{header(k, label)}</React.Fragment>)}<th /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employee}>
                    <td>{r.employee_name}</td>
                    {KPI_COLS.map(([k]) => (
                      <td key={k} className="num"
                        style={k === "attendance_percentage" && Number(r[k]) < 90 ? { color: "var(--danger)", fontWeight: 600 } : undefined}>
                        {k === "attendance_percentage" ? `${Number(r[k]).toLocaleString("mk-MK", { maximumFractionDigits: 1 })}%` : Number(r[k]).toLocaleString("mk-MK", { maximumFractionDigits: 2 })}
                      </td>
                    ))}
                    <td><Button size="sm" busy={storing === r.employee} onClick={() => void store(r.employee)}
                      title="Пресметај и зачувај го месецот">Зачувај</Button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Вкупно / просек ({rows.length})</th>
                  {KPI_COLS.map(([k]) => (
                    <th key={k} className="num">
                      {k === "attendance_percentage" ? `${avg(k).toLocaleString("mk-MK", { maximumFractionDigits: 1 })}%`
                        : sum(k).toLocaleString("mk-MK", { maximumFractionDigits: 2 })}
                    </th>
                  ))}
                  <th />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Пресметано од присуството во живо; „Зачувај“ го запишува месецот во показателите.</p>
    </div>
  );
}
