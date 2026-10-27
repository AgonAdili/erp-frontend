/** What a record's detail page shows under its fields: child resources (filtered to the record, with an Add
 * form that fills the link) and a few computed panels. Keyed by the server's resource key. */
import { useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, API_BASE, download } from "@/api/client";
import type { ResourceMeta, Row } from "@/api/types";
import { Alert, Badge, Button, Modal, Spinner, statusTone } from "@/components/ui";
import { t } from "@/i18n/mk";
import { formatMoney } from "@/lib/format";
import { useInvalidateResource, useMeta } from "@/meta/hooks";

import { OfferItems } from "./offerItems";
import { QuotationCompare } from "./procurement";
import { ResourceForm } from "./ResourceForm";
import { ResourceList } from "./ResourceList";

interface ChildSpec {
  path: string;      // "inventory/document-lines"
  fk: string;        // filter / link field on the child
}

export function ChildTable({ spec, parent }: { spec: ChildSpec; parent: Row }) {
  const endpoint = `${API_BASE}/${spec.path}/`;
  const meta = useMeta(endpoint);
  const [adding, setAdding] = useState(false);
  const invalidate = useInvalidateResource(endpoint);
  if (meta.isLoading) return <Spinner />;
  if (!meta.data || !meta.data.permissions.view) return null;
  const m = meta.data;
  return (
    <div className="card stack">
      <div className="row">
        <h2 style={{ margin: 0 }}>{m.title}</h2>
        <span style={{ flex: 1 }} />
        {m.permissions.add ? <Button size="sm" onClick={() => setAdding(true)}>+ {t.add}</Button> : null}
      </div>
      <ResourceList meta={m} baseQuery={{ [spec.fk]: parent.id }} embedded />
      {adding ? (
        <Modal title={`${m.title_singular} — ${t.add}`} onClose={() => setAdding(false)}>
          <ResourceForm meta={m} defaults={{ [spec.fk]: parent.id }}
            onSaved={() => { setAdding(false); invalidate(); }} onCancel={() => setAdding(false)} />
        </Modal>
      ) : null}
    </div>
  );
}

const CHILDREN: Record<string, ChildSpec[]> = {
  "inventory.documents": [{ path: "inventory/document-lines", fk: "document" }, { path: "inventory/document-costs", fk: "document" }],
  "master_data.projects": [
    { path: "projects/engineers", fk: "project" }, { path: "projects/diary-books", fk: "project" },
    { path: "projects/measurement-books", fk: "project" }, { path: "projects/certificates", fk: "project" },
    { path: "budget/costs", fk: "project" },
  ],
  "projects.boqs": [{ path: "projects/boq-items", fk: "boq" }],
  "projects.certificates": [{ path: "projects/certificate-items", fk: "certificate" }],
  "projects.diary_books": [{ path: "projects/diary-entries", fk: "book" }],
  "projects.measurement_books": [{ path: "projects/measurement-pages", fk: "book" }],
  "procurement.requests": [{ path: "procurement/rfqs", fk: "material_request" }, { path: "procurement/purchase-orders", fk: "material_request" }],
  "procurement.rfq": [{ path: "procurement/rfq-suppliers", fk: "rfq" }, { path: "procurement/quotations", fk: "rfq" }],
  "procurement.purchase_orders": [{ path: "procurement/goods-receipts", fk: "purchase_order" }],
  "offers.requests": [{ path: "offers/site-visits", fk: "request" }, { path: "offers/offers", fk: "request" }],
  "offers.offers": [{ path: "offers/followups", fk: "offer" }, { path: "offers/approval-log", fk: "offer" }],
  "work_orders.list": [
    { path: "workorders/resources", fk: "work_order" }, { path: "workorders/materials", fk: "work_order" },
    { path: "workorders/daily-reports", fk: "work_order" },
  ],
  "master_data.employees": [
    { path: "people/employment-records", fk: "employee" }, { path: "hr/employee-documents", fk: "employee" },
    { path: "hr/work-experience", fk: "employee" }, { path: "hr/leaves", fk: "employee" },
    { path: "hr/loans", fk: "employee" }, { path: "hr/bailiffs", fk: "employee" },
    { path: "hr/disciplinary-actions", fk: "employee" }, { path: "hr/payroll", fk: "employee" },
  ],
  "fleet.vehicles": [
    { path: "fleet/documents", fk: "vehicle" }, { path: "fleet/schedules", fk: "vehicle" },
    { path: "fleet/maintenance", fk: "vehicle" }, { path: "fleet/daily-reports", fk: "vehicle" },
  ],
  "accounting.fixed_assets": [{ path: "assets/ledger", fk: "asset" }, { path: "assets/documents", fk: "asset" }],
  "accounting.depreciation": [{ path: "assets/depreciation-entries", fk: "run" }],
  "accounting.asset_stocktake": [{ path: "assets/stocktake-lines", fk: "stocktake" }],
  "accounting.journal_entries": [{ path: "accounting/ledger", fk: "journal_entry" }],
  "dms.documents": [{ path: "dms/relations", fk: "from_document" }, { path: "dms/links", fk: "document" }],
  "dms.classification": [{ path: "dms/retention-rules", fk: "classification" }],
  "dms.registers": [{ path: "dms/record-types", fk: "register" }, { path: "dms/ledger", fk: "register" }],
  "finance.mortgages": [{ path: "finance/loan-payments", fk: "loan" }],
  "budget.budgets": [{ path: "budget/alerts", fk: "budget" }],
  "hr.rate_sets": [{ path: "hr/contribution-rates", fk: "rate_set" }],
  "workflow.definitions": [{ path: "workflow/stages", fk: "definition" }],
};

