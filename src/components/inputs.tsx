/** Inputs chosen by field metadata type, plus the related-record and file pickers. Dates show and accept
 * dd.mm.yyyy (never the browser's date picker); amounts are right-aligned and formatted on leaving the field
 * (branding_rules/03 "Fields", 07 §5). */
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Paperclip, Upload, X } from "@/components/icons";

import { api, type Query } from "@/api/client";
import type { FieldMeta, Page, RelatedRef, Row } from "@/api/types";
import { t } from "@/i18n/mk";
import { formatNumber } from "@/lib/format";

import { Switch } from "./ui";

// ── dates: dd.mm.yyyy ─────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/** "14.10.2026" / "14102026" / "2026-10-14" (and "… 14:30" with time) → ISO; null when incomplete or invalid. */
export function parseDate(text: string, withTime = false): string | null {
  const s = text.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  let y: number, mo: number, d: number, hh = 0, mm = 0;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; hh = +(m[4] ?? 0); mm = +(m[5] ?? 0); }
  else {
    m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(s);
    if (!m) return null;
    d = +m[1]; mo = +m[2]; y = +m[3]; hh = +(m[4] ?? 0); mm = +(m[5] ?? 0);
  }
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || hh > 23 || mm > 59) return null;
  const iso = `${y}-${pad(mo)}-${pad(d)}`;
  return withTime ? `${iso}T${pad(hh)}:${pad(mm)}` : iso;
}

/** ISO → "14.10.2026" (or "14.10.2026 14:30"). */
export function showDate(value: unknown, withTime = false): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(value));
  if (!m) return String(value);
  const date = `${m[3]}.${m[2]}.${m[1]}`;
  return withTime ? `${date} ${m[4] ?? "00"}:${m[5] ?? "00"}` : date;
}

/** Typing digits only: the dots (and the space before the time) are put in for you. */
function autoFormat(raw: string, withTime: boolean): string {
  if (/[-/]/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "").slice(0, withTime ? 12 : 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `.${digits.slice(2, 4)}`;
  if (digits.length > 4) out += `.${digits.slice(4, 8)}`;
  if (withTime && digits.length > 8) out += ` ${digits.slice(8, 10)}`;
  if (withTime && digits.length > 10) out += `:${digits.slice(10, 12)}`;
  return out;
}

export function DateInput({ value, onChange, id, invalid, disabled, withTime, className, ...rest }: {
  value: unknown; onChange: (iso: string | null) => void; id?: string; invalid?: boolean; disabled?: boolean; withTime?: boolean;
  className?: string; "aria-label"?: string; "aria-describedby"?: string; name?: string;
}) {
  const [text, setText] = useState(() => showDate(value, withTime));
  const [bad, setBad] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(showDate(value, withTime));
  }, [value, withTime]);
  return (
    <input id={id} className={`input${invalid || bad ? " invalid" : ""}${className ? ` ${className}` : ""}`} inputMode="numeric"
      autoComplete="off" spellCheck={false} placeholder={withTime ? "дд.мм.гггг чч:мм" : t.dateFormat} value={text} disabled={disabled}
      aria-invalid={invalid || bad || undefined} {...rest}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        const grew = e.target.value.length > text.length;
        const next = grew ? autoFormat(e.target.value, Boolean(withTime)) : e.target.value;
        setText(next);
        setBad(false);
        if (!next.trim()) onChange(null);
        else { const iso = parseDate(next, withTime); if (iso) onChange(iso); }
      }}
      onBlur={() => {
        focused.current = false;
        const s = text.trim();
        if (!s) { setBad(false); return; }
        const iso = parseDate(s, withTime);
        if (iso) { setText(showDate(iso, withTime)); setBad(false); } else setBad(true);
      }} />
  );
}

// ── month: "2026-11" as the month's name and the year ────────────────────────

const MONTH_NAMES = ["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"];

export function MonthInput({ value, onChange, id, label }: { value: string; onChange: (ym: string) => void; id?: string; label: string }) {
  const [y, m] = value.split("-").map(Number);
  const set = (yy: number, mm: number) => onChange(`${yy}-${String(mm).padStart(2, "0")}`);
  return (
    <div className="row-tight" role="group" aria-label={label}>
      <select id={id} className="input" aria-label={`${label}: месец`} value={m} onChange={(e) => set(y, Number(e.target.value))}>
        {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
      <input className="input num w-num" inputMode="numeric" aria-label={`${label}: година`} value={y}
        onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); if (v > 1999 && v < 2100) set(v, m); }} />
    </div>
  );
}

