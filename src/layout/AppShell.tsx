/*! @license © 2026 Mia Spasovska. EACore design system (CORE) and front-end specification (FE) — author: Mia Spasovska. All rights reserved unless agreed otherwise in writing. Fingerprint EAC-MS-C226E467F1A53502. */
/** The app shell in FE markup (FE templates/layout.html + partials/sidebar, topbar, module_tabs, bottom_nav):
 * skip link · sidebar by colour group (icon in the group colour at rest, solid tile when current; icons-only mode saved
 * per person; a drawer under 960px) · top bar (where I am, Ctrl K, legal entity, + Ново, notifications, theme, user menu
 * with language) · the module's tabs · main · phone bottom nav. Data comes from the server's metadata and permissions:
 * the sidebar shows only what this user may open (useNav), never a link the server would refuse. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Page, Row } from "@/api/types";
import { useSession } from "@/auth/session";
import { usePrefs } from "@/app/prefs";
import {
  Bell, Building, Check, ChevronDown, ChevronLeft, Clock, House, Inbox, Keyboard, LogOut, Menu as MenuIcon, Monitor, Moon,
  Pin, Plus, Rows3, Rows4, Search, Sun, User, X,
} from "@/components/icons";
import { Badge, Button, EmptyState, Kbd, Menu, Modal, Popover } from "@/components/ui";
import { LANGS, lang, type Lang } from "@/i18n";
import { t } from "@/i18n/mk";
import { formatRelative } from "@/lib/format";
import { useLiveUpdates } from "@/live/useLiveUpdates";
import { groupForPath, resourcePath, SECTIONS } from "@/nav/modules";
import { useNav, type VisibleGroup } from "@/nav/useNav";

import { CommandPalette } from "./CommandPalette";
import { CrumbProvider, useCrumb } from "./Page";
import { tr } from "@/i18n";

function useInboxCount() {
  return useQuery({
    queryKey: ["inbox", "count"],
    queryFn: () => api.get<Page<Row>>("/workflow/inbox/", { page_size: 1 }),
    refetchInterval: 120_000,
    select: (d) => d.count,
  });
}

/** Ink logo in light, bone in dark (CORE 24). */
export function BrandLogo() {
  const { resolvedTheme } = usePrefs();
  return <img className="ea-brand-img" src={resolvedTheme === "dark" ? "/icons/eacore-icon-bone.png" : "/icons/eacore-icon-ink.png"} alt="" />;
}

// ── sidebar ───────────────────────────────────────────────────────────────────

function PinButton({ route }: { route: string }) {
  const { pins, togglePin } = usePrefs();
  const on = pins.includes(route);
  return (
    <button type="button" className={`ea-pin${on ? " is-on" : ""}`} aria-label={on ? t.unpin : t.pin} aria-pressed={on}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(route); }}>
      <Pin aria-hidden />
    </button>
  );
}

