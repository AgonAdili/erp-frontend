/**
 * Session state for the whole app: who is signed in, their permission codes and legal entities, MFA, and
 * the idle timeout (warning, keepalive, sign-out) the server enforces.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, setCsrfToken, setUnauthorizedHandler } from "@/api/client";
import type { Session } from "@/api/types";
import { isLang, lang, storeLang, type Lang } from "@/i18n";

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (username: string, password: string, remember: boolean) => Promise<Session>;
  verifyMfa: (code: string) => Promise<Session>;
  logout: () => Promise<void>;
  can: (code: string) => boolean;
  idleWarning: boolean;
  keepAlive: () => void;
  /** Save the UI language on the server (Django i18n), then reload so every label and server string follows. */
  setLanguage: (code: Lang) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const SESSION_KEY = ["auth", "session"] as const;

export function hasCode(session: Session | null, code: string): boolean {
  const codes = session?.access?.codes ?? [];
  if (codes.includes("*")) return true;
  if (codes.includes(code)) return true;
  // a bare resource means its view action (server rule)
  return code.split(".").length === 2 && codes.includes(`${code}.view`);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const data = await api.get<Session>("/auth/session/");
      setCsrfToken(data.csrf_token);
      return data;
    },
    staleTime: Infinity,
    retry: 1,
  });
  const session = query.data ?? null;

  const apply = useCallback(
    (data: Session) => {
      setCsrfToken(data.csrf_token);
      queryClient.setQueryData(SESSION_KEY, data);
      return data;
    },
    [queryClient],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (username: string, password: string, remember: boolean) =>
      apply(await api.post<Session>("/auth/login/", { username, password, remember })),
    [apply],
  );

  const verifyMfa = useCallback(
    async (code: string) => {
      await api.post("/auth/mfa/verify/", { code });
      const data = await api.get<Session>("/auth/session/");
      return apply(data);
    },
    [apply],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } finally {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    }
  }, [queryClient]);

  const can = useCallback((code: string) => hasCode(session, code), [session]);

  // The account's language is the source of truth: when the server reports another one than this page loaded with,
  // remember it and reload once (the catalogue loads before the app starts, main.tsx).
  const serverLang = session?.language?.slice(0, 2);
  useEffect(() => {
    if (isLang(serverLang) && serverLang !== lang()) {
      storeLang(serverLang);
      window.location.reload();
    }
  }, [serverLang]);

  const setLanguage = useCallback(async (code: Lang) => {
    // TODO(back end): confirm the field name of POST /api/v1/auth/language/ (endpoints.txt lists only the path).
    if (session?.authenticated) await api.post("/auth/language/", { language: code });
    storeLang(code);
    window.location.reload();
  }, [session?.authenticated]);

  // ── idle timeout: warn before the server's idle limit, keep alive on activity ──
  const [idleWarning, setIdleWarning] = useState(false);
  const lastActivity = useRef(Date.now());
  const lastKeepalive = useRef(Date.now());
  const signedIn = Boolean(session?.authenticated && session.user && !session.mfa?.pending);

  const keepAlive = useCallback(() => {
    lastActivity.current = Date.now();
    lastKeepalive.current = Date.now();
    setIdleWarning(false);
    void api.post("/auth/keepalive/").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!signedIn || !session) return;
    const { idle_timeout, idle_warning, keepalive_interval } = session.session;
    if (!idle_timeout) return;
    const onActivity = () => {
      lastActivity.current = Date.now();
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = window.setInterval(() => {
      const idle = (Date.now() - lastActivity.current) / 1000;
      if (idle >= idle_timeout) {
        void logout();
        return;
      }
      setIdleWarning(idle >= idle_timeout - (idle_warning || 60));
      const sinceKeepalive = (Date.now() - lastKeepalive.current) / 1000;
      if (idle < (keepalive_interval || 300) && sinceKeepalive >= (keepalive_interval || 300)) {
        lastKeepalive.current = Date.now();
        void api.post("/auth/keepalive/").catch(() => undefined);
      }
    }, 5000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(timer);
    };
  }, [signedIn, session, logout]);

  const value = useMemo<SessionContextValue>(
    () => ({ session, loading: query.isLoading, refresh, login, verifyMfa, logout, can, idleWarning, keepAlive, setLanguage }),
    [session, query.isLoading, refresh, login, verifyMfa, logout, can, idleWarning, keepAlive, setLanguage],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

const NO_SESSION: SessionContextValue = {
  session: null,
  loading: false,
  refresh: async () => undefined,
  login: async () => { throw new Error("no session provider"); },
  verifyMfa: async () => { throw new Error("no session provider"); },
  logout: async () => undefined,
  can: () => false,
  idleWarning: false,
  keepAlive: () => undefined,
  setLanguage: async () => undefined,
};

/** The session; outside the provider (isolated component tests) an empty, signed-out one. */
export function useSession(): SessionContextValue {
  return useContext(SessionContext) ?? NO_SESSION;
}
