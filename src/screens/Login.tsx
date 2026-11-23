/** Sign-in: local account (when allowed) or Microsoft Entra ID, then the MFA code when required. */
import { useState } from "react";
import { Eye, EyeOff, LogIn } from "@/components/icons";

import { ApiError } from "@/api/client";
import { useSession } from "@/auth/session";
import { Alert, Button, Field, IconButton } from "@/components/ui";
import { t } from "@/i18n/mk";

export function Login() {
  const { session, login, verifyMfa, logout } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mfaPending = Boolean(session?.authenticated && session.mfa?.pending);
  const local = session?.local_login !== false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    // the button stays enabled (08): an incomplete form is answered with an inline message
    if (mfaPending ? code.replace(/\s/g, "").length < 6 : !username.trim() || !password) {
      setError(mfaPending ? "Внесете го шестцифрениот код." : "Внесете корисничко име и лозинка.");
      return;
    }
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
    <main className="auth" id="main">
      <form className="auth-sheet" onSubmit={submit} noValidate aria-labelledby="login-title">
        <div className="auth-brand">
          <svg className="sb-mark" aria-hidden><use href={`${import.meta.env.BASE_URL}icons/solar.svg#eacore-mark`} /></svg>
          <strong translate="no">EACore</strong>
        </div>
        <div className="stack-sm">
          <h1 id="login-title">{mfaPending ? t.mfaTitle : t.login}</h1>
          <p className="soft">{mfaPending ? t.mfaLead : t.loginLead}</p>
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {mfaPending ? (
          <Field label={t.mfaCode} htmlFor="mfa-code">
            <input id="mfa-code" name="code" className="input otp-input" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={8}
              spellCheck={false} pattern="[0-9 ]*" value={code} onChange={(e) => setCode(e.target.value.replace(/[^d ]/g, ""))} />
          </Field>
        ) : local ? (
          <>
            <Field label={t.username} htmlFor="username">
              <input id="username" name="username" className="input" autoComplete="username" autoFocus value={username} autoCapitalize="none"
                spellCheck={false} onChange={(e) => setUsername(e.target.value)} onBlur={() => setUsername((u) => u.trim())} />
            </Field>
            <Field label={t.password} htmlFor="password">
              <div className="password-field">
                <input id="password" name="password" className="input" type={reveal ? "text" : "password"} autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} />
                <IconButton className="reveal" size="sm" label={reveal ? t.hidePassword : t.showPassword} icon={reveal ? EyeOff : Eye}
                  aria-pressed={reveal} onClick={() => setReveal((v) => !v)} />
              </div>
            </Field>
            <label className="check">
              <input type="checkbox" name="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t.remember}
            </label>
          </>
        ) : null}
        {mfaPending || local ? (
          <Button type="submit" variant="primary" busy={busy}>{mfaPending ? t.verify : t.signIn}</Button>
        ) : null}
        {mfaPending ? <Button variant="ghost" onClick={() => void logout()}>{t.otherAccount}</Button> : null}
        {!mfaPending && session?.sso_enabled ? (
          <>
            {local ? <div className="divider">{t.or}</div> : null}
            <a className="btn btn-outline-secondary" href="/oidc/authenticate/"><LogIn /><span>{t.signInMicrosoft.replace("Microsoft", "")}<span translate="no">Microsoft</span></span></a>
          </>
        ) : null}
        {session?.version ? <p className="xs muted">{t.version} {session.version}</p> : null}
      </form>
    </main>
  );
}
