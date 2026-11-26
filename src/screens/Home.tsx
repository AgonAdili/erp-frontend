/*! @license © 2026 Mia Spasovska. EACore design system (CORE) and front-end specification (FE) — author: Mia Spasovska. All rights reserved unless agreed otherwise in writing. Fingerprint EAC-MS-C226E467F1A53502. */
/** Home (FE home.html, CORE 14): the greeting with what waits for me as bubbles (each a filtered link, most urgent
 * first), my approvals, unread notices and work orders, quick access, and the module launcher. Only data the back end
 * serves today; gamification stays off (CORE: CEO approval pending). */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Page as ApiPage, Row } from "@/api/types";
import { useSession } from "@/auth/session";
import { useCount, type Data } from "@/components/dashboard";
import { Bell, ChevronRight, Inbox } from "@/components/icons";
import { Badge, EmptyState, Panel, Skeleton } from "@/components/ui";
import { t } from "@/i18n/mk";
import { QuickLinks } from "@/layout/AppShell";
import { Page } from "@/layout/Page";
import { formatDate, formatLongDate, formatNumber, formatRelative, todayISO } from "@/lib/format";
import { useNav, type VisibleGroup } from "@/nav/useNav";
import { tr } from "@/i18n";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? tr("Добро утро") : h < 18 ? tr("Добар ден") : tr("Добра вечер");
}

function Launch({ g, index }: { g: VisibleGroup; index: number }) {
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
    <li>
      <Link to={g.landing} className="ea-launch-a" data-module={g.group.module}>
        <span className="ea-side-ic" aria-hidden><g.group.icon /></span>
        <span className="ea-launch-t">
          <b>{g.group.label}</b>
          <small>{first ? (count.data === undefined ? <Skeleton width={90} height={10} /> : <><span className="num">{formatNumber(count.data, 0)}</span> {first.title.toLowerCase()}</>) : g.links[0]?.label}</small>
        </span>
      </Link>
    </li>
  );
}

export function Home() {
  const { session, can } = useSession();
  const { groups, resources, loading } = useNav();
  const inbox = useQuery({ queryKey: ["inbox", "home"], queryFn: () => api.get<ApiPage<Row>>("/workflow/inbox/", { page_size: 6 }) });
  const notes = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => api.get<ApiPage<Row>>("/workflow/notifications/", { is_read: "false", page_size: 6 }),
  });
  const canWo = can("work_orders.dashboard.view");
  const wo = useQuery({
    queryKey: ["overview", "/workorders/work-orders/dashboard/", "home"],
    queryFn: () => api.get<Data>("/workorders/work-orders/dashboard/"),
    enabled: canWo,
  });
  const myWo = ((wo.data?.my_actions ?? []) as Data[]).slice(0, 6);
  const todayWo = ((wo.data?.week ?? []) as Data[]).find((d) => d.date === todayISO())?.work_orders as Data[] | undefined;
  const name = session?.user?.first_name || session?.user?.full_name || session?.user?.username;
  const titleOf = (route: string) => resources.find((r) => r.route === route)?.title ?? groups.flatMap((g) => g.links).find((l) => l.to === route)?.label ?? route;
  const bubbles = [
    { n: inbox.data?.count, text: tr("одобрувања чекаат"), to: "/inbox", tone: "caution" },
    { n: notes.data?.count, text: tr("непрочитани известувања"), to: "/notifications", tone: "info" },
    ...(canWo ? [{ n: todayWo?.length, text: tr("работни налози денес"), to: "/workorders", tone: "neutral" }] : []),
  ].filter((b) => b.n);

  return (
    <Page title={t.home} board>
      <section className="ea-hello" aria-labelledby="hello-t">
        <div className="ea-hello-text">
          <p className="ea-hello-date">{formatLongDate(new Date())}</p>
          <h1 className="ea-hello-title" id="hello-t">{greeting()}, {name}</h1>
          {bubbles.length ? (
            <ul className="ea-bubbles" aria-label={tr("Што бара внимание")}>
              {bubbles.map((b) => (
                <li key={b.to}><Link className={`ea-bubble is-${b.tone}`} to={b.to}><span className="ea-bubble-n">{formatNumber(b.n, 0)}</span>{b.text}<ChevronRight aria-hidden /></Link></li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <h2 className="ea-section-h">{tr("Што чека на вас")}</h2>
      <div className="ea-grid-12">
        <Panel className="s4" title={t.inbox} flush actions={<Link className="ea-panel-link" to="/inbox">{t.viewAll}</Link>}>
          {inbox.isLoading ? <Skeleton height={60} /> : !(inbox.data?.results ?? []).length ? (
            <EmptyState compact icon={Inbox} title={tr("Ништо не чека ваша одлука")} />
          ) : (
            <ol className="ea-rows">
              {(inbox.data?.results ?? []).map((i) => (
                <li key={i.id}>
                  <span className="ea-rows-name"><Link to={i.target_route ? String(i.target_route) : "/inbox"}>{String(i.title || i._label)}</Link>
                    <span className="ea-rows-sub">{formatRelative(i.created_at)}</span></span>
                  {i.stage_name ? <Badge plain tone="warning">{String(i.stage_name)}</Badge> : null}
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel className="s4" title={t.notifications} flush actions={<Link className="ea-panel-link" to="/notifications">{t.viewAll}</Link>}>
          {notes.isLoading ? <Skeleton height={60} /> : !(notes.data?.results ?? []).length ? (
            <EmptyState compact icon={Bell} title={tr("Нема нови известувања")} />
          ) : (
            <ol className="ea-rows">
              {(notes.data?.results ?? []).map((n) => (
                <li key={n.id}>
                  <span className="ea-rows-name">{n.route ? <Link to={String(n.route)}>{String(n.title)}</Link> : String(n.title)}
                    <span className="ea-rows-sub">{formatRelative(n.created_at)}{n.message ? ` · ${String(n.message)}` : ""}</span></span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        {canWo ? (
          <Panel className="s4" title={tr("Мои работни налози")} flush actions={<Link className="ea-panel-link" to="/workorders">{t.overview}</Link>}>
            {wo.isLoading ? <Skeleton height={60} /> : !myWo.length ? (
              <EmptyState compact title={tr("Ниеден налог не чека на вас")} />
            ) : (
              <ol className="ea-rows">
                {myWo.map((w) => (
                  <li key={String(w.id)}>
                    <span className="ea-rows-name"><Link to={`/workorders/work-orders/${w.id}`}><span className="ea-id">{String(w.wo_number || `#${w.id}`)}</span> · {String(w.project ?? "")}</Link>
                      <span className="ea-rows-sub">{formatDate(w.work_date)}</span></span>
                    {w.status_label ? <Badge plain tone="info">{String(w.status_label)}</Badge> : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        ) : (
          <Panel className="s4" title={tr("Брз пристап")} flush><QuickLinks titleOf={titleOf} /></Panel>
        )}
        {canWo ? <Panel className="s12" title={tr("Брз пристап")} flush><QuickLinks titleOf={titleOf} /></Panel> : null}
      </div>

      <section className="ea-launch-g" aria-labelledby="mods-h">
        <h2 className="ea-section-h" id="mods-h">{tr("Модули")}</h2>
        {loading ? <Skeleton height={120} /> : (
          <ul className="ea-launch">{groups.map((g, i) => <Launch key={g.group.key} g={g} index={i} />)}</ul>
        )}
        {!loading && !groups.length ? <EmptyState title={tr("Немате пристап до модули")}>{tr("Побарајте пристап од администраторот.")}</EmptyState> : null}
      </section>
    </Page>
  );
}
