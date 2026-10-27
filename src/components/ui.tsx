/** Design-system components (styles in src/styles/components.css). Radix provides the accessible behaviour of
 * dialogs, menus, popovers, tooltips and tabs; sonner the toasts. */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Dialog, DropdownMenu, Popover as RxPopover, Switch as RxSwitch, Tabs as RxTabs, Tooltip as RxTooltip } from "radix-ui";
import { Toaster, toast as sonner } from "sonner";
import {
  AlertTriangle, CheckCircle2, ChevronLeft, Info, Inbox, MoreHorizontal, RefreshCw, X, XCircle,
  type LucideIcon,
} from "lucide-react";

import { ApiError } from "@/api/client";
import { t } from "@/i18n/mk";

// ── buttons ───────────────────────────────────────────────────────────────────

export type Variant = "default" | "primary" | "danger" | "ghost" | "danger-solid";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  busy?: boolean;
  icon?: LucideIcon;
};

export function buttonClass(variant: Variant = "default", size?: "sm" | "md", extra?: string) {
  const v = variant === "danger-solid" ? "danger solid" : variant === "default" ? "" : variant;
  return ["btn", v, size === "sm" ? "sm" : "", extra ?? ""].filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size, busy, icon: Icon, children, className, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={busy || rest.disabled}
      aria-busy={busy || undefined} {...rest}>
      {busy ? <span className="spinner" aria-hidden /> : Icon ? <Icon aria-hidden /> : null}
      {children}
    </button>
  );
});

