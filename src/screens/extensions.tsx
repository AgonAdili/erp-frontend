/** What a record's detail page adds: child resources as tabs (filtered to the record, with an Add drawer that
 * fills the link) and computed panels (project overview and BOQ, budget vs actual, partner approvals,
 * payroll calculation, MPIN, offer items, quotation comparison). Keyed by the server's resource key. */
import { useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Download, FileText, Plus, XCircle } from "@/components/icons";

import { api, API_BASE, download } from "@/api/client";
import type { ResourceMeta, Row } from "@/api/types";
import { Bullet, Kpi, Kpis, Meter } from "@/components/dashboard";
import {
  Alert, Badge, Button, Drawer, EmptyState, ErrorState, Panel, Skeleton, SkeletonPanel, Spinner, statusTone,
} from "@/components/ui";
import { t } from "@/i18n/mk";
import { formatWhole, formatMoney, formatNumber, num } from "@/lib/format";
import { useInvalidateResource, useMeta } from "@/meta/hooks";

import { OfferItems } from "./offerItems";
import { QuotationCompare } from "./procurement";
import { ResourceForm } from "./ResourceForm";
import { ResourceList } from "./ResourceList";
import { tr } from "@/i18n";

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
    <section className="ea-panel" style={{ overflow: "hidden" }} aria-label={m.title}>
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
    { path: "inventory/document-lines", fk: "document", label: tr("Ставки") },
    { path: "inventory/document-costs", fk: "document", label: tr("Зависни трошоци") },
  ],
  "master_data.projects": [
    { path: "projects/engineers", fk: "project", label: tr("Инженери") },
    { path: "projects/diary-books", fk: "project", label: tr("Градежен дневник") },
    { path: "projects/measurement-books", fk: "project", label: tr("Градежни книги") },
    { path: "projects/certificates", fk: "project", label: tr("Ситуации") },
    { path: "budget/costs", fk: "project", label: tr("Рачни трошоци") },
  ],
  "projects.boqs": [{ path: "projects/boq-items", fk: "boq", label: tr("Ставки") }],
  "projects.certificates": [{ path: "projects/certificate-items", fk: "certificate", label: tr("Ставки") }],
  "projects.diary_books": [{ path: "projects/diary-entries", fk: "book", label: tr("Записи во дневникот") }],
  "projects.measurement_books": [{ path: "projects/measurement-pages", fk: "book", label: tr("Страни") }],
  "procurement.requests": [
    { path: "procurement/rfqs", fk: "material_request", label: tr("Барања за понуди") },
    { path: "procurement/purchase-orders", fk: "material_request", label: tr("Нарачки") },
  ],
  "procurement.rfq": [
    { path: "procurement/rfq-suppliers", fk: "rfq", label: tr("Добавувачи") },
    { path: "procurement/quotations", fk: "rfq", label: tr("Понуди") },
  ],
  "procurement.purchase_orders": [{ path: "procurement/goods-receipts", fk: "purchase_order", label: tr("Приемници") }],
  "offers.requests": [
    { path: "offers/site-visits", fk: "request", label: tr("Увиди на терен") },
    { path: "offers/offers", fk: "request", label: tr("Понуди") },
  ],
  "offers.offers": [
    { path: "offers/followups", fk: "offer", label: tr("Следења") },
    { path: "offers/approval-log", fk: "offer", label: tr("Тек на одобрување") },
  ],
  "work_orders.list": [
    { path: "workorders/resources", fk: "work_order", label: tr("Ресурси") },
    { path: "workorders/materials", fk: "work_order", label: tr("Материјали") },
    { path: "workorders/daily-reports", fk: "work_order", label: tr("Дневни извештаи") },
  ],
  "master_data.employees": [
    { path: "people/employment-records", fk: "employee", label: tr("Вработување") },
    { path: "hr/employee-documents", fk: "employee", label: tr("Документи") },
    { path: "hr/work-experience", fk: "employee", label: tr("Искуство") },
    { path: "hr/leaves", fk: "employee", label: tr("Отсуства") },
    { path: "hr/loans", fk: "employee", label: tr("Заеми") },
    { path: "hr/bailiffs", fk: "employee", label: tr("Извршувања") },
    { path: "hr/disciplinary-actions", fk: "employee", label: tr("Дисциплински мерки") },
    { path: "hr/payroll", fk: "employee", label: tr("Плати") },
  ],
  "fleet.vehicles": [
    { path: "fleet/documents", fk: "vehicle", label: tr("Документи") },
    { path: "fleet/schedules", fk: "vehicle", label: tr("Сервиси") },
    { path: "fleet/maintenance", fk: "vehicle", label: tr("Одржување") },
    { path: "fleet/daily-reports", fk: "vehicle", label: tr("Дневни извештаи") },
  ],
  "accounting.fixed_assets": [
    { path: "assets/ledger", fk: "asset", label: tr("Картица") },
    { path: "assets/documents", fk: "asset", label: tr("Документи") },
  ],
  "accounting.depreciation": [{ path: "assets/depreciation-entries", fk: "run", label: tr("Ставки") }],
  "accounting.asset_stocktake": [{ path: "assets/stocktake-lines", fk: "stocktake", label: tr("Ставки од попис") }],
  "accounting.journal_entries": [{ path: "accounting/ledger", fk: "journal_entry", label: tr("Ставки во главна книга") }],
  "dms.documents": [
    { path: "dms/relations", fk: "from_document", label: tr("Врски") },
    { path: "dms/links", fk: "document", label: tr("Поврзани записи") },
  ],
  "dms.classification": [{ path: "dms/retention-rules", fk: "classification", label: tr("Правила за чување") }],
  "dms.registers": [
    { path: "dms/record-types", fk: "register", label: tr("Видови документи") },
    { path: "dms/ledger", fk: "register", label: tr("Архивска книга") },
  ],
  "finance.mortgages": [{ path: "finance/loan-payments", fk: "loan", label: tr("Плаќања на рати") }],
  "budget.budgets": [{ path: "budget/alerts", fk: "budget", label: tr("Предупредувања") }],
  "hr.rate_sets": [{ path: "hr/contribution-rates", fk: "rate_set", label: tr("Придонеси") }],
  "workflow.definitions": [{ path: "workflow/stages", fk: "definition", label: tr("Фази") }],
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
        <Kpi label={tr("Вредност на проектот")} value={formatWhole(value)} unit="MKD" sub={d.value_source || undefined} />
        <Kpi label={tr("Изведено (градежна книга)")} value={formatWhole(executed)} unit="MKD" sub={tr("{0} % од вредноста", formatNumber(pctExec, 1))} />
        <Kpi label={tr("Фактурирано (платени ситуации)")} value={formatWhole(invoiced)} unit="MKD" sub={value ? tr("{0} % од вредноста", formatNumber((invoiced / value) * 100, 1)) : undefined} />
        <Kpi label={tr("Непредвидени работи")} value={formatWhole(d.unforeseen_total)} unit="MKD" tone={num(d.unforeseen_total) > 0 ? "attention" : undefined} />
        <Kpi label={tr("Активни инженери")} value={d.engineers_active} />
      </Kpis>
      <Panel title={tr("Извршување")} sub={tr("Изведено и фактурирано наспроти вредноста на проектот")}>
        <div className="stack-sm">
          <Bullet budget={value} actual={invoiced} committed={Math.max(0, executed - invoiced)} />
          <div className="legend" style={{ marginBottom: 0 }}>
            <span><span className="swatch" style={{ background: "var(--ea-chart-1)" }} />{tr("Фактурирано")}{" "}<span className="lv">{formatMoney(invoiced)}</span></span>
            <span><span className="swatch" style={{ background: "color-mix(in srgb, var(--ea-chart-2) 30%, transparent)" }} />{tr("Изведено, нефактурирано")}{" "}<span className="lv">{formatMoney(Math.max(0, executed - invoiced))}</span></span>
            <span><span className="swatch" style={{ background: "var(--ea-text)", width: 3 }} />{tr("Вредност")}{" "}<span className="lv">{formatMoney(value)}</span></span>
          </div>
        </div>
      </Panel>
      {d.over.length || d.under.length ? (
        <div className="grid-2">
          {([[tr("Повеќе од договореното"), d.over, "danger"], [tr("Помалку од договореното"), d.under, "info"]] as const).map(([title, list, tone]) => (
            <Panel key={title} title={title} sub={tr("{0} ставки", list.length)} flush>
              {!list.length ? <EmptyState compact title={tr("Нема")} /> : (
                <div className="table-responsive table-wrap" style={{ maxHeight: 300 }}>
                  <table className="table ea-table compact">
                    <thead><tr><th>{tr("Бр.")}</th><th>{tr("Ставка")}</th><th className="num">{tr("Разлика")}</th><th className="num">{tr("Вредност")}</th></tr></thead>
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
      <Panel title={tr("Предмер")} sub={boq.data ? tr("Вкупно {0} MKD", formatMoney(boq.data.total)) : undefined} flush>
        {boq.isLoading ? <Spinner /> : !boq.data?.rows.length ? <EmptyState compact title={tr("Проектот нема предмер")} /> : (
          <div className="table-responsive table-wrap" style={{ maxHeight: 480 }}>
            <table className="table ea-table compact">
              <thead><tr><th>{tr("Бр.")}</th><th>{tr("Опис")}</th><th>{tr("Ед.")}</th><th className="num">{tr("Количина")}</th><th className="num">{tr("Ед. цена")}</th><th className="num">{tr("Вкупно")}</th></tr></thead>
              <tbody>
                {boq.data.rows.map((r) => {
                  const heading = r.row_type && r.row_type !== "ITEM";
                  return (
                    <tr key={r.id} style={heading ? { background: "var(--ea-subtle)", fontWeight: 600 } : undefined}>
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
  const gates: [string, { allowed: boolean; reason: string }][] = [[tr("Плаќања"), d.transact_payment], [tr("Договори"), d.transact_contract]];
  const issues = (d.activation_issues ?? []) as { message?: string; code?: string; field?: string }[];
  return (
    <div className="grid-2">
      <Panel title={tr("Одобрувања")} sub={tr("{0} од {1} задолжителни", d.approvals_done, d.approvals_total)}>
        <div className="stack-sm">
          <Meter value={d.approvals_done} max={d.approvals_total || 1} label={tr("Одобрувања")} />
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }} className="stack-sm">
            {(d.approval_rows ?? []).map((r: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const status = String(r.approval?.status ?? "");
              const ok = /APPROVED/.test(status), bad = /REJECT/.test(status);
              return (
                <li key={r.role} className="row-tight">
                  {ok ? <CheckCircle2 aria-hidden style={{ width: 18, color: "var(--ea-go)" }} /> : bad ? <XCircle aria-hidden style={{ width: 18, color: "var(--ea-stop)" }} /> : <Circle aria-hidden style={{ width: 18, color: "var(--ea-text-3)" }} />}
                  <span style={{ flex: 1 }}>{r.label}{r.required ? "" : <span className="muted small">{" "}{tr("(незадолжително)")}</span>}</span>
                  {r.approval ? <Badge tone={statusTone(status)}>{String(r.approval.status_display ?? status)}</Badge> : <span className="small muted">{tr("чека")}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>
      <Panel title={tr("Може ли да се работи со партнерот")}>
        <div className="stack-sm">
          {gates.map(([label, g]) => g ? (
            <div key={label} className="row-tight" style={{ alignItems: "flex-start" }}>
              {g.allowed ? <CheckCircle2 aria-hidden style={{ width: 18, color: "var(--ea-go)", flex: "none" }} /> : <XCircle aria-hidden style={{ width: 18, color: "var(--ea-stop)", flex: "none" }} />}
              <span><strong>{label}:</strong> {g.allowed ? tr("дозволено") : tr("блокирано")}{g.reason ? <span className="small muted"> — {g.reason}</span> : null}</span>
            </div>
          ) : null)}
          {issues.length ? (
            <Alert tone="warning" title={tr("Пред активирање треба да се дополни")}>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{issues.map((i, k) => <li key={k}>{i.message ?? i.code}</li>)}</ul>
            </Alert>
          ) : null}
          {d.pending_bank_changes ? <Alert tone="info">{tr("Промени на банкарска сметка што чекаат проверка:")}{" "}{d.pending_bank_changes}</Alert> : null}
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
      {s.overrun ? <Alert tone="danger" title={tr("Буџетот е надминат")}>{tr("Потрошеното ја надминува планираната вредност за")}{" "}{formatMoney(Math.abs(num(s.variance)))} MKD</Alert> : null}
      <Kpis>
        <Kpi label={tr("Буџет")} value={formatWhole(s.total_budget)} unit="MKD" />
        <Kpi label={tr("Потрошено")} value={formatWhole(s.total_actual)} unit="MKD" sub={tr("{0} % од буџетот", formatNumber(s.pct, 1))} tone={s.overrun ? "alarm" : undefined} />
        <Kpi label={tr("Нарачано, неплатено")} value={formatWhole(s.committed)} unit="MKD" />
        <Kpi label={tr("Преостанато")} value={formatWhole(s.variance)} unit="MKD" />
      </Kpis>
      <Panel title={tr("По категорија")} sub={tr("Потрошено (темно), нарачано (светло) и буџет (линија)")}>
        <div className="stack">
          {s.rows.map((r) => (
            <div key={r.category} className="stack-sm" style={{ gap: 4 }}>
              <div className="row-tight small">
                <span style={{ flex: 1 }}>{r.label} {r.over ? <Badge tone="danger">{tr("надминато")}</Badge> : null}</span>
                <span className="num">{formatMoney(r.actual)} / {formatMoney(r.budget)}</span>
                <span className="num muted" style={{ width: 52, textAlign: "right" }}>{formatNumber(r.pct, 0)} %</span>
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
  pio: tr("ПИО"), health: tr("Здравствено"), unemployment: tr("Невработеност"), additional_health: tr("Дополнително здравствено"),
  injury: tr("Повреда при работа"), income_tax: tr("Персонален данок"),
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
    <Panel title={tr("Пресметка од бруто до нето")} sub={s.frozen ? tr("Заклучена пресметка") : tr("Прелиминарна пресметка — може да се промени")}
      actions={<div className="row-tight">
        {(["payslip", "combined", "statutory"] as const).map((kind) => (
          <a key={kind} className="btn btn-outline-secondary btn-sm" target="_blank" rel="noreferrer" href={`${meta.endpoint}${row.id}/pdf/?kind=${kind}`}>
            <FileText aria-hidden />{kind === "payslip" ? tr("Платен лист") : kind === "combined" ? tr("Комбиниран") : tr("Образец")}
          </a>
        ))}
      </div>}>
      <dl className="fact-list">
        <div><dt>{tr("Бруто плата")}</dt><dd className="num">{formatMoney(s.bruto)}</dd></div>
        {Object.entries(s.breakdown).map(([k, v]) => <div key={k}><dt style={{ paddingLeft: 12 }}>− {BREAKDOWN_LABELS[k] ?? k}</dt><dd className="num">{formatMoney(v)}</dd></div>)}
        <div><dt>{tr("Придонеси вкупно")}</dt><dd className="num">{formatMoney(s.pridonesi_vkupno)}</dd></div>
        <div><dt>{tr("Даночна основа")}</dt><dd className="num">{formatMoney(s.danocna_osnova)}</dd></div>
        <div><dt>{tr("Персонален данок")}</dt><dd className="num">{formatMoney(s.danok)}</dd></div>
        <div><dt><strong>{tr("Нето плата")}</strong></dt><dd className="num" style={{ fontSize: 18 }}>{formatMoney(s.neto)}</dd></div>
      </dl>
    </Panel>
  );
}

function MpinDetail({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const employees = (row.employees as Record<string, unknown>[] | undefined) ?? [];
  const checks = (row.checks as { unreconciled: number[]; missing_municipality: number[]; missing_company_details: string[] }) ??
    { unreconciled: [], missing_municipality: [], missing_company_details: [] };
  return (
    <Panel title={tr("Вработени во пријавата")} sub={tr("{0} вработени", employees.length)} flush
      actions={<div className="row-tight">
        <Button size="sm" icon={Download} onClick={() => void download(`${meta.endpoint}${row.id}/txt/`)}>{tr("TXT за УЈП")}</Button>
        <Button size="sm" icon={Download} onClick={() => void download(`${meta.endpoint}${row.id}/xml/`)}>XML</Button>
      </div>}>
      <div className="stack-sm" style={{ padding: "0 16px" }}>
        {checks.missing_company_details.length ? <Alert tone="warning" title={tr("Недостасуваат податоци за обврзникот")}>{checks.missing_company_details.join(", ")}</Alert> : null}
        {checks.unreconciled.length ? <Alert tone="danger">{tr("Редови што не се усогласени:")}{" "}{checks.unreconciled.length}</Alert> : null}
        {checks.missing_municipality.length ? <Alert tone="warning">{tr("Вработени без шифра на општина:")}{" "}{checks.missing_municipality.length}</Alert> : null}
      </div>
      <div className="table-responsive table-wrap" style={{ maxHeight: 520 }}>
        <table className="table ea-table compact">
          <thead><tr><th className="num">#</th><th>{tr("ЕМБГ")}</th><th>{tr("Општина")}</th><th className="num">{tr("Бруто")}</th><th className="num">{tr("ПИО")}</th>
            <th className="num">{tr("Здравство")}</th><th className="num">{tr("Данок")}</th><th className="num">{tr("Нето")}</th><th /></tr></thead>
          <tbody>
            {employees.map((e) => (
              <tr key={String(e.id)}>
                <td className="num">{String(e.sequence)}</td>
                <td className="mono">{String(e.embg ?? "")}</td>
                <td>{String(e.municipality_code ?? "") || <span className="tone-warning">{tr("недостасува")}</span>}</td>
                <td className="num">{formatMoney(e.gross)}</td>
                <td className="num">{formatMoney(e.pio)}</td>
                <td className="num">{formatMoney(e.health)}</td>
                <td className="num">{formatMoney(e.income_tax)}</td>
                <td className="num">{formatMoney(e.net)}</td>
                <td>{e.reconciles ? null : <Badge tone="danger">{tr("неусогласено")}</Badge>}</td>
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
  const LABELS: Record<string, string> = { total: tr("Вкупно ставки"), counted: tr("Пописани"), found: tr("Пронајдени"), missing: tr("Недостасуваат"),
    moved: tr("На друга локација"), pending: tr("Непописани"), surplus: tr("Вишок") };
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
