/** Create / edit form for any resource, from its metadata: fields grouped into sections, widths by type,
 * sticky save bar, Ctrl+S, focus on the first error, and a guard against leaving with unsaved changes.
 * Server validation errors land on their fields; a version conflict (409) offers the latest version. */
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { UNSAFE_DataRouterContext, useBlocker, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import type { FieldMeta, ResourceMeta, Row } from "@/api/types";
import { FieldInput } from "@/components/inputs";
import { RowsEditor, rowsPayload } from "@/components/rows";
import { useSession } from "@/auth/session";
import { Alert, Button, Field, Kbd, Modal, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";
import { routeFor, useSave } from "@/meta/hooks";

import { AllocationEditor, ALLOCATIONS } from "./allocations";

const HIDDEN = new Set(["id", "version", "created_at", "updated_at", "created_by", "updated_by", "_label"]);

export function editableFields(meta: ResourceMeta): FieldMeta[] {
  const fields = meta.fields.filter((f) => !HIDDEN.has(f.name) && !f.read_only);
  // nested rows (lines, allocations) after the header fields, whatever the serializer order
  return [...fields.filter((f) => f.type !== "rows"), ...fields.filter((f) => f.type === "rows")];
}

function widthOf(f: FieldMeta): string {
  switch (f.type) {
    case "text": case "json": case "m2m": case "rows": return "w-12";
    case "date": case "time": case "integer": case "decimal": return "w-3";
    case "datetime": return "w-3";
    case "boolean": return "w-3 check-cell";
    case "file": case "upload": return "w-6";
    case "string": return (f.max_length ?? 0) > 200 ? "w-8" : "";
    default: return "";
  }
}

type SectionKey = "main" | "dates" | "amounts" | "options" | "files" | "notes";
const SECTION_TITLES: Record<SectionKey, string> = {
  main: "Основни податоци", dates: "Датуми и рокови", amounts: "Износи", options: "Опции", files: "Документи", notes: "Опис и белешки",
};

function sectionOf(f: FieldMeta): SectionKey {
  if (f.type === "date" || f.type === "datetime" || f.type === "time") return "dates";
  if (f.type === "decimal") return "amounts";
  if (f.type === "boolean") return "options";
  if (f.type === "file" || f.type === "upload") return "files";
  if (f.type === "text" || f.type === "json") return "notes";
  return "main";
}

function initialValues(fields: FieldMeta[], row?: Row): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    if (row && f.name in row) values[f.name] = row[f.name];
    else if (f.default !== undefined) values[f.name] = f.default;
    else if (f.type === "boolean") values[f.name] = false;
    else if (f.type === "m2m" || f.type === "rows") values[f.name] = [];
    else values[f.name] = null;
  }
  return values;
}

function toPayload(fields: FieldMeta[], values: Record<string, unknown>, touched: Set<string>, creating: boolean) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!creating && !touched.has(f.name)) continue;
    let v = values[f.name];
    if (v && typeof v === "object" && !Array.isArray(v) && f.type === "file") v = (v as { id: number }).id;
    if (f.type === "rows") v = rowsPayload(f, (v as Record<string, unknown>[]) ?? []);
    if (v === "" && (f.nullable || ["date", "datetime", "time", "decimal", "integer", "fk"].includes(f.type))) v = null;
    if (creating && (v === null || v === undefined) && !f.required) continue;
    out[f.name] = v;
  }
  return out;
}

/** Multipart body for records sent with a file (DMS registration); objects and lists as JSON strings. */
function toFormData(payload: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(payload)) {
    if (v === null || v === undefined) continue;
    if (v instanceof File) form.append(k, v);
    else if (Array.isArray(v)) v.forEach((x) => form.append(k, String(x)));
    else if (typeof v === "object") form.append(k, JSON.stringify(v));
    else form.append(k, String(v));
  }
  return form;
}

/** List filters of a dependent picker from the current form values (legal entity falls back to the default). */
export function dependentFilters(f: FieldMeta, values: Record<string, unknown>, defaultEntity?: number | null) {
  if (!f.depends_on) return undefined;
  const out: Record<string, string | number> = {};
  for (const [param, source] of Object.entries(f.depends_on)) {
    const v = values[source] ?? (source === "legal_entity" ? defaultEntity : null);
    if (v !== null && v !== undefined && v !== "") out[param] = typeof v === "object" ? (v as { id: number }).id : (v as string | number);
  }
  return out;
}

