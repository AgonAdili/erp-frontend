/** The form page type (branding_rules/04 §3 "Form"): one column, at most 640px, titled sections, the required
 * note at the top, an error summary on a failed save, a sticky [Откажи] [Зачувај] footer, Ctrl+S, and
 * "Имате незачувани промени" before leaving. Create and edit share it. Server validation errors land on their
 * fields; a version conflict (409) offers the latest version. */
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";

import { ApiError } from "@/api/client";
import type { FieldMeta, ResourceMeta, Row } from "@/api/types";
import { FieldInput } from "@/components/inputs";
import { RowsEditor, rowsPayload } from "@/components/rows";
import { useSession } from "@/auth/session";
import { Alert, Button, Field, Modal, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";
import { useSave } from "@/meta/hooks";

import { AllocationEditor, ALLOCATIONS } from "./allocations";

const HIDDEN = new Set(["id", "version", "created_at", "updated_at", "created_by", "updated_by", "_label"]);

export function editableFields(meta: ResourceMeta): FieldMeta[] {
  const fields = meta.fields.filter((f) => !HIDDEN.has(f.name) && !f.read_only);
  // nested rows (lines, allocations) after the header fields, whatever the serializer order
  return [...fields.filter((f) => f.type !== "rows"), ...fields.filter((f) => f.type === "rows")];
}

/** Short values sit two to a row; everything else takes the column. */

type SectionKey = "main" | "dates" | "amounts" | "options" | "files" | "notes";
const SECTION_TITLES: Record<SectionKey, string> = {
  main: "Основни податоци", dates: "Датуми и рокови", amounts: "Износи и количини", options: "Опции", files: "Документи", notes: "Опис и белешки",
};

function sectionOf(f: FieldMeta): SectionKey {
  if (f.required && !["text", "json", "file", "upload", "boolean"].includes(f.type)) return "main";
  if (f.type === "date" || f.type === "datetime" || f.type === "time") return "dates";
  if (f.type === "decimal" || f.type === "integer") return "amounts";
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

/** "Имате незачувани промени" with [Остани] [Отфрли промени] (needs the data router; skipped in isolated tests). */
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
      {t.leaveText}
    </Modal>
  );
}

