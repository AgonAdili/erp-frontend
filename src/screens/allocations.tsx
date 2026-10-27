/** Payment allocation for supplier payments and customer receipts: the party's open items, an amount per
 * item, automatic distribution oldest due first (the server's own default when nothing is allocated), and
 * what remains unallocated. */
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Page } from "@/api/types";
import { Meter } from "@/components/dashboard";
import { Alert, Button, EmptyState, Skeleton } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";

export interface AllocationSpec {
  party: string;        // form field with the partner ("supplier" / "customer")
  item: string;         // allocation field with the open item ("payable" / "receivable")
  endpoint: string;     // open items list
  partyFilter: string;  // filter on the open items
  openStatuses: string[];
  partyLabel: string;
}

export const ALLOCATIONS: Record<string, AllocationSpec> = {
  "payables.payments": {
    party: "supplier", item: "payable", endpoint: "/payables/open-items/", partyFilter: "supplier",
    openStatuses: ["OPEN", "PARTIALLY_PAID", "OVERDUE"], partyLabel: "добавувачот",
  },
  "receivables.receipts": {
    party: "customer", item: "receivable", endpoint: "/receivables/open-items/", partyFilter: "customer",
    openStatuses: ["OPEN", "PARTIALLY_COLLECTED", "OVERDUE"], partyLabel: "купувачот",
  },
};

interface OpenItem {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  original_amount: string;
  open_amount: string;
  status: string;
  legal_entity: number;
}

type Allocation = Record<string, unknown>;

const cents = (v: unknown) => Math.round(Number(v || 0) * 100);
const amount = (c: number) => (c / 100).toFixed(2);

/** Oldest due first (no due date last, then invoice date), each item up to its open amount. */
export function distribute(items: OpenItem[], total: number, itemField: string): Allocation[] {
  let left = cents(total);
  const sorted = [...items].sort((a, b) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.invoice_date.localeCompare(b.invoice_date) || a.id - b.id);
  const out: Allocation[] = [];
  for (const item of sorted) {
    if (left <= 0) break;
    const take = Math.min(left, cents(item.open_amount));
    if (take <= 0) continue;
    out.push({ [itemField]: item.id, amount: amount(take) });
    left -= take;
  }
  return out;
}

export function AllocationEditor({
  spec, values, value, onChange, errors,
}: {
  spec: AllocationSpec;
  values: Record<string, unknown>;
  value: Allocation[];
  onChange: (rows: Allocation[]) => void;
  errors?: unknown;
}) {
  const party = values[spec.party] as number | null | undefined;
  const entity = values.legal_entity as number | null | undefined;
  const q = useQuery({
    queryKey: ["open-items", spec.endpoint, party, entity],
    queryFn: () => api.get<Page<OpenItem>>(spec.endpoint, {
      [spec.partyFilter]: party, status__in: spec.openStatuses, legal_entity: entity ?? undefined,
      ordering: "due_date", page_size: 500,
    }),
    enabled: Boolean(party),
  });
  if (!party) return <p className="muted small" style={{ margin: 0 }}>Изберете го {spec.partyLabel} за да се прикажат отворените ставки.</p>;
  if (q.isLoading) return <Skeleton height={120} />;
  const items = q.data?.results ?? [];
  const byItem = new Map(value.map((a) => [Number(a[spec.item]), a]));
  const allocated = value.reduce((s, a) => s + cents(a.amount), 0);
  const total = cents(values.amount);
  const left = total - allocated;
  const openTotal = items.reduce((s, i) => s + cents(i.open_amount), 0);

  const setAmount = (item: OpenItem, raw: string) => {
    const rest = value.filter((a) => Number(a[spec.item]) !== item.id);
    if (raw === "" || Number(raw) === 0) onChange(rest);
    else onChange([...rest, { [spec.item]: item.id, amount: raw }]);
  };

  return (
    <div className="stack">
      <div className="row">
        <span className="small muted">Отворено <strong className="num" style={{ color: "var(--ink)" }}>{formatMoney(amount(openTotal))}</strong></span>
        <span className="small muted">Распоредено <strong className="num" style={{ color: "var(--ink)" }}>{formatMoney(amount(allocated))}</strong></span>
        <span className={`small ${left < 0 ? "tone-danger" : "muted"}`}>Нераспоредено <strong className="num">{formatMoney(amount(left))}</strong></span>
        <span className="spacer" />
        <Button size="sm" variant="primary" disabled={!total || !items.length} onClick={() => onChange(distribute(items, total / 100, spec.item))}>
          Распореди по најстар рок
        </Button>
        <Button size="sm" disabled={!value.length} onClick={() => onChange([])}>Исчисти распоред</Button>
      </div>
      {total ? <Meter value={allocated} max={total} badAt={100.01} label="Распоредено од износот" /> : null}
      {left < 0 ? <Alert tone="danger">Распоредениот износ е поголем од износот на плаќањето.</Alert> : null}
      {errors ? <Alert tone="danger">{Array.isArray(errors) ? errors.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join(" ") : String(errors)}</Alert> : null}
      {!items.length ? <EmptyState compact title="Нема отворени ставки" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Фактура</th><th>Датум</th><th>Рок</th><th className="num">Износ</th><th className="num">Отворено</th>
                <th className="num">Распореди</th></tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const a = byItem.get(item.id);
                const over = a ? cents(a.amount) > cents(item.open_amount) : false;
                return (
                  <tr key={item.id}>
                    <td>{item.invoice_number || `#${item.id}`}</td>
                    <td>{formatDate(item.invoice_date)}</td>
                    <td>{formatDate(item.due_date)}</td>
                    <td className="num">{formatMoney(item.original_amount)}</td>
                    <td className="num">{formatMoney(item.open_amount)}</td>
                    <td className="num" style={{ width: 160 }}>
                      <input className={`input num${over ? " invalid" : ""}`} type="number" step="0.01" min="0"
                        aria-label={`Распореди на ${item.invoice_number || item.id}`}
                        value={a ? String(a.amount) : ""} onChange={(e) => setAmount(item, e.target.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small" style={{ margin: 0 }}>Без распоред, плаќањето се затвора автоматски по најстар рок.</p>
    </div>
  );
}
