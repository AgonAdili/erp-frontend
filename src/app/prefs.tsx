/** Per-person conveniences kept in this browser: theme, row density, the module panel, the active legal
 * entity for overviews, pinned screens and recently opened records. Storage may be unavailable (private
 * windows); everything falls back to defaults. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useSession } from "@/auth/session";

export type Theme = "system" | "light" | "dark";
export type Density = "comfortable" | "compact";

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`eacore.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(`eacore.${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** useState persisted under `eacore.<key>`. */
export function useStored<T>(key: string, fallback: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStore(key, fallback));
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      writeStore(key, next);
      return next;
    });
  }, [key]);
  return [value, set];
}

export interface RecentItem {
  route: string;
  title: string;
  kind: string;
  at: number;
}

interface PrefsValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: "light" | "dark";
  density: Density;
  setDensity: (d: Density) => void;
  navCollapsed: boolean;
  setNavCollapsed: (v: boolean) => void;
  entity: number | null;
  setEntity: (id: number | null) => void;
  pins: string[];
  togglePin: (route: string) => void;
  recent: RecentItem[];
  pushRecent: (item: Omit<RecentItem, "at">) => void;
}

const PrefsContext = createContext<PrefsValue | null>(null);

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [theme, setTheme] = useStored<Theme>("theme", "system");
  const [density, setDensity] = useStored<Density>("density", "comfortable");
  const [navCollapsed, setNavCollapsed] = useStored("navCollapsed", false);
  const [storedEntity, setEntity] = useStored<number | null>("entity", null);
  const [pins, setPins] = useStored<string[]>("pins", []);
  const [recent, setRecent] = useStored<RecentItem[]>("recent", []);
  const [dark, setDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
    root.setAttribute("data-density", density);
  }, [theme, density]);

  // the stored entity only counts while the user still has access to it
  const entities = session?.access?.entities ?? [];
  const entity = storedEntity !== null && entities.some((e) => e.id === storedEntity)
    ? storedEntity : session?.access?.default_entity_id ?? entities[0]?.id ?? null;

  const togglePin = useCallback((route: string) => {
    setPins((list) => (list.includes(route) ? list.filter((r) => r !== route) : [...list, route].slice(-12)));
  }, [setPins]);

  const pushRecent = useCallback((item: Omit<RecentItem, "at">) => {
    setRecent((list) => [{ ...item, at: Date.now() }, ...list.filter((r) => r.route !== item.route)].slice(0, 12));
  }, [setRecent]);

  const value = useMemo<PrefsValue>(() => ({
    theme, setTheme, resolvedTheme: theme === "system" ? (dark ? "dark" : "light") : theme,
    density, setDensity, navCollapsed, setNavCollapsed, entity, setEntity, pins, togglePin, recent, pushRecent,
  }), [theme, setTheme, dark, density, setDensity, navCollapsed, setNavCollapsed, entity, setEntity, pins, togglePin, recent, pushRecent]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

const FALLBACK: PrefsValue = {
  theme: "system", setTheme: () => undefined, resolvedTheme: "light", density: "comfortable", setDensity: () => undefined,
  navCollapsed: false, setNavCollapsed: () => undefined, entity: null, setEntity: () => undefined,
  pins: [], togglePin: () => undefined, recent: [], pushRecent: () => undefined,
};

/** Preferences; outside the provider (isolated component tests) the defaults. */
export function usePrefs(): PrefsValue {
  return useContext(PrefsContext) ?? FALLBACK;
}

/** The legal entity the overviews show; null lets the server use the user's default. */
export function useEntity(): number | null {
  return usePrefs().entity;
}
