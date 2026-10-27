/** Stock (v1 "Залиха" and "Вреднување"): quantity on hand per item with the reorder check and a warehouse
 * request for the low items; moving-average valuation as at a date. */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingCart } from "lucide-react";

import { api, API_BASE, ApiError } from "@/api/client";
import { useEntity } from "@/app/prefs";
import { useSession } from "@/auth/session";
import { RelatedSelect } from "@/components/inputs";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, PageHeader, Panel, SkeletonRows, Tabs, useToast } from "@/components/ui";
import { Page } from "@/layout/Page";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

const MOVEMENTS = `${API_BASE}/inventory/movements/`;

interface Level {
  item: number;
  code: string;
  name: string;
  unit: string;
  quantity: string;
  reorder_level: string | null;
  low: boolean;
}

interface Valued {
  item: number;
  item_code: string;
  item_name: string;
  unit: string;
  quantity: string;
  unit_cost: string;
  value: string;
  negative_at: string | null;
  reliable: boolean;
}

function Levels({ entity, warehouse }: { entity: number | null; warehouse: number | null }) {
  const [lowOnly, setLowOnly] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { can } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["stock-levels", entity, warehouse, lowOnly],
    queryFn: () => api.get<Level[]>(`${MOVEMENTS}levels/`, {
      legal_entity: entity, warehouse: lowOnly ? undefined : warehouse, low: lowOnly ? 1 : undefined,
    }),
  });
  const needle = text.trim().toLowerCase();
  const rows = (q.data ?? []).filter((r) => !needle || `${r.code} ${r.name}`.toLowerCase().includes(needle));
  const low = (q.data ?? []).filter((r) => r.low);

  const reorder = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ created: boolean; material_request?: number; number?: string; detail?: string }>(
        `${MOVEMENTS}reorder/`, { items: low.map((r) => r.item) }, { query: { legal_entity: entity } });
      if (res.created && res.material_request) {
        toast(`Креирано барање за материјали ${res.number ?? ""}`, "success");
        navigate(`/procurement/requests/${res.material_request}`);
      } else {
        toast(res.detail ?? "Нема артикли под минимумот.");
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="row">
        <div className="input-icon" style={{ flex: "1 1 240px", maxWidth: 340 }}>
          <Search aria-hidden />
          <input className="input" type="search" placeholder="Шифра или назив…" aria-label="Пребарај артикл"
            value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <label className="check small">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Само под минимум
        </label>
        <span className="spacer" />
        {low.length ? <Badge tone="warning">Под минимум: {low.length}</Badge> : null}
        {can("inventory.items.add") ? (
          <Button size="sm" variant="primary" icon={ShoppingCart} disabled={!low.length} busy={busy} onClick={() => void reorder()}>
            Барање за набавка{low.length ? ` (${low.length})` : ""}
          </Button>
        ) : null}
      </div>
      {lowOnly && warehouse ? <p className="small muted">Минимумот се проверува за сите магацини заедно.</p> : null}
      {q.isLoading ? <SkeletonRows rows={8} cols={5} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : !rows.length ? <EmptyState title={needle ? "Ниеден артикл не одговара" : "Нема залиха"} /> : (
        <div className="table-wrap" style={{ maxHeight: "calc(100vh - 330px)" }}>
          <table className="table">
            <thead>
              <tr><th>Шифра</th><th>Артикл</th><th>Ед.</th><th className="num">Залиха</th><th className="num">Минимум</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item}>
                  <td className="nowrap">{r.code}</td>
                  <td><Link to={`/catalog/items/${r.item}`}>{r.name}</Link></td>
                  <td>{r.unit}</td>
                  <td className={`num${r.low ? " tone-warning strong" : ""}`}>{formatNumber(r.quantity)}</td>
                  <td className="num">{r.reorder_level ? formatNumber(r.reorder_level) : <span className="muted-cell">—</span>}</td>
                  <td>{r.low ? <Badge tone="warning">под минимум</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Valuation({ entity, warehouse }: { entity: number | null; warehouse: number | null }) {
  const [asOf, setAsOf] = useState("");
  const q = useQuery({
    queryKey: ["stock-valuation", entity, warehouse, asOf],
    queryFn: () => api.get<{ rows: Valued[]; total: string }>(`${MOVEMENTS}valuation/`, {
      legal_entity: entity, warehouse, as_of: asOf || undefined,
    }),
  });
  const unreliable = (q.data?.rows ?? []).filter((r) => !r.reliable);
  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Field label="Состојба на ден" htmlFor="as-of" help={asOf ? undefined : "Празно = денес"}>
          <input id="as-of" type="date" className="input" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
        <span className="spacer" />
        {q.data ? <div className="right"><div className="small muted">Вкупна вредност</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{formatMoney(q.data.total)} <span className="small muted">ден.</span></div></div> : null}
      </div>
      {unreliable.length ? (
        <Alert tone="warning" title={`Несигурна цена кај ${unreliable.length} артикли`}>
          Залихата одела во минус, па нивната просечна цена не е сигурна. Проверете ги приемите пред тој датум.
        </Alert>
      ) : null}
      {q.isLoading ? <SkeletonRows rows={8} cols={6} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : !q.data?.rows.length ? <EmptyState title="Нема залиха на тој датум" /> : (
        <div className="table-wrap" style={{ maxHeight: "calc(100vh - 380px)" }}>
          <table className="table">
            <thead>
              <tr><th>Шифра</th><th>Артикл</th><th>Ед.</th><th className="num">Количина</th>
                <th className="num">Просечна цена</th><th className="num">Вредност</th><th /></tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.item}>
                  <td className="nowrap">{r.item_code}</td>
                  <td><Link to={`/catalog/items/${r.item}`}>{r.item_name}</Link></td>
                  <td>{r.unit}</td>
                  <td className="num">{formatNumber(r.quantity)}</td>
                  <td className="num">{formatMoney(r.unit_cost)}</td>
                  <td className="num">{formatMoney(r.value)}</td>
                  <td>{r.reliable ? null : <Badge tone="danger">минус од {formatDate(r.negative_at)}</Badge>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={5}>Вкупно</td><td className="num">{formatMoney(q.data.total)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export function StockOverview() {
  const [tab, setTab] = useState<"levels" | "valuation">("levels");
  const entity = useEntity();
  const [warehouse, setWarehouse] = useState<number | null>(null);
  return (
    <Page title="Залиха и вреднување">
      <PageHeader title="Залиха и вреднување" subtitle="Количина по артикл, минимална залиха и вредност по просечна набавна цена"
        actions={<div style={{ minWidth: 240 }}>
          <Field label="Магацин" htmlFor="stock-warehouse">
            <RelatedSelect id="stock-warehouse" related={{ endpoint: `${API_BASE}/catalog/warehouses/` }} value={warehouse}
              onChange={(v) => setWarehouse(v)} placeholder="Сите магацини" />
          </Field>
        </div>} />
      <Tabs tabs={[{ key: "levels", label: "Состојба" }, { key: "valuation", label: "Вреднување" }]} value={tab} onChange={setTab} />
      <Panel>
        {tab === "levels" ? <Levels entity={entity} warehouse={warehouse} /> : <Valuation entity={entity} warehouse={warehouse} />}
      </Panel>
    </Page>
  );
}
