/** A record: its fields, the actions its state allows, print, edit / delete, history, attachments, comments. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/api/client";
import type { FieldMeta, ResourceMeta, Row } from "@/api/types";
import { FileInput, type StoredFileRef } from "@/components/inputs";
import { RowsTable } from "@/components/rows";
import { Alert, Badge, Button, EmptyState, Spinner, statusTone, Tabs, useConfirm, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";
import { displayValue, formatDateTime } from "@/lib/format";
import { routeFor, useDelete, useInvalidateResource, useRecord } from "@/meta/hooks";

import { ActionButton, actionApplies } from "./actions";
import { HANDLED_ROWS } from "./extensions";
import { ResourceForm } from "./ResourceForm";
import { isStatusColumn } from "./ResourceList";

const SKIP = new Set(["id", "_label", "version"]);

function FieldValue({ row, field }: { row: Row; field: FieldMeta }) {
  if (field.type === "file") {
    const f = row[field.name] as StoredFileRef | null;
    if (!f) return <span className="muted">{t.none}</span>;
    return f.url ? <a href={f.inline_url ?? f.url} target="_blank" rel="noreferrer">{f.name}</a> : <span>{f.name}</span>;
  }
  const masked = Array.isArray(row._masked) && (row._masked as string[]).includes(field.name);
  if (masked) return <span className="muted">•••</span>;
  const text = displayValue(row, field.name, field.type, field.decimal_places);
  if (isStatusColumn(field.name) && text) return <Badge tone={statusTone(String(row[field.name]))}>{text}</Badge>;
  if (!text) return <span className="muted">{t.none}</span>;
  return field.type === "text" ? <span style={{ whiteSpace: "pre-wrap" }}>{text}</span> : <>{text}</>;
}

function History({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const q = useQuery({
    queryKey: ["history", meta.endpoint, row.id, row.version],
    queryFn: () => api.get<{ at: string; actor: string; action: string; changes: Record<string, unknown>; note: string }[]>(
      `${meta.endpoint}${row.id}/history/`),
  });
  if (q.isLoading) return <Spinner />;
  if (!q.data?.length) return <EmptyState />;
  return (
    <table className="table">
      <thead><tr><th>Време</th><th>Корисник</th><th>Акција</th><th>Промени</th></tr></thead>
      <tbody>
        {q.data.map((h, i) => (
          <tr key={i}>
            <td className="nowrap">{formatDateTime(h.at)}</td>
            <td>{h.actor}</td>
            <td>{h.action}{h.note ? <div className="small muted">{h.note}</div> : null}</td>
            <td className="small mono" style={{ whiteSpace: "pre-wrap" }}>
              {Object.entries(h.changes ?? {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface AttachmentRow {
  id: number;
  category: string;
  description: string;
  created_at: string;
  file?: StoredFileRef;
  uploaded_by?: string;
}

function Attachments({ meta, row, canEdit }: { meta: ResourceMeta; row: Row; canEdit: boolean }) {
  const path = `/records/${meta.model}/${row.id}/attachments/`;
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["attachments", path], queryFn: () => api.get<AttachmentRow[]>(path) });
  const [file, setFile] = useState<StoredFileRef | null>(null);
  const [description, setDescription] = useState("");
  const add = async () => {
    if (!file) return;
    try {
      await api.post(path, { file: file.id, description });
      setFile(null);
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["attachments", path] });
    } catch (err) {
      toast((err as Error).message, "danger");
    }
  };
  return (
    <div className="stack">
      {q.isLoading ? <Spinner /> : !q.data?.length ? <EmptyState /> : (
        <table className="table">
          <tbody>
            {q.data.map((a) => (
              <tr key={a.id}>
                <td>{a.file?.url ? <a href={a.file.inline_url ?? a.file.url} target="_blank" rel="noreferrer">{a.file.name}</a> : a.file?.name}</td>
                <td>{a.description}</td>
                <td className="small muted nowrap">{formatDateTime(a.created_at)} {a.uploaded_by}</td>
                {canEdit ? (
                  <td className="right">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      await api.del(`/attachments/${a.id}/`);
                      void qc.invalidateQueries({ queryKey: ["attachments", path] });
                    }}>{t.remove}</Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canEdit ? (
        <div className="row">
          <FileInput value={file} onChange={setFile} />
          <input className="input" style={{ maxWidth: 300 }} placeholder="Опис" value={description}
            onChange={(e) => setDescription(e.target.value)} />
          <Button size="sm" variant="primary" disabled={!file} onClick={add}>{t.upload}</Button>
        </div>
      ) : null}
    </div>
  );
}

function Comments({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const path = `/records/${meta.model}/${row.id}/comments/`;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["comments", path],
    queryFn: () => api.get<{ id: number; author: string; body: string; created_at: string }[]>(path),
  });
  const [body, setBody] = useState("");
  return (
    <div className="stack">
      {(q.data ?? []).map((c) => (
        <div key={c.id} className="card" style={{ padding: 10 }}>
          <div className="small muted">{c.author} · {formatDateTime(c.created_at)}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
        </div>
      ))}
      <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.comments} />
      <div>
        <Button size="sm" variant="primary" disabled={!body.trim()} onClick={async () => {
          await api.post(path, { body });
          setBody("");
          void qc.invalidateQueries({ queryKey: ["comments", path] });
        }}>{t.save}</Button>
      </div>
    </div>
  );
}

type Tab = "details" | "history" | "attachments" | "comments";

export function ResourceDetail({ meta, id, children }: { meta: ResourceMeta; id: string; children?: (row: Row) => React.ReactNode }) {
  const record = useRecord(meta.endpoint, id);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>("details");
  const navigate = useNavigate();
  const toast = useToast();
  const remove = useDelete(meta.endpoint);
  const invalidate = useInvalidateResource(meta.endpoint);
  const { confirm, dialog } = useConfirm();

  if (record.isLoading) return <Spinner />;
  if (record.error) return <Alert tone="danger">{(record.error as Error).message}</Alert>;
  const row = record.data!;
  const route = routeFor(meta.endpoint);
  const actions = meta.actions.filter((a) => a.detail && actionApplies(a, row));
  const fields = meta.fields.filter((f) => !SKIP.has(f.name) && f.type !== "rows" && !f.write_only && !f.hidden);
  const rowFields = meta.fields.filter((f) => f.type === "rows" && !(HANDLED_ROWS[meta.key] ?? []).includes(f.name));

  const onDelete = async () => {
    if (!(await confirm(t.confirmDelete, true))) return;
    try {
      await remove.mutateAsync({ id: row.id, version: row.version });
      toast(t.deleted);
      navigate(route);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    }
  };

  return (
    <div className="stack">
      {dialog}
      <div className="page-head">
        <Button variant="ghost" onClick={() => navigate(route)}>← {meta.title}</Button>
        <h1>{String(row._label ?? `#${row.id}`)}</h1>
        <span className="spacer" />
        {actions.map((a) => (
          <ActionButton key={a.name} meta={meta} action={a} row={row} onDone={invalidate} />
        ))}
        {meta.permissions.edit && !editing ? <Button onClick={() => setEditing(true)}>{t.edit}</Button> : null}
        {meta.permissions.delete ? <Button variant="danger" onClick={onDelete}>{t.delete}</Button> : null}
      </div>
      {editing ? (
        <div className="card">
          <ResourceForm meta={meta} row={row} onSaved={() => { setEditing(false); invalidate(); }}
            onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "details", label: t.details },
              { key: "history", label: t.history },
              { key: "attachments", label: t.attachments },
              { key: "comments", label: t.comments },
            ]}
          />
          {tab === "details" ? (
            <div className="stack">
              <div className="card">
                <dl className="dl">
                  {fields.map((f) => (
                    <div key={f.name}>
                      <dt>{f.label}</dt>
                      <dd><FieldValue row={row} field={f} /></dd>
                    </div>
                  ))}
                </dl>
              </div>
              {rowFields.map((f) => (
                <div key={f.name} className="card">
                  <h2>{f.label}</h2>
                  <RowsTable field={f} rows={(row[f.name] as Row[]) ?? []} />
                </div>
              ))}
              {children ? children(row) : null}
            </div>
          ) : null}
          {tab === "history" ? <div className="card flush"><History meta={meta} row={row} /></div> : null}
          {tab === "attachments" ? <div className="card"><Attachments meta={meta} row={row} canEdit={meta.permissions.edit} /></div> : null}
          {tab === "comments" ? <div className="card"><Comments meta={meta} row={row} /></div> : null}
        </>
      )}
    </div>
  );
}
