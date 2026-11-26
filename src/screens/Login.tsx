/*! @license © 2026 Mia Spasovska. EACore design system (CORE) and front-end specification (FE) — author: Mia Spasovska. All rights reserved unless agreed otherwise in writing. Fingerprint EAC-MS-C226E467F1A53502. */
/** Sign in (FE registration/login.html). CORE 09.10.2026: username and password only, no social or Microsoft sign-in, no
 * "remember me" (Mia, 05.11.2026). The server's two-step code (MFA) stays: the back end requires it for some accounts.
 * "EA Group" and "EACore" are names, never translated. */
import { useState } from "react";

import { ApiError } from "@/api/client";
import { useSession } from "@/auth/session";
import { Alert, Button, Field } from "@/components/ui";
import { LANGS, lang } from "@/i18n";
import { t } from "@/i18n/mk";
import { BrandLogo } from "@/layout/AppShell";
import { tr } from "@/i18n";

export function Login() {
  const { session, login, verifyMfa, logout, setLanguage } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      else await login(username.trim(), password, false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      if (mfaPending) setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ea-login-b">
      <main className="ea-login" id="main">
        <p className="ea-brand"><BrandLogo /><span translate="no">EACore</span></p>
        <div className="ea-login-head">
          <h1 className="ea-login-t">{mfaPending ? t.mfaTitle : t.login}</h1>
          <p className="ea-meta">{mfaPending ? t.mfaLead : <>{tr("Систем за управување на")}{" "}<span translate="no">EA Group</span></>}</p>
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!mfaPending && !local ? (
          <Alert tone="warning" title={tr("Најавата со корисничко име е исклучена")}>
            {tr("Серверот не дозволува најава со корисничко име и лозинка. Јавете се на IT.")}
          </Alert>
        ) : (
          <form className="ea-login-f" onSubmit={submit} noValidate>
            {mfaPending ? (
              <Field label={t.mfaCode} htmlFor="mfa-code">
                <input id="mfa-code" className="form-control otp-input" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={8}
                  pattern="[0-9 ]*" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} />
              </Field>
            ) : (
              <>
                <Field label={t.username} htmlFor="username">
                  <input id="username" className="form-control" autoComplete="username" autoFocus value={username} autoCapitalize="none" spellCheck={false}
                    onChange={(e) => setUsername(e.target.value)} />
                </Field>
                <Field label={t.password} htmlFor="password">
                  <input id="password" className="form-control" type="password" autoComplete="current-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                </Field>
              </>
            )}
            <Button type="submit" variant="primary" busy={busy} disabled={mfaPending ? code.replace(/\s/g, "").length < 6 : !username || !password}>
              {mfaPending ? t.verify : t.signIn}
            </Button>
            {mfaPending ? <Button variant="ghost" onClick={() => void logout()}>{tr("Најави се со друга сметка")}</Button> : null}
          </form>
        )}
        <p className="ea-langs" aria-label={tr("Јазик")}>
          {LANGS.map((l) => (
            <button key={l.code} type="button" lang={l.code} translate="no" aria-current={lang() === l.code ? "true" : undefined}
              onClick={() => { if (lang() !== l.code) void setLanguage(l.code); }}>{l.label}</button>
          ))}
        </p>
        {session?.version ? <p className="ea-meta">{tr("Верзија")}{" "}{session.version}</p> : null}
      </main>
    </div>
  );
}
