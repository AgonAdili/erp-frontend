/** Sign-in: local account (when allowed) or Microsoft Entra ID, then the MFA code when required. */
import { useState } from "react";

import { ApiError } from "@/api/client";
import { useSession } from "@/auth/session";
import { Alert, Button, Field } from "@/components/ui";
import { t } from "@/i18n/mk";

export function Login() {
  const { session, login, verifyMfa } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mfaPending = Boolean(session?.authenticated && session.mfa?.pending);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mfaPending) await verifyMfa(code);
      else await login(username, password, remember);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card stack" onSubmit={submit}>
        <h1>{t.appName}</h1>
        <h2 className="muted" style={{ fontWeight: 500 }}>{mfaPending ? t.mfaTitle : t.login}</h2>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {mfaPending ? (
          <Field label={t.mfaCode} htmlFor="mfa-code">
            <input id="mfa-code" className="input" inputMode="numeric" autoComplete="one-time-code" autoFocus
              value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        ) : session?.local_login !== false ? (
          <>
            <Field label={t.username} htmlFor="username">
              <input id="username" className="input" autoComplete="username" autoFocus value={username}
                onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label={t.password} htmlFor="password">
              <input id="password" className="input" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t.remember}
            </label>
          </>
        ) : null}
        {mfaPending || session?.local_login !== false ? (
          <Button type="submit" variant="primary" busy={busy}>{mfaPending ? t.verify : t.signIn}</Button>
        ) : null}
        {!mfaPending && session?.sso_enabled ? (
          <a className="btn" href="/oidc/authenticate/">{t.signInMicrosoft}</a>
        ) : null}
        <div className="small muted">v{session?.version}</div>
      </form>
    </div>
  );
}
