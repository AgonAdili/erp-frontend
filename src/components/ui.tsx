/** The shared parts (branding_rules/03-components.md; styles in src/styles/components.css). One of each: one
 * button, one field, one panel, one status, one confirm dialog. Radix gives dialogs, menus, popovers, tooltips
 * and tabs their accessible behaviour; sonner the toasts. */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Dialog, DropdownMenu, Popover as RxPopover, Switch as RxSwitch, Tabs as RxTabs, Tooltip as RxTooltip } from "radix-ui";
import { Toaster, toast as sonner } from "sonner";

import { ApiError } from "@/api/client";
import { t } from "@/i18n/mk";

import {
  AlertTriangle, CheckCircle2, ChevronLeft, Info, Inbox, MoreHorizontal, RefreshCw, X, XCircle, type IconType,
} from "./icons";

/** A custom property for CSS to read: the only thing an inline style may set (01 §1.3). */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}

// ── buttons ───────────────────────────────────────────────────────────────────

/** primary = the one main action; default = secondary (outline); ghost = rows and toolbars;
 * danger-solid = only the confirm button of the confirm dialog. "danger" is kept as a secondary button. */
export type Variant = "default" | "primary" | "danger" | "ghost" | "danger-solid";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  busy?: boolean;
  icon?: IconType;
};

export function buttonClass(variant: Variant = "default", size?: "sm" | "md", extra?: string) {
  const v = variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : variant === "danger-solid" ? "btn-danger" : "btn-outline-secondary";
  return ["btn", v, size === "sm" ? "btn-sm" : "", extra ?? ""].filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size, busy, icon: Icon, children, className, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={busy || rest.disabled}
      aria-busy={busy || undefined} {...rest}>
      {Icon ? <Icon /> : null}
      {children}
      {busy ? <span className="spinner" aria-hidden /> : null}
    </button>
  );
});

