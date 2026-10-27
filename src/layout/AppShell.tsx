/** The frame around every signed-in screen: the module rail, the module panel (its screens and lists), the top
 * bar (breadcrumbs, ⌘K, legal entity, notifications, user menu), shortcuts and the idle-timeout warning. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Building, Check, ChevronDown, ChevronRight, Clock, House, Inbox, Keyboard, LogOut, Menu as MenuIcon, Monitor, Moon,
  PanelLeft, PanelLeftClose, Pin, Rows3, Rows4, Search, Sun, User,
} from "lucide-react";

import { api } from "@/api/client";
import type { Page, Row } from "@/api/types";
import { useSession } from "@/auth/session";
import { usePrefs } from "@/app/prefs";
import { Button, EmptyState, IconButton, Kbd, Menu, Modal, Popover, Tooltip } from "@/components/ui";
import { t } from "@/i18n/mk";
import { formatRelative } from "@/lib/format";
import { useLiveUpdates } from "@/live/useLiveUpdates";
import { groupForPath, resourcePath } from "@/nav/modules";
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

// ── rail ──────────────────────────────────────────────────────────────────────

function Rail({ groups, active, onPick }: { groups: VisibleGroup[]; active: string; onPick: () => void }) {
  const inbox = useInboxCount();
  const { navCollapsed, setNavCollapsed } = usePrefs();
  const location = useLocation();
  const atHome = location.pathname === "/";
  return (
    <nav className="rail" aria-label={t.menu}>
      <Link to="/" className="brand" aria-label={t.home} onClick={onPick}>EA</Link>
      <Tooltip content={t.home} side="right">
        <Link to="/" className={`rail-btn${atHome ? " active" : ""}`} aria-label={t.home} onClick={onPick}><House aria-hidden /></Link>
      </Tooltip>
      <Tooltip content={t.inbox} side="right">
        <Link to="/inbox" className={`rail-btn${location.pathname === "/inbox" ? " active" : ""}`}
          aria-label={`${t.inbox}${inbox.data ? `: ${inbox.data}` : ""}`} onClick={onPick}>
          <Inbox aria-hidden />
          {inbox.data ? <span className="dot">{inbox.data > 99 ? "99+" : inbox.data}</span> : null}
        </Link>
      </Tooltip>
      <span className="rail-sep" aria-hidden />
      {groups.map((g) => (
        <Tooltip key={g.group.key} content={g.group.label} side="right">
          <Link to={g.landing} className={`rail-btn${active === g.group.key ? " active" : ""}`} aria-label={g.group.label}
            aria-current={active === g.group.key ? "true" : undefined} onClick={onPick}>
            <g.group.icon aria-hidden />
          </Link>
        </Tooltip>
      ))}
      <span className="grow" />
      <Tooltip content={navCollapsed ? t.expand : t.collapse} side="right">
        <button type="button" className="rail-btn modnav-toggle" aria-label={navCollapsed ? t.expand : t.collapse}
          onClick={() => setNavCollapsed(!navCollapsed)}>
          {navCollapsed ? <PanelLeft aria-hidden /> : <PanelLeftClose aria-hidden />}
        </button>
      </Tooltip>
    </nav>
  );
}

// ── module panel ──────────────────────────────────────────────────────────────

function PinButton({ route }: { route: string }) {
  const { pins, togglePin } = usePrefs();
  const on = pins.includes(route);
  return (
    <button type="button" className={`pin-btn${on ? " on" : ""}`} aria-label={on ? t.unpin : t.pin} title={on ? t.unpin : t.pin}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(route); }}>
      <Pin aria-hidden />
    </button>
  );
}

function GroupPanel({ g, onNavigate }: { g: VisibleGroup; onNavigate: () => void }) {
  const location = useLocation();
  const current = `/${resourcePath(location.pathname)}`;
  const inMore = g.more.some((r) => r.route === current);
  const [showMore, setShowMore] = useState(inMore);
  useEffect(() => { if (inMore) setShowMore(true); }, [inMore]);
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");
  return (
    <>
      {g.links.length ? (
        <>
          {g.links.map((l) => (
            <NavLink key={l.to} to={l.to} end className={linkClass} onClick={onNavigate}>{l.label}</NavLink>
          ))}
        </>
      ) : null}
      {g.primary.length ? <div className="nav-label">{t.records}</div> : null}
      {g.primary.map((r) => (
        <NavLink key={r.route} to={r.route} className={() => (current === r.route ? "active" : "")} onClick={onNavigate}>
          <span className="truncate">{r.title}</span><PinButton route={r.route} />
        </NavLink>
      ))}
      {g.more.length ? (
        <>
          <button type="button" className="nav-more" aria-expanded={showMore} onClick={() => setShowMore((s) => !s)}>
            {showMore ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
            {g.primary.length ? `${t.more} (${g.more.length})` : `${t.records} (${g.more.length})`}
          </button>
          {showMore ? g.more.map((r) => (
            <NavLink key={r.route} to={r.route} className={() => (current === r.route ? "active" : "")} onClick={onNavigate}>
              <span className="truncate">{r.title}</span><PinButton route={r.route} />
            </NavLink>
          )) : null}
        </>
      ) : null}
    </>
  );
}

function QuickPanel({ onNavigate }: { onNavigate: () => void }) {
  const { pins, recent } = usePrefs();
  const { resources, groups } = useNav();
  const titleOf = (route: string) => resources.find((r) => r.route === route)?.title
    ?? groups.flatMap((g) => g.links).find((l) => l.to === route)?.label ?? route;
  return (
    <>
      <div className="nav-label">{t.pinned}</div>
      {pins.length ? pins.map((p) => (
        <NavLink key={p} to={p} onClick={onNavigate}><Pin aria-hidden /><span className="truncate">{titleOf(p)}</span><PinButton route={p} /></NavLink>
      )) : <p className="xs muted" style={{ padding: "4px 10px", margin: 0 }}>Закачете листа со иглата до нејзиното име.</p>}
      <div className="nav-label">{t.recent}</div>
      {recent.length ? recent.slice(0, 8).map((r) => (
        <NavLink key={r.route} to={r.route} onClick={onNavigate}><Clock aria-hidden /><span className="truncate">{r.title}</span></NavLink>
      )) : <p className="xs muted" style={{ padding: "4px 10px", margin: 0 }}>Записите што ги отворате ќе се појават тука.</p>}
    </>
  );
}

function ModNav({ group, onNavigate }: { group?: VisibleGroup; onNavigate: () => void }) {
  const { navCollapsed } = usePrefs();
  return (
    <aside className={`modnav${navCollapsed ? " collapsed" : ""}`} aria-label={group?.group.label ?? t.home}>
      <div className="modnav-head"><h2>{group?.group.label ?? "Брз пристап"}</h2></div>
      <div className="modnav-body">
        {group ? <GroupPanel key={group.group.key} g={group} onNavigate={onNavigate} /> : <QuickPanel onNavigate={onNavigate} />}
      </div>
    </aside>
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
  } else if (link?.overview) {
    items.push({ label: link.label });
  } else if (crumb) {
    items.push({ label: crumb });
  }
  if (!items.length) items.push({ label: location.pathname === "/" ? t.home : crumb || t.appName });
  return (
    <nav className="crumbs" aria-label="Патека">
      {items.map((it, i) => (
        <span key={i} className="row-tight" style={{ minWidth: 0, gap: 4 }}>
          {i > 0 ? <ChevronRight aria-hidden /> : null}
          {it.to && i < items.length - 1 ? <Link to={it.to}>{it.label}</Link> : <span className="current" aria-current="page">{it.label}</span>}
        </span>
      ))}
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
      <button type="button" className="btn ghost entity-btn" aria-label={`${t.entity}: ${current?.name ?? ""}`}>
        <Building aria-hidden /><span>{current?.short_name || current?.code || t.entity}</span><ChevronDown aria-hidden />
      </button>
    } items={[
      { heading: true, label: "Правно лице за прегледите" },
      ...entities.map((e) => ({
        label: e.name, icon: e.id === entity ? Check : undefined, hint: e.code, onSelect: () => setEntity(e.id),
      })),
    ]} />
  );
}

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
      <button type="button" className="btn ghost icon" aria-label={`${t.notifications}${n ? `: ${n}` : ""}`} style={{ position: "relative" }}>
        <Bell aria-hidden />
        {n ? <span className="count" style={{ position: "absolute", top: 1, right: -2 }}>{n > 99 ? "99+" : n}</span> : null}
      </button>
    }>
      <div style={{ width: "min(380px, calc(100vw - 24px))" }}>
        <div className="row" style={{ padding: "12px 14px 8px" }}>
          <strong>{t.notifications}</strong><span className="spacer" />
          {n ? <Button size="sm" variant="ghost" onClick={async () => { await api.post("/workflow/notifications/read-all/"); refresh(); }}>{t.markAllRead}</Button> : null}
        </div>
        {list.isLoading ? <div style={{ padding: 20 }} className="muted small">{t.loading}</div>
          : !(list.data?.results ?? []).length ? <EmptyState compact icon={Bell} title="Нема нови известувања" /> : (
            <div style={{ padding: "0 6px 6px" }}>
              {(list.data?.results ?? []).map((row) => (
                <button key={row.id} type="button" className="menu-item" style={{ width: "100%", alignItems: "flex-start", border: 0, background: "none", textAlign: "left" }}
                  onClick={() => void openOne(row)}>
                  <span className={`badge ${row.level === "WARNING" ? "danger" : row.level === "ACTION" ? "warning" : "info"} plain`} style={{ width: 8, height: 8, padding: 0, marginTop: 7 }} aria-hidden />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 500 }}>{String(row.title)}</span>
                    {row.message ? <span className="small muted" style={{ display: "block" }}>{String(row.message)}</span> : null}
                    <span className="xs muted">{formatRelative(row.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        <div className="panel-foot" style={{ justifyContent: "center" }}>
          <Link to="/notifications" className="panel-link" onClick={() => setOpen(false)}>{t.viewAll}</Link>
        </div>
      </div>
    </Popover>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function UserMenu({ onShortcuts }: { onShortcuts: () => void }) {
  const { session, logout } = useSession();
  const { theme, setTheme, density, setDensity } = usePrefs();
  const navigate = useNavigate();
  const user = session?.user;
  const name = user?.full_name || user?.username || "";
  return (
    <Menu label={name} trigger={
      <button type="button" className="btn ghost" aria-label={`${t.profile}: ${name}`} style={{ paddingLeft: 4, gap: 8 }}>
        <span className="avatar" aria-hidden>{initials(name)}</span>
        <ChevronDown aria-hidden />
      </button>
    } items={[
      { heading: true, label: name },
      { label: t.profile, icon: User, onSelect: () => navigate("/profile") },
      { label: t.theme, heading: true, separatorBefore: true },
      { label: t.themeSystem, icon: theme === "system" ? Check : Monitor, onSelect: () => setTheme("system") },
      { label: t.themeLight, icon: theme === "light" ? Check : Sun, onSelect: () => setTheme("light") },
      { label: t.themeDark, icon: theme === "dark" ? Check : Moon, onSelect: () => setTheme("dark") },
      { label: t.density, heading: true, separatorBefore: true },
      { label: t.comfortable, icon: density === "comfortable" ? Check : Rows3, onSelect: () => setDensity("comfortable") },
      { label: t.compact, icon: density === "compact" ? Check : Rows4, onSelect: () => setDensity("compact") },
      { label: t.shortcuts, icon: Keyboard, hint: "?", onSelect: onShortcuts, separatorBefore: true },
      { label: t.signOut, icon: LogOut, onSelect: () => void logout(), danger: true, separatorBefore: true },
    ]} />
  );
}

const SHORTCUTS: [string[], string][] = [
  [["Ctrl", "K"], "Пребарај или оди на екран"],
  [["/"], "Пребарај во листата"],
  [["J"], "Следен ред во листа"],
  [["K"], "Претходен ред во листа"],
  [["Enter"], "Отвори го избраниот ред"],
  [["N"], "Нов запис во листата"],
  [["Ctrl", "S"], "Зачувај формулар"],
  [["Esc"], "Затвори дијалог или панел"],
  [["?"], "Оваа листа"],
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
      <p>{t.idleWarning} <strong className="num" style={{ fontSize: 18 }}>{mm}:{ss}</strong>.</p>
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
      <div className="shell">
        {drawer ? <div className="nav-scrim" onClick={() => setDrawer(false)} aria-hidden /> : null}
        <div className={`nav-drawer${drawer ? " open" : ""}`}>
          <Rail groups={groups} active={activeKey} onPick={() => setDrawer(false)} />
          <ModNav group={active} onNavigate={() => setDrawer(false)} />
        </div>
        <div className="main">
          <header className="topbar">
            <IconButton className="menu-toggle" label={t.menu} icon={MenuIcon} onClick={() => setDrawer(true)} tip={false} />
            <Breadcrumbs group={active} />
            <button type="button" className="search-trigger" onClick={() => setPalette(true)} aria-label={t.searchEverywhere}>
              <Search aria-hidden /><span>{t.searchEverywhere}</span><Kbd>Ctrl K</Kbd>
            </button>
            <EntitySwitcher />
            <NotificationsPopover />
            <UserMenu onShortcuts={() => setShortcuts(true)} />
          </header>
          <main className="content" id="main">{children}</main>
        </div>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
      {shortcuts ? <ShortcutsDialog onClose={() => setShortcuts(false)} /> : null}
      <IdleDialog />
    </CrumbProvider>
  );
}