type Extension = ComponentType<{ meta: ResourceMeta; row: Row }>;

function BudgetSummary({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const q = useQuery({
    queryKey: ["budget-summary", row.id, row.version],
    queryFn: () => api.get<{
      total_budget: string; total_actual: string; committed: string; variance: string; pct: number; overrun: boolean;
      rows: { category: string; label: string; budget: string; actual: string; variance: string; pct: number; over: boolean }[];
    }>(`${meta.endpoint}${row.id}/summary/`),
  });
  if (q.isLoading) return <Spinner />;
  if (!q.data) return null;
  const s = q.data;
  return (
    <div className="card stack">
      <h2>Буџет / остварено</h2>
      <div className="kpis">
        <div className="kpi"><div className="label">Буџет</div><div className="value">{formatMoney(s.total_budget)}</div></div>
        <div className="kpi"><div className="label">Потрошено</div><div className="value">{formatMoney(s.total_actual)}</div></div>
        <div className="kpi"><div className="label">Нарачано</div><div className="value">{formatMoney(s.committed)}</div></div>
        <div className="kpi"><div className="label">%</div><div className="value">{s.pct}%</div></div>
      </div>
      {s.overrun ? <Alert tone="danger">Буџетот е надминат.</Alert> : null}
      <table className="table">
        <thead><tr><th>Категорија</th><th className="num">Буџет</th><th className="num">Остварено</th><th className="num">Разлика</th><th className="num">%</th></tr></thead>
        <tbody>
          {s.rows.map((r) => (
            <tr key={r.category}>
              <td>{r.label} {r.over ? <Badge tone="danger">над</Badge> : null}</td>
              <td className="num">{formatMoney(r.budget)}</td>
              <td className="num">{formatMoney(r.actual)}</td>
              <td className="num">{formatMoney(r.variance)}</td>
              <td className="num">{r.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayrollStatutory({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const q = useQuery({
    queryKey: ["statutory", row.id, row.version],
    queryFn: () => api.get<{ bruto: string; pridonesi_vkupno: string; danocna_osnova: string; danok: string; neto: string;
      breakdown: Record<string, string>; frozen: boolean }>(`${meta.endpoint}${row.id}/statutory/`),
  });
  if (!q.data) return q.isLoading ? <Spinner /> : null;
  const s = q.data;
  return (
    <div className="card stack">
      <div className="row">
        <h2 style={{ margin: 0 }}>Бруто пресметка</h2>
        <Badge tone={s.frozen ? "success" : "warning"}>{s.frozen ? "Заклучено" : "Прелиминарно"}</Badge>
        <span style={{ flex: 1 }} />
        {(["payslip", "combined", "statutory"] as const).map((kind) => (
          <a key={kind} className="btn sm" target="_blank" rel="noreferrer"
            href={`${meta.endpoint}${row.id}/pdf/?kind=${kind}`}>
            {kind === "payslip" ? "Платен лист" : kind === "combined" ? "Комбиниран" : "Пресметка (образец)"}
          </a>
        ))}
      </div>
      <dl className="dl">
        <div><dt>Бруто</dt><dd>{formatMoney(s.bruto)}</dd></div>
        <div><dt>Придонеси</dt><dd>{formatMoney(s.pridonesi_vkupno)}</dd></div>
        <div><dt>Даночна основа</dt><dd>{formatMoney(s.danocna_osnova)}</dd></div>
        <div><dt>Данок</dt><dd>{formatMoney(s.danok)}</dd></div>
        <div><dt>Нето</dt><dd>{formatMoney(s.neto)}</dd></div>
        {Object.entries(s.breakdown).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{formatMoney(v)}</dd></div>)}
      </dl>
    </div>
  );
}

function MpinDetail({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const employees = (row.employees as Record<string, unknown>[] | undefined) ?? [];
  const checks = (row.checks as { unreconciled: number[]; missing_municipality: number[]; missing_company_details: string[] }) ??
    { unreconciled: [], missing_municipality: [], missing_company_details: [] };
  return (
    <div className="card stack">
      <div className="row">
        <h2 style={{ margin: 0 }}>Вработени во пријавата</h2>
        <span style={{ flex: 1 }} />
        <Button size="sm" onClick={() => download(`${meta.endpoint}${row.id}/txt/`)}>TXT (УЈП)</Button>
        <Button size="sm" onClick={() => download(`${meta.endpoint}${row.id}/xml/`)}>XML</Button>
      </div>
      {checks.missing_company_details.length ? (
        <Alert tone="warning">Недостасуваат податоци за обврзникот: {checks.missing_company_details.join(", ")}</Alert>
      ) : null}
      {checks.unreconciled.length ? <Alert tone="danger">Редови што не се усогласени: {checks.unreconciled.length}</Alert> : null}
      {checks.missing_municipality.length ? <Alert tone="warning">Без шифра на општина: {checks.missing_municipality.length}</Alert> : null}
      <table className="table">
        <thead><tr><th>#</th><th>ЕМБГ</th><th>Општина</th><th className="num">Бруто</th><th className="num">ПИО</th>
          <th className="num">Здравство</th><th className="num">Данок</th><th className="num">Нето</th><th /></tr></thead>
        <tbody>
          {employees.map((e) => (
            <tr key={String(e.id)}>
              <td>{String(e.sequence)}</td>
              <td className="mono">{String(e.embg ?? "")}</td>
              <td>{String(e.municipality_code ?? "")}</td>
              <td className="num">{formatMoney(e.gross)}</td>
              <td className="num">{formatMoney(e.pio)}</td>
              <td className="num">{formatMoney(e.health)}</td>
              <td className="num">{formatMoney(e.income_tax)}</td>
              <td className="num">{formatMoney(e.net)}</td>
              <td>{e.reconciles ? null : <Badge tone={statusTone("FAILED")}>!</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function childrenOf(key: string): Extension | undefined {
  const specs = CHILDREN[key];
  if (!specs) return undefined;
  const Children: Extension = ({ row }) => (
    <>{specs.map((spec) => <ChildTable key={spec.path} spec={spec} parent={row} />)}</>
  );
  return Children;
}

function combine(...parts: (Extension | undefined)[]): Extension | undefined {
  const list = parts.filter(Boolean) as Extension[];
  if (!list.length) return undefined;
  const Combined: Extension = (props) => <>{list.map((P, i) => <P key={i} {...props} />)}</>;
  return Combined;
}

/** Nested row fields shown by a custom panel instead of the generic table. */
export const HANDLED_ROWS: Record<string, string[]> = { "offers.offers": ["items"] };

const CUSTOM: Record<string, Extension> = {
  "offers.offers": OfferItems,
  "procurement.rfq": QuotationCompare,
  "budget.budgets": BudgetSummary,
  "hr.payroll": PayrollStatutory,
  "hr.mpin": MpinDetail,
};

export const DETAIL_EXTENSIONS: Record<string, Extension> = Object.fromEntries(
  [...new Set([...Object.keys(CHILDREN), ...Object.keys(CUSTOM)])].map((key) => [key, combine(CUSTOM[key], childrenOf(key))!]),
);
