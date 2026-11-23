/** Home, built as a board (branding_rules/04 §3): the greeting with urgency bubbles that open their lists, the
 * figures strip, then numbered sections: what needs action (approvals, notifications, my work orders), the
 * modules by module group, and quick access (pinned and recent). */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Page as ApiPage, Row } from "@/api/types";
import { usePrefs } from "@/app/prefs";
import { useSession } from "@/auth/session";
import { Kpi, Kpis, useCount, type Data } from "@/components/dashboard";
import { Bell, Clock, Inbox, Pin } from "@/components/icons";
import { Badge, EmptyState, Panel, Section, Skeleton, Status, statusTone } from "@/components/ui";
import { t } from "@/i18n/mk";
import { Page } from "@/layout/Page";
import { formatDate, formatLongDate, formatNumber, formatRelative, todayISO } from "@/lib/format";
import { MODULE_GROUPS } from "@/nav/modules";
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
    <Link to={g.landing} className="module-tile" data-module={g.group.tone}>
      <span className="sb-tile"><g.group.icon /></span>
      <span className="mt-body">
        <span className="mt-title">{g.group.label}</span>
        <span className="mt-sub">
          {first ? (count.data === undefined ? <Skeleton width={90} height={10} /> : `${first.title} (${formatNumber(count.data, 0)})`) : g.links[0]?.label}
        </span>
      </span>
    </Link>
  );
}