export function ResourceForm({ meta, row, onSaved, onCancel, defaults, hideFields }: {
  meta: ResourceMeta;
  row?: Row;
  onSaved?: (row: Row) => void;
  onCancel?: () => void;
  defaults?: Record<string, unknown>;
  /** Fields the context sets (a parent record): sent, not shown. */
  hideFields?: string[];
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
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const dataRouter = useContext(UNSAFE_DataRouterContext);

  /** Set a field; clear the pickers that depend on it; copy `fills` from the picked row. */
  const change = (f: FieldMeta, v: unknown, picked?: Row) => {
    const next: Record<string, unknown> = { [f.name]: v };
    for (const other of fields) {
      if (other !== f && Object.values(other.depends_on ?? {}).includes(f.name) && values[other.name] != null) next[other.name] = null;
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
      // let the guard see the clean state before the caller navigates
      window.setTimeout(() => {
        if (onSaved) onSaved(saved);
        else toast(t.saved, "success");
      }, 0);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
        window.setTimeout(() => {
          summaryRef.current?.focus();
          summaryRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 30);
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

  const hide = new Set(hideFields ?? []);
  const visible = fields.filter((f) => !f.hidden && !hide.has(f.name));
  const fieldErrorNames = new Set(Object.keys(error?.errors ?? {}));
  const generalErrors = error ? Object.entries(error.errors).filter(([k]) => !fields.some((f) => f.name === k)).flatMap(([, v]) => v) : [];
  const fieldErrors = visible.filter((f) => fieldErrorNames.has(f.name));

  const renderField = (f: FieldMeta): ReactNode => {
    const id = `fld-${f.name}`;
    const err = error?.fieldError(f.name);
    if (f.name === "legal_entity" && f.type === "fk") {
      // the user's own companies; with one there is nothing to choose (the server applies the default)
      if (myEntities.length <= 1) return null;
      return (
        <div key={f.name}>
          <Field label={f.label} htmlFor={id} error={err} required>
            <select id={id} name={f.name} className="input" value={String(values[f.name] ?? session?.access?.default_entity_id ?? "")}
              onChange={(e) => change(f, Number(e.target.value))}>
              {myEntities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
        </div>
      );
    }
    const rowErrors = (error?.errors as Record<string, unknown> | undefined)?.[f.name];
    if (f.type === "rows" && f.name === "allocations" && ALLOCATIONS[meta.key]) {
      return (
        <div key={f.name}>
          <AllocationEditor spec={ALLOCATIONS[meta.key]} values={values} value={(values[f.name] as Record<string, unknown>[]) ?? []}
            errors={rowErrors} onChange={(v) => setRows(f.name, v)} />
        </div>
      );
    }
    if (f.type === "rows") {
      const flat = Array.isArray(rowErrors) && typeof rowErrors[0] === "string" ? String(rowErrors[0]) : typeof rowErrors === "string" ? rowErrors : "";
      return (
        <div key={f.name} className="stack-sm">
          {f.help_text ? <p className="muted">{f.help_text}</p> : null}
          <RowsEditor field={f} value={(values[f.name] as Record<string, unknown>[]) ?? []} errors={rowErrors} onChange={(v) => setRows(f.name, v)} />
          {flat ? <div className="field"><span className="error">{flat}</span></div> : null}
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
      <div key={f.name} className={f.type === "boolean" ? "check-cell" : undefined}>
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

  const header = visible.filter((f) => f.type !== "rows");
  const nested = visible.filter((f) => f.type === "rows");
  const ordered = [...header.filter((f) => f.required), ...header.filter((f) => !f.required)];
  const useSections = header.length > 6;
  const sections: [SectionKey, FieldMeta[]][] = useSections
    ? (Object.keys(SECTION_TITLES) as SectionKey[]).map((k) => [k, ordered.filter((f) => sectionOf(f) === k)] as [SectionKey, FieldMeta[]]).filter(([, l]) => l.length)
    : [["main", ordered]];
  const hasRequired = visible.some((f) => f.required && !f.nullable);

  return (
    <form ref={formRef} className="form" onSubmit={submit} noValidate>
      {dataRouter ? <LeaveGuard when={dirty && !save.isPending} /> : null}
      {hasRequired ? <p className="required-note">{t.requiredNote}</p> : null}
      {error?.status === 409 ? (
        <Alert tone="warning" title="Записот е изменет во меѓувреме"
          action={onCancel ? <Button size="sm" onClick={onCancel}>Прикажи ја најновата верзија</Button> : undefined}>
          {t.conflict}
        </Alert>
      ) : error ? (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <strong>{t.errorSummary}</strong>
          {fieldErrors.length || generalErrors.length ? (
            <ul>
              {generalErrors.map((g, i) => <li key={`g${i}`}>{g}</li>)}
              {fieldErrors.map((f) => <li key={f.name}><a href={`#fld-${f.name}`}>{f.label}: {error.fieldError(f.name)}</a></li>)}
            </ul>
          ) : <div>{error.message}</div>}
        </div>
      ) : null}
      {sections.map(([key, list]) => (
        <section key={key} className="form-section" aria-label={useSections ? SECTION_TITLES[key] : undefined}>
          {useSections ? <h2>{SECTION_TITLES[key]}</h2> : null}
          <div className="form-fields">{list.map(renderField)}</div>
        </section>
      ))}
      {nested.map((f) => (
        <section key={f.name} className="form-section rows-section">
          <h2>{f.label}</h2>
          <div className="form-fields">{renderField(f)}</div>
        </section>
      ))}
      <div className="form-foot">
        {dirty ? <span className="dirty"><span className="ea-dot is-caution" aria-hidden />{t.unsaved}</span> : null}
        {onCancel ? <Button onClick={onCancel}>{t.cancel}</Button> : null}
        <Button type="submit" variant="primary" busy={save.isPending}>{t.save}</Button>
      </div>
    </form>
  );
}
