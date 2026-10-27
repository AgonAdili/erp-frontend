/** Quotation comparison on an RFQ (v1 "Споредба на понуди"): totals cheapest first, unit prices per request
 * line with the lowest marked, financial terms, and the supplier choice. */
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, API_BASE } from "@/api/client";
import type { ResourceMeta, Row } from "@/api/types";
import { Kpi, Kpis } from "@/components/dashboard";
import { Alert, Badge, EmptyState, Panel, SkeletonPanel } from "@/components/ui";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useInvalidateResource, useMeta } from "@/meta/hooks";

import { ActionButton } from "./actions";

interface Quote {
  id: number;
  version: number;
  supplier: string;
  total: string;
  total_without_vat: string;
  vat: string;
  currency: string;
  gap: string;
  offer_date: string;
  valid_until: string | null;
  delivery_time: string;
  payment_terms: string;
  transport_included: boolean;
  warranty_notes: string;
  evaluation_comment: string;
  is_selected: boolean;
  selection_reason: string;
}

interface Comparison {
  quotations: Quote[];
  matrix: { id: number; material: string; quantity: string; unit: string;
    cells: { quotation: number; unit_price: string | null; total: string | null; is_lowest: boolean }[] }[];
  minimum_quotations: number;
  below_minimum: boolean;
}

const QUOTATIONS = `${API_BASE}/procurement/quotations/`;

export function QuotationCompare({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const q = useQuery({
    queryKey: ["rfq-compare", row.id, row.version],
    queryFn: () => api.get<Comparison>(`${meta.endpoint}${row.id}/compare/`),
  });
  const quoteMeta = useMeta(QUOTATIONS);
  const invalidateQuotes = useInvalidateResource(QUOTATIONS);
  const invalidateRfq = useInvalidateResource(meta.endpoint);
  if (q.isLoading) return <SkeletonPanel />;
  if (!q.data) return null;
  const { quotations: quotes, matrix } = q.data;
  const select = quoteMeta.data?.actions.find((a) => a.url_path === "select");
  const sel = (quote: Quote) => (quote.is_selected ? { className: "selected" } : {});
  const line = (label: string, cell: (quote: Quote) => ReactNode, cls = "") => (
    <tr className={cls}>
      <th scope="row">{label}</th>
      {quotes.map((quote) => <td key={quote.id} {...sel(quote)}>{cell(quote)}</td>)}
    </tr>
  );
  const group = (label: string) => (
    <tr className="group"><th scope="rowgroup" colSpan={quotes.length + 1}>{label}</th></tr>
  );

  return (
    <Panel title="Споредба на понуди" sub={`${quotes.length} понуди, од најевтина`}>
     <div className="stack">
      {q.data.below_minimum ? (
        <Alert tone="warning" title="Недоволно понуди">
          Потребни се најмалку {q.data.minimum_quotations} понуди за оваа вредност; евидентирани: {quotes.length}.
        </Alert>
      ) : null}
      {!quotes.length ? <EmptyState title="Сè уште нема понуди">Додајте ги понудите од добавувачите во табот „Понуди“.</EmptyState> : (
        <>
          <Kpis>
            {quotes.map((quote, i) => (
              <Kpi key={quote.id} label={`${i + 1}. ${quote.supplier}`} value={formatMoney(quote.total)} unit={quote.currency}
                tone={quote.is_selected ? "good" : undefined}
                sub={`${quote.is_selected ? "избрана · " : ""}${i === 0 && quotes.length > 1 ? "најниска цена" : i > 0 ? `+${formatMoney(quote.gap)} од најниската` : ""}`} />
            ))}
          </Kpis>
          <div className="table-wrap">
            <table className="table compare">
              <thead>
                <tr>
                  <th scope="col">Ставка / критериум</th>
                  {quotes.map((quote) => (
                    <th key={quote.id} scope="col" {...sel(quote)}>
                      {quote.supplier} {quote.is_selected ? <Badge tone="success">избрана</Badge> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group("Цени по ставка")}
                {matrix.length ? matrix.map((m) => (
                  <tr key={m.id}>
                    <th scope="row">{m.material}<div className="small muted">{formatNumber(m.quantity)} {m.unit}</div></th>
                    {m.cells.map((c, i) => (
                      <td key={c.quotation} className={[c.is_lowest ? "best" : "", quotes[i].is_selected ? "selected" : ""].join(" ").trim()}>
                        {c.unit_price === null ? <span className="muted">—</span> : (
                          <>
                            {formatMoney(c.unit_price)} / {m.unit}
                            <div className="small muted">вкупно {formatMoney(c.total)}</div>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                )) : line("Барањето нема ставки", () => null)}
                {group("Финансии")}
                {line("Без ДДВ", (x) => formatMoney(x.total_without_vat))}
                {line("ДДВ", (x) => formatMoney(x.vat))}
                {line("Вкупно со ДДВ", (x) => <strong>{formatMoney(x.total)}</strong>, "total")}
                {group("Услови и испорака")}
                {line("Датум на понуда", (x) => formatDate(x.offer_date))}
                {line("Важи до", (x) => formatDate(x.valid_until) || "—")}
                {line("Рок на испорака", (x) => x.delivery_time || "—")}
                {line("Услови за плаќање", (x) => x.payment_terms || "—")}
                {line("Превоз вклучен", (x) => (x.transport_included ? "Да" : "Не"))}
                {group("Оценка")}
                {line("Гаранција и квалитет", (x) => x.warranty_notes || "—")}
                {line("Коментар од оценувањето", (x) => x.evaluation_comment || "—")}
                {line("Причина за избор", (x) => x.selection_reason || "—")}
                {select && quoteMeta.data ? line("Избор", (x) => (x.is_selected ? "Избрана" : (
                  <ActionButton meta={quoteMeta.data!} action={select} row={{ id: x.id, version: x.version } as Row}
                    onDone={() => { void q.refetch(); invalidateQuotes(); invalidateRfq(); }} />
                ))) : null}
              </tbody>
            </table>
          </div>
          <p className="small muted">Зелено: најниска единечна цена по ставка.</p>
        </>
      )}
     </div>
    </Panel>
  );
}
