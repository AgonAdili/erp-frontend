/** What a record's detail page adds: child resources as tabs (filtered to the record, with an Add drawer that
 * fills the link) and computed panels (project overview and BOQ, budget vs actual, partner approvals,
 * payroll calculation, MPIN, offer items, quotation comparison). Keyed by the server's resource key. */
import { useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Download, FileText, Plus, XCircle } from "lucide-react";

import { api, API_BASE, download } from "@/api/client";
import type { ResourceMeta, Row } from "@/api/types";
import { Bullet, Kpi, Kpis, Meter } from "@/components/dashboard";
import {
  Alert, Badge, Button, Drawer, EmptyState, ErrorState, Panel, Skeleton, SkeletonPanel, Spinner, statusTone,
} from "@/components/ui";
import { t } from "@/i18n/mk";
import { formatCompact, formatMoney, formatNumber, num } from "@/lib/format";
import { useInvalidateResource, useMeta } from "@/meta/hooks";

import { OfferItems } from "./offerItems";
import { QuotationCompare } from "./procurement";
import { ResourceForm } from "./ResourceForm";
import { ResourceList } from "./ResourceList";

export interface ChildSpec {
  path: string;      // "inventory/document-lines"
  fk: string;        // filter / link field on the child
  label: string;     // tab label
}

export function ChildTable({ spec, parent }: { spec: ChildSpec; parent: Row }) {
  const endpoint = `${API_BASE}/${spec.path}/`;
  const meta = useMeta(endpoint);
  const [adding, setAdding] = useState(false);
  const invalidate = useInvalidateResource(endpoint);
  if (meta.isLoading) return <SkeletonPanel />;
  if (meta.error) return <ErrorState error={meta.error} />;
  if (!meta.data || !meta.data.permissions.view) return <Panel><EmptyState title={t.forbiddenTitle}>{t.forbiddenText}</EmptyState></Panel>;
  const m = meta.data;
  return (
    <section className="panel" style={{ overflow: "hidden" }} aria-label={m.title}>
      <ResourceList meta={m} baseQuery={{ [spec.fk]: parent.id }} embedded
        headerExtra={m.permissions.add ? <Button size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)}>{t.add}</Button> : null} />
      {adding ? (
        <Drawer narrow title={`${m.title_singular || m.title}: ${t.addNew.toLowerCase()}`} onClose={() => setAdding(false)}>
          <ResourceForm meta={m} defaults={{ [spec.fk]: parent.id }} compact
            onSaved={() => { setAdding(false); invalidate(); }} onCancel={() => setAdding(false)} />
        </Drawer>
      ) : null}
    </section>
  );
}