/** Asks before leaving the page with unsaved changes (needs the data router; skipped in isolated tests). */
function LeaveGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!when) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [when]);
  if (blocker.state !== "blocked") return null;
  return (
    <Modal size="sm" title={t.leaveTitle} onClose={() => blocker.reset?.()}
      footer={<>
        <Button autoFocus onClick={() => blocker.reset?.()}>{t.stay}</Button>
        <Button variant="danger-solid" onClick={() => blocker.proceed?.()}>{t.leave}</Button>
      </>}>
      <p style={{ color: "var(--ink-soft)" }}>{t.leaveText}</p>
    </Modal>
  );
}

export function ResourceForm({
  meta, row, onSaved, onCancel, defaults, compact,
}: {
  meta: ResourceMeta;
  row?: Row;
  onSaved?: (row: Row) => void;
  onCancel?: () => void;
  defaults?: Record<string, unknown>;
  /** In a dialog or drawer: no sections, no sticky bar. */
  compact?: boolean;
}) {
  const creating = !row;
  const fields = useMemo(() => editableFields(meta), [meta]);
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...initialValues(fields, row), ...defaults }));
  const [touched, setTouched] = useState<Set<string>>(() => new Set(Object.keys(defaults ?? {})));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const save = useSave(meta.endpoint);
  const { session } = useSession();
  const myEntities = session?.access?.entities ?? [];
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const dataRouter = useContext(UNSAFE_DataRouterContext);

  /** Set a field; clear the pickers that depend on it; copy `fills` from the picked row. */
  const change = (f: FieldMeta, v: unknown, picked?: Row) => {
    const next: Record<string, unknown> = { [f.name]: v };
    for (const other of fields) {
      if (other !== f && Object.values(other.depends_on ?? {}).includes(f.name) && values[other.name] != null) {
        next[other.name] = null;
      }
    }
    if (picked) for (const [target, attr] of Object.entries(f.fills ?? {})) {
      if (picked[attr] !== undefined && picked[attr] !== null && picked[attr] !== "") next[target] = picked[attr];
    }
    setValues((s) => ({ ...s, ...next }));
    setTouched((s) => { const n = new Set(s); Object.keys(next).forEach((k) => n.add(k)); return n; });
    setDirty(true);
  };
  const setRows = (name: string, v: unknown) => {
    setValues((s) => ({ ...s, [name]: v }));
    setTouched((s) => new Set(s).add(name));
    setDirty(true);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (save.isPending) return;
    setError(null);
    try {
      const payload = toPayload(fields, values, touched, creating);
      const saved = await save.mutateAsync({
        id: row?.id,
        data: Object.values(payload).some((v) => v instanceof File) ? toFormData(payload) : payload,
        version: row?.version,
      });
      setDirty(false);
      toast(creating ? `${meta.title_singular || t.created}: ${t.created.toLowerCase()}` : t.saved, "success");
      // let the guard see the clean state before navigating
      window.setTimeout(() => {
        if (onSaved) onSaved(saved);
        else navigate(`${routeFor(meta.endpoint)}/${saved.id}`, { replace: true });
      }, 0);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
        window.setTimeout(() => {
          const bad = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], .input.invalid, .alert.danger");
          bad?.scrollIntoView({ block: "center", behavior: "smooth" });
          if (bad && bad.matches("input,select,textarea")) bad.focus({ preventScroll: true });
        }, 50);
      } else {
        toast(String(err), "danger");
      }
    }
  };

  // Ctrl/Cmd+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (!formRef.current?.isConnected) return;
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const fieldErrorNames = new Set(Object.keys(error?.errors ?? {}));
  const generalErrors = error
    ? Object.entries(error.errors).filter(([k]) => !fields.some((f) => f.name === k)).flatMap(([, v]) => v)
    : [];

  const renderField = (f: FieldMeta): ReactNode => {
    const id = `fld-${f.name}`;
    const err = error?.fieldError(f.name);
    if (f.name === "legal_entity" && f.type === "fk") {
      // the user's own companies; with one there is nothing to choose (the server applies the default)
      if (myEntities.length <= 1) return null;
      return (
        <div key={f.name}>
          <Field label={f.label} htmlFor={id} error={err} required>
            <select id={id} className="input" value={String(values[f.name] ?? session?.access?.default_entity_id ?? "")}
              onChange={(e) => change(f, Number(e.target.value))}>
              {myEntities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
        </div>
      );
    }
    if (f.type === "rows" && f.name === "allocations" && ALLOCATIONS[meta.key]) {
      return (
        <div key={f.name} className="w-12">
          <AllocationEditor spec={ALLOCATIONS[meta.key]} values={values}
            value={(values[f.name] as Record<string, unknown>[]) ?? []}
            errors={(error?.errors as Record<string, unknown> | undefined)?.[f.name]}
            onChange={(v) => setRows(f.name, v)} />
        </div>
      );
    }
    if (f.type === "rows") {
      return (
        <div key={f.name} className="w-12">
          {f.help_text ? <p className="small muted" style={{ marginBottom: 8 }}>{f.help_text}</p> : null}
          <RowsEditor field={f} value={(values[f.name] as Record<string, unknown>[]) ?? []}
            errors={(error?.errors as Record<string, unknown> | undefined)?.[f.name]}
            onChange={(v) => setRows(f.name, v)} />
          {typeof (error?.errors as Record<string, unknown> | undefined)?.[f.name] === "string" || (Array.isArray(error?.errors?.[f.name]) && typeof error?.errors?.[f.name]?.[0] === "string")
            ? <div className="field"><span className="error">{String(error?.errors?.[f.name]?.[0] ?? error?.errors?.[f.name])}</span></div> : null}
        </div>
      );
    }
    const input = (
      <FieldInput id={id} field={f} value={values[f.name]} invalid={fieldErrorNames.has(f.name)}
        initialLabel={row ? (row[`${f.name}_label`] as string | undefined) : undefined}
        filters={dependentFilters(f, values, session?.access?.default_entity_id)}
        onChange={(v, picked) => change(f, v, picked)} />
    );
    return (
      <div key={f.name} className={compact ? (["text", "json", "m2m", "file", "upload"].includes(f.type) ? "w-12" : "w-6") : widthOf(f)}>
        {f.type === "boolean" ? (
          <div className="field">{input}{err ? <span className="error" role="alert">{err}</span> : f.help_text ? <span className="help">{f.help_text}</span> : null}</div>
        ) : (
          <Field label={f.label} required={f.required && !f.nullable} help={f.help_text || undefined} error={err} htmlFor={id}>
            {input}
          </Field>
        )}
      </div>
    );
  };

  // `hidden` fields are API helpers (filled from picked rows): sent, never shown
  const header = fields.filter((f) => f.type !== "rows" && !f.hidden);
  const nested = fields.filter((f) => f.type === "rows" && !f.hidden);
  const useSections = !compact && header.length > 8;
  const sections: [SectionKey, FieldMeta[]][] = useSections
    ? (Object.keys(SECTION_TITLES) as SectionKey[]).map((k) => [k, header.filter((f) => sectionOf(f) === k)] as [SectionKey, FieldMeta[]]).filter(([, l]) => l.length)
    : [["main", header]];

  return (
    <form ref={formRef} className="form" onSubmit={submit} noValidate>
      {dataRouter && !compact ? <LeaveGuard when={dirty && !save.isPending} /> : null}
      {error?.status === 409 ? (
        <Alert tone="warning" title="Записот е изменет во меѓувреме"
          action={onCancel ? <Button size="sm" onClick={onCancel}>Прикажи ја најновата верзија</Button> : undefined}>
          {t.conflict}
        </Alert>
      ) : error && (generalErrors.length || !fieldErrorNames.size) ? (
        <Alert tone="danger" title="Записот не е зачуван">{generalErrors.length ? generalErrors.join(" ") : error.message}</Alert>
      ) : error ? (
        <Alert tone="danger" title="Записот не е зачуван">Поправете ги означените полиња.</Alert>
      ) : null}
      {sections.map(([key, list]) => (
        <section key={key} className="form-section" aria-label={useSections ? SECTION_TITLES[key] : undefined}>
          {useSections ? <h3 className="section-title">{SECTION_TITLES[key]}</h3> : null}
          <div className="form-grid">{list.map(renderField)}</div>
        </section>
      ))}
      {nested.map((f) => (
        <section key={f.name} className="form-section">
          <h3 className="section-title">{f.label}</h3>
          <div className="form-grid">{renderField(f)}</div>
        </section>
      ))}
      <div className={compact ? "row" : "save-bar"} style={compact ? { justifyContent: "flex-end" } : undefined}>
        {!compact && dirty ? <span className="dirty">{t.unsaved}</span> : null}
        {!compact ? <span className="xs muted" style={{ marginLeft: dirty ? 8 : 0 }}><Kbd>Ctrl</Kbd> <Kbd>S</Kbd></span> : null}
        <span className="spacer" />
        <Button onClick={() => (onCancel ? onCancel() : navigate(-1))}>{t.cancel}</Button>
        <Button type="submit" variant="primary" busy={save.isPending}>{creating ? t.save : t.saveChanges}</Button>
      </div>
    </form>
  );
}
