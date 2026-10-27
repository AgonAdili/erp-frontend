/** Route `/:module/:path[/new|/:id]` → the generic list, form or detail of that API resource. */
import { useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { ErrorState, PageHeader, Panel, Skeleton, SkeletonRows } from "@/components/ui";
import { t } from "@/i18n/mk";
import { Page } from "@/layout/Page";
import { endpointFor, routeFor, useMeta } from "@/meta/hooks";
import { Forbidden, NotFound } from "@/layout/NotFound";

import { ResourceDetail } from "./ResourceDetail";
import { ResourceForm } from "./ResourceForm";
import { ResourceList } from "./ResourceList";

export function ResourceScreen({ mode }: { mode: "list" | "new" | "detail" }) {
  const { module = "", path = "", id } = useParams();
  const endpoint = endpointFor(module, path);
  const meta = useMeta(endpoint);
  if (meta.isLoading) {
    return (
      <div className="page">
        <Skeleton width={260} height={30} />
        <div className="panel"><SkeletonRows rows={8} /></div>
      </div>
    );
  }
  if (meta.error instanceof ApiError && meta.error.status === 404) return <NotFound />;
  if (meta.error instanceof ApiError && meta.error.status === 403) return <Forbidden />;
  if (meta.error || !meta.data) return <Page><ErrorState error={meta.error} onRetry={() => void meta.refetch()} /></Page>;
  const m = meta.data;
  if (!m.permissions.view) return <Forbidden />;
  if (mode === "new") {
    if (!m.permissions.add) return <Forbidden />;
    return (
      <Page title={`${m.title_singular || m.title}: ${t.addNew.toLowerCase()}`} narrow>
        <PageHeader back={{ to: routeFor(m.endpoint), label: m.title }} title={`${m.title_singular || m.title}`} subtitle={t.addNew} />
        <Panel><ResourceForm meta={m} /></Panel>
      </Page>
    );
  }
  if (mode === "detail" && id) {
    return <div className="page" key={id}><ResourceDetail meta={m} id={id} /></div>;
  }
  return <Page title={m.title}><ResourceList meta={m} /></Page>;
}