export const CHILDREN: Record<string, ChildSpec[]> = {
  "inventory.documents": [
    { path: "inventory/document-lines", fk: "document", label: "Ставки" },
    { path: "inventory/document-costs", fk: "document", label: "Зависни трошоци" },
  ],
  "master_data.projects": [
    { path: "projects/engineers", fk: "project", label: "Инженери" },
    { path: "projects/diary-books", fk: "project", label: "Градежен дневник" },
    { path: "projects/measurement-books", fk: "project", label: "Градежни книги" },
    { path: "projects/certificates", fk: "project", label: "Ситуации" },
    { path: "budget/costs", fk: "project", label: "Рачни трошоци" },
  ],
  "projects.boqs": [{ path: "projects/boq-items", fk: "boq", label: "Ставки" }],
  "projects.certificates": [{ path: "projects/certificate-items", fk: "certificate", label: "Ставки" }],
  "projects.diary_books": [{ path: "projects/diary-entries", fk: "book", label: "Записи во дневникот" }],
  "projects.measurement_books": [{ path: "projects/measurement-pages", fk: "book", label: "Страни" }],
  "procurement.requests": [
    { path: "procurement/rfqs", fk: "material_request", label: "Барања за понуди" },
    { path: "procurement/purchase-orders", fk: "material_request", label: "Нарачки" },
  ],
  "procurement.rfq": [
    { path: "procurement/rfq-suppliers", fk: "rfq", label: "Добавувачи" },
    { path: "procurement/quotations", fk: "rfq", label: "Понуди" },
  ],
  "procurement.purchase_orders": [{ path: "procurement/goods-receipts", fk: "purchase_order", label: "Приемници" }],
  "offers.requests": [
    { path: "offers/site-visits", fk: "request", label: "Увиди на терен" },
    { path: "offers/offers", fk: "request", label: "Понуди" },
  ],
  "offers.offers": [
    { path: "offers/followups", fk: "offer", label: "Следења" },
    { path: "offers/approval-log", fk: "offer", label: "Тек на одобрување" },
  ],
  "work_orders.list": [
    { path: "workorders/resources", fk: "work_order", label: "Ресурси" },
    { path: "workorders/materials", fk: "work_order", label: "Материјали" },
    { path: "workorders/daily-reports", fk: "work_order", label: "Дневни извештаи" },
  ],
  "master_data.employees": [
    { path: "people/employment-records", fk: "employee", label: "Вработување" },
    { path: "hr/employee-documents", fk: "employee", label: "Документи" },
    { path: "hr/work-experience", fk: "employee", label: "Искуство" },
    { path: "hr/leaves", fk: "employee", label: "Отсуства" },
    { path: "hr/loans", fk: "employee", label: "Заеми" },
    { path: "hr/bailiffs", fk: "employee", label: "Извршувања" },
    { path: "hr/disciplinary-actions", fk: "employee", label: "Дисциплински мерки" },
    { path: "hr/payroll", fk: "employee", label: "Плати" },
  ],
  "fleet.vehicles": [
    { path: "fleet/documents", fk: "vehicle", label: "Документи" },
    { path: "fleet/schedules", fk: "vehicle", label: "Сервиси" },
    { path: "fleet/maintenance", fk: "vehicle", label: "Одржување" },
    { path: "fleet/daily-reports", fk: "vehicle", label: "Дневни извештаи" },
  ],
  "accounting.fixed_assets": [
    { path: "assets/ledger", fk: "asset", label: "Картица" },
    { path: "assets/documents", fk: "asset", label: "Документи" },
  ],
  "accounting.depreciation": [{ path: "assets/depreciation-entries", fk: "run", label: "Ставки" }],
  "accounting.asset_stocktake": [{ path: "assets/stocktake-lines", fk: "stocktake", label: "Ставки од попис" }],
  "accounting.journal_entries": [{ path: "accounting/ledger", fk: "journal_entry", label: "Ставки во главна книга" }],
  "dms.documents": [
    { path: "dms/relations", fk: "from_document", label: "Врски" },
    { path: "dms/links", fk: "document", label: "Поврзани записи" },
  ],
  "dms.classification": [{ path: "dms/retention-rules", fk: "classification", label: "Правила за чување" }],
  "dms.registers": [
    { path: "dms/record-types", fk: "register", label: "Видови документи" },
    { path: "dms/ledger", fk: "register", label: "Архивска книга" },
  ],
  "finance.mortgages": [{ path: "finance/loan-payments", fk: "loan", label: "Плаќања на рати" }],
  "budget.budgets": [{ path: "budget/alerts", fk: "budget", label: "Предупредувања" }],
  "hr.rate_sets": [{ path: "hr/contribution-rates", fk: "rate_set", label: "Придонеси" }],
  "workflow.definitions": [{ path: "workflow/stages", fk: "definition", label: "Фази" }],
};

type Extension = ComponentType<{ meta: ResourceMeta; row: Row }>;

// ── project: overview and BOQ ────────────────────────────────────────────────

interface ProjectOverviewData {
  project_value: string; value_source: string; executed_total: string; invoiced_total: string; unforeseen_total: string;
  over: { boq_item: number; number: string; title: string; unit: string; qty: string; value: string }[];
  under: { boq_item: number; number: string; title: string; unit: string; qty: string; value: string }[];
  engineers_active: number;
}

interface BoqData { rows: (Row & { depth: number })[]; total: string }