// ── amounts: 1.234,50 and 1234.50 both accepted, shown back as 1.234,50 ───────

/** "1.234,50" / "1234.50" / "1 234,5" → "1234.50"; null when empty, undefined when not a number. */
export function parseDecimal(text: string): string | null | undefined {
  let s = text.trim().replace(/[\s ]/g, "").replace("−", "-");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return /^-?\d*\.?\d*$/.test(s) && s !== "-" && s !== "." ? s : undefined;
}

export function DecimalInput({ value, onChange, id, invalid, disabled, places = 2, unit, className, ...rest }: {
  value: unknown; onChange: (v: string | null) => void; id?: string; invalid?: boolean; disabled?: boolean; places?: number;
  unit?: string; className?: string; "aria-label"?: string; name?: string;
}) {
  const shown = (v: unknown) => (v === null || v === undefined || v === "" ? "" : formatNumber(v, places));
  const [text, setText] = useState(() => shown(value));
  const [bad, setBad] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(shown(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const input = (
    <input id={id} className={`input num${invalid || bad ? " invalid" : ""}${className ? ` ${className}` : ""}`} inputMode="decimal"
      autoComplete="off" spellCheck={false} value={text} disabled={disabled} aria-invalid={invalid || bad || undefined} {...rest}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseDecimal(e.target.value);
        setBad(v === undefined);
        if (v !== undefined) onChange(v);
      }}
      onBlur={() => {
        focused.current = false;
        const v = parseDecimal(text);
        if (v !== undefined) setText(shown(v));
      }} />
  );
  return unit ? <span className="input-unit">{input}<span className="unit">{unit}</span></span> : input;
}

export interface StoredFileRef {
  id: number;
  name: string;
  size?: number;
  url?: string | null;
  inline_url?: string | null;
  is_image?: boolean;
}

type Value = unknown;

export function FieldInput({
  field, value, onChange, invalid, id, initialLabel, filters,
}: {
  field: FieldMeta;
  value: Value;
  onChange: (v: Value, row?: Row) => void;
  invalid?: boolean;
  id?: string;
  initialLabel?: string;
  /** Extra list filters for a related picker (dependent fields). */
  filters?: Query;
}) {
  const cls = `input${invalid ? " invalid" : ""}`;
  const disabled = field.read_only;
  const str = value === null || value === undefined ? "" : String(value);
  const aria = { "aria-invalid": invalid || undefined };
  switch (field.type) {
    case "boolean":
      return <Switch id={id} checked={Boolean(value)} disabled={disabled} onChange={(v) => onChange(v)} label={field.label} />;
    case "text":
      return <textarea id={id} className={cls} value={str} disabled={disabled} maxLength={field.max_length} {...aria}
        onChange={(e) => onChange(e.target.value)} />;
    case "integer":
      return <input id={id} className={`${cls} num`} inputMode="numeric" autoComplete="off" spellCheck={false} value={str} disabled={disabled} {...aria}
        onChange={(e) => { const d = e.target.value.replace(/[^\d-]/g, ""); onChange(d === "" ? null : Number(d)); }} />;
    case "decimal":
      return <DecimalInput id={id} value={value} invalid={invalid} disabled={disabled} places={field.decimal_places ?? 2} onChange={onChange} />;
    case "date":
      return <DateInput id={id} value={value} invalid={invalid} disabled={disabled} onChange={onChange} />;
    case "datetime":
      return <DateInput id={id} value={value} invalid={invalid} disabled={disabled} withTime onChange={onChange} />;
    case "time":
      return <input id={id} className={cls} type="time" value={str.slice(0, 5)} disabled={disabled} {...aria}
        onChange={(e) => onChange(e.target.value || null)} />;
    case "choice":
      return (
        <select id={id} className={cls} value={str} disabled={disabled} {...aria}
          onChange={(e) => onChange(e.target.value === "" ? (field.nullable ? null : "") : e.target.value)}>
          {!field.required || field.nullable || str === "" ? <option value="">{t.choose}</option> : null}
          {(field.choices ?? []).map((c) => (
            <option key={String(c.value)} value={String(c.value)}>{c.label}</option>
          ))}
        </select>
      );
    case "fk":
      return <RelatedSelect id={id} related={field.related} value={value as number | null} disabled={disabled}
        initialLabel={initialLabel} onChange={onChange} invalid={invalid} filters={filters} />;
    case "m2m":
      return <RelatedMulti related={field.related} value={(value as number[]) ?? []} disabled={disabled} onChange={onChange} id={id} />;
    case "file":
      return <FileInput value={value as StoredFileRef | number | null} disabled={disabled} onChange={onChange} image={field.image} id={id} />;
    case "upload":
      return <LocalFileInput id={id} value={value instanceof File ? value : null} disabled={disabled} onChange={onChange} />;
    case "json":
      return <textarea id={id} className={`${cls} mono`} value={typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2)}
        disabled={disabled} {...aria} onChange={(e) => {
          try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
        }} />;
    case "email":
      return <input id={id} className={cls} type="email" value={str} disabled={disabled} maxLength={field.max_length} {...aria}
        autoComplete="email" onChange={(e) => onChange(e.target.value)} />;
    case "url":
      return <input id={id} className={cls} type="url" value={str} disabled={disabled} maxLength={field.max_length} {...aria}
        onChange={(e) => onChange(e.target.value)} />;
    default:
      return <input id={id} className={cls} value={str} disabled={disabled} maxLength={field.max_length} {...aria}
        onChange={(e) => onChange(e.target.value)} />;
  }
}

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(h);
  }, [value, ms]);
  return v;
}

