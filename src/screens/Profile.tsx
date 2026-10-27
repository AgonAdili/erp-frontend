/** My profile: who I am, which permissions I hold (v1 my_profile), password change, appearance, two-step sign-in. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { api, ApiError } from "@/api/client";
import { usePrefs } from "@/app/prefs";
import { useSession } from "@/auth/session";
import { Alert, Badge, Button, EmptyState, Field, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui";
import { t } from "@/i18n/mk";
import { Page } from "@/layout/Page";

interface MyPermissions {
  is_admin: boolean;
  granted_count: number;
  roles: string[];
  modules: { label: string; resources: { label: string; actions: string[] }[] }[];
}

function PasswordChange() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const mismatch = Boolean(repeat) && next !== repeat;
  return (
    <Panel title="Промена на лозинка">
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        setBusy(true);
        try {
          await api.post("/auth/password/change/", { old_password: current, new_password1: next, new_password2: repeat });
          setMsg({ tone: "success", text: "Лозинката е променета." });
          setCurrent(""); setNext(""); setRepeat("");
        } catch (err) {
          setMsg({ tone: "danger", text: err instanceof ApiError ? err.message : String(err) });
        } finally {
          setBusy(false);
        }
      }}>
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        <Field label="Тековна лозинка" htmlFor="pw-old">
          <input id="pw-old" type="password" className="input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Нова лозинка" htmlFor="pw-new">
          <input id="pw-new" type="password" className="input" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Повторете ја новата лозинка" htmlFor="pw-rep" error={mismatch ? "Лозинките не се исти." : undefined}>
          <input id="pw-rep" type="password" className={`input${mismatch ? " invalid" : ""}`} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
        <div><Button type="submit" variant="primary" busy={busy} disabled={!current || !next || next !== repeat}>Промени лозинка</Button></div>
      </form>
    </Panel>
  );
}

export function Profile() {
  const { session } = useSession();
  const { theme, setTheme, density, setDensity } = usePrefs();
  const perms = useQuery({ queryKey: ["me", "permissions"], queryFn: () => api.get<MyPermissions>("/auth/me/permissions/") });
  const user = session?.user;
  return (
    <Page title={t.profile} narrow>
      <PageHeader title={user?.full_name || user?.username || t.profile} subtitle={user?.email || user?.username} />
      <div className="grid-2">
        <Panel title="Сметка">
          <dl className="fact-list">
            <div><dt>Корисничко име</dt><dd>{user?.username}</dd></div>
            <div><dt>Е-пошта</dt><dd>{user?.email || t.none}</dd></div>
            <div><dt>Оддел</dt><dd>{user?.department || t.none}</dd></div>
            <div><dt>Улога во набавки</dt><dd>{user?.procurement_role || t.none}</dd></div>
            <div><dt>Потврда во два чекори</dt><dd>{session?.mfa?.enrolled ? <Badge tone="success">вклучена</Badge> : <Badge>не е вклучена</Badge>}</dd></div>
          </dl>
        </Panel>
        <Panel title="Правни лица">
          <ul className="home-list">
            {(session?.access?.entities ?? []).map((e) => (
              <li key={e.id}><span>{e.name}{e.is_primary ? <span className="xs muted"> · основно</span> : null}</span><Badge plain>{e.clearance}</Badge></li>
            ))}
          </ul>
        </Panel>
        <Panel title={t.theme}>
          <div className="stack">
            <div className="field"><span className="label">{t.theme}</span>
              <Segmented label={t.theme} value={theme} onChange={setTheme}
                options={[{ value: "system", label: t.themeSystem }, { value: "light", label: t.themeLight }, { value: "dark", label: t.themeDark }]} />
            </div>
            <div className="field"><span className="label">{t.density}</span>
              <Segmented label={t.density} value={density} onChange={setDensity}
                options={[{ value: "comfortable", label: t.comfortable }, { value: "compact", label: t.compact }]} />
            </div>
            <p className="xs muted">Поставките важат за овој прелистувач.</p>
          </div>
        </Panel>
        {session?.mfa?.auth_method !== "sso" ? <PasswordChange /> : null}
      </div>
      <Panel title="Мои дозволи" sub={perms.data ? (perms.data.roles.length ? `Улоги: ${perms.data.roles.join(", ")}` : "Без улоги") : undefined}>
        {perms.isLoading ? <Skeleton height={120} /> : perms.data?.is_admin ? <Alert tone="info">Администратор: пристап до сè.</Alert> : !perms.data?.modules.length ? (
          <EmptyState compact title="Немате доделени дозволи">Побарајте пристап од администраторот.</EmptyState>
        ) : (
          <div className="grid-2">
            {perms.data.modules.map((m) => (
              <div key={m.label} className="stack-sm">
                <h3>{m.label}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }} className="stack-sm">
                  {m.resources.map((r) => (
                    <li key={r.label} className="small"><span className="row-tight"><Check aria-hidden style={{ width: 14, color: "var(--success)" }} />{r.label}</span>
                      <span className="xs muted" style={{ paddingLeft: 22 }}>{r.actions.join(", ")}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </Page>
  );
}