function Bubble({ n, label, to, tone }: { n: number; label: string; to: string; tone?: "caution" | "stop" }) {
  return <Link to={to} className={`bubble${tone ? ` is-${tone}` : ""}`}><span className="b-n">{formatNumber(n, 0)}</span>{label}</Link>;
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
  const woAllowed = can("work_orders.dashboard.view");
  const wo = useQuery({
    queryKey: ["overview", "/workorders/work-orders/dashboard/", "home"],
    queryFn: () => api.get<Data>("/workorders/work-orders/dashboard/"),
    enabled: woAllowed,
  });
  const myWo = ((wo.data?.my_actions ?? []) as Data[]).slice(0, 6);
  const todayWo = ((wo.data?.week ?? []) as Data[]).find((d) => d.date === todayISO())?.work_orders as Data[] | undefined;
  const name = session?.user?.first_name || session?.user?.full_name || session?.user?.username;
  const titleOf = (route: string) => resources.find((r) => r.route === route)?.title ?? groups.flatMap((g) => g.links).find((l) => l.to === route)?.label ?? route;
  const waiting = inbox.data?.count ?? 0;
  const unread = notes.data?.count ?? 0;

  return (
    <Page title={t.home}>
      <header className="greeting">
        <span className="ea-label">{formatLongDate(new Date())}</span>
        <h1>{greeting()}, {name}</h1>
        <div className="bubbles">
          {waiting ? <Bubble n={waiting} label={waiting === 1 ? "барање чека одлука" : "барања чекаат одлука"} to="/inbox" tone="caution" /> : null}
          {unread ? <Bubble n={unread} label="непрочитани известувања" to="/notifications" /> : null}
          {woAllowed && myWo.length ? <Bubble n={myWo.length} label={myWo.length === 1 ? "налог со ваш следен чекор" : "налози со ваш следен чекор"} to="/workorders" tone="caution" /> : null}
          {!inbox.isLoading && !waiting && !unread && !myWo.length ? <span className="muted">Ништо не чека ваша одлука.</span> : null}
        </div>
      </header>

      <Kpis>
        <Kpi label="Одобрувања" value={inbox.data ? formatNumber(waiting, 0) : undefined} tone={waiting ? "attention" : undefined} to="/inbox" />
        <Kpi label="Известувања" value={notes.data ? formatNumber(unread, 0) : undefined} to="/notifications" />
        {woAllowed ? <Kpi label="Налози денес" value={todayWo ? formatNumber(todayWo.length, 0) : undefined} to="/workorders" /> : null}
        {woAllowed ? <Kpi label="Налози за мене" value={wo.data ? formatNumber(myWo.length, 0) : undefined} to="/workorders" /> : null}
      </Kpis>

      <Section n={1} title="Што бара акција">
        <div className="ea-grid-12">
          <Panel className={woAllowed ? "s4" : "s6"} title={t.inbox} sub={inbox.data ? formatNumber(waiting, 0) : undefined} flush
            actions={<Link to="/inbox" className="panel-link">{t.viewAll}</Link>}>
            {inbox.isLoading ? <div className="ea-panel-body"><Skeleton height={60} /></div> : !(inbox.data?.results ?? []).length ? (
              <EmptyState compact icon={Inbox} title="Ништо не чека ваша одлука." />
            ) : (
              <ol className="ea-rows">
                {(inbox.data?.results ?? []).map((i) => (
                  <li key={i.id}>
                    <span className="r-main">
                      <Link to={i.target_route ? String(i.target_route) : "/inbox"}>{String(i.title || i._label)}</Link>
                      <span className="r-sub">{formatRelative(i.created_at)}</span>
                    </span>
                    <span className="r-end"><Badge tone="caution">{String(i.stage_name ?? "")}</Badge></span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <Panel className={woAllowed ? "s4" : "s6"} title={t.notifications} sub={notes.data ? formatNumber(unread, 0) : undefined} flush
            actions={<Link to="/notifications" className="panel-link">{t.viewAll}</Link>}>
            {notes.isLoading ? <div className="ea-panel-body"><Skeleton height={60} /></div> : !(notes.data?.results ?? []).length ? (
              <EmptyState compact icon={Bell} title="Нема нови известувања." />
            ) : (
              <ol className="ea-rows">
                {(notes.data?.results ?? []).map((n) => (
                  <li key={n.id}>
                    <span className="r-main">
                      {n.route ? <Link to={String(n.route)}>{String(n.title)}</Link> : <span className="r-title">{String(n.title)}</span>}
                      <span className="r-sub">{formatRelative(n.created_at)}{n.message ? ` · ${String(n.message)}` : ""}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          {woAllowed ? (
            <Panel className="s4" title="Мои работни налози" flush actions={<Link to="/workorders" className="panel-link">{t.viewAll}</Link>}>
              {wo.isLoading ? <div className="ea-panel-body"><Skeleton height={60} /></div> : !myWo.length ? (
                <EmptyState compact title="Ниеден налог не чека на вас." />
              ) : (
                <ol className="ea-rows">
                  {myWo.map((w) => (
                    <li key={String(w.id)}>
                      <span className="r-main">
                        <Link to={`/workorders/work-orders/${w.id}`}><span className="ea-id">{String(w.wo_number || `#${w.id}`)}</span> · {String(w.project ?? "")}</Link>
                        <span className="r-sub">{formatDate(w.work_date)}</span>
                      </span>
                      <span className="r-end"><Status tone={statusTone(String(w.status ?? ""))}>{String(w.status_label ?? "")}</Status></span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          ) : null}
        </div>
      </Section>

      <Section n={2} title="Модули">
        {loading ? <Skeleton height={120} /> : MODULE_GROUPS.map(({ tone, label }) => {
          const list = groups.filter((g) => g.group.tone === tone);
          if (!list.length) return null;
          return (
            <div key={tone} className="stack-sm">
              <span className="ea-label">{label}</span>
              <div className="module-grid">{list.map((g, i) => <ModuleTile key={g.group.key} g={g} index={i} />)}</div>
            </div>
          );
        })}
      </Section>

      <Section n={3} title="Брз пристап">
        <Panel flush title="Закачени и неодамна отворени">
          {!pins.length && !recent.length ? (
            <EmptyState compact icon={Pin} title="Сè уште ништо.">Закачените листи и записите што ги отворате ќе се појават тука.</EmptyState>
          ) : (
            <ol className="ea-rows">
              {pins.map((p) => <li key={`p${p}`}><Pin /><span className="r-main"><Link to={p}>{titleOf(p)}</Link></span></li>)}
              {recent.slice(0, 6).map((r) => (
                <li key={`r${r.route}`}><Clock /><span className="r-main"><Link to={r.route}>{r.title}</Link><span className="r-sub">{r.kind}</span></span></li>
              ))}
            </ol>
          )}
        </Panel>
      </Section>
    </Page>
  );
}