export function rowLabel(row: Row): string {
  return String(row._label ?? row.name ?? row.title ?? row.code ?? row.id);
}

/** Search-as-you-type picker over the related resource's list endpoint (?search=). */
export function RelatedSelect({
  related, value, onChange, disabled, initialLabel, invalid, id, placeholder, filters,
}: {
  related?: RelatedRef;
  value: number | null;
  onChange: (v: number | null, row?: Row) => void;
  disabled?: boolean;
  initialLabel?: string;
  invalid?: boolean;
  id?: string;
  placeholder?: string;
  filters?: Query;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [label, setLabel] = useState(initialLabel ?? "");
  const [highlight, setHighlight] = useState(0);
  const search = useDebounced(text);
  const endpoint = related?.endpoint;
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => setLabel(initialLabel ?? ""), [initialLabel]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = useQuery({
    queryKey: ["options", endpoint, search, filters],
    queryFn: ({ signal }) => api.get<Page<Row>>(endpoint as string, { ...filters, search, page_size: 20 }, signal),
    enabled: open && Boolean(endpoint),
    staleTime: 30_000,
  });
  // a value set without a label (prefill) → fetch the record once for its text
  const current = useQuery({
    queryKey: ["record", endpoint, String(value)],
    queryFn: () => api.get<Row>(`${endpoint}${value}/`),
    enabled: Boolean(endpoint) && value !== null && value !== undefined && !label,
    staleTime: 60_000,
  });
  const shown = value === null || value === undefined ? "" : label || (current.data ? rowLabel(current.data) : `#${value}`);
  const rows = options.data?.results ?? [];

  if (!endpoint) {
    return <input id={id} className="input" value={value ?? ""} disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} />;
  }
  const pick = (row: Row | null) => {
    onChange(row ? row.id : null, row ?? undefined);
    setLabel(row ? rowLabel(row) : "");
    setText("");
    setOpen(false);
  };
  return (
    <div className="combo" ref={ref}>
      <div className="combo-control">
        <input
          id={id}
          className={`input${invalid ? " invalid" : ""}`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-activedescendant={open && rows[highlight] ? `${listId}-${rows[highlight].id}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? text : shown}
          placeholder={open ? shown || placeholder || t.searchPlaceholder : placeholder ?? t.choose}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => { setText(e.target.value); setOpen(true); setHighlight(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { setOpen(true); setHighlight((h) => Math.min(h + 1, rows.length - 1)); e.preventDefault(); }
            if (e.key === "ArrowUp") { setHighlight((h) => Math.max(h - 1, 0)); e.preventDefault(); }
            if (e.key === "Enter" && open && rows[highlight]) { pick(rows[highlight]); e.preventDefault(); }
            if (e.key === "Escape" && open) { setOpen(false); e.stopPropagation(); }
            if (e.key === "Tab") setOpen(false);
          }}
        />
        {value && !disabled ? (
          <button type="button" className="combo-clear" aria-label={`${t.remove}: ${shown}`} onClick={() => pick(null)}><X aria-hidden /></button>
        ) : null}
      </div>
      {open && !disabled ? (
        <div className="options" role="listbox" id={listId}>
          {options.isLoading ? <div className="hint">{t.loading}</div> : null}
          {rows.map((row, i) => (
            <button key={row.id} id={`${listId}-${row.id}`} type="button" role="option" aria-selected={row.id === value}
              className={i === highlight ? "hl" : ""} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(row)}>
              {rowLabel(row)}
            </button>
          ))}
          {!options.isLoading && rows.length === 0 ? <div className="hint">{search ? `Ништо за „${search}“.` : t.noResults}</div> : null}
          {options.data && options.data.count > rows.length ? <div className="hint">Уште {options.data.count - rows.length} — пребарајте подетално.</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function ChipLabel({ endpoint, id, known }: { endpoint?: string; id: number; known?: string }) {
  const q = useQuery({
    queryKey: ["record", endpoint, String(id)],
    queryFn: () => api.get<Row>(`${endpoint}${id}/`),
    enabled: Boolean(endpoint) && !known,
    staleTime: 60_000,
  });
  return <>{known ?? (q.data ? rowLabel(q.data) : `#${id}`)}</>;
}

export function RelatedMulti({ related, value, onChange, disabled, id }: {
  related?: RelatedRef; value: number[]; onChange: (v: number[]) => void; disabled?: boolean; id?: string;
}) {
  const [labels, setLabels] = useState<Record<number, string>>({});
  return (
    <div className="stack-sm">
      {!disabled ? (
        <RelatedSelect id={id} related={related} value={null} placeholder={`${t.add}…`} onChange={(next, row) => {
          if (next && !value.includes(next)) {
            onChange([...value, next]);
            if (row) setLabels((l) => ({ ...l, [next]: rowLabel(row) }));
          }
        }} />
      ) : null}
      {value.length ? (
        <div className="chips">
          {value.map((v) => (
            <span key={v} className="chip">
              <span className="truncate"><ChipLabel endpoint={related?.endpoint} id={v} known={labels[v]} /></span>
              {!disabled ? <button type="button" aria-label={t.remove} onClick={() => onChange(value.filter((x) => x !== v))}><X aria-hidden /></button> : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function fileSize(n?: number) {
  if (!n) return "";
  return n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** A drop zone: drag a file in or click to pick one. */
export function DropZone({ onFile, busy, accept, id, label = t.uploadHint }: {
  onFile: (f: File) => void; busy?: boolean; accept?: string; id?: string; label?: string;
}) {
  const inputId = useId();
  const [over, setOver] = useState(false);
  return (
    <label htmlFor={id ?? inputId} className={`file-drop${over ? " over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
      {busy ? <span className="spinner" aria-hidden /> : <Upload aria-hidden />}
      <span>{busy ? t.loading : label}</span>
      <input id={id ?? inputId} type="file" accept={accept} disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </label>
  );
}

/** A file kept in the browser and sent with the form (multipart). */
function LocalFileInput({ id, value, onChange, disabled }: { id?: string; value: File | null; onChange: (f: File | null) => void; disabled?: boolean }) {
  if (value) {
    return (
      <div className="row-tight file-ref">
        <Paperclip aria-hidden /><span className="truncate">{value.name}</span><span className="xs muted">{fileSize(value.size)}</span>
        {!disabled ? <button type="button" className="combo-clear inline" aria-label={t.remove} onClick={() => onChange(null)}><X aria-hidden /></button> : null}
      </div>
    );
  }
  return disabled ? <span className="muted">{t.none}</span> : <DropZone id={id} onFile={onChange} />;
}

/** Uploads to /api/v1/files/ and keeps the returned reference; the form sends its id. */
export function FileInput({ value, onChange, disabled, image, id }: {
  value: StoredFileRef | number | null;
  onChange: (v: StoredFileRef | null) => void;
  disabled?: boolean;
  image?: boolean;
  id?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = value && typeof value === "object" ? value : null;
  const upload = async (f: File) => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", f);
      if (image) form.append("kind", "image");
      onChange(await api.post<StoredFileRef>("/files/", form));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack-sm">
      {file ? (
        <div className="row-tight file-ref">
          <FileText aria-hidden />
          {file.url ? <a href={file.inline_url ?? file.url} target="_blank" rel="noreferrer" className="truncate">{file.name}</a> : <span className="truncate">{file.name}</span>}
          <span className="xs muted">{fileSize(file.size)}</span>
          {!disabled ? <button type="button" className="combo-clear inline" aria-label={`${t.remove}: ${file.name}`} onClick={() => onChange(null)}><X aria-hidden /></button> : null}
        </div>
      ) : typeof value === "number" ? <span className="muted">#{value}</span> : null}
      {!disabled && !file ? <DropZone id={id} onFile={(f) => void upload(f)} busy={busy} accept={image ? "image/*" : undefined} /> : null}
      {error ? <span className="field"><span className="error">{error}</span></span> : null}
    </div>
  );
}
