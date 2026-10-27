/** Start page: what waits for me (approvals, unread notices), and the modules I use. */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Page, Row } from "@/api/types";
import { useSession } from "@/auth/session";
import { Badge, Spinner } from "@/components/ui";
import { MODULES, moduleLabel, t } from "@/i18n/mk";
import { formatDateTime } from "@/lib/format";
import { routeFor, useResourceIndex } from "@/meta/hooks";

export function Home() {
  const { session } = useSession();
  const inbox = useQuery({ queryKey: ["inbox"], queryFn: () => api.get<Page<Row>>("/workflow/inbox/", { page_size: 5 }) });
  const notes = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => api.get<Page<Row>>("/workflow/notifications/", { is_read: "false", page_size: 8 }),
  });
  const index = useResourceIndex();
  const modules = [...new Set((index.data ?? []).filter((e) => e.permissions.view).map((e) => e.module))]
    .sort((a, b) => (MODULES[a]?.order ?? 999) - (MODULES[b]?.order ?? 999));
  return (
    <div className="stack">
      <div className="page-head"><h1>Добредојдовте, {session?.user?.first_name || session?.user?.username}</h1></div>
      <div className="grid-2">
        <div className="card stack">
          <div className="row"><h2 style={{ margin: 0 }}>{t.inbox}</h2><Badge tone="warning">{inbox.data?.count ?? 0}</Badge>
            <span style={{ flex: 1 }} /><Link to="/workflow/inbox-screen" className="small">Сите →</Link></div>
          {inbox.isLoading ? <Spinner /> : (inbox.data?.results ?? []).map((i) => (
            <div key={i.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>{String(i.title || i._label)}</span>
              <span className="small muted">{String(i.stage_name ?? "")}</span>
            </div>
          ))}
          {inbox.data && !inbox.data.count ? <span className="muted small">{t.noResults}</span> : null}
        </div>
        <div className="card stack">
          <div className="row"><h2 style={{ margin: 0 }}>{t.notifications}</h2>
            <span style={{ flex: 1 }} /><Link to="/workflow/notifications" className="small">Сите →</Link></div>
          {notes.isLoading ? <Spinner /> : (notes.data?.results ?? []).map((n) => (
            <div key={n.id}>
              {n.route ? <Link to={String(n.route)}>{String(n.title)}</Link> : <span>{String(n.title)}</span>}
              <div className="small muted">{formatDateTime(n.created_at)} {n.message ? `· ${String(n.message)}` : ""}</div>
            </div>
          ))}
          {notes.data && !notes.data.count ? <span className="muted small">{t.noResults}</span> : null}
        </div>
      </div>
      <div className="card stack">
        <h2>Модули</h2>
        <div className="kpis">
          {modules.map((m) => {
            const first = (index.data ?? []).find((e) => e.module === m && e.permissions.view);
            return first ? (
              <Link key={m} to={routeFor(first.endpoint)} className="card kpi" style={{ textDecoration: "none" }}>
                <div className="value" style={{ fontSize: 16 }}>{moduleLabel(m)}</div>
                <div className="label">{first.title}</div>
              </Link>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
