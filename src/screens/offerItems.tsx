/** Offer lines editor (v1 offer form with the calculator): rows priced by the server calculator as you type,
 * saved together (PUT …/items/), after which the server recalculates totals and approval needs. */
import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

import { api, ApiError } from "@/api/client";
import type { FieldMeta, ResourceMeta, Row } from "@/api/types";
import { FieldInput } from "@/components/inputs";
import { Alert, Badge, Button, EmptyState, IconButton, Panel, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";
import { formatMoney, formatNumber } from "@/lib/format";
import { useInvalidateResource } from "@/meta/hooks";

const COLUMNS = ["service_item", "description", "unit", "formula_type", "quantity", "thickness_cm", "unit_cost",
  "unit_price", "discount_percent", "minimum_charge"];

interface Calc {
  total: string;
  subtotal_after_discount: string;
  calculated_quantity: string;
  tonnage: string | null;
  approval_required: boolean;
  approval_reason: string;
  warnings: string[];
}

type Line = Record<string, unknown>;

function useCalculations(lines: Line[]) {
  const [calc, setCalc] = useState<(Calc | null)[]>([]);
  const key = JSON.stringify(lines.map((l) => [l.formula_type, l.unit, l.quantity, l.unit_price, l.thickness_cm, l.discount_percent, l.minimum_charge]));
  useEffect(() => {
    const h = window.setTimeout(async () => {
      const results = await Promise.all(lines.map((l) => api.post<Calc>("/offers/offers/calculate-line/", {
        formula_type: l.formula_type || null, unit: l.unit || null, quantity: l.quantity || 0, unit_price: l.unit_price || 0,
        thickness_cm: l.thickness_cm || null, discount_percent: l.discount_percent || 0, minimum_charge: l.minimum_charge || null,
      }).catch(() => null)));
      setCalc(results);
    }, 300);
    return () => window.clearTimeout(h);
  }, [key]);
  return calc;
}

export function OfferItems({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const itemsField = meta.fields.find((f) => f.name === "items");
  const cols = useMemo<FieldMeta[]>(() => {
    const children = itemsField?.children ?? [];
    return COLUMNS.map((n) => children.find((c) => c.name === n)).filter(Boolean).map((c) => ({ ...c!, read_only: false }));
  }, [itemsField]);
  const [lines, setLines] = useState<Line[]>(() => ((row.items as Line[]) ?? []).map((l) => ({ ...l })));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const calc = useCalculations(lines);
  const toast = useToast();
  const invalidate = useInvalidateResource(meta.endpoint);
  const editable = !["ACCEPTED", "CONVERTED", "EXPIRED", "CANCELLED"].includes(String(row.status));   // server LOCKED_STATUSES
  const canEdit = editable && meta.actions.some((a) => a.name === "set_items" && a.allowed);

  useEffect(() => {
    if (!dirty) setLines(((row.items as Line[]) ?? []).map((l) => ({ ...l })));
  }, [row.items, dirty]);

  const update = (i: number, name: string, v: unknown) => {
    setDirty(true);
    setLines((list) => list.map((l, j) => (j === i ? { ...l, [name]: v } : l)));
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const items = lines.map((l, i) => {
        const out: Line = { sort_order: i };
        for (const c of cols) if (l[c.name] !== undefined && l[c.name] !== "") out[c.name] = l[c.name];
        return out;
      });
      await api.put(`${meta.endpoint}${row.id}/items/`, { items }, row.version);
      toast("Ставките се зачувани", "success");
      setDirty(false);
      invalidate();
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setSaving(false);
    }
  };
  const total = calc.reduce((s, c) => s + (c ? Number(c.subtotal_after_discount) : 0), 0);

  const needApproval = calc.filter((c) => c?.approval_required).length;
  return (
    <Panel title="Ставки на понудата" sub={`${lines.length} ставки · пресметано без ДДВ ${formatMoney(total)} ден.`} flush
      actions={canEdit ? (
        <div className="row-tight">
          <Button size="sm" icon={Plus} onClick={() => { setDirty(true); setLines((l) => [...l, { quantity: "1" }]); }}>Додај ставка</Button>
          <Button size="sm" variant="primary" icon={Save} busy={saving} disabled={!dirty} onClick={save}>Зачувај ставки</Button>
        </div>
      ) : !editable ? <Badge plain>заклучена</Badge> : null}>
      <div className="stack-sm" style={{ padding: error || needApproval || dirty ? "0 16px 8px" : 0 }}>
        {error ? <Alert tone="danger" title="Ставките не се зачувани">{error.message}</Alert> : null}
        {needApproval ? <Alert tone="warning">{needApproval} {needApproval === 1 ? "ставка бара" : "ставки бараат"} одобрување пред испраќање.</Alert> : null}
        {dirty ? <span className="small tone-warning">Имате незачувани промени во ставките.</span> : null}
      </div>
      {!lines.length ? <EmptyState compact title="Понудата нема ставки">{canEdit ? "Додајте ја првата ставка." : undefined}</EmptyState> : (
        <div className="table-wrap rows-editor">
          <table className="table">
            <thead>
              <tr>
                <th className="num" style={{ width: 36 }}>#</th>
                {cols.map((c) => <th key={c.name} className={c.type === "decimal" ? "num" : undefined}>{c.label}</th>)}
                <th className="num">Износ</th>
                {canEdit ? <th aria-label={t.actions} /> : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="num muted">{i + 1}</td>
                  {cols.map((c) => (
                    <td key={c.name} className={!canEdit && c.type === "decimal" ? "num" : undefined}
                      style={{ minWidth: canEdit ? (c.type === "fk" ? 220 : c.name === "description" ? 220 : 100) : undefined }}>
                      {canEdit ? (
                        <FieldInput field={c} value={l[c.name]} onChange={(v) => update(i, c.name, v)}
                          initialLabel={l[`${c.name}_label`] as string | undefined} />
                      ) : c.type === "decimal" ? formatNumber(l[c.name], 2) : String(l[`${c.name}_display`] ?? l[`${c.name}_label`] ?? l[c.name] ?? "")}
                    </td>
                  ))}
                  <td className="num nowrap">
                    <span className="strong">{calc[i] ? formatMoney(calc[i]!.subtotal_after_discount) : ""}</span>
                    {calc[i]?.tonnage ? <div className="xs muted">{formatNumber(calc[i]!.tonnage, 3)} t</div> : null}
                    {calc[i]?.approval_required ? <div><Badge tone="warning">{calc[i]!.approval_reason}</Badge></div> : null}
                    {calc[i]?.warnings?.length ? <div className="xs tone-warning">{calc[i]!.warnings.join("; ")}</div> : null}
                  </td>
                  {canEdit ? (
                    <td><IconButton size="sm" label={`${t.remove} ${i + 1}`} icon={Trash2}
                      onClick={() => { setDirty(true); setLines((list) => list.filter((_, j) => j !== i)); }} /></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={cols.length + 1}>Вкупно без ДДВ</td><td className="num">{formatMoney(total)}</td>{canEdit ? <td /> : null}</tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}
