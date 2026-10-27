/** Route `/:module/:path[/new|/:id]` → the generic list, form or detail of that API resource. */
import { useParams } from "react-router-dom";

import { Alert, Spinner } from "@/components/ui";
import { t } from "@/i18n/mk";
import { endpointFor, useMeta } from "@/meta/hooks";

import { DETAIL_EXTENSIONS } from "./extensions";
import { ResourceDetail } from "./ResourceDetail";
import { ResourceForm } from "./ResourceForm";
import { ResourceList } from "./ResourceList";

export function ResourceScreen({ mode }: { mode: "list" | "new" | "detail" }) {
  const { module = "", path = "", id } = useParams();
  const endpoint = endpointFor(module, path);
  const meta = useMeta(endpoint);
  if (meta.isLoading) return <Spinner />;
  if (meta.error || !meta.data) return <Alert tone="danger">{(meta.error as Error)?.message ?? t.noResults}</Alert>;
  if (!meta.data.permissions.view) return <Alert tone="warning">Немате дозвола за преглед.</Alert>;
  if (mode === "new") {
    return (
      <div className="stack">
        <div className="page-head"><h1>{meta.data.title_singular} — {t.add}</h1></div>
        <div className="card"><ResourceForm meta={meta.data} /></div>
      </div>
    );
  }
  if (mode === "detail" && id) {
    const Extension = DETAIL_EXTENSIONS[meta.data.key];
    return (
      <ResourceDetail meta={meta.data} id={id}>
        {Extension ? (row) => <Extension meta={meta.data!} row={row} /> : undefined}
      </ResourceDetail>
    );
  }
  return <ResourceList meta={meta.data} />;
}
