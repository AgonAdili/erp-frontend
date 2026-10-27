/** Stock overview (v1 "Залиха" and "Вреднување"): quantity on hand per item with the reorder check and a
 * warehouse request for the low items; moving-average valuation as at a date. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api, API_BASE, ApiError } from "@/api/client";
import { useSession } from "@/auth/session";
import { EntityPicker } from "@/components/dashboard";
import { RelatedSelect } from "@/components/inputs";
import { Alert, Badge, Button, EmptyState, Field, Spinner, Tabs, useToast } from "@/components/ui";
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
        toast(`Креирано барање ${res.number ?? ""}`);
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
        <input className="input" type="search" placeholder="Шифра или назив…" aria-label="Пребарај артикл"
          value={text} onChange={(e) => setText(e.target.value)} style={{ maxWidth: 280 }} />
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Само под минимум
        </label>
        <span style={{ flex: 1 }} />
        {low.length ? <Badge tone="warning">Под минимум: {low.length}</Badge> : null}
        {can("inventory.items.add") ? (
          <Button size="sm" disabled={!low.length} busy={busy} onClick={() => void reorder()}>
            Барање за набавка (под минимум)
          </Button>
        ) : null}
      </div>
      {lowOnly && warehouse ? <p className="small muted" style={{ margin: 0 }}>Минимумот се проверува за сите магацини.</p> : null}
      {q.isLoading ? <Spinner /> : q.error ? <Alert tone="danger">{(q.error as Error).message}</Alert> : !rows.length ? <EmptyState /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Шифра</th><th>Артикл</th><th>Единица</th><th className="num">Залиха</th><th className="num">Минимум</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item}>
                  <td className="mono">{r.code}</td>
                  <td><a href={`/catalog/items/${r.item}`} onClick={(e) => { e.preventDefault(); navigate(`/catalog/items/${r.item}`); }}>{r.name}</a></td>
                  <td>{r.unit}</td>
                  <td className="num">{formatNumber(r.quantity)}</td>
                  <td className="num">{r.reorder_level ? formatNumber(r.reorder_level) : ""}</td>
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
      <div className="row">
        <Field label="Состојба на ден" htmlFor="as-of">
          <input id="as-of" type="date" className="input" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
        <span style={{ flex: 1 }} />
        {q.data ? <div className="kpi"><div className="label">Вкупна вредност</div><div className="value">{formatMoney(q.data.total)}</div></div> : null}
      </div>
      {unreliable.length ? (
        <Alert tone="warning">
          Залихата одела во минус кај {unreliable.length} артикли; нивната просечна цена не е сигурна.
        </Alert>
      ) : null}
      {q.isLoading ? <Spinner /> : !q.data?.rows.length ? <EmptyState /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Шифра</th><th>Артикл</th><th>Единица</th><th className="num">Количина</th>
                <th className="num">Просечна цена</th><th className="num">Вредност</th><th /></tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.item}>
                  <td className="mono">{r.item_code}</td>
                  <td>{r.item_name}</td>
                  <td>{r.unit}</td>
                  <td className="num">{formatNumber(r.quantity)}</td>
                  <td className="num">{formatMoney(r.unit_cost)}</td>
                  <td className="num">{formatMoney(r.value)}</td>
                  <td>{r.reliable ? null : <Badge tone="danger" >минус од {formatDate(r.negative_at)}</Badge>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th colSpan={5}>Вкупно</th><th className="num">{formatMoney(q.data.total)}</th><th /></tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export function StockOverview() {
  const [tab, setTab] = useState<"levels" | "valuation">("levels");
  const [entity, setEntity] = useState<number | null>(null);
  const [warehouse, setWarehouse] = useState<number | null>(null);
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Залиха</h1>
        <span className="spacer" />
        <EntityPicker value={entity} onChange={setEntity} />
        <Field label="Магацин" htmlFor="stock-warehouse">
          <RelatedSelect id="stock-warehouse" related={{ endpoint: `${API_BASE}/catalog/warehouses/` }} value={warehouse}
            onChange={(v) => setWarehouse(v)} placeholder="Сите магацини" />
        </Field>
      </div>
      <Tabs tabs={[{ key: "levels", label: "Состојба" }, { key: "valuation", label: "Вреднување" }]} value={tab} onChange={setTab} />
      <div className="card">
        {tab === "levels" ? <Levels entity={entity} warehouse={warehouse} /> : <Valuation entity={entity} warehouse={warehouse} />}
      </div>
    </div>
  );
}