function ProjectOverview({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const q = useQuery({ queryKey: ["project-overview", row.id, row.version], queryFn: () => api.get<ProjectOverviewData>(`${meta.endpoint}${row.id}/overview/`) });
  const boq = useQuery({ queryKey: ["project-boq", row.id, row.version], queryFn: () => api.get<BoqData>(`${meta.endpoint}${row.id}/boq/`) });
  if (q.isLoading) return <SkeletonPanel />;
  if (q.error) return <ErrorState error={q.error} compact />;
  const d = q.data!;
  const value = num(d.project_value), executed = num(d.executed_total), invoiced = num(d.invoiced_total);
  const pctExec = value ? (executed / value) * 100 : 0;
  return (
    <div className="stack">
      <Kpis>
        <Kpi label="Вредност на проектот" value={formatCompact(value)} unit="ден." sub={d.value_source || undefined} />
        <Kpi label="Изведено (градежна книга)" value={formatCompact(executed)} unit="ден." sub={`${formatNumber(pctExec, 1)}% од вредноста`} />
        <Kpi label="Фактурирано (платени ситуации)" value={formatCompact(invoiced)} unit="ден." sub={value ? `${formatNumber((invoiced / value) * 100, 1)}% од вредноста` : undefined} />
        <Kpi label="Непредвидени работи" value={formatCompact(d.unforeseen_total)} unit="ден." tone={num(d.unforeseen_total) > 0 ? "attention" : undefined} />
        <Kpi label="Активни инженери" value={d.engineers_active} />
      </Kpis>
      <Panel title="Извршување" sub="Изведено и фактурирано наспроти вредноста на проектот">
        <div className="stack-sm">
          <Bullet budget={value} actual={invoiced} committed={Math.max(0, executed - invoiced)} />
          <div className="legend" style={{ marginBottom: 0 }}>
            <span><span className="swatch" style={{ background: "var(--series-1)" }} />Фактурирано <span className="lv">{formatMoney(invoiced)}</span></span>
            <span><span className="swatch" style={{ background: "color-mix(in srgb, var(--series-2) 30%, transparent)" }} />Изведено, нефактурирано <span className="lv">{formatMoney(Math.max(0, executed - invoiced))}</span></span>
            <span><span className="swatch" style={{ background: "var(--ink)", width: 3 }} />Вредност <span className="lv">{formatMoney(value)}</span></span>
          </div>
        </div>
      </Panel>
      {d.over.length || d.under.length ? (
        <div className="grid-2">
          {([["Повеќе од договореното", d.over, "danger"], ["Помалку од договореното", d.under, "info"]] as const).map(([title, list, tone]) => (
            <Panel key={title} title={title} sub={`${list.length} ставки`} flush>
              {!list.length ? <EmptyState compact title="Нема" /> : (
                <div className="table-wrap" style={{ maxHeight: 300 }}>
                  <table className="table compact">
                    <thead><tr><th>Бр.</th><th>Ставка</th><th className="num">Разлика</th><th className="num">Вредност</th></tr></thead>
                    <tbody>{list.map((e) => (
                      <tr key={e.boq_item}><td className="nowrap">{e.number}</td><td className="wrap">{e.title}</td>
                        <td className="num nowrap">{formatNumber(e.qty, 2)} {e.unit}</td>
                        <td className="num"><Badge tone={tone} plain>{formatMoney(e.value)}</Badge></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </Panel>
          ))}
        </div>
      ) : null}
      <Panel title="Предмер" sub={boq.data ? `Вкупно ${formatMoney(boq.data.total)} ден.` : undefined} flush>
        {boq.isLoading ? <Spinner /> : !boq.data?.rows.length ? <EmptyState compact title="Проектот нема предмер" /> : (
          <div className="table-wrap" style={{ maxHeight: 480 }}>
            <table className="table compact">
              <thead><tr><th>Бр.</th><th>Опис</th><th>Ед.</th><th className="num">Количина</th><th className="num">Ед. цена</th><th className="num">Вкупно</th></tr></thead>
              <tbody>
                {boq.data.rows.map((r) => {
                  const heading = r.row_type && r.row_type !== "ITEM";
                  return (
                    <tr key={r.id} style={heading ? { background: "var(--surface-2)", fontWeight: 600 } : undefined}>
                      <td className="nowrap">{String(r.number ?? "")}</td>
                      <td className="wrap" style={{ paddingLeft: 12 + r.depth * 16 }}>{String(r.title ?? r.description ?? "")}</td>
                      <td>{String(r.unit ?? "")}</td>
                      <td className="num">{heading ? "" : formatNumber(r.quantity, 2)}</td>
                      <td className="num">{heading ? "" : formatMoney(r.unit_price)}</td>
                      <td className="num">{heading ? "" : formatMoney(r.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ── partner: approvals and transaction gates ────────────────────────────────

function PartnerOverview({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const q = useQuery({ queryKey: ["partner-overview", row.id, row.version], queryFn: () => api.get<Record<string, any>>(`${meta.endpoint}${row.id}/overview/`) }); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (q.isLoading) return <SkeletonPanel height={160} />;
  if (q.error || !q.data) return null;
  const d = q.data;
  const gates: [string, { allowed: boolean; reason: string }][] = [["Плаќања", d.transact_payment], ["Договори", d.transact_contract]];
  const issues = (d.activation_issues ?? []) as { message?: string; code?: string; field?: string }[];
  return (
    <div className="grid-2">
      <Panel title="Одобрувања" sub={`${d.approvals_done} од ${d.approvals_total} задолжителни`}>
        <div className="stack-sm">
          <Meter value={d.approvals_done} max={d.approvals_total || 1} label="Одобрувања" />
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }} className="stack-sm">
            {(d.approval_rows ?? []).map((r: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const status = String(r.approval?.status ?? "");
              const ok = /APPROVED/.test(status), bad = /REJECT/.test(status);
              return (
                <li key={r.role} className="row-tight">
                  {ok ? <CheckCircle2 aria-hidden style={{ width: 18, color: "var(--success)" }} /> : bad ? <XCircle aria-hidden style={{ width: 18, color: "var(--danger)" }} /> : <Circle aria-hidden style={{ width: 18, color: "var(--ink-faint)" }} />}
                  <span style={{ flex: 1 }}>{r.label}{r.required ? "" : <span className="muted small"> (незадолжително)</span>}</span>
                  {r.approval ? <Badge tone={statusTone(status)}>{String(r.approval.status_display ?? status)}</Badge> : <span className="small muted">чека</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>
      <Panel title="Може ли да се работи со партнерот">
        <div className="stack-sm">
          {gates.map(([label, g]) => g ? (
            <div key={label} className="row-tight" style={{ alignItems: "flex-start" }}>
              {g.allowed ? <CheckCircle2 aria-hidden style={{ width: 18, color: "var(--success)", flex: "none" }} /> : <XCircle aria-hidden style={{ width: 18, color: "var(--danger)", flex: "none" }} />}
              <span><strong>{label}:</strong> {g.allowed ? "дозволено" : "блокирано"}{g.reason ? <span className="small muted"> — {g.reason}</span> : null}</span>
            </div>
          ) : null)}
          {issues.length ? (
            <Alert tone="warning" title="Пред активирање треба да се дополни">
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{issues.map((i, k) => <li key={k}>{i.message ?? i.code}</li>)}</ul>
            </Alert>
          ) : null}
          {d.pending_bank_changes ? <Alert tone="info">Промени на банкарска сметка што чекаат проверка: {d.pending_bank_changes}</Alert> : null}
        </div>
      </Panel>
    </div>
  );
}

// ── budget ───────────────────────────────────────────────────────────────────

function BudgetSummary({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const q = useQuery({
    queryKey: ["budget-summary", row.id, row.version],
    queryFn: () => api.get<{
      total_budget: string; total_actual: string; committed: string; variance: string; pct: number; overrun: boolean;
      rows: { category: string; label: string; budget: string; actual: string; variance: string; pct: number; over: boolean }[];
    }>(`${meta.endpoint}${row.id}/summary/`),
  });
  if (q.isLoading) return <SkeletonPanel />;
  if (!q.data) return null;
  const s = q.data;
  return (
    <div className="stack">
      {s.overrun ? <Alert tone="danger" title="Буџетот е надминат">Потрошеното ја надминува планираната вредност за {formatMoney(Math.abs(num(s.variance)))} ден.</Alert> : null}
      <Kpis>
        <Kpi label="Буџет" value={formatCompact(s.total_budget)} unit="ден." />
        <Kpi label="Потрошено" value={formatCompact(s.total_actual)} unit="ден." sub={`${formatNumber(s.pct, 1)}% од буџетот`} tone={s.overrun ? "alarm" : undefined} />
        <Kpi label="Нарачано, неплатено" value={formatCompact(s.committed)} unit="ден." />
        <Kpi label="Преостанато" value={formatCompact(s.variance)} unit="ден." />
      </Kpis>
      <Panel title="По категорија" sub="Потрошено (темно), нарачано (светло) и буџет (линија)">
        <div className="stack">
          {s.rows.map((r) => (
            <div key={r.category} className="stack-sm" style={{ gap: 4 }}>
              <div className="row-tight small">
                <span style={{ flex: 1 }}>{r.label} {r.over ? <Badge tone="danger">надминато</Badge> : null}</span>
                <span className="num">{formatMoney(r.actual)} / {formatMoney(r.budget)}</span>
                <span className="num muted" style={{ width: 52, textAlign: "right" }}>{formatNumber(r.pct, 0)}%</span>
              </div>
              <Bullet budget={num(r.budget)} actual={num(r.actual)} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── payroll ──────────────────────────────────────────────────────────────────

const BREAKDOWN_LABELS: Record<string, string> = {
  pio: "ПИО", health: "Здравствено", unemployment: "Невработеност", additional_health: "Дополнително здравствено",
  injury: "Повреда при работа", income_tax: "Персонален данок",
};

function PayrollStatutory({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const q = useQuery({
    queryKey: ["statutory", row.id, row.version],
    queryFn: () => api.get<{ bruto: string; pridonesi_vkupno: string; danocna_osnova: string; danok: string; neto: string;
      breakdown: Record<string, string>; frozen: boolean }>(`${meta.endpoint}${row.id}/statutory/`),
  });
  if (!q.data) return q.isLoading ? <SkeletonPanel height={160} /> : null;
  const s = q.data;
  return (
    <Panel title="Пресметка од бруто до нето" sub={s.frozen ? "Заклучена пресметка" : "Прелиминарна пресметка — може да се промени"}
      actions={<div className="row-tight">
        {(["payslip", "combined", "statutory"] as const).map((kind) => (
          <a key={kind} className="btn sm" target="_blank" rel="noreferrer" href={`${meta.endpoint}${row.id}/pdf/?kind=${kind}`}>
            <FileText aria-hidden />{kind === "payslip" ? "Платен лист" : kind === "combined" ? "Комбиниран" : "Образец"}
          </a>
        ))}
      </div>}>
      <dl className="fact-list">
        <div><dt>Бруто плата</dt><dd className="num">{formatMoney(s.bruto)}</dd></div>
        {Object.entries(s.breakdown).map(([k, v]) => <div key={k}><dt style={{ paddingLeft: 12 }}>− {BREAKDOWN_LABELS[k] ?? k}</dt><dd className="num">{formatMoney(v)}</dd></div>)}
        <div><dt>Придонеси вкупно</dt><dd className="num">{formatMoney(s.pridonesi_vkupno)}</dd></div>
        <div><dt>Даночна основа</dt><dd className="num">{formatMoney(s.danocna_osnova)}</dd></div>
        <div><dt>Персонален данок</dt><dd className="num">{formatMoney(s.danok)}</dd></div>
        <div><dt><strong>Нето плата</strong></dt><dd className="num" style={{ fontSize: 18 }}>{formatMoney(s.neto)}</dd></div>
      </dl>
    </Panel>
  );
}

function MpinDetail({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const employees = (row.employees as Record<string, unknown>[] | undefined) ?? [];
  const checks = (row.checks as { unreconciled: number[]; missing_municipality: number[]; missing_company_details: string[] }) ??
    { unreconciled: [], missing_municipality: [], missing_company_details: [] };
  return (
    <Panel title="Вработени во пријавата" sub={`${employees.length} вработени`} flush
      actions={<div className="row-tight">
        <Button size="sm" icon={Download} onClick={() => void download(`${meta.endpoint}${row.id}/txt/`)}>TXT за УЈП</Button>
        <Button size="sm" icon={Download} onClick={() => void download(`${meta.endpoint}${row.id}/xml/`)}>XML</Button>
      </div>}>
      <div className="stack-sm" style={{ padding: "0 16px" }}>
        {checks.missing_company_details.length ? <Alert tone="warning" title="Недостасуваат податоци за обврзникот">{checks.missing_company_details.join(", ")}</Alert> : null}
        {checks.unreconciled.length ? <Alert tone="danger">Редови што не се усогласени: {checks.unreconciled.length}</Alert> : null}
        {checks.missing_municipality.length ? <Alert tone="warning">Вработени без шифра на општина: {checks.missing_municipality.length}</Alert> : null}
      </div>
      <div className="table-wrap" style={{ maxHeight: 520 }}>
        <table className="table compact">
          <thead><tr><th className="num">#</th><th>ЕМБГ</th><th>Општина</th><th className="num">Бруто</th><th className="num">ПИО</th>
            <th className="num">Здравство</th><th className="num">Данок</th><th className="num">Нето</th><th /></tr></thead>
          <tbody>
            {employees.map((e) => (
              <tr key={String(e.id)}>
                <td className="num">{String(e.sequence)}</td>
                <td className="mono">{String(e.embg ?? "")}</td>
                <td>{String(e.municipality_code ?? "") || <span className="tone-warning">недостасува</span>}</td>
                <td className="num">{formatMoney(e.gross)}</td>
                <td className="num">{formatMoney(e.pio)}</td>
                <td className="num">{formatMoney(e.health)}</td>
                <td className="num">{formatMoney(e.income_tax)}</td>
                <td className="num">{formatMoney(e.net)}</td>
                <td>{e.reconciles ? null : <Badge tone="danger">неусогласено</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── asset stocktake ──────────────────────────────────────────────────────────

function StocktakeSummary({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const q = useQuery({ queryKey: ["stocktake-summary", row.id, row.version], queryFn: () => api.get<Record<string, unknown>>(`${meta.endpoint}${row.id}/summary/`) });
  if (q.isLoading) return <Skeleton height={90} />;
  if (!q.data) return null;
  const entries = Object.entries(q.data).filter(([, v]) => typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)));
  if (!entries.length) return null;
  const LABELS: Record<string, string> = { total: "Вкупно ставки", counted: "Пописани", found: "Пронајдени", missing: "Недостасуваат",
    moved: "На друга локација", pending: "Непописани", surplus: "Вишок" };
  return (
    <Kpis>
      {entries.map(([k, v]) => <Kpi key={k} label={LABELS[k] ?? k.replace(/_/g, " ")} value={formatNumber(v, 0)}
        tone={/missing|surplus/.test(k) && num(v) > 0 ? "attention" : undefined} />)}
    </Kpis>
  );
}

/** Nested row fields shown by a custom panel instead of the generic table. */
export const HANDLED_ROWS: Record<string, string[]> = { "offers.offers": ["items"] };

export const CUSTOM: Record<string, Extension> = {
  "offers.offers": OfferItems,
  "procurement.rfq": QuotationCompare,
  "budget.budgets": BudgetSummary,
  "hr.payroll": PayrollStatutory,
  "hr.mpin": MpinDetail,
  "master_data.projects": ProjectOverview,
  "partners.partners": PartnerOverview,
  "accounting.asset_stocktake": StocktakeSummary,
};

/** Panels shown above the record's fields (they are what people open the record for). */
export const PANELS_FIRST = new Set(["master_data.projects", "budget.budgets", "partners.partners", "accounting.asset_stocktake", "hr.payroll"]);
