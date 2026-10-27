/** Sidebar (resources the user may view, grouped by module), top bar (search, notifications, entity, user),
 * idle-timeout warning. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { ResourceIndexEntry } from "@/api/types";
import { useSession } from "@/auth/session";
import { Button, Modal } from "@/components/ui";
import { moduleLabel, MODULES, t } from "@/i18n/mk";
import { useLiveUpdates } from "@/live/useLiveUpdates";
import { routeFor, useResourceIndex } from "@/meta/hooks";

/** Extra screens that are not plain resources, per module. */
export const CUSTOM_LINKS: { module: string; to: string; label: string; code?: string }[] = [
  { module: "offers", to: "/offers/dashboard", label: "Преглед (понуди)", code: "offers.dashboard.view" },
  { module: "offers", to: "/offers/approvals", label: "Одобрувања на понуди", code: "offers.approval.view" },
  { module: "procurement", to: "/procurement/dashboard", label: "Преглед (набавка)", code: "procurement.dashboard.view" },
  { module: "accounting", to: "/accounting/dashboard", label: "Преглед (сметководство)", code: "accounting.dashboard.view" },
  { module: "finance", to: "/finance/dashboard", label: "Преглед (финансии)", code: "finance.dashboard.view" },
  { module: "workorders", to: "/workorders/dashboard", label: "Преглед (работни налози)", code: "work_orders.dashboard.view" },
  { module: "workorders", to: "/workorders/resource-board", label: "Распоред на ресурси", code: "work_orders.resource_board.view" },
  { module: "hr", to: "/hr/leave-timeline", label: "Отсуства — распоред", code: "hr.leaves.view" },
  { module: "hr", to: "/hr/attendance-day", label: "Присуство (по ден)", code: "hr.attendance.add" },
  { module: "hr", to: "/hr/attendance-month", label: "Присуство (по месец)", code: "hr.attendance.add" },
  { module: "hr", to: "/hr/dashboard", label: "Преглед (HR)", code: "hr.dashboard.view" },
  { module: "hr", to: "/hr/kpi-month", label: "Показатели по месец", code: "hr.kpi.view" },
  { module: "inventory", to: "/inventory/stock", label: "Залиха и вреднување", code: "inventory.movements.view" },
  { module: "fleet", to: "/fleet/dashboard", label: "Преглед (возен парк)", code: "fleet.dashboard.view" },
  { module: "fleet", to: "/fleet/efficiency", label: "Потрошувачка наспроти норма", code: "fleet.reports.view" },
  { module: "budget", to: "/budget/portfolio", label: "Буџет по проекти", code: "finance.budget.view" },
  { module: "analytics", to: "/analytics", label: "Аналитика", code: "analytics.dashboard.view" },
];

