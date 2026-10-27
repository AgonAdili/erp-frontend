/** The frame every module overview shares: title, which legal entity it covers, when it was loaded, refresh,
 * and the quick links to the module's lists. */
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { useEntity } from "@/app/prefs";
import { useSession } from "@/auth/session";
import { ErrorState, IconButton, PageHeader, SkeletonPanel } from "@/components/ui";
import { t } from "@/i18n/mk";
import { Page } from "@/layout/Page";
import { formatRelative } from "@/lib/format";
import { useMeta } from "@/meta/hooks";

export function useEntityName(): string {
  const { session } = useSession();
  const id = useEntity();
  const entities = session?.access?.entities ?? [];
  if (entities.length <= 1) return entities[0]?.name ?? "";
  return entities.find((e) => e.id === id)?.name ?? "";
}

export function OverviewSkeleton() {
  return (
    <div className="stack" aria-busy>
      <SkeletonPanel height={130} />
      <div className="grid-2"><SkeletonPanel /><SkeletonPanel /></div>
    </div>
  );
}

export function Overview<T>({ title, subtitle, actions, q, children, entityScoped = true }: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  q: { isLoading: boolean; error: unknown; data?: T; refetch: () => unknown; isFetching?: boolean; dataUpdatedAt?: number };
  children: (data: T) => ReactNode;
  entityScoped?: boolean;
}) {
  const entity = useEntityName();
  const sub = subtitle ?? (entityScoped && entity ? entity : undefined);
  return (
    <Page title={title}>
      <PageHeader title={title}
        subtitle={<span className="row-tight" style={{ flexWrap: "wrap" }}>
          {sub ? <span>{sub}</span> : null}
          {q.dataUpdatedAt ? <span className="xs muted">· {t.updated.toLowerCase()} {formatRelative(new Date(q.dataUpdatedAt).toISOString())}</span> : null}
        </span>}
        actions={<>
          {actions}
          <IconButton label={t.refresh} icon={RefreshCw} variant="default" onClick={() => void q.refetch()}
            className={q.isFetching ? "spinning" : undefined} disabled={q.isFetching} />
        </>} />
      {q.isLoading ? <OverviewSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : q.data !== undefined ? children(q.data) : null}
    </Page>
  );
}

/** "/offers/offers?status=SENT" */
export function listUrl(path: string, query: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return `/${path}${qs ? `?${qs}` : ""}`;
}

/** value → label of a resource field's choices (status names for rows an overview returns as raw codes). */
export function useChoiceLabels(path: string, field = "status"): (v: unknown) => string {
  const meta = useMeta(`/api/v1/${path}/`);
  const choices = meta.data?.fields.find((f) => f.name === field)?.choices ?? [];
  return (v) => choices.find((c) => String(c.value) === String(v))?.label ?? String(v ?? "");
}