/** A square icon-only button with an accessible name and a tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string; tip?: boolean }>(function IconButton(
  { label, icon: Icon, variant = "ghost", size, className, tip = true, children, ...rest }, ref,
) {
  const btn = (
    <button ref={ref} type="button" aria-label={label} className={buttonClass(variant, size, `icon ${className ?? ""}`)} {...rest}>
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </button>
  );
  return tip ? <Tooltip content={label}>{btn}</Tooltip> : btn;
});

export function LinkButton({ to, children, variant = "default", size, icon: Icon, className }: {
  to: string; children?: ReactNode; variant?: Variant; size?: "sm" | "md"; icon?: LucideIcon; className?: string;
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)}>
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </Link>
  );
}

// ── loading ───────────────────────────────────────────────────────────────────

export function Spinner({ label = t.loading }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <div className="row-tight"><span className="spinner" aria-hidden /> <span className="small">{label}</span></div>
    </div>
  );
}

export function Skeleton({ width = "100%", height = 12, style }: { width?: number | string; height?: number; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ width, height, ...style }} aria-hidden />;
}

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label={t.loading} style={{ padding: "8px 16px 16px" }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20, padding: "12px 0", borderBottom: "1px solid var(--rule)" }}>
          {Array.from({ length: cols }, (_, c) => <Skeleton key={c} width={`${55 + ((r * 7 + c * 13) % 40)}%`} />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanel({ height = 220 }: { height?: number }) {
  return (
    <div className="panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }} aria-hidden>
      <Skeleton width="40%" height={14} />
      <Skeleton height={height - 60} />
    </div>
  );
}

// ── fields ────────────────────────────────────────────────────────────────────

export function Field({
  label, required, help, error, children, htmlFor, className,
}: {
  label: ReactNode; required?: boolean; help?: ReactNode; error?: string; children: ReactNode; htmlFor?: string; className?: string;
}) {
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="req" aria-hidden>*</span> : null}
      </label>
      {children}
      {error ? <span className="error" role="alert">{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, id, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id?: string; disabled?: boolean;
}) {
  return (
    <label className="check" htmlFor={id}>
      <RxSwitch.Root id={id} className="switch" checked={checked} disabled={disabled} onCheckedChange={onChange}>
        <RxSwitch.Thumb className="switch-thumb" />
      </RxSwitch.Root>
      {label}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// ── badges ────────────────────────────────────────────────────────────────────

const TONES: Record<string, string> = {
  success: "success", warning: "warning", danger: "danger", info: "info", accent: "accent", neutral: "", secondary: "",
};

export function Badge({ children, tone, plain }: { children: ReactNode; tone?: string; plain?: boolean }) {
  return <span className={`badge ${TONES[tone ?? ""] ?? tone ?? ""}${plain ? " plain" : ""}`}>{children}</span>;
}

const STATUS_TONE: [RegExp, string][] = [
  [/(REJECT|CANCEL|VOID|DISPUTE|BLOCK|FAILED|INFECTED|OVERDUE|EXPIRED|QUALITY|LOST|TERMINATED|SUSPEND)/, "danger"],
  [/(PENDING|REVIEW|SUBMITTED|PARTIAL|HOLD|WAIT|RETURNED|NEEDS|REQUIRED|CLARIF|TO_CHECK|AWAIT)/, "warning"],
  [/(PAID|APPROVED|POSTED|ACTIVE|COMPLETED|CLOSED|FINALIZED|ACCEPTED|VERIFIED|DONE|ISSUED|SIGNED|RECEIVED|MATCHED|FULLY|READY|SENT|PRESENT|VALID|OPEN)/, "success"],
  [/(DRAFT|NEW|PLANNED|INACTIVE|ARCHIV)/, ""],
];

export function statusTone(value: string): string {
  const v = value.toUpperCase();
  for (const [re, tone] of STATUS_TONE) if (re.test(v)) return tone;
  return "info";
}

export function StatusPill({ value, label }: { value: unknown; label?: ReactNode }) {
  const raw = String(value ?? "");
  if (!raw && !label) return null;
  return <Badge tone={statusTone(raw)}>{label ?? raw}</Badge>;
}

// ── alerts ────────────────────────────────────────────────────────────────────

const ALERT_ICON: Record<string, LucideIcon> = { info: Info, danger: XCircle, warning: AlertTriangle, success: CheckCircle2 };

export function Alert({ tone = "info", title, children, action }: {
  tone?: "info" | "danger" | "warning" | "success"; title?: ReactNode; children?: ReactNode; action?: ReactNode;
}) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className={`alert ${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden />
      <div className="alert-body">
        {title ? <div className="alert-title">{title}</div> : null}
        {children}
      </div>
      {action}
    </div>
  );
}

// ── empty and error states ────────────────────────────────────────────────────

export function EmptyState({ children, title, icon: Icon = Inbox, action, compact }: {
  children?: ReactNode; title?: ReactNode; icon?: LucideIcon; action?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={`empty${compact ? " compact" : ""}`}>
      <Icon aria-hidden />
      <div className="empty-title">{title ?? t.noResults}</div>
      {children ? <div className="empty-text">{children}</div> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return String(error ?? "");
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const status = error instanceof ApiError ? error.status : 0;
  const title = status === 403 ? t.forbiddenTitle : status === 404 ? t.notFoundTitle : t.loadFailed;
  return (
    <EmptyState icon={status === 403 ? XCircle : AlertTriangle} title={title} compact={compact}
      action={onRetry && status !== 403 && status !== 404 ? <Button size="sm" icon={RefreshCw} onClick={onRetry}>{t.retry}</Button> : undefined}>
      {errorText(error)}
    </EmptyState>
  );
}

/** Loading → skeleton/spinner, error → ErrorState with retry, otherwise the content. */
export function QueryState<T>({ q, children, skeleton }: {
  q: { isLoading: boolean; error: unknown; data?: T; refetch?: () => unknown };
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
}) {
  if (q.isLoading) return <>{skeleton ?? <Spinner />}</>;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch ? () => void q.refetch!() : undefined} />;
  if (q.data === undefined) return null;
  return <>{children(q.data)}</>;
}