function groupResources(entries: ResourceIndexEntry[]) {
  const groups = new Map<string, ResourceIndexEntry[]>();
  for (const e of entries) {
    if (!e.permissions.view) continue;
    const list = groups.get(e.module) ?? [];
    list.push(e);
    groups.set(e.module, list);
  }
  return [...groups.entries()].sort((a, b) => (MODULES[a[0]]?.order ?? 999) - (MODULES[b[0]]?.order ?? 999));
}

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const index = useResourceIndex();
  const { can } = useSession();
  const location = useLocation();
  const groups = useMemo(() => groupResources(index.data ?? []), [index.data]);
  const currentModule = location.pathname.split("/")[1];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const custom = CUSTOM_LINKS.filter((l) => !l.code || can(l.code));
  const moduleKeys = new Set([...groups.map(([m]) => m), ...custom.map((c) => c.module)]);
  const ordered = [...moduleKeys].sort((a, b) => (MODULES[a]?.order ?? 999) - (MODULES[b]?.order ?? 999));
  return (
    <nav className={`sidebar${open ? " open" : ""}`} aria-label="Главно мени">
      <Link to="/" className="brand" onClick={onNavigate}>{t.appName}</Link>
      <NavLink to="/" end onClick={onNavigate}>{t.home}</NavLink>
      <NavLink to="/workflow/inbox-screen" onClick={onNavigate}>{t.inbox}</NavLink>
      {ordered.map((module) => {
        const items = groups.find(([m]) => m === module)?.[1] ?? [];
        const links = custom.filter((c) => c.module === module);
        const isOpen = expanded[module] ?? module === currentModule;
        return (
          <div key={module}>
            <button type="button" className="group-title" aria-expanded={isOpen}
              onClick={() => setExpanded((s) => ({ ...s, [module]: !isOpen }))}>
              <span>{module === "analytics" ? "Аналитика" : moduleLabel(module)}</span>
              <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen ? (
              <>
                {links.map((l) => <NavLink key={l.to} to={l.to} onClick={onNavigate}>{l.label}</NavLink>)}
                {items.map((e) => (
                  <NavLink key={e.key} to={routeFor(e.endpoint)} onClick={onNavigate}>{e.title}</NavLink>
                ))}
              </>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

interface SearchRow {
  group: string;
  title: string;
  subtitle: string;
  route: string;
}

function GlobalSearch() {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(text.trim()), 250);
    return () => window.clearTimeout(h);
  }, [text]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const q = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.get<{ results: SearchRow[] }>("/search/", { q: debounced }),
    enabled: debounced.length >= 2,
  });
  return (
    <div className="combo" ref={ref} style={{ width: "min(420px, 50vw)" }}>
      <input className="input" type="search" placeholder={t.searchPlaceholder} aria-label={t.search} value={text}
        onFocus={() => setOpen(true)} onChange={(e) => { setText(e.target.value); setOpen(true); }} />
      {open && debounced.length >= 2 ? (
        <div className="options">
          {(q.data?.results ?? []).map((r, i) => (
            <button key={i} type="button" onClick={() => { setOpen(false); setText(""); navigate(r.route); }}>
              <span className="small muted">{r.group}</span> {r.title}
              {r.subtitle ? <div className="small muted">{r.subtitle}</div> : null}
            </button>
          ))}
          {q.data && !q.data.results.length ? <div className="small muted" style={{ padding: 8 }}>{t.noResults}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function NotificationBell() {
  const q = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<{ count: number }>("/workflow/notifications/unread/"),
    refetchInterval: 60_000,
  });
  const count = q.data?.count ?? 0;
  return (
    <Link to="/workflow/notifications" className="btn ghost" aria-label={`${t.notifications}: ${count}`}>
      🔔{count ? <span className="badge danger" style={{ marginLeft: 4 }}>{count}</span> : null}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout, idleWarning, keepAlive } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  useLiveUpdates(Boolean(session?.user));
  const entities = session?.access?.entities ?? [];
  const user = session?.user;
  return (
    <div className="shell">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div className="main">
        <header className="topbar">
          <Button variant="ghost" className="menu-toggle" aria-label="Мени" onClick={() => setMenuOpen((o) => !o)}>☰</Button>
          <GlobalSearch />
          <span className="spacer" />
          <span className="small muted entity-label" title={entities.map((e) => e.name).join(", ")}>
            {session?.access?.all_entities ? t.allEntities : entities.map((e) => e.short_name || e.code).join(", ")}
          </span>
          <NotificationBell />
          <Link to="/profile" className="small">{user?.full_name ?? user?.username}</Link>
          <Button size="sm" onClick={() => void logout()}>{t.signOut}</Button>
        </header>
        <main className="content">{children}</main>
      </div>
      {idleWarning ? (
        <Modal title={t.idleWarning} onClose={keepAlive}
          footer={<Button variant="primary" onClick={keepAlive}>{t.stayLoggedIn}</Button>}>
          <p style={{ margin: 0 }}>{t.idleWarning}</p>
        </Modal>
      ) : null}
    </div>
  );
}
