/** Route `/:module/:path[/new|/:id|/:id/edit]` → the list, record or form page of that API resource.
 * A form opened from somewhere else carries `from=` (where Save and Cancel return) and may prefill fields from
 * the link (`/hr/leaves/new?employee=12`) or copy a record (`?copy=42`). After creating, the person lands back
 * on the list (or `from`); after editing, on the record. */
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import type { ResourceMeta, Row } from "@/api/types";
import { ErrorState, PageHeader, Skeleton, SkeletonPanel, SkeletonRows, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";
import { Page } from "@/layout/Page";
import { endpointFor, routeFor, useMeta, useRecord } from "@/meta/hooks";
import { Forbidden, NotFound } from "@/layout/NotFound";

import { ResourceDetail } from "./ResourceDetail";
import { editableFields, ResourceForm } from "./ResourceForm";
import { ResourceList } from "./ResourceList";

/** Only in-app paths are followed (never an outside URL). */
export function safeFrom(from: string | null): string | null {
  return from && from.startsWith("/") && !from.startsWith("//") ? from : null;
}

/** Values to start a form with: link parameters that name an editable field, or a copied record. */
function usePrefill(meta: ResourceMeta, search: URLSearchParams, copy?: Row) {
  return useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of editableFields(meta)) {
      if (copy && f.name in copy && !["number", "code"].includes(f.name) && !/(_number|_code)$/.test(f.name)) out[f.name] = copy[f.name];
      const v = search.get(f.name);
      if (v === null || v === "") continue;
      out[f.name] = ["fk", "integer"].includes(f.type) && /^\d+$/.test(v) ? Number(v) : f.type === "boolean" ? v === "true" : v;
    }
    return Object.keys(out).length ? out : undefined;
  }, [meta, search, copy]);
}

function FormPage({ meta, id }: { meta: ResourceMeta; id?: string }) {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const list = routeFor(meta.endpoint);
  const from = safeFrom(search.get("from"));
  const record = useRecord(meta.endpoint, id);
  const copyId = search.get("copy") ?? undefined;
  const copied = useRecord(meta.endpoint, copyId);
  const prefill = usePrefill(meta, search, copied.data);
  const editing = Boolean(id);
  const row = record.data;
  const label = row ? String(row._label ?? `#${row.id}`) : "";
  const title = editing ? `${t.edit}: ${label}` : `${t.newRecord}: ${(meta.title_singular || meta.title).toLowerCase()}`;
  const wide = meta.fields.some((f) => f.type === "rows" && !f.read_only);
  const back = from ?? (editing && row ? `${list}/${row.id}` : list);

  if ((editing && record.isLoading) || (copyId && copied.isLoading)) {
    return <Page title={meta.title}><Skeleton width={320} height={32} /><SkeletonPanel height={360} /></Page>;
  }
  if (editing && (record.error || !row)) return <Page title={meta.title}><ErrorState heading error={record.error} onRetry={() => void record.refetch()} /></Page>;

  return (
    <Page title={title}>
      <div className={`form-page${wide ? " wide" : ""}`}>
        <PageHeader back={{ to: back, label: editing ? label : meta.title }} title={title} />
        <ResourceForm meta={meta} row={row} defaults={editing ? undefined : prefill}
          onCancel={() => navigate(back)}
          onSaved={(saved) => {
            const name = String(saved._label ?? "");
            if (editing) {
              toast("Промените се зачувани.", "success", name ? { description: name } : undefined);
              navigate(from ?? `${list}/${saved.id}`);
            } else {
              toast("Записот е зачуван.", "success", {
                description: name || undefined,
                action: { label: t.open, onClick: () => navigate(`${list}/${saved.id}`) },
              });
              navigate(from ?? list);
            }
          }} />
      </div>
    </Page>
  );
}

export function ResourceScreen({ mode }: { mode: "list" | "new" | "detail" | "edit" }) {
  const { module = "", path = "", id } = useParams();
  const endpoint = endpointFor(module, path);
  const meta = useMeta(endpoint);

  if (meta.isLoading) {
    return (
      <div className="page">
        <Skeleton width={280} height={32} />
        <div className="ea-panel"><SkeletonRows rows={8} /></div>
      </div>
    );
  }
  if (meta.error instanceof ApiError && meta.error.status === 404) return <NotFound />;
  if (meta.error instanceof ApiError && meta.error.status === 403) return <Forbidden />;
  if (meta.error || !meta.data) return <Page><ErrorState heading error={meta.error} onRetry={() => void meta.refetch()} /></Page>;
  const m = meta.data;
  if (!m.permissions.view) return <Forbidden />;
  if (mode === "new") return m.permissions.add ? <FormPage meta={m} /> : <Forbidden />;
  if (mode === "edit" && id) return m.permissions.edit ? <FormPage meta={m} id={id} /> : <Forbidden />;
  if (mode === "detail" && id) return <div className="page" key={id}><ResourceDetail meta={m} id={id} /></div>;
  return <Page title={m.title}><ResourceList meta={m} /></Page>;
}
