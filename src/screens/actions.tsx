/** Server-declared actions: state transitions and operations (POST, optional input form), reports (GET,
 * rendered from their JSON) and downloads. Shown only when allowed and when the record's state matches. */
import { useState } from "react";

import { api, ApiError, buildUrl, newIdempotencyKey, type Query } from "@/api/client";
import type { ActionInput, ActionMeta, ResourceMeta, Row } from "@/api/types";
import { FileInput, RelatedMulti, RelatedSelect, type StoredFileRef } from "@/components/inputs";
import { JsonView } from "@/components/JsonView";
import { useTrackTask } from "@/components/tasks";
import { Alert, Button, Field, Modal, Spinner, useConfirm, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";

export function actionApplies(action: ActionMeta, row?: Row): boolean {
  if (!action.allowed) return false;
  if (action.methods?.includes("PUT")) return false;   // collection replacements have their own editors
  if (!row) return true;
  return Object.entries(action.when ?? {}).every(([field, values]) => values.includes(String(row[field] ?? "")));
}

export function actionKind(action: ActionMeta): "action" | "report" | "download" {
  if (action.download || action.kind === "download") return "download";
  if (action.kind === "report") return "report";
  if (action.methods.length === 1 && action.methods[0] === "GET") return "report";
  return "action";
}

function actionUrl(meta: ResourceMeta, action: ActionMeta, row?: Row) {
  return action.detail && row ? `${meta.endpoint}${row.id}/${action.url_path}/` : `${meta.endpoint}${action.url_path}/`;
}

const INPUT_LABELS: Record<string, string> = {
  reason: "Причина", comment: "Коментар", note: "Белешка", payment_date: "Датум на плаќање", date: "Датум",
  amount: "Износ", status: "Статус", source: "Извор", file: "Датотека", year: "Година", month: "Месец",
};

function InputControl({ input, value, onChange }: { input: ActionInput; value: unknown; onChange: (v: unknown) => void }) {
  const id = `action-${input.name}`;
  const str = value === undefined || value === null ? "" : String(value);
  switch (input.type) {
    case "date":
      return <input id={id} className="input" type="date" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "number":
    case "decimal":
      return <input id={id} className="input" inputMode="decimal" value={str} onChange={(e) => onChange(e.target.value.replace(",", "."))} />;
    case "boolean":
      return <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
    case "file":
      return <FileInput value={(value as StoredFileRef) ?? null} onChange={onChange} />;
    case "choice":
      return (
        <select id={id} className="input" value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t.choose}</option>
          {(input.choices ?? []).map((c) => <option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}
        </select>
      );
    case "ref":
      return <RelatedSelect id={id} related={{ endpoint: input.endpoint }} value={(value as number) ?? null} onChange={(v) => onChange(v)} />;
    case "refs":
      return <RelatedMulti related={{ endpoint: input.endpoint }} value={(value as number[]) ?? []} onChange={onChange} />;
    case "text":
      return <textarea id={id} className="input" value={str} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <input id={id} className="input" value={str} onChange={(e) => onChange(e.target.value)} />;
  }
}

function initialInputs(inputs: ActionInput[]): Record<string, unknown> {
  const now = new Date();
  const values: Record<string, unknown> = {};
  for (const i of inputs) {
    if (i.name === "year") values.year = String(now.getFullYear());
    if (i.name === "month") values.month = String(now.getMonth() + 1);
  }
  return values;
}

function toQuery(values: Record<string, unknown>): Query {
  const q: Query = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    q[k] = v === true ? "1" : Array.isArray(v) ? (v as number[]) : String(v);
  }
  return q;
}

export function ActionButton({
  meta,
  action,
  row,
  onDone,
  size = "sm",
}: {
  meta: ResourceMeta;
  action: ActionMeta;
  row?: Row;
  onDone?: (result: unknown) => void;
  size?: "sm";
}) {
  const inputs = action.input ?? [];
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>(() => initialInputs(inputs));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<unknown>(undefined);
  const toast = useToast();
  const track = useTrackTask();
  const { confirm, dialog } = useConfirm();
  if (!actionApplies(action, row)) return null;

  const url = actionUrl(meta, action, row);
  const kind = actionKind(action);

  const runReport = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.get(url, toQuery(values)));
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) {
        payload[k] = v && typeof v === "object" && !Array.isArray(v) && "id" in (v as object) ? (v as { id: number }).id : v;
      }
      const res = await api.post<Record<string, unknown> | undefined>(url, payload, {
        version: row?.version ?? null, idempotencyKey: newIdempotencyKey(),
      });
      if (res && typeof res === "object" && "task_id" in res) {
        track(String(res.task_id), action.label);
        setOpen(false);
      } else if (res && typeof res === "object" && !("id" in res && "version" in res) && inputs.length) {
        setResult(res);   // an operation's own summary (created, skipped …): keep the dialog open to show it
      } else {
        setOpen(false);
      }
      toast(`${action.label}: ${t.done}`);
      onDone?.(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
        if (!open) toast(err.message, "danger");
      } else {
        toast(String(err), "danger");
      }
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (kind === "download") {
      window.open(buildUrl(url), "_blank", "noopener");
      return;
    }
    if (kind === "report") {
      setResult(undefined);
      setOpen(true);
      if (!inputs.some((i) => i.required)) void runReport();
      return;
    }
    if (inputs.length) {
      setResult(undefined);
      setOpen(true);
      return;
    }
    if (action.confirm && !(await confirm(action.confirm, action.danger))) return;
    await runAction({});
  };

  const missing = inputs.filter((i) => i.required && (values[i.name] === undefined || values[i.name] === "" ||
    (Array.isArray(values[i.name]) && !(values[i.name] as unknown[]).length)));
  const generalError = error && !inputs.some((i) => error.fieldError(i.name)) ? error.message : "";
  return (
    <>
      {dialog}
      <Button size={size} variant={action.danger ? "danger" : action.variant === "primary" ? "primary" : "default"}
        busy={busy && !open} onClick={start}>
        {action.label}
      </Button>
      {open ? (
        <Modal
          title={action.label}
          onClose={() => setOpen(false)}
          footer={
            kind === "report" ? (
              <>
                {inputs.length ? <Button variant="primary" busy={busy} disabled={missing.length > 0} onClick={runReport}>Прикажи</Button> : null}
                <Button onClick={() => setOpen(false)}>{t.close}</Button>
              </>
            ) : result !== undefined ? (
              <Button onClick={() => setOpen(false)}>{t.close}</Button>
            ) : (
              <>
                <Button onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button variant={action.danger ? "danger" : "primary"} busy={busy} disabled={missing.length > 0}
                  onClick={() => runAction(values)}>
                  {t.confirm}
                </Button>
              </>
            )
          }
        >
          <div className="stack">
            {action.confirm && kind !== "report" && result === undefined ? <p style={{ margin: 0 }}>{action.confirm}</p> : null}
            {generalError ? <Alert tone="danger">{generalError}</Alert> : null}
            {result === undefined || kind === "report" ? (
              <div className="grid-2">
                {inputs.map((input) => (
                  <Field key={input.name} label={input.label ?? INPUT_LABELS[input.name] ?? input.name} required={input.required}
                    htmlFor={`action-${input.name}`} error={error?.fieldError(input.name)}>
                    <InputControl input={input} value={values[input.name]}
                      onChange={(v) => setValues((s) => ({ ...s, [input.name]: v }))} />
                  </Field>
                ))}
              </div>
            ) : null}
            {kind === "report" && busy ? <Spinner /> : null}
            {result !== undefined ? <JsonView data={result} /> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
