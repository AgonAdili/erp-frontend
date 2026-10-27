/** ⌘K / Ctrl+K: go to any screen or list, create a record, find a record (server search), recent records,
 * and a few app commands. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { Clock, FileText, LayoutGrid, LogOut, Moon, Plus, Search, Sun, Bell, Inbox, Monitor } from "lucide-react";

import { api } from "@/api/client";
import { useSession } from "@/auth/session";
import { usePrefs } from "@/app/prefs";
import { Kbd } from "@/components/ui";
import { t } from "@/i18n/mk";
import { useNav } from "@/nav/useNav";

interface SearchRow {
  group: string;
  title: string;
  subtitle: string;
  route: string;
}

function useDebounced<T>(value: T, ms = 220): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(h);
  }, [value, ms]);
  return v;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { groups, resources } = useNav();
  const { recent, setTheme, resolvedTheme } = usePrefs();
  const { logout } = useSession();
  const [text, setText] = useState("");
  const query = useDebounced(text.trim());
  const search = useQuery({
    queryKey: ["search", query],
    queryFn: ({ signal }) => api.get<{ results: SearchRow[] }>("/search/", { q: query }, signal),
    enabled: open && query.length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => { if (!open) setText(""); }, [open]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };
  const results = search.data?.results ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="cmdk-dialog" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{t.searchEverywhere}</Dialog.Title>
          <Command label={t.searchEverywhere} loop>
            <div className="cmdk-input-wrap">
              <Search aria-hidden />
              <Command.Input value={text} onValueChange={setText} placeholder={t.searchEverywhere} autoFocus />
              {search.isFetching ? <span className="spinner" aria-hidden style={{ color: "var(--ink-faint)" }} /> : <Kbd>Esc</Kbd>}
            </div>
            <Command.List>
              <Command.Empty>{query.length >= 2 && search.isFetching ? t.loading : t.noResults}</Command.Empty>
              {results.length ? (
                <Command.Group heading={t.records}>
                  {results.map((r, i) => (
                    <Command.Item key={`${r.route}-${i}`} value={`rec ${r.title} ${r.subtitle} ${r.group} ${i}`} keywords={[query]}
                      onSelect={() => go(r.route)}>
                      <FileText aria-hidden />
                      <span className="truncate">{r.title}</span>
                      <span className="c-sub">{[r.group, r.subtitle].filter(Boolean).join(" — ")}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {!text && recent.length ? (
                <Command.Group heading={t.recent}>
                  {recent.slice(0, 6).map((r) => (
                    <Command.Item key={r.route} value={`recent ${r.title} ${r.route}`} onSelect={() => go(r.route)}>
                      <Clock aria-hidden />
                      <span className="truncate">{r.title}</span>
                      <span className="c-sub">{r.kind}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              <Command.Group heading={t.screens}>
                <Command.Item value="Почетна home" onSelect={() => go("/")}><LayoutGrid aria-hidden />{t.home}</Command.Item>
                <Command.Item value="Одобрувања inbox" onSelect={() => go("/inbox")}><Inbox aria-hidden />{t.inbox}</Command.Item>
                <Command.Item value="Известувања notifications" onSelect={() => go("/notifications")}><Bell aria-hidden />{t.notifications}</Command.Item>
                {groups.flatMap((g) => g.links.map((l) => (
                  <Command.Item key={l.to} value={`${g.group.label} ${l.label} ${l.to}`} onSelect={() => go(l.to)}>
                    <g.group.icon aria-hidden />
                    <span>{l.overview ? `${g.group.label}: ${l.label.toLowerCase()}` : l.label}</span>
                    <span className="c-sub">{g.group.label}</span>
                  </Command.Item>
                )))}
                {groups.flatMap((g) => [...g.primary, ...g.more].map((r) => (
                  <Command.Item key={r.route} value={`${r.title} ${g.group.label} ${r.path}`} onSelect={() => go(r.route)}>
                    <g.group.icon aria-hidden />
                    <span>{r.title}</span>
                    <span className="c-sub">{g.group.label}</span>
                  </Command.Item>
                )))}
              </Command.Group>
              {text ? (
                <Command.Group heading={t.create}>
                  {resources.filter((r) => r.entry.permissions.add).map((r) => (
                    <Command.Item key={`new-${r.route}`} value={`нов креирај ${r.title} ${r.path}`} onSelect={() => go(`${r.route}/new`)}>
                      <Plus aria-hidden />
                      <span>{t.addNew}: {r.title}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              <Command.Group heading={t.actions}>
                <Command.Item value="тема изглед темен светол theme" onSelect={() => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); onOpenChange(false); }}>
                  {resolvedTheme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
                  {resolvedTheme === "dark" ? t.themeLight : t.themeDark}
                </Command.Item>
                <Command.Item value="тема систем theme system" onSelect={() => { setTheme("system"); onOpenChange(false); }}>
                  <Monitor aria-hidden />{t.theme}: {t.themeSystem.toLowerCase()}
                </Command.Item>
                <Command.Item value="одјава sign out logout" onSelect={() => { onOpenChange(false); void logout(); }}>
                  <LogOut aria-hidden />{t.signOut}
                </Command.Item>
              </Command.Group>
            </Command.List>
            <div className="cmdk-foot">
              <span><Kbd>↑</Kbd><Kbd>↓</Kbd> избор</span>
              <span><Kbd>Enter</Kbd> отвори</span>
              <span><Kbd>Esc</Kbd> затвори</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