function SideItem({ g, current, onNavigate }: { g: VisibleGroup; current: boolean; onNavigate: () => void }) {
  const location = useLocation();
  const [open, setOpen] = useState(current);
  useEffect(() => { if (current) setOpen(true); }, [current]);
  const here = location.pathname.replace(/\/+$/, "") || "/";
  const res = `/${resourcePath(location.pathname)}`;
  const subId = `sub-${g.group.key}`;
  const links = g.links.filter((l) => !l.overview);
  const hasSubs = links.length + g.primary.length + g.more.length > 0;
  return (
    <li className={`ea-side-li${hasSubs ? " has-sub" : ""}${open ? " is-open" : ""}`}>
      <Link to={g.landing} className="ea-side-a" data-module={g.group.module} aria-current={current ? "page" : undefined}
        title={g.group.label} onClick={onNavigate}>
        <span className="ea-side-ic" aria-hidden><g.group.icon /></span>
        <span className="ea-side-txt">{g.group.label}</span>
      </Link>
      {hasSubs ? (
        <>
          <button type="button" className="ea-side-exp" aria-expanded={open} aria-controls={subId}
            aria-label={tr("Подмодули: {0}", g.group.label)} onClick={() => setOpen((o) => !o)}><ChevronDown aria-hidden /></button>
          <ul className="ea-side-sub" id={subId} hidden={!open}>
            {links.map((l) => (
              <li key={l.to}><Link to={l.to} className="ea-side-suba" aria-current={here === l.to ? "page" : undefined} onClick={onNavigate}><span>{l.label}</span></Link></li>
            ))}
            {g.primary.length || g.more.length ? <li className="ea-side-subh">{t.records}</li> : null}
            {[...g.primary, ...g.more].map((r) => (
              <li key={r.route}>
                <Link to={r.route} className="ea-side-suba" aria-current={res === r.route ? "page" : undefined} onClick={onNavigate}>
                  <span>{r.title}</span><PinButton route={r.route} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </li>
  );
}

function Sidebar({ groups, activeKey, open, onClose }: { groups: VisibleGroup[]; activeKey: string; open: boolean; onClose: () => void }) {
  const inbox = useInboxCount();
  const location = useLocation();
  const { navCollapsed, setNavCollapsed } = usePrefs();
  const top = [
    { to: "/", label: t.home, icon: House, current: location.pathname === "/" },
    { to: "/inbox", label: t.inbox, icon: Inbox, current: location.pathname === "/inbox", count: inbox.data },
  ];
  return (
    <>
      <nav className={`ea-side${open ? " is-open" : ""}`} id="ea-side" aria-label={tr("Модули")}>
        <div className="ea-side-top">
          <Link className="ea-brand" to="/" aria-label="EACore" onClick={onClose}><BrandLogo /><span className="ea-side-txt" translate="no">EACore</span></Link>
          <button type="button" className="btn btn-ghost btn-sm btn-icon ea-side-mini" aria-pressed={navCollapsed}
            aria-label={navCollapsed ? t.expand : t.collapse} onClick={() => setNavCollapsed(!navCollapsed)}><ChevronLeft aria-hidden /></button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon ea-side-close" aria-label={tr("Затвори мени")} onClick={onClose}><X aria-hidden /></button>
        </div>
        <div className="ea-side-grp">
          <ul className="ea-side-list">
            {top.map((i) => (
              <li key={i.to} className="ea-side-li">
                <Link to={i.to} className="ea-side-a" aria-current={i.current ? "page" : undefined} title={i.label} onClick={onClose}>
                  <span className="ea-side-ic" aria-hidden><i.icon /></span><span className="ea-side-txt">{i.label}</span>
                  {i.count ? <span className="ea-side-n is-caution" aria-label={tr("{0} чекаат", i.count)}>{i.count > 99 ? "99+" : i.count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {SECTIONS.map((sec) => {
          const items = groups.filter((g) => g.group.section === sec);
          if (!items.length) return null;
          return (
            <div className="ea-side-grp" key={sec}>
              <p className="ea-side-h">{sec}</p>
              <ul className="ea-side-list">
                {items.map((g) => <SideItem key={g.group.key} g={g} current={g.group.key === activeKey} onNavigate={onClose} />)}
              </ul>
            </div>
          );
        })}
        <p className="ea-side-org ea-side-txt" translate="no">EA Group</p>
      </nav>
      {open ? <div className="ea-scrim" onClick={onClose} aria-hidden /> : null}
    </>
  );
}

// ── top bar ───────────────────────────────────────────────────────────────────

function Breadcrumbs({ group }: { group?: VisibleGroup }) {
  const location = useLocation();
  const crumb = useCrumb();
  const { resources } = useNav();
  const parts = location.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const items: { to?: string; label: string }[] = [];
  if (group) items.push({ to: group.landing, label: group.group.label });
  const res = resources.find((r) => r.path === parts.slice(0, 2).join("/"));
  const link = group?.links.find((l) => l.to === location.pathname);
  if (res) {
    items.push({ to: res.route, label: res.title });
    if (parts[2] === "new") items.push({ label: t.addNew });
    else if (parts[2]) items.push({ label: crumb || `#${parts[2]}` });
  } else if (link && !link.overview) {
    items.push({ label: link.label });
  } else if (!link && crumb) {
    items.push({ label: crumb });
  }
  if (!items.length) items.push({ label: location.pathname === "/" ? t.home : crumb || "EACore" });
  return (
    <nav className="ea-top-where ea-crumbs" aria-label={tr("Патека")}>
      <ol>
        {items.map((it, i) => (
          <li key={i}>{i === items.length - 1 ? <b aria-current="page">{it.label}</b> : it.to ? <Link to={it.to}>{it.label}</Link> : <span>{it.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

function EntitySwitcher() {
  const { session } = useSession();
  const { entity, setEntity } = usePrefs();
  const entities = session?.access?.entities ?? [];
  if (entities.length <= 1) return null;
  const current = entities.find((e) => e.id === entity);
  return (
    <Menu label={t.entity} trigger={
      <button type="button" className="btn btn-ghost ea-top-entity" aria-label={`${t.entity}: ${current?.name ?? ""}`}>
        <Building aria-hidden /><span className="ea-top-entity-t">{current?.short_name || current?.code || t.entity}</span><ChevronDown aria-hidden />
      </button>
    } items={[
      { heading: true, label: tr("Правно лице за прегледите") },
      ...entities.map((e) => ({
        label: e.name, icon: e.id === entity ? Check : undefined, hint: e.code, onSelect: () => setEntity(e.id),
      })),
    ]} />
  );
}

const LEVEL_TONE: Record<string, string> = { WARNING: "danger", ACTION: "warning" };

function NotificationsPopover() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const count = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<{ count: number }>("/workflow/notifications/unread/"),
    refetchInterval: 60_000,
  });
  const list = useQuery({
    queryKey: ["notifications", "popover"],
    queryFn: () => api.get<Page<Row>>("/workflow/notifications/", { is_read: "false", page_size: 8 }),
    enabled: open,
  });
  const n = count.data?.count ?? 0;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["notifications"] });
  const openOne = async (row: Row) => {
    setOpen(false);
    await api.post(`/workflow/notifications/${row.id}/read/`).catch(() => undefined);
    refresh();
    if (row.route) navigate(String(row.route));
  };
  return (
    <Popover open={open} onOpenChange={setOpen} align="end" trigger={
      <button type="button" className="btn btn-ghost btn-icon ea-top-bell" aria-label={`${t.notifications}${n ? tr(": {0} нови", n) : ""}`}>
        <Bell aria-hidden />
        {n ? <span className="ea-top-badge" aria-hidden>{n > 99 ? "99+" : n}</span> : null}
      </button>
    }>
      <div className="ea-notif">
        <div className="ea-notif-head">
          <b>{t.notifications}</b>
          {n ? <Button size="sm" variant="ghost" onClick={async () => { await api.post("/workflow/notifications/read-all/"); refresh(); }}>{t.markAllRead}</Button> : null}
        </div>
        {list.isLoading ? <p className="ea-meta ea-notif-empty">{t.loading}</p>
          : !(list.data?.results ?? []).length ? <EmptyState compact icon={Bell} title={tr("Нема нови известувања")} /> : (
            <ul className="ea-notif-list">
              {(list.data?.results ?? []).map((row) => (
                <li key={row.id}>
                  <button type="button" className="ea-notif-row" onClick={() => void openOne(row)}>
                    <Badge plain tone={LEVEL_TONE[String(row.level)] ?? "info"}><b>{String(row.title)}</b></Badge>
                    {row.message ? <span className="ea-meta">{String(row.message)}</span> : null}
                    <span className="ea-meta">{formatRelative(row.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        <div className="ea-notif-foot"><Link to="/notifications" className="ea-panel-link" onClick={() => setOpen(false)}>{t.viewAll}</Link></div>
      </div>
    </Popover>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function UserMenu({ onShortcuts }: { onShortcuts: () => void }) {
  const { session, logout, setLanguage } = useSession();
  const { theme, setTheme, density, setDensity } = usePrefs();
  const navigate = useNavigate();
  const user = session?.user;
  const name = user?.full_name || user?.username || "";
  const role = user?.department || user?.tier || "";
  const offered = (session?.languages?.length ? session.languages.map((l) => l.code.slice(0, 2)) : LANGS.map((l) => l.code))
    .filter((c): c is Lang => LANGS.some((l) => l.code === c));
  return (
    <Menu label={name} trigger={
      <button type="button" className="ea-top-me" aria-label={`${t.profile}: ${name}`}>
        <span className="ea-av" aria-hidden>{initials(name)}</span>
        <span className="ea-top-me-t"><b>{name}</b>{role ? <small>{role}</small> : null}</span>
      </button>
    } items={[
      { label: t.profile, icon: User, onSelect: () => navigate("/profile") },
      { label: tr("Јазик"), heading: true, separatorBefore: true },
      ...LANGS.filter((l) => offered.includes(l.code)).map((l) => ({
        label: <span lang={l.code} translate="no">{l.label}</span>, icon: lang() === l.code ? Check : undefined,
        onSelect: () => { if (lang() !== l.code) void setLanguage(l.code); },
      })),
      { label: t.theme, heading: true, separatorBefore: true },
      { label: t.themeSystem, icon: theme === "system" ? Check : Monitor, onSelect: () => setTheme("system") },
      { label: t.themeLight, icon: theme === "light" ? Check : Sun, onSelect: () => setTheme("light") },
      { label: t.themeDark, icon: theme === "dark" ? Check : Moon, onSelect: () => setTheme("dark") },
      { label: t.density, heading: true, separatorBefore: true },
      { label: t.comfortable, icon: density === "comfortable" ? Check : Rows3, onSelect: () => setDensity("comfortable") },
      { label: t.compact, icon: density === "compact" ? Check : Rows4, onSelect: () => setDensity("compact") },
      { label: t.shortcuts, icon: Keyboard, hint: "?", onSelect: onShortcuts, separatorBefore: true },
      { label: t.signOut, icon: LogOut, onSelect: () => void logout(), separatorBefore: true },
    ]} />
  );
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = usePrefs();
  const dark = resolvedTheme === "dark";
  return (
    <button type="button" className="btn btn-ghost btn-icon" aria-pressed={dark} aria-label={tr("Темна тема")} data-tip={dark ? t.themeLight : t.themeDark}
      onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </button>
  );
}

/** "+ Ново" (FE new_dialog): every list this user may add to, by sidebar group. */
function NewDialog({ onClose }: { onClose: () => void }) {
  const { groups } = useNav();
  const navigate = useNavigate();
  const blocks = groups.map((g) => ({ g, items: [...g.primary, ...g.more].filter((r) => r.entry.permissions.add) })).filter((b) => b.items.length);
  return (
    <Modal title={tr("Ново")} description={tr("Изберете што внесувате.")} onClose={onClose} size="lg">
      {!blocks.length ? <EmptyState compact title={tr("Немате дозвола да додавате записи")} /> : (
        <div className="ea-new">
          {blocks.map(({ g, items }) => (
            <section key={g.group.key} className="ea-new-g" data-module={g.group.module} aria-label={g.group.label}>
              <h3 className="ea-eyebrow">{g.group.label}</h3>
              <ul className="ea-new-list">
                {items.map((r) => (
                  <li key={r.route}>
                    <button type="button" className="ea-new-a" onClick={() => { onClose(); navigate(`${r.route}/new`); }}>
                      <span className="ea-side-ic" aria-hidden><g.group.icon /></span><span>{r.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** The module's own screens as tabs (FE module_tabs): overview + screens + the first lists; the rest under "Повеќе". */
function ModuleTabs({ g }: { g: VisibleGroup }) {
  const location = useLocation();
  const here = location.pathname.replace(/\/+$/, "");
  const res = `/${resourcePath(location.pathname)}`;
  const tabs = [...g.links.map((l) => ({ to: l.to, label: l.label, current: here === l.to })),
    ...g.primary.map((r) => ({ to: r.route, label: r.title, current: res === r.route }))];
  const shown = tabs.slice(0, 7);
  const rest = [...tabs.slice(7), ...g.more.map((r) => ({ to: r.route, label: r.title, current: res === r.route }))];
  const restCurrent = rest.find((x) => x.current);
  return (
    <div className="ea-mtabs-wrap" data-module={g.group.module}>
      <nav className="ea-mtabs" aria-label={g.group.label}>
        {shown.map((x) => <Link key={x.to} to={x.to} aria-current={x.current ? "page" : undefined}>{x.label}</Link>)}
        {restCurrent ? <Link to={restCurrent.to} aria-current="page">{restCurrent.label}</Link> : null}
      </nav>
      {rest.length ? (
        <Menu label={t.more} trigger={<button type="button" className="btn btn-ghost btn-sm ea-mtabs-more"><span className="ea-mtabs-t">{t.more}</span><ChevronDown aria-hidden /></button>}
          items={rest.map((x) => ({ label: x.label, to: x.to, icon: x.current ? Check : undefined }))} />
      ) : null}
    </div>
  );
}

const SHORTCUTS: [string[], string][] = [
  [["Ctrl", "K"], tr("Пребарај или оди на екран")],
  [["/"], tr("Пребарај во листата")],
  [["J"], tr("Следен ред во листа")],
  [["K"], tr("Претходен ред во листа")],
  [["Enter"], tr("Отвори го избраниот ред")],
  [["N"], tr("Нов запис во листата")],
  [["Ctrl", "S"], tr("Зачувај формулар")],
  [["Esc"], tr("Затвори дијалог или панел")],
  [["?"], tr("Оваа листа")],
];

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={t.shortcuts} onClose={onClose} size="sm">
      <dl className="fact-list">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={label}><dt>{label}</dt><dd className="row-tight">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</dd></div>
        ))}
      </dl>
    </Modal>
  );
}

function IdleDialog() {
  const { session, keepAlive, idleWarning } = useSession();
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!idleWarning) return;
    setLeft(session?.session.idle_warning || 60);
    const h = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(h);
  }, [idleWarning, session]);
  if (!idleWarning) return null;
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, "0");
  return (
    <Modal size="sm" title={t.idleTitle} onClose={keepAlive}
      footer={<Button variant="primary" autoFocus onClick={keepAlive}>{t.stayLoggedIn}</Button>}>
      <p>{t.idleWarning} <b className="num">{mm}:{ss}</b>.</p>
    </Modal>
  );
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [creating, setCreating] = useState(false);
  const location = useLocation();
  const { groups } = useNav();
  useLiveUpdates(Boolean(session?.user));

  const activeKey = groupForPath(location.pathname)?.key ?? "";
  const active = useMemo(() => groups.find((g) => g.group.key === activeKey), [groups, activeKey]);

  useEffect(() => { setDrawer(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      if (e.key === "Escape" && drawer) { setDrawer(false); return; }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "?") { e.preventDefault(); setShortcuts(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <CrumbProvider>
      <div className="ea-app">
        <a className="ea-skip" href="#main">{tr("Прескокни до содржината")}</a>
        <Sidebar groups={groups} activeKey={activeKey} open={drawer} onClose={() => setDrawer(false)} />
        <div className="ea-app-main">
          <header className="ea-top">
            <button type="button" className="btn btn-ghost btn-icon ea-top-menu" aria-label={tr("Отвори мени")} aria-controls="ea-side"
              aria-expanded={drawer} onClick={() => setDrawer(true)}><MenuIcon aria-hidden /></button>
            <Breadcrumbs group={active} />
            <button type="button" className="ea-top-search" onClick={() => setPalette(true)} aria-label={tr("Барај или изврши (Ctrl K)")}>
              <Search aria-hidden /><span>{tr("Барај или изврши")}</span><Kbd>Ctrl K</Kbd>
            </button>
            <span className="ea-board-grow" />
            <EntitySwitcher />
            <button type="button" className="btn btn-primary btn-sm ea-top-new" onClick={() => setCreating(true)}><Plus aria-hidden /><span>{tr("Ново")}</span></button>
            <NotificationsPopover />
            <ThemeButton />
            <UserMenu onShortcuts={() => setShortcuts(true)} />
          </header>
          {active ? <ModuleTabs g={active} /> : null}
          <main className="ea-main" id="main" tabIndex={-1} data-module={active?.group.module}>{children}</main>
        </div>
      </div>
      <nav className="ea-bnav" aria-label={tr("Брза навигација")}>
        <Link to="/"><House aria-hidden /><span>{t.home}</span></Link>
        <button type="button" onClick={() => setPalette(true)}><Search aria-hidden /><span>{tr("Барај")}</span></button>
        <button type="button" className="is-new" onClick={() => setCreating(true)}><Plus aria-hidden /><span>{tr("Ново")}</span></button>
        <Link to="/notifications"><Bell aria-hidden /><span>{t.notifications}</span></Link>
        <button type="button" onClick={() => setDrawer(true)} aria-controls="ea-side"><MenuIcon aria-hidden /><span>{t.menu}</span></button>
      </nav>
      <CommandPalette open={palette} onOpenChange={setPalette} />
      {creating ? <NewDialog onClose={() => setCreating(false)} /> : null}
      {shortcuts ? <ShortcutsDialog onClose={() => setShortcuts(false)} /> : null}
      <IdleDialog />
    </CrumbProvider>
  );
}

/** Quick access (pinned lists + recently opened records), used by Home. */
export function QuickLinks({ titleOf }: { titleOf: (route: string) => string }) {
  const { pins, recent } = usePrefs();
  if (!pins.length && !recent.length) return <EmptyState compact icon={Pin} title={tr("Сè уште ништо")}>{tr("Закачете листа во менито (иглата до името) или отворете запис — ќе се појави тука.")}</EmptyState>;
  return (
    <ol className="ea-rows">
      {pins.map((p) => <li key={`p${p}`}><span className="ea-rows-name"><Link to={p}><Pin aria-hidden /> {titleOf(p)}</Link></span></li>)}
      {recent.slice(0, 6).map((r) => (
        <li key={`r${r.route}`}><span className="ea-rows-name"><Link to={r.route}><Clock aria-hidden /> {r.title}</Link><span className="ea-rows-sub">{r.kind}</span></span></li>
      ))}
    </ol>
  );
}