// ── page structure ────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, back, status, actions, children }: {
  title: ReactNode; subtitle?: ReactNode; back?: { to: string; label: string }; status?: ReactNode;
  actions?: ReactNode; children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="ph-main">
        {back ? <Link to={back.to} className="back-link"><ChevronLeft aria-hidden />{back.label}</Link> : null}
        <div className="ph-title"><h1>{title}</h1>{status}</div>
        {subtitle ? <div className="ph-sub">{subtitle}</div> : null}
        {children}
      </div>
      {actions ? <div className="ph-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, sub, actions, children, flush, foot, className, id }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; foot?: ReactNode;
  className?: string; id?: string;
}) {
  return (
    <section className={`panel${flush ? " flush" : ""}${className ? ` ${className}` : ""}`} id={id} aria-label={typeof title === "string" ? title : undefined}>
      {title || actions ? (
        <div className="panel-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? <h2>{title}</h2> : null}
            {sub ? <div className="sub">{sub}</div> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="panel-body">{children}</div>
      {foot ? <div className="panel-foot">{foot}</div> : null}
    </section>
  );
}

// ── dialog & drawer ───────────────────────────────────────────────────────────

export function Modal({ title, description, onClose, children, footer, size }: {
  title: ReactNode; description?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "lg";
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className={`dialog${size ? ` ${size}` : ""}`} aria-describedby={description ? undefined : undefined}
          onOpenAutoFocus={(e) => {
            // focus the first field, not the close button
            const first = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(".dialog-body input, .dialog-body select, .dialog-body textarea");
            if (first) { e.preventDefault(); first.focus(); }
          }}>
          <div className="dialog-head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
              {description ? <Dialog.Description className="desc">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close asChild><IconButton label={t.close} icon={X} size="sm" tip={false} /></Dialog.Close>
          </div>
          <div className="dialog-body">{children}</div>
          {footer ? <div className="dialog-foot">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Drawer({ title, onClose, children, actions, narrow }: {
  title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode; narrow?: boolean;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className={`drawer${narrow ? " narrow" : ""}`} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="drawer-head">
            <Dialog.Title asChild><h2 className="truncate">{title}</h2></Dialog.Title>
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
            {actions}
            <Dialog.Close asChild><IconButton label={t.close} icon={X} tip={false} /></Dialog.Close>
          </div>
          <div className="drawer-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── menus, popovers, tooltips ─────────────────────────────────────────────────

export interface MenuEntry {
  label: ReactNode;
  icon?: LucideIcon;
  onSelect?: () => void;
  to?: string;
  danger?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
  separatorBefore?: boolean;
  heading?: boolean;
}

export function Menu({ trigger, items, align = "end", label }: {
  trigger?: ReactNode; items: MenuEntry[]; align?: "start" | "end"; label?: string;
}) {
  if (!items.length) return null;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        {trigger ?? <button type="button" className="btn icon" aria-label={label ?? t.moreActions}><MoreHorizontal aria-hidden /></button>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" align={align} sideOffset={6} collisionPadding={8}>
          {items.map((item, i) => (
            <MenuRow key={i} item={item} />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuRow({ item }: { item: MenuEntry }) {
  const Icon = item.icon;
  if (item.heading) return <DropdownMenu.Label className="menu-label">{item.label}</DropdownMenu.Label>;
  const body = <>{Icon ? <Icon aria-hidden /> : null}<span>{item.label}</span>{item.hint ? <span className="hint">{item.hint}</span> : null}</>;
  return (
    <>
      {item.separatorBefore ? <DropdownMenu.Separator className="menu-sep" /> : null}
      {item.to ? (
        <DropdownMenu.Item asChild disabled={item.disabled} className={`menu-item${item.danger ? " danger" : ""}`}>
          <Link to={item.to} style={{ textDecoration: "none" }}>{body}</Link>
        </DropdownMenu.Item>
      ) : (
        <DropdownMenu.Item disabled={item.disabled} className={`menu-item${item.danger ? " danger" : ""}`} onSelect={() => item.onSelect?.()}>
          {body}
        </DropdownMenu.Item>
      )}
    </>
  );
}

export function Popover({ trigger, children, align = "start", open, onOpenChange }: {
  trigger: ReactNode; children: ReactNode; align?: "start" | "end" | "center"; open?: boolean; onOpenChange?: (o: boolean) => void;
}) {
  return (
    <RxPopover.Root open={open} onOpenChange={onOpenChange}>
      <RxPopover.Trigger asChild>{trigger}</RxPopover.Trigger>
      <RxPopover.Portal>
        <RxPopover.Content className="popover" align={align} sideOffset={6} collisionPadding={8}>
          {children}
        </RxPopover.Content>
      </RxPopover.Portal>
    </RxPopover.Root>
  );
}

export function Tooltip({ content, children, side = "bottom" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "right" | "left" }) {
  // its own provider, so a tooltip also works outside the app shell (isolated screens, tests)
  return (
    <RxTooltip.Provider delayDuration={350}>
      <RxTooltip.Root>
        <RxTooltip.Trigger asChild>{children}</RxTooltip.Trigger>
        <RxTooltip.Portal>
          <RxTooltip.Content className="tooltip" side={side} sideOffset={6}>{content}</RxTooltip.Content>
        </RxTooltip.Portal>
      </RxTooltip.Root>
    </RxTooltip.Provider>
  );
}

export const TooltipProvider = RxTooltip.Provider;

// ── tabs ──────────────────────────────────────────────────────────────────────

export function Tabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: { key: T; label: ReactNode; count?: number | string }[]; value: T; onChange: (key: T) => void; label?: string;
}) {
  return (
    <RxTabs.Root value={value} onValueChange={(v) => onChange(v as T)} activationMode="manual">
      <RxTabs.List className="tabs" aria-label={label}>
        {tabs.map((tab) => (
          <RxTabs.Trigger key={tab.key} value={tab.key}>
            {tab.label}
            {tab.count !== undefined && tab.count !== null && tab.count !== "" ? <span className="count">{tab.count}</span> : null}
          </RxTabs.Trigger>
        ))}
      </RxTabs.List>
    </RxTabs.Root>
  );
}

// ── toasts ────────────────────────────────────────────────────────────────────

type Tone = "default" | "danger" | "success";
type ToastFn = (text: string, tone?: Tone, opts?: { action?: { label: string; onClick: () => void }; description?: string }) => void;

const push: ToastFn = (text, tone = "default", opts) => {
  const o = { description: opts?.description, action: opts?.action };
  if (tone === "danger") sonner.error(text, { ...o, duration: 8000 });
  else if (tone === "success") sonner.success(text, o);
  else sonner(text, o);
};

const ToastContext = createContext<ToastFn>(push);

export function ToastProvider({ children, theme = "system" }: { children: ReactNode; theme?: "light" | "dark" | "system" }) {
  return (
    <ToastContext.Provider value={push}>
      {children}
      <Toaster position="bottom-right" theme={theme} closeButton richColors={false} visibleToasts={4}
        toastOptions={{ style: { fontFamily: "var(--font)", fontSize: "14px" } }} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ── confirmation ──────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title?: string;
  text: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

/** `await confirm({title, text, confirmLabel, danger})`; the button names the action ("Избриши запис"). */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const confirm = useCallback(
    (opts: ConfirmOptions | string, danger = false) =>
      new Promise<boolean>((resolve) => setState({ ...(typeof opts === "string" ? { text: opts, danger } : opts), resolve })),
    [],
  );
  const close = (ok: boolean) => { state?.resolve(ok); setState(null); };
  const dialog = state ? (
    <Modal size="sm" title={state.title ?? t.confirmTitle} onClose={() => close(false)}
      footer={<>
        <Button onClick={() => close(false)}>{t.cancel}</Button>
        <Button autoFocus variant={state.danger ? "danger-solid" : "primary"} onClick={() => close(true)}>
          {state.confirmLabel ?? t.confirm}
        </Button>
      </>}>
      <div style={{ color: "var(--ink-soft)" }}>{state.text}</div>
    </Modal>
  ) : null;
  return { confirm, dialog };
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}
