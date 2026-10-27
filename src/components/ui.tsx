/** Base components of the design system (styles in src/styles.css). */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { t } from "@/i18n/mk";

type Variant = "default" | "primary" | "danger" | "ghost";

export function Button({
  variant = "default",
  size,
  busy,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm"; busy?: boolean }) {
  const cls = ["btn", variant !== "default" ? variant : "", size ?? "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} disabled={busy || rest.disabled} {...rest}>
      {busy ? <span className="spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Spinner({ label = t.loading }: { label?: string }) {
  return (
    <div className="center" role="status" aria-live="polite">
      <div className="row">
        <span className="spinner" aria-hidden /> <span className="muted">{label}</span>
      </div>
    </div>
  );
}

export function Field({
  label,
  required,
  help,
  error,
  children,
  htmlFor,
}: {
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="req" aria-hidden>*</span> : null}
      </label>
      {children}
      {error ? <span className="error" role="alert">{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  );
}

const TONES: Record<string, string> = {
  success: "success", warning: "warning", danger: "danger", info: "info", neutral: "", secondary: "",
};

/** Status badge; tone guessed from common status values when not given. */
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${TONES[tone ?? ""] ?? tone ?? ""}`}>{children}</span>;
}

const STATUS_TONE: [RegExp, string][] = [
  [/(PAID|APPROVED|POSTED|ACTIVE|COMPLETED|CLOSED|FINALIZED|ACCEPTED|VERIFIED|DONE|ISSUED|SIGNED|RECEIVED|MATCHED|FULLY)/, "success"],
  [/(REJECT|CANCEL|VOID|DISPUTE|BLOCK|FAILED|INFECTED|OVERDUE|EXPIRED|QUALITY)/, "danger"],
  [/(PENDING|DRAFT|REVIEW|SUBMITTED|PARTIAL|HOLD|WAIT|PROGRESS|RETURNED)/, "warning"],
];

export function statusTone(value: string): string {
  for (const [re, tone] of STATUS_TONE) if (re.test(value)) return tone;
  return "info";
}

export function Alert({ tone = "info", children }: { tone?: "info" | "danger" | "warning" | "success"; children: ReactNode }) {
  return <div className={`alert ${tone}`} role={tone === "danger" ? "alert" : "status"}>{children}</div>;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={id}>
        <header>
          <h2 id={id} style={{ margin: 0, flex: 1 }}>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={t.close}>✕</Button>
        </header>
        <div className="body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: ReactNode }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.key} role="tab" aria-selected={tab.key === value} className={tab.key === value ? "active" : ""}
          onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── toasts ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  text: string;
  tone: "default" | "danger";
}

const ToastContext = createContext<(text: string, tone?: "default" | "danger") => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "default" | "danger" = "default") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), tone === "danger" ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.tone === "danger" ? "danger" : ""}`}>{x.text}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ── confirmation ──────────────────────────────────────────────────────────────

export function useConfirm() {
  const [state, setState] = useState<{ text: string; resolve: (ok: boolean) => void; danger?: boolean } | null>(null);
  const confirm = useCallback(
    (text: string, danger = false) => new Promise<boolean>((resolve) => setState({ text, resolve, danger })),
    [],
  );
  const dialog = state ? (
    <Modal
      title={t.confirm}
      onClose={() => { state.resolve(false); setState(null); }}
      footer={
        <>
          <Button onClick={() => { state.resolve(false); setState(null); }}>{t.cancel}</Button>
          <Button variant={state.danger ? "danger" : "primary"} onClick={() => { state.resolve(true); setState(null); }}>
            {t.confirm}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{state.text}</p>
    </Modal>
  ) : null;
  return { confirm, dialog };
}

export function EmptyState({ children = t.noResults }: { children?: ReactNode }) {
  return <div className="center muted">{children}</div>;
}
