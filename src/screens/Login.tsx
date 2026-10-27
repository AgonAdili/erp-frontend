/** Sign-in: local account (when allowed) or Microsoft Entra ID, then the MFA code when required. */
import { useState } from "react";
import { LogIn } from "lucide-react";

import { ApiError } from "@/api/client";
import { useSession } from "@/auth/session";
import { Alert, Button, Field } from "@/components/ui";
import { t } from "@/i18n/mk";

export function Login() {
  const { session, login, verifyMfa, logout } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mfaPending = Boolean(session?.authenticated && session.mfa?.pending);
  const local = session?.local_login !== false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mfaPending) await verifyMfa(code.replace(/\s/g, ""));
      else await login(username.trim(), password, remember);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      if (mfaPending) setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <aside className="login-art" aria-hidden>
        <div className="mark"><i>EA</i>{t.appName}</div>
        <div className="lane-lines"><span /><span className="amber" /><span /></div>
        <div className="stack" style={{ gap: 12, position: "relative" }}>
          <h1>Понуди, градилишта, возен парк и книги на едно место.</h1>
          <p>Секој налог, секоја ситуација и секое одобрување — со јасен следен чекор.</p>
        </div>
      </aside>
      <main className="login-form-wrap">
        <form className="login-form" onSubmit={submit} noValidate>
          <div className="stack-sm">
            <h2>{mfaPending ? t.mfaTitle : t.login}</h2>
            <p className="muted">{mfaPending ? t.mfaLead : t.loginLead}</p>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {mfaPending ? (
            <Field label={t.mfaCode} htmlFor="mfa-code">
              <input id="mfa-code" className="input otp-input" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={8}
                pattern="[0-9 ]*" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} />
            </Field>
          ) : local ? (
            <>
              <Field label={t.username} htmlFor="username">
                <input id="username" className="input" autoComplete="username" autoFocus value={username} autoCapitalize="none" spellCheck={false}
                  onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field label={t.password} htmlFor="password">
                <input id="password" className="input" type="password" autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <label className="check small">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t.remember}
              </label>
            </>
          ) : null}
          {mfaPending || local ? (
            <Button type="submit" variant="primary" busy={busy} disabled={mfaPending ? code.replace(/\s/g, "").length < 6 : !username || !password}>
              {mfaPending ? t.verify : t.signIn}
            </Button>
          ) : null}
          {mfaPending ? <Button variant="ghost" onClick={() => void logout()}>Најави се со друга сметка</Button> : null}
          {!mfaPending && session?.sso_enabled ? (
            <>
              {local ? <div className="divider">{t.or}</div> : null}
              <a className="btn" href="/oidc/authenticate/"><LogIn aria-hidden />{t.signInMicrosoft}</a>
            </>
          ) : null}
          {session?.version ? <p className="xs muted center-text">Верзија {session.version}</p> : null}
        </form>
      </main>
    </div>
  );
}
