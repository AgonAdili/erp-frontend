/** Create / edit form for any resource, from its metadata. Server validation errors land on their fields;
 * a version conflict (409) reloads the record. */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import type { FieldMeta, ResourceMeta, Row } from "@/api/types";
import { FieldInput } from "@/components/inputs";
import { RowsEditor, rowsPayload } from "@/components/rows";
import { useSession } from "@/auth/session";
import { Alert, Button, Field, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";
import { routeFor, useSave } from "@/meta/hooks";

import { AllocationEditor, ALLOCATIONS } from "./allocations";

const HIDDEN = new Set(["id", "version", "created_at", "updated_at", "created_by", "updated_by", "_label"]);
const WIDE = new Set(["text", "json", "m2m", "rows"]);

export function editableFields(meta: ResourceMeta): FieldMeta[] {
  const fields = meta.fields.filter((f) => !HIDDEN.has(f.name) && !f.read_only);
  // nested rows (lines, allocations) after the header fields, whatever the serializer order
  return [...fields.filter((f) => f.type !== "rows"), ...fields.filter((f) => f.type === "rows")];
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

export function ResourceForm({
  meta,
  row,
  onSaved,
  onCancel,
  defaults,
}: {
  meta: ResourceMeta;
  row?: Row;
  onSaved?: (row: Row) => void;
  onCancel?: () => void;
  defaults?: Record<string, unknown>;
}) {
  const creating = !row;
  const fields = useMemo(() => editableFields(meta), [meta]);
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...initialValues(fields, row), ...defaults }));
  const [touched, setTouched] = useState<Set<string>>(() => new Set(Object.keys(defaults ?? {})));
  const [error, setError] = useState<ApiError | null>(null);
  const save = useSave(meta.endpoint);
  const { session } = useSession();
  const myEntities = session?.access?.entities ?? [];
  const navigate = useNavigate();
  const toast = useToast();

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
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = toPayload(fields, values, touched, creating);
      const saved = await save.mutateAsync({
        id: row?.id,
        data: Object.values(payload).some((v) => v instanceof File) ? toFormData(payload) : payload,
        version: row?.version,
      });
      toast(t.saved);
      if (onSaved) onSaved(saved);
      else navigate(`${routeFor(meta.endpoint)}/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
        if (err.status === 409) toast(t.conflict, "danger");
      } else {
        toast(String(err), "danger");
      }
    }
  };

  const fieldErrorNames = new Set(Object.keys(error?.errors ?? {}));
  const generalErrors = error
    ? Object.entries(error.errors).filter(([k]) => !fields.some((f) => f.name === k)).flatMap(([, v]) => v)
    : [];

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {error && (generalErrors.length || !fieldErrorNames.size) ? (
        <Alert tone="danger">{generalErrors.length ? generalErrors.join(" ") : error.message}</Alert>
      ) : null}
      <div className="grid-2">
        {fields.map((f) => {
          const id = `fld-${f.name}`;
          if (f.name === "legal_entity" && f.type === "fk") {
            // the user's own companies; with one there is nothing to choose (the server applies the default)
            if (myEntities.length <= 1) return null;
            return (
              <Field key={f.name} label={f.label} htmlFor={id} error={error?.fieldError(f.name)}>
                <select id={id} className="input" value={String(values[f.name] ?? session?.access?.default_entity_id ?? "")}
                  onChange={(e) => {
                    change(f, Number(e.target.value));
                  }}>
                  {myEntities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </Field>
            );
          }
          if (f.type === "rows" && f.name === "allocations" && ALLOCATIONS[meta.key]) {
            return (
              <div key={f.name} style={{ gridColumn: "1 / -1" }}>
                <Field label={f.label}>
                  <AllocationEditor spec={ALLOCATIONS[meta.key]} values={values}
                    value={(values[f.name] as Record<string, unknown>[]) ?? []}
                    errors={(error?.errors as Record<string, unknown> | undefined)?.[f.name]}
                    onChange={(v) => {
                      setValues((s) => ({ ...s, [f.name]: v }));
                      setTouched((s) => new Set(s).add(f.name));
                    }} />
                </Field>
              </div>
            );
          }
          if (f.type === "rows") {
            return (
              <div key={f.name} style={{ gridColumn: "1 / -1" }}>
                <Field label={f.label} help={f.help_text || undefined}>
                  <RowsEditor field={f} value={(values[f.name] as Record<string, unknown>[]) ?? []}
                    errors={(error?.errors as Record<string, unknown> | undefined)?.[f.name]}
                    onChange={(v) => {
                      setValues((s) => ({ ...s, [f.name]: v }));
                      setTouched((s) => new Set(s).add(f.name));
                    }} />
                </Field>
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
            <div key={f.name} style={WIDE.has(f.type) ? { gridColumn: "1 / -1" } : undefined}>
              {f.type === "boolean" ? (
                <div className="field">{input}{error?.fieldError(f.name) ? <span className="error">{error.fieldError(f.name)}</span> : null}</div>
              ) : (
                <Field label={f.label} required={f.required && !f.nullable} help={f.help_text || undefined}
                  error={error?.fieldError(f.name)} htmlFor={id}>
                  {input}
                </Field>
              )}
            </div>
          );
        })}
      </div>
      <div className="row">
        <Button type="submit" variant="primary" busy={save.isPending}>{t.save}</Button>
        <Button onClick={() => (onCancel ? onCancel() : navigate(-1))}>{t.cancel}</Button>
      </div>
    </form>
  );
}
