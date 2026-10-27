/** Inputs chosen by field metadata type, plus the related-record and file pickers. */
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Paperclip, Upload, X } from "lucide-react";

import { api, type Query } from "@/api/client";
import type { FieldMeta, Page, RelatedRef, Row } from "@/api/types";
import { t } from "@/i18n/mk";

import { Switch } from "./ui";

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
      return <input id={id} className={`${cls} num`} type="number" step={1} value={str} disabled={disabled} {...aria}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "decimal":
      return <input id={id} className={`${cls} num`} inputMode="decimal" value={str} disabled={disabled} {...aria}
        onChange={(e) => onChange(e.target.value.replace(",", ".") || null)} />;
    case "date":
      return <input id={id} className={cls} type="date" value={str.slice(0, 10)} disabled={disabled} {...aria}
        onChange={(e) => onChange(e.target.value || null)} />;
    case "datetime":
      return <input id={id} className={cls} type="datetime-local" value={str.slice(0, 16)} disabled={disabled} {...aria}
        onChange={(e) => onChange(e.target.value || null)} />;
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
        {!disabled ? <button type="button" className="combo-clear" style={{ position: "static", translate: "none" }} aria-label={t.remove} onClick={() => onChange(null)}><X aria-hidden /></button> : null}
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
          {!disabled ? <button type="button" className="combo-clear" style={{ position: "static", translate: "none" }} aria-label={`${t.remove}: ${file.name}`} onClick={() => onChange(null)}><X aria-hidden /></button> : null}
        </div>
      ) : typeof value === "number" ? <span className="muted">#{value}</span> : null}
      {!disabled && !file ? <DropZone id={id} onFile={(f) => void upload(f)} busy={busy} accept={image ? "image/*" : undefined} /> : null}
      {error ? <span className="field"><span className="error">{error}</span></span> : null}
    </div>
  );
}