/** An icon-only button: round, with an accessible name and a matching tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string; tip?: boolean }>(function IconButton(
  { label, icon: Icon, variant = "ghost", size, className, tip = true, children, ...rest }, ref,
) {
  const btn = (
    <button ref={ref} type="button" aria-label={label} className={buttonClass(variant, size, `btn-icon ${className ?? ""}`)} {...rest}>
      {Icon ? <Icon /> : null}
      {children}
    </button>
  );
  return tip ? <Tooltip content={label}>{btn}</Tooltip> : btn;
});

export function LinkButton({ to, children, variant = "default", size, icon: Icon, className }: {
  to: string; children?: ReactNode; variant?: Variant; size?: "sm" | "md"; icon?: IconType; className?: string;
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)}>
      {Icon ? <Icon /> : null}
      {children}
    </Link>
  );
}

// ── loading: a skeleton of the real layout, a solid pulse ────────────────────

export function Spinner({ label = t.loading }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <div className="row-tight"><span className="spinner" aria-hidden /> <span>{label}</span></div>
    </div>
  );
}

export function Skeleton({ width = "100%", height = 12 }: { width?: number | string; height?: number; style?: CSSProperties }) {
  const w = typeof width === "number" ? `${width}px` : width;
  return <span className="skeleton skel-sized" style={cssVars({ "--w": w, "--h": `${height}px` })} aria-hidden />;
}

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label={t.loading} className="skel-rows" style={cssVars({ "--cols": cols })}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skel-row">
          {Array.from({ length: cols }, (_, c) => <Skeleton key={c} width={`${55 + ((r * 7 + c * 13) % 40)}%`} />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanel({ height = 220 }: { height?: number }) {
  return (
    <div className="ea-panel" aria-hidden>
      <div className="ea-panel-body stack"><Skeleton width="40%" height={14} /><Skeleton height={height - 60} /></div>
    </div>
  );
}

// ── fields ────────────────────────────────────────────────────────────────────

export function Field({
  label, required, help, error, children, htmlFor, className,
}: {
  label: ReactNode; required?: boolean; help?: ReactNode; error?: string; children: ReactNode; htmlFor?: string; className?: string;
}) {
  const describedBy = htmlFor ? `${htmlFor}-desc` : undefined;
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="req" aria-hidden>*</span> : null}
      </label>
      {children}
      {error ? <span className="error" role="alert" id={describedBy}>{error}</span> : help ? <span className="help" id={describedBy}>{help}</span> : null}
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

/** A grey track with an ink pill on the chosen item (period pickers, in-page views). */
export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string;
}) {
  return (
    <div className="ea-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// ── status: one mapping from code to tone, a round dot + text ─────────────────

export type Tone = "go" | "info" | "caution" | "stop" | "neutral";

const STATUS_TONE: [RegExp, Tone][] = [
  [/(UNPAID|CANCEL|VOID|DRAFT|INACTIVE|ARCHIV|NOT_STARTED|PASSIVE|WITHDRAWN)/, "neutral"],
  [/(REJECT|OVERDUE|BLOCK|FAILED|FAIL|DISPUTE|EXPIRED|LOST|TERMINATED|SUSPEND|INFECTED|QUALITY_ISSUE|BLACKLIST|ERROR|LATE)/, "stop"],
  [/(PENDING|WAIT|AWAIT|PARTIAL|HOLD|RETURNED|NEEDS|REQUIRED|CLARIF|TO_CHECK|DUE_SOON|REVIEW|DUE)/, "caution"],
  [/(SUBMITTED|IN_PROGRESS|PROGRESS|OPEN|SENT|PLANNED|ISSUED|NEW|SCHEDULED|ASSIGNED)/, "info"],
  [/(APPROVED|PAID|POSTED|COMPLETED|CLOSED|DONE|ACCEPTED|VERIFIED|SIGNED|RECEIVED|MATCHED|FULLY|READY|ACTIVE|PRESENT|VALID|FINALIZED|CONVERTED|COLLECTED|CONFIRMED)/, "go"],
];

/** The tone of a status code (07 §2): the same status looks the same in every module. */
export function statusTone(value: string): Tone {
  const v = value.toUpperCase();
  for (const [re, tone] of STATUS_TONE) if (re.test(v)) return tone;
  return "neutral";
}

const LEGACY_TONE: Record<string, Tone> = {
  success: "go", good: "go", warning: "caution", attention: "caution", danger: "stop", alarm: "stop", info: "info",
  accent: "info", neutral: "neutral", secondary: "neutral", "": "neutral",
};

export function toTone(tone?: string): Tone {
  if (!tone) return "neutral";
  return (["go", "info", "caution", "stop", "neutral"].includes(tone) ? tone : LEGACY_TONE[tone] ?? "neutral") as Tone;
}

/** A status: a round dot and its words. */
export function Status({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className="ea-st"><span className={`ea-dot is-${toTone(tone)}`} aria-hidden />{children}</span>;
}

/** A pill: with a dot for a state; `plain` for a label that is not a state. */
export function Badge({ children, tone, plain }: { children: ReactNode; tone?: string; plain?: boolean }) {
  if (plain) return <span className="ea-chip plain">{children}</span>;
  return <span className="ea-chip"><span className={`ea-dot is-${toTone(tone)}`} aria-hidden />{children}</span>;
}

export function StatusPill({ value, label }: { value: unknown; label?: ReactNode }) {
  const raw = String(value ?? "");
  if (!raw && !label) return null;
  return <Badge tone={statusTone(raw)}>{label ?? raw}</Badge>;
}

// ── alerts: a solid status fill for a state that blocks work ─────────────────

const ALERT_ICON: Record<string, IconType> = { info: Info, danger: XCircle, warning: AlertTriangle, success: CheckCircle2, neutral: Info };
const ALERT_TONE: Record<string, string> = { info: "is-info", danger: "is-stop", warning: "is-caution", success: "is-go", neutral: "is-neutral" };

export function Alert({ tone = "info", title, children, action }: {
  tone?: "info" | "danger" | "warning" | "success" | "neutral"; title?: ReactNode; children?: ReactNode; action?: ReactNode;
}) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className={`ea-alert ${ALERT_TONE[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon />
      <div className="alert-body">
        {title ? <div className="alert-title">{title}</div> : null}
        {children}
      </div>
      {action}
    </div>
  );
}

// ── empty and error states ────────────────────────────────────────────────────

/** `heading`: the state is the whole page, so its title is the page's one h1. */
export function EmptyState({ children, title, icon: Icon = Inbox, action, compact, heading }: {
  children?: ReactNode; title?: ReactNode; icon?: IconType; action?: ReactNode; compact?: boolean; heading?: boolean;
}) {
  const Title = heading ? "h1" : "div";
  return (
    <div className={`empty${compact ? " compact" : ""}`}>
      <Icon />
      <Title className="empty-title">{title ?? t.noResults}</Title>
      {children ? <div className="empty-text">{children}</div> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  // a script error's own text is English and technical (07 §2: errors say what happened and what to do)
  return "Настана неочекувана грешка. Обидете се повторно; ако грешката се повтори, известете го администраторот.";
}

export function ErrorState({ error, onRetry, compact, heading }: { error: unknown; onRetry?: () => void; compact?: boolean; heading?: boolean }) {
  const status = error instanceof ApiError ? error.status : 0;
  const title = status === 403 ? t.forbiddenTitle : status === 404 ? t.notFoundTitle : t.loadFailed;
  return (
    <EmptyState icon={status === 403 ? XCircle : AlertTriangle} title={title} compact={compact} heading={heading}
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

/** The page head: an optional ancestor link, the page's only h1, a sub-line, the actions on the right. */
export function PageHeader({ title, subtitle, back, status, actions, controls, children, eyebrow, display }: {
  title: ReactNode; subtitle?: ReactNode; back?: { to: string; label: string }; status?: ReactNode;
  actions?: ReactNode; children?: ReactNode; eyebrow?: ReactNode;
  /** Filters and the period picker: a row under the title, never among the actions (03, page head). */
  controls?: ReactNode;
  /** The board greeting (40px, one per page). */
  display?: boolean;
}) {
  return (
    <header className={`page-head${display ? " greeting" : ""}`}>
      <div className="ph-main">
        {back ? <Link to={back.to} className="back-link"><ChevronLeft />{back.label}</Link>
          : eyebrow ? <span className="ea-label">{eyebrow}</span> : null}
        <div className="ph-title"><h1>{title}</h1>{status}</div>
        {subtitle ? <div className="ph-sub">{subtitle}</div> : null}
        {children}
      </div>
      {actions ? <div className="ph-actions">{actions}</div> : null}
      {controls ? <div className="ph-controls">{controls}</div> : null}
    </header>
  );
}

/** A numbered section: mono "01", a title, a 2px ink rule. */
export function Section({ n, title, actions, children }: { n: number; title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="ea-section" aria-label={typeof title === "string" ? title : undefined}>
      <div className="ea-section-head"><span className="n">{String(n).padStart(2, "0")}</span><h2>{title}</h2>{actions}</div>
      {children}
    </section>
  );
}

/** A panel (card): hairline sheet; head with title, meta and a link; body; quiet footer. */
export function Panel({ title, sub, actions, children, flush, foot, className, id }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; foot?: ReactNode;
  className?: string; id?: string;
}) {
  return (
    <section className={`ea-panel${flush ? " flush" : ""}${className ? ` ${className}` : ""}`} id={id} aria-label={typeof title === "string" ? title : undefined}>
      {title || actions ? (
        <div className="ea-panel-head">
          <div className="head-text">
            {title ? <h2>{title}</h2> : null}
            {sub ? <span className="meta">{sub}</span> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="ea-panel-body">{children}</div>
      {foot ? <div className="ea-panel-foot">{foot}</div> : null}
    </section>
  );
}

// ── dialog (confirmations only) & drawer ──────────────────────────────────────

export function Modal({ title, description, onClose, children, footer, size }: {
  title: ReactNode; description?: ReactNode; onClose: () => void; children?: ReactNode; footer?: ReactNode;
  size?: "sm" | "lg"; eyebrow?: ReactNode; className?: string;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className={`dialog${size ? ` ${size}` : ""}`}>
          <div className="dialog-head">
            <div className="grow">
              <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
              {description ? <Dialog.Description className="desc">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close asChild><IconButton label={t.close} icon={X} size="sm" tip={false} /></Dialog.Close>
          </div>
          {children ? <div className="dialog-body">{children}</div> : null}
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
  icon?: IconType;
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
        {trigger ?? <button type="button" className="btn btn-ghost btn-icon" aria-label={label ?? t.moreActions}><MoreHorizontal /></button>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" align={align} sideOffset={6} collisionPadding={8}>
          {items.map((item, i) => <MenuRow key={i} item={item} />)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuRow({ item }: { item: MenuEntry }) {
  const Icon = item.icon;
  if (item.heading) return <DropdownMenu.Label className="menu-label ea-label">{item.label}</DropdownMenu.Label>;
  const body = <>{Icon ? <Icon /> : null}<span>{item.label}</span>{item.hint ? <span className="hint">{item.hint}</span> : null}</>;
  return (
    <>
      {item.separatorBefore ? <DropdownMenu.Separator className="menu-sep" /> : null}
      {item.to ? (
        <DropdownMenu.Item asChild disabled={item.disabled} className={`menu-item${item.danger ? " danger" : ""}`}>
          <Link to={item.to}>{body}</Link>
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
        <RxPopover.Content className="popover" align={align} sideOffset={6} collisionPadding={8}>{children}</RxPopover.Content>
      </RxPopover.Portal>
    </RxPopover.Root>
  );
}

/** After 400ms on hover, at once on keyboard focus (06 §2). */
export function Tooltip({ content, children, side = "bottom" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "right" | "left" }) {
  return (
    <RxTooltip.Provider delayDuration={400} skipDelayDuration={300}>
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

// ── tabs: pills, the chosen one in ink ────────────────────────────────────────

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

// ── toasts: bottom right, at most 3, the solid status fill, past tense ───────

type ToastTone = "default" | "danger" | "success";
type ToastFn = (text: string, tone?: ToastTone, opts?: { action?: { label: string; onClick: () => void }; description?: string }) => void;

const push: ToastFn = (text, tone = "default", opts) => {
  const o = { description: opts?.description, action: opts?.action, duration: opts?.action ? 8000 : 5000 };
  if (tone === "danger") sonner.error(text, { ...o, duration: Infinity });
  else if (tone === "success") sonner.success(text, o);
  else sonner.info(text, o);
};

const ToastContext = createContext<ToastFn>(push);

export function ToastProvider({ children, theme = "system" }: { children: ReactNode; theme?: "light" | "dark" | "system" }) {
  return (
    <ToastContext.Provider value={push}>
      {children}
      <Toaster position="bottom-right" theme={theme} closeButton richColors={false} visibleToasts={3} gap={8} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ── the confirm dialog ────────────────────────────────────────────────────────

export interface ConfirmOptions {
  /** The question with the object: "Да се избрише фактурата ФА-2026-0142?" */
  title?: string;
  /** The consequence. */
  text: ReactNode;
  /** The action with its object: "Избриши фактура". */
  confirmLabel?: string;
  danger?: boolean;
}

/** `await confirm({title, text, confirmLabel, danger})`; focus starts on Откажи. */
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
        <Button autoFocus onClick={() => close(false)}>{t.cancel}</Button>
        <Button variant={state.danger ? "danger-solid" : "primary"} onClick={() => close(true)}>{state.confirmLabel ?? t.confirm}</Button>
      </>}>
      {state.text}
    </Modal>
  ) : null;
  return { confirm, dialog };
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}
