/** Inputs chosen by field metadata type, plus the related-record and file pickers. */
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, type Query } from "@/api/client";
import type { FieldMeta, Page, RelatedRef, Row } from "@/api/types";
import { t } from "@/i18n/mk";

import { Button } from "./ui";

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
  field,
  value,
  onChange,
  invalid,
  id,
  initialLabel,
  filters,
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
  switch (field.type) {
    case "boolean":
      return (
        <label className="check">
          <input id={id} type="checkbox" checked={Boolean(value)} disabled={disabled}
            onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      );
    case "text":
      return <textarea id={id} className={cls} value={str} disabled={disabled} maxLength={field.max_length}
        onChange={(e) => onChange(e.target.value)} />;
    case "integer":
      return <input id={id} className={cls} type="number" step={1} value={str} disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "decimal":
      return <input id={id} className={cls} inputMode="decimal" value={str} disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(",", ".") || null)} />;
    case "date":
      return <input id={id} className={cls} type="date" value={str.slice(0, 10)} disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)} />;
    case "datetime":
      return <input id={id} className={cls} type="datetime-local" value={str.slice(0, 16)} disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)} />;
    case "time":
      return <input id={id} className={cls} type="time" value={str.slice(0, 5)} disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)} />;
    case "choice":
      return (
        <select id={id} className={cls} value={str} disabled={disabled}
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
      return <RelatedMulti related={field.related} value={(value as number[]) ?? []} disabled={disabled} onChange={onChange} />;
    case "file":
      return <FileInput value={value as StoredFileRef | number | null} disabled={disabled} onChange={onChange}
        image={field.image} />;
    case "upload":
      return <input id={id} type="file" disabled={disabled} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />;
    case "json":
      return <textarea id={id} className={`${cls} mono`} value={typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2)}
        disabled={disabled} onChange={(e) => {
          try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
        }} />;
    case "email":
      return <input id={id} className={cls} type="email" value={str} disabled={disabled} maxLength={field.max_length}
        onChange={(e) => onChange(e.target.value)} />;
    default:
      return <input id={id} className={cls} value={str} disabled={disabled} maxLength={field.max_length}
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

function rowLabel(row: Row): string {
  return String(row._label ?? row.name ?? row.title ?? row.code ?? row.id);
}

/** Search-as-you-type picker over the related resource's list endpoint (?search=). */
export function RelatedSelect({
  related,
  value,
  onChange,
  disabled,
  initialLabel,
  invalid,
  id,
  placeholder,
  filters,
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

  useEffect(() => setLabel(initialLabel ?? ""), [initialLabel]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = useQuery({
    queryKey: ["options", endpoint, search, filters],
    queryFn: () => api.get<Page<Row>>(endpoint as string, { ...filters, search, page_size: 20 }),
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
  const shown = label || (current.data ? rowLabel(current.data) : value ? `#${value}` : "");
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
      <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
        <input
          id={id}
          className={`input${invalid ? " invalid" : ""}`}
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          value={open ? text : shown}
          placeholder={open ? shown || placeholder || t.searchPlaceholder : placeholder ?? t.choose}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setText(e.target.value); setOpen(true); setHighlight(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { setHighlight((h) => Math.min(h + 1, rows.length - 1)); e.preventDefault(); }
            if (e.key === "ArrowUp") { setHighlight((h) => Math.max(h - 1, 0)); e.preventDefault(); }
            if (e.key === "Enter" && open && rows[highlight]) { pick(rows[highlight]); e.preventDefault(); }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {value && !disabled ? <Button size="sm" variant="ghost" aria-label={t.remove} onClick={() => pick(null)}>✕</Button> : null}
      </div>
      {open && !disabled ? (
        <div className="options" role="listbox">
          {options.isLoading ? <div className="small muted" style={{ padding: 8 }}>{t.loading}</div> : null}
          {rows.map((row, i) => (
            <button key={row.id} type="button" role="option" aria-selected={row.id === value}
              className={i === highlight ? "hl" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(row)}>
              {rowLabel(row)}
            </button>
          ))}
          {!options.isLoading && rows.length === 0 ? <div className="small muted" style={{ padding: 8 }}>{t.noResults}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function RelatedMulti({
  related,
  value,
  onChange,
  disabled,
}: {
  related?: RelatedRef;
  value: number[];
  onChange: (v: number[]) => void;
  disabled?: boolean;
}) {
  const [labels, setLabels] = useState<Record<number, string>>({});
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="chips">
        {value.map((v) => (
          <span key={v} className="chip">
            {labels[v] ?? `#${v}`}
            {!disabled ? <button type="button" aria-label={t.remove} onClick={() => onChange(value.filter((x) => x !== v))}>✕</button> : null}
          </span>
        ))}
      </div>
      {!disabled ? (
        <RelatedSelect related={related} value={null} onChange={(id, row) => {
          if (id && !value.includes(id)) {
            onChange([...value, id]);
            if (row) setLabels((l) => ({ ...l, [id]: rowLabel(row) }));
          }
        }} />
      ) : null}
    </div>
  );
}

/** Uploads to /api/v1/files/ and keeps the returned reference; the form sends its id. */
export function FileInput({
  value,
  onChange,
  disabled,
  image,
}: {
  value: StoredFileRef | number | null;
  onChange: (v: StoredFileRef | null) => void;
  disabled?: boolean;
  image?: boolean;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = value && typeof value === "object" ? value : null;
  return (
    <div className="stack" style={{ gap: 4 }}>
      {file ? (
        <div className="row">
          {file.url ? <a href={file.inline_url ?? file.url} target="_blank" rel="noreferrer">{file.name}</a> : <span>{file.name}</span>}
          {!disabled ? <Button size="sm" variant="ghost" onClick={() => onChange(null)}>{t.remove}</Button> : null}
        </div>
      ) : typeof value === "number" ? <span className="muted">#{value}</span> : null}
      {!disabled ? (
        <div className="row">
          <input id={inputId} type="file" accept={image ? "image/*" : undefined} disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
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
                e.target.value = "";
              }
            }} />
          {busy ? <span className="spinner" aria-hidden /> : null}
        </div>
      ) : null}
      {error ? <span className="error small">{error}</span> : null}
    </div>
  );
}
