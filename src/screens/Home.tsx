/** Start page: what waits for me (approvals, unread notices, my work orders), my pinned and recent screens,
 * and every module I use with one live figure. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Clock, Inbox, Pin } from "lucide-react";

import { api } from "@/api/client";
import type { Page as ApiPage, Row } from "@/api/types";
import { usePrefs } from "@/app/prefs";
import { useSession } from "@/auth/session";
import { useCount, type Data } from "@/components/dashboard";
import { Badge, EmptyState, LinkButton, Panel, Skeleton } from "@/components/ui";
import { t } from "@/i18n/mk";
import { Page } from "@/layout/Page";
import { formatDate, formatLongDate, formatNumber, formatRelative, todayISO } from "@/lib/format";
import { useNav, type VisibleGroup } from "@/nav/useNav";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Добро утро" : h < 18 ? "Добар ден" : "Добра вечер";
}

function ModuleTile({ g, index }: { g: VisibleGroup; index: number }) {
  const first = g.primary[0] ?? g.more[0];
  // stagger the tiles' count requests instead of sending a dozen at once
  const [ready, setReady] = useState(index < 4);
  useEffect(() => {
    if (ready) return;
    const h = window.setTimeout(() => setReady(true), index * 90);
    return () => window.clearTimeout(h);
  }, [ready, index]);
  const count = useCount(first?.entry.endpoint ?? "", {}, Boolean(first) && ready);
  return (
    <Link to={g.landing} className="module-tile">
      <span className="mt-icon"><g.group.icon aria-hidden /></span>
      <span className="mt-body">
        <span className="mt-title">{g.group.label}</span>
        <span className="mt-sub">
          {first ? (count.data === undefined ? <Skeleton width={90} height={10} /> : <><strong className="num">{formatNumber(count.data, 0)}</strong> {first.title.toLowerCase()}</>) : g.links[0]?.label}
        </span>
      </span>
    </Link>
  );
}

export function Home() {
  const { session, can } = useSession();
  const { pins, recent } = usePrefs();
  const { groups, resources, loading } = useNav();
  const inbox = useQuery({ queryKey: ["inbox", "home"], queryFn: () => api.get<ApiPage<Row>>("/workflow/inbox/", { page_size: 6 }) });
  const notes = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => api.get<ApiPage<Row>>("/workflow/notifications/", { is_read: "false", page_size: 6 }),
  });
  const wo = useQuery({
    queryKey: ["overview", "/workorders/work-orders/dashboard/", "home"],
    queryFn: () => api.get<Data>("/workorders/work-orders/dashboard/"),
    enabled: can("work_orders.dashboard.view"),
  });
  const myWo = ((wo.data?.my_actions ?? []) as Data[]).slice(0, 6);
  const todayWo = ((wo.data?.week ?? []) as Data[]).find((d) => d.date === todayISO())?.work_orders as Data[] | undefined;
  const name = session?.user?.first_name || session?.user?.full_name || session?.user?.username;
  const titleOf = (route: string) => resources.find((r) => r.route === route)?.title ?? groups.flatMap((g) => g.links).find((l) => l.to === route)?.label ?? route;
  const dateLine = formatLongDate(new Date());

  return (
    <Page title={t.home}>
      <header className="home-head">
        <div>
          <p className="home-date">{dateLine}</p>
          <h1>{greeting()}, {name}</h1>
        </div>
        <div className="home-counts" aria-label="Што чека вас">
          <Link to="/inbox" className={`home-count${inbox.data?.count ? " attention" : ""}`}>
            <span className="num">{inbox.data ? formatNumber(inbox.data.count, 0) : "–"}</span><span>одобрувања</span>
          </Link>
          <Link to="/notifications" className="home-count">
            <span className="num">{notes.data ? formatNumber(notes.data.count, 0) : "–"}</span><span>непрочитани известувања</span>
          </Link>
          {can("work_orders.dashboard.view") ? (
            <Link to="/workorders" className="home-count">
              <span className="num">{todayWo ? formatNumber(todayWo.length, 0) : "–"}</span><span>работни налози денес</span>
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid-3">
        <Panel title={t.inbox} flush actions={<LinkButton to="/inbox" size="sm">{t.viewAll}</LinkButton>}>
          {inbox.isLoading ? <div style={{ padding: 16 }}><Skeleton height={60} /></div> : !(inbox.data?.results ?? []).length ? (
            <EmptyState compact icon={Inbox} title="Ништо не чека ваша одлука" />
          ) : (
            <ul className="home-list">
              {(inbox.data?.results ?? []).map((i) => (
                <li key={i.id}>
                  <Link to={i.target_route ? String(i.target_route) : "/inbox"} className="truncate">{String(i.title || i._label)}</Link>
                  <span className="row-tight"><Badge tone="warning" plain>{String(i.stage_name ?? "")}</Badge><span className="xs muted">{formatRelative(i.created_at)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t.notifications} flush actions={<LinkButton to="/notifications" size="sm">{t.viewAll}</LinkButton>}>
          {notes.isLoading ? <div style={{ padding: 16 }}><Skeleton height={60} /></div> : !(notes.data?.results ?? []).length ? (
            <EmptyState compact icon={Bell} title="Нема нови известувања" />
          ) : (
            <ul className="home-list">
              {(notes.data?.results ?? []).map((n) => (
                <li key={n.id}>
                  {n.route ? <Link to={String(n.route)} className="truncate">{String(n.title)}</Link> : <span className="truncate">{String(n.title)}</span>}
                  <span className="xs muted">{formatRelative(n.created_at)}{n.message ? ` · ${String(n.message)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {can("work_orders.dashboard.view") ? (
          <Panel title="Мои работни налози" flush actions={<LinkButton to="/workorders" size="sm">{t.overview}</LinkButton>}>
            {wo.isLoading ? <div style={{ padding: 16 }}><Skeleton height={60} /></div> : !myWo.length ? (
              <EmptyState compact title="Ниеден налог не чека на вас" />
            ) : (
              <ul className="home-list">
                {myWo.map((w) => (
                  <li key={String(w.id)}>
                    <Link to={`/workorders/work-orders/${w.id}`} className="truncate">{String(w.wo_number || `#${w.id}`)} · {String(w.project ?? "")}</Link>
                    <span className="xs muted">{formatDate(w.work_date)} · {String(w.status_label ?? "")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : (
          <Panel title="Брз пристап" flush>
            <QuickList pins={pins} recent={recent} titleOf={titleOf} />
          </Panel>
        )}
      </div>

      {can("work_orders.dashboard.view") && (pins.length || recent.length) ? (
        <Panel title="Брз пристап" flush><QuickList pins={pins} recent={recent} titleOf={titleOf} /></Panel>
      ) : null}

      <section aria-label="Модули" className="stack-sm">
        <h2>Модули</h2>
        {loading ? <Skeleton height={120} /> : (
          <div className="module-grid">
            {groups.map((g, i) => <ModuleTile key={g.group.key} g={g} index={i} />)}
          </div>
        )}
      </section>
    </Page>
  );
}

function QuickList({ pins, recent, titleOf }: { pins: string[]; recent: { route: string; title: string; kind: string; at: number }[]; titleOf: (r: string) => string }) {
  if (!pins.length && !recent.length) return <EmptyState compact icon={Pin} title="Сè уште ништо">Закачете листа од менито или отворете запис — ќе се појави тука.</EmptyState>;
  return (
    <ul className="home-list">
      {pins.map((p) => <li key={`p${p}`}><Link to={p} className="row-tight"><Pin aria-hidden style={{ width: 14, color: "var(--amber)" }} />{titleOf(p)}</Link></li>)}
      {recent.slice(0, 6).map((r) => (
        <li key={`r${r.route}`}><Link to={r.route} className="row-tight truncate"><Clock aria-hidden style={{ width: 14, color: "var(--ink-faint)" }} />{r.title}</Link>
          <span className="xs muted">{r.kind}</span></li>
      ))}
    </ul>
  );
}
