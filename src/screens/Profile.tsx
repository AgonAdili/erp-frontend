/** My profile: who I am, which permissions I hold (v1 my_profile), password change, two-step sign-in. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, ApiError } from "@/api/client";
import { useSession } from "@/auth/session";
import { Alert, Button, Field, Spinner } from "@/components/ui";
import { t } from "@/i18n/mk";

interface MyPermissions {
  is_admin: boolean;
  granted_count: number;
  roles: string[];
  modules: { label: string; resources: { label: string; actions: string[] }[] }[];
}

function PasswordChange() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  return (
    <form className="card stack" onSubmit={async (e) => {
      e.preventDefault();
      setMsg(null);
      try {
        await api.post("/auth/password/change/", { old_password: current, new_password1: next, new_password2: next });
        setMsg({ tone: "success", text: "Лозинката е променета." });
        setCurrent(""); setNext("");
      } catch (err) {
        setMsg({ tone: "danger", text: err instanceof ApiError ? err.message : String(err) });
      }
    }}>
      <h2>Промена на лозинка</h2>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      <Field label="Тековна лозинка" htmlFor="pw-old">
        <input id="pw-old" type="password" className="input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="Нова лозинка" htmlFor="pw-new">
        <input id="pw-new" type="password" className="input" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <div><Button type="submit" variant="primary" disabled={!current || !next}>{t.save}</Button></div>
    </form>
  );
}

export function Profile() {
  const { session } = useSession();
  const perms = useQuery({ queryKey: ["me", "permissions"], queryFn: () => api.get<MyPermissions>("/auth/me/permissions/") });
  const user = session?.user;
  return (
    <div className="stack">
      <div className="page-head"><h1>{t.profile}</h1></div>
      <div className="card">
        <dl className="dl">
          <div><dt>Корисник</dt><dd>{user?.username}</dd></div>
          <div><dt>Име</dt><dd>{user?.full_name}</dd></div>
          <div><dt>Е-пошта</dt><dd>{user?.email || t.none}</dd></div>
          <div><dt>Оддел</dt><dd>{user?.department || t.none}</dd></div>
          <div><dt>Улога во набавки</dt><dd>{user?.procurement_role || t.none}</dd></div>
          <div><dt>{t.entity}</dt><dd>{(session?.access?.entities ?? []).map((e) => `${e.name} (${e.clearance})`).join(", ")}</dd></div>
          <div><dt>Потврда во два чекори</dt><dd>{session?.mfa?.enrolled ? "Вклучена" : "Не е вклучена"}</dd></div>
        </dl>
      </div>
      {session?.mfa?.auth_method !== "sso" ? <PasswordChange /> : null}
      <div className="card stack">
        <h2>Мои дозволи {perms.data ? `(${perms.data.roles.join(", ") || "без улоги"})` : ""}</h2>
        {perms.isLoading ? <Spinner /> : perms.data?.is_admin ? <Alert tone="info">Администратор: пристап до сè.</Alert> : (
          perms.data?.modules.map((m) => (
            <div key={m.label}>
              <h3>{m.label}</h3>
              <ul style={{ margin: 0 }}>
                {m.resources.map((r) => <li key={r.label}>{r.label}: <span className="muted">{r.actions.join(", ")}</span></li>)}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
