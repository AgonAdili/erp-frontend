/** The app shell (branding_rules/04 §1): skip link · sidebar (modules grouped by module group, the module icon in
 * its group's colour) · top bar (breadcrumbs, search ⌘K, "+ Ново", notifications, profile) · module tabs
 * (Преглед first, then the module's lists) · main. On phones a bottom nav replaces the sidebar. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Page, Row } from "@/api/types";
import { useSession } from "@/auth/session";
import { usePrefs } from "@/app/prefs";
import {
  Bell, Check, ChevronRight, House, Inbox, Keyboard, LogOut, Menu as MenuIcon, Monitor, Moon, PanelLeftClose, PanelLeftOpen,
  Plus, Search, Sun, User,
} from "@/components/icons";
import { Button, EmptyState, IconButton, Kbd, Menu, Modal, Popover, Tooltip, type MenuEntry } from "@/components/ui";
import { t } from "@/i18n/mk";
import { formatRelative } from "@/lib/format";
import { useLiveUpdates } from "@/live/useLiveUpdates";
import { groupForPath, MODULE_GROUPS, resourcePath } from "@/nav/modules";
import { useNav, type VisibleGroup } from "@/nav/useNav";

import { CommandPalette } from "./CommandPalette";
import { CrumbProvider, useCrumb } from "./Page";

function useInboxCount() {
  return useQuery({
    queryKey: ["inbox", "count"],
    queryFn: () => api.get<Page<Row>>("/workflow/inbox/", { page_size: 1 }),
    refetchInterval: 120_000,
    select: (d) => d.count,
  });
}

function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<{ count: number }>("/workflow/notifications/unread/"),
    refetchInterval: 60_000,
    select: (d) => d.count,
  });
}

const capped = (n: number) => (n > 99 ? "99+" : String(n));

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function Tip({ on, label, children }: { on: boolean; label: string; children: ReactNode }) {
  return on ? <Tooltip content={label} side="right">{children}</Tooltip> : <>{children}</>;
}

// ── sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ groups, activeKey, onNavigate }: { groups: VisibleGroup[]; activeKey: string; onNavigate: () => void }) {
  const { navCollapsed: collapsed, setNavCollapsed, entity } = usePrefs();
  const { session } = useSession();
  const inbox = useInboxCount();
  const location = useLocation();
  const entities = session?.access?.entities ?? [];
  const company = entities.find((e) => e.id === entity) ?? entities[0];
  const atHome = location.pathname === "/";
  return (
    <aside className="sidebar" aria-label={t.menu}>
      <Link to="/" className="sb-brand" onClick={onNavigate} aria-label={`${t.appName} — ${t.home}`}>
        <svg className="sb-mark" aria-hidden><use href={`${import.meta.env.BASE_URL}icons/solar.svg#eacore-mark`} /></svg>
        <span className="sb-word"><strong translate="no">EACore</strong><span>{company?.short_name || company?.name || "EA Group"}</span></span>
      </Link>
      <nav className="sb-scroll" aria-label={t.menu}>
        <Tip on={collapsed} label={t.home}>
          <Link to="/" className={`sb-item plain${atHome ? " active" : ""}`} aria-current={atHome ? "page" : undefined} onClick={onNavigate}>
            <span className="sb-tile"><House /></span><span className="sb-text">{t.home}</span>
          </Link>
        </Tip>
        <Tip on={collapsed} label={t.inbox}>
          <NavLink to="/inbox" className={({ isActive }) => `sb-item plain${isActive ? " active" : ""}`} onClick={onNavigate}
            aria-label={`${t.inbox}${inbox.data ? `: ${inbox.data}` : ""}`}>
            <span className="sb-tile"><Inbox /></span><span className="sb-text">{t.inbox}</span>
            {inbox.data ? <span className="sb-count">{capped(inbox.data)}</span> : null}
          </NavLink>
        </Tip>
        {MODULE_GROUPS.map(({ tone, label }) => {
          const list = groups.filter((g) => g.group.tone === tone);
          if (!list.length) return null;
          return (
            <div key={tone} data-module={tone}>
              <div className="sb-group-label ea-label">{label}</div>
              {list.map((g) => {
                const current = g.group.key === activeKey;
                return (
                  <Tip key={g.group.key} on={collapsed} label={g.group.label}>
                    <Link to={g.landing} className={`sb-item${current ? " active" : ""}`} aria-current={current ? "true" : undefined} onClick={onNavigate}>
                      <span className="sb-tile"><g.group.icon /></span><span className="sb-text">{g.group.label}</span>
                    </Link>
                  </Tip>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="sb-foot">
        <IconButton className="sb-collapse" label={collapsed ? t.expand : t.collapse} icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          onClick={() => setNavCollapsed(!collapsed)} />
      </div>
    </aside>
  );
}

// ── top bar ───────────────────────────────────────────────────────────────────

/** Ancestors only: the module, then the list; never an item that repeats its parent. */
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
    if (parts[2]) items.push({ to: res.route, label: res.title });
    items.push({ label: parts[2] === "new" ? t.newRecord : parts[3] === "edit" ? t.edit : parts[2] ? crumb || `#${parts[2]}` : res.title });
  } else if (link && !link.overview) items.push({ label: link.label });
  else if (!group) items.push({ label: location.pathname === "/" ? t.home : crumb || t.appName });
  return (
    <nav className="crumbs" aria-label="Патека">
      {items.map((it, i) => (
        <span key={i} className="row-tight">
          {i > 0 ? <ChevronRight /> : null}
          {it.to && i < items.length - 1 ? <Link to={it.to}>{it.label}</Link> : <span className="truncate" aria-current="page">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** "+ Ново": choice tiles of what to create, by module, filtered by permission. */
function CreateMenu({ groups }: { groups: VisibleGroup[] }) {
  const [open, setOpen] = useState(false);
  const byGroup = groups.map((g) => ({ g, items: [...g.primary, ...g.more].filter((r) => r.entry.permissions.add).slice(0, 6) })).filter((x) => x.items.length);
  if (!byGroup.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen} align="end" trigger={<Button variant="primary" icon={Plus} className="create-btn"><span>{t.addNew}</span></Button>}>
      <div className="create-panel">
        {byGroup.map(({ g, items }) => (
          <div key={g.group.key} className="create-group" data-module={g.group.tone}>
            <span className="ea-label">{g.group.label}</span>
            <div className="create-tiles">
              {items.map((r) => (
                <Link key={r.route} to={`${r.route}/new`} className="create-tile" onClick={() => setOpen(false)}><g.group.icon />{r.title}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Popover>
  );
}

function NotificationsPopover() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const count = useUnreadCount();
  const list = useQuery({
    queryKey: ["notifications", "popover"],
    queryFn: () => api.get<Page<Row>>("/workflow/notifications/", { is_read: "false", page_size: 8 }),
    enabled: open,
  });
  const n = count.data ?? 0;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["notifications"] });
  const openOne = async (row: Row) => {
    setOpen(false);
    await api.post(`/workflow/notifications/${row.id}/read/`).catch(() => undefined);
    refresh();
    if (row.route) navigate(String(row.route));
  };
  const tone = (level: unknown) => (level === "WARNING" ? "stop" : level === "ACTION" ? "caution" : level === "SUCCESS" ? "go" : "info");
  return (
    <Popover open={open} onOpenChange={setOpen} align="end" trigger={
      <button type="button" className="btn btn-ghost btn-icon bell" aria-label={`${t.notifications}${n ? `: ${n}` : ""}`}>
        <Bell />{n ? <span className="sb-count">{capped(n)}</span> : null}
      </button>
    }>
      <div className="stack-sm">
        <div className="row ea-panel-head">
          <h2 className="grow">{t.notifications}</h2>
          {n ? <Button size="sm" variant="ghost" onClick={async () => { await api.post("/workflow/notifications/read-all/"); refresh(); }}>{t.markAllRead}</Button> : null}
        </div>
        {list.isLoading ? <div className="ea-panel-body muted">{t.loading}</div>
          : !(list.data?.results ?? []).length ? <EmptyState compact icon={Bell} title="Нема нови известувања." /> : (
            <ul className="feed">
              {(list.data?.results ?? []).map((row) => (
                <li key={row.id}>
                  <button type="button" className="notif-row" onClick={() => void openOne(row)}>
                    <span className={`ea-dot is-${tone(row.level)}`} aria-hidden />
                    <span className="grow">
                      <span className="n-title">{String(row.title)}</span>
                      {row.message ? <span className="n-sub">{String(row.message)}</span> : null}
                      <span className="n-sub">{formatRelative(row.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        <div className="ea-panel-foot"><Link to="/notifications" onClick={() => setOpen(false)}>{t.viewAll}</Link></div>
      </div>
    </Popover>
  );
}

function UserMenu({ onShortcuts }: { onShortcuts: () => void }) {
  const { session, logout } = useSession();
  const { theme, setTheme, entity, setEntity } = usePrefs();
  const navigate = useNavigate();
  const user = session?.user;
  const name = user?.full_name || user?.username || "";
  const entities = session?.access?.entities ?? [];
  const items: MenuEntry[] = [
    { heading: true, label: name },
    { label: t.profile, icon: User, onSelect: () => navigate("/profile") },
    ...(entities.length > 1 ? [
      { label: t.entity, heading: true, separatorBefore: true } as MenuEntry,
      ...entities.map((e) => ({ label: e.name, icon: e.id === entity ? Check : undefined, hint: e.code, onSelect: () => setEntity(e.id) })),
    ] : []),
    { label: t.theme, heading: true, separatorBefore: true },
    { label: t.themeLight, icon: theme === "light" ? Check : Sun, onSelect: () => setTheme("light") },
    { label: t.themeDark, icon: theme === "dark" ? Check : Moon, onSelect: () => setTheme("dark") },
    { label: t.themeSystem, icon: theme === "system" ? Check : Monitor, onSelect: () => setTheme("system") },
    { label: t.shortcuts, icon: Keyboard, hint: "?", onSelect: onShortcuts, separatorBefore: true },
    { label: t.signOut, icon: LogOut, onSelect: () => void logout(), separatorBefore: true },
  ];
  return (
    <Menu label={name} items={items} trigger={
      <button type="button" className="avatar-btn" aria-label={`${t.profile}: ${name}`}><span className="avatar" aria-hidden>{initials(name)}</span></button>
    } />
  );
}

// ── module tabs: Преглед first, then the module's lists ──────────────────────

/** Room kept for the "Повеќе (n)" trigger when tabs move into it. */
const MORE_W = 132;

function ModuleTabs({ g }: { g: VisibleGroup }) {
  const location = useLocation();
  const here = `/${resourcePath(location.pathname)}`;
  const tab = (active: boolean) => (active ? "active" : "");
  // Преглед first, then the board links and the lists, in order; the ones that don't fit go into "Повеќе"
  const entries = useMemo(() => [
    ...g.links.map((l) => ({ to: l.to, label: l.overview ? t.overview : l.label, link: true })),
    ...g.primary.slice(0, 6).map((r) => ({ to: r.route, label: r.title, link: false })),
  ], [g]);
  const navRef = useRef<HTMLElement>(null);
  const widths = useRef<number[]>([]);
  const [fit, setFit] = useState(entries.length);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    widths.current = [];
    setFit(entries.length);
    const measure = () => {
      if (widths.current.length !== entries.length) {
        const kids = [...nav.querySelectorAll<HTMLElement>(":scope > [data-tab]")];
        if (kids.length !== entries.length) return;
        widths.current = kids.map((k) => k.offsetWidth);
      }
      const gap = parseFloat(getComputedStyle(nav).columnGap) || 0;
      const room = nav.clientWidth;
      const total = widths.current.reduce((s, w) => s + w + gap, 0);
      const extra = g.primary.length > 6 || g.more.length;
      if (total <= room - (extra ? MORE_W : 0)) { setFit(entries.length); return; }
      let used = MORE_W, n = 0;
      while (n < entries.length && used + widths.current[n] + gap <= room) { used += widths.current[n] + gap; n++; }
      setFit(Math.max(1, n));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [entries, g.primary.length, g.more.length]);
  const shown = entries.slice(0, fit);
  const rest = [
    ...entries.slice(fit).map((e) => ({ route: e.to, title: e.label })),
    ...g.primary.slice(6), ...g.more,
  ];
  const inRest = rest.find((r) => r.route === here || r.route === location.pathname);
  return (
    <div className="modtabs" data-module={g.group.tone}>
      <span className="mod-name"><span className="sb-tile"><g.group.icon /></span>{g.group.label}</span>
      <nav className="tabs" aria-label={g.group.label} ref={navRef}>
        {shown.map((e) => e.link
          ? <NavLink key={e.to} to={e.to} end data-tab className={({ isActive }) => tab(isActive)}>{e.label}</NavLink>
          : <Link key={e.to} to={e.to} data-tab className={tab(here === e.to)} aria-current={here === e.to ? "page" : undefined}>{e.label}</Link>)}
        {rest.length ? (
          <Menu label={t.more} align="start" items={rest.map((r) => ({ label: r.title, to: r.route, icon: r.route === here || r.route === location.pathname ? Check : undefined }))}
            trigger={<button type="button" className={tab(Boolean(inRest))}>{inRest ? inRest.title : `${t.more} (${rest.length})`}</button>} />
        ) : null}
      </nav>
    </div>
  );
}

// ── dialogs ───────────────────────────────────────────────────────────────────

const SHORTCUTS: [string[], string][] = [
  [["Ctrl", "K"], "Пребарај или оди на екран"],
  [["/"], "Пребарај во листата"],
  [["J"], "Следен ред во листа"],
  [["K"], "Претходен ред во листа"],
  [["Enter"], "Отвори го избраниот ред"],
  [["N"], "Нов запис"],
  [["Ctrl", "S"], "Зачувај формулар"],
  [["Esc"], "Затвори"],
  [["?"], "Оваа листа"],
];

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={t.shortcuts} onClose={onClose} size="sm">
      <dl className="fact-list">
        {SHORTCUTS.map(([keys, label]) => <div key={label}><dt>{label}</dt><dd className="row-tight">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</dd></div>)}
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
    <Modal size="sm" title={t.idleTitle} onClose={keepAlive} footer={<Button variant="primary" autoFocus onClick={keepAlive}>{t.stayLoggedIn}</Button>}>
      {t.idleWarning} <strong className="num">{mm}:{ss}</strong>.
    </Modal>
  );
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

// ── phones: the bottom nav ────────────────────────────────────────────────────

function BottomNav({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const inbox = useInboxCount();
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");
  return (
    <nav className="bottom-nav" aria-label={t.menu}>
      <NavLink to="/" end className={link}><House />{t.home}</NavLink>
      <NavLink to="/inbox" className={link}><Inbox />{t.inbox}{inbox.data ? <span className="sb-count">{capped(inbox.data)}</span> : null}</NavLink>
      <button type="button" onClick={onSearch}><Search />{t.search}</button>
      <button type="button" onClick={onMenu}><MenuIcon />{t.menu}</button>
    </nav>
  );
}

// ── frame ─────────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { navCollapsed } = usePrefs();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const location = useLocation();
  const { groups } = useNav();
  useLiveUpdates(Boolean(session?.user));

  const activeKey = groupForPath(location.pathname)?.key ?? "";
  const active = useMemo(() => groups.find((g) => g.group.key === activeKey), [groups, activeKey]);

  useEffect(() => { setDrawer(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "?") { e.preventDefault(); setShortcuts(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CrumbProvider>
      <a className="skip-link" href="#main">{t.skipToContent}</a>
      <div className={`app${navCollapsed ? " collapsed" : ""}${drawer ? " nav-open" : ""}`}>
        {drawer ? <div className="nav-scrim" onClick={() => setDrawer(false)} aria-hidden /> : null}
        <Sidebar groups={groups} activeKey={activeKey} onNavigate={() => setDrawer(false)} />
        <div className="main">
          <header className="topbar">
            <IconButton className="menu-toggle" label={t.menu} icon={MenuIcon} onClick={() => setDrawer(true)} tip={false} />
            <Breadcrumbs group={active} />
            <button type="button" className="search-trigger" onClick={() => setPalette(true)} aria-label={t.searchEverywhere}>
              <Search /><span>{t.searchEverywhere}</span><Kbd>Ctrl K</Kbd>
            </button>
            <CreateMenu groups={groups} />
            <span className="bell-wrap"><NotificationsPopover /></span>
            <UserMenu onShortcuts={() => setShortcuts(true)} />
          </header>
          {active ? <ModuleTabs g={active} /> : null}
          <main className="content" id="main" tabIndex={-1} data-module={active?.group.tone}>{children}</main>
        </div>
        <BottomNav onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
      {shortcuts ? <ShortcutsDialog onClose={() => setShortcuts(false)} /> : null}
      <IdleDialog />
    </CrumbProvider>
  );
}
