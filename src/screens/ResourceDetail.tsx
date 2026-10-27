/** A record: where it is in its flow, what can be done next, its fields grouped, child records as tabs, an
 * activity timeline (history and comments together) and attachments. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, FileText, History as HistoryIcon, MessageSquare, Paperclip, Pencil, Printer, Send, Trash2, X } from "lucide-react";

import { api, ApiError } from "@/api/client";
import type { ActionMeta, FieldMeta, ResourceMeta, Row } from "@/api/types";
import { usePrefs } from "@/app/prefs";
import { useSession } from "@/auth/session";
import { DropZone, type StoredFileRef } from "@/components/inputs";
import { RowsTable } from "@/components/rows";
import {
  Badge, Button, EmptyState, ErrorState, IconButton, Menu, PageHeader, Panel, Skeleton, SkeletonPanel, statusTone, Tabs,
  useConfirm, useToast, type MenuEntry,
} from "@/components/ui";
import { t } from "@/i18n/mk";
import { useDocumentTitle } from "@/layout/Page";
import { displayValue, formatDate, formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { routeFor, useDelete, useInvalidateResource, useRecord } from "@/meta/hooks";

import { ActionButton, actionApplies, actionKind } from "./actions";
import { CHILDREN, ChildTable, CUSTOM, HANDLED_ROWS, PANELS_FIRST } from "./extensions";
import { ResourceForm } from "./ResourceForm";
import { isStatusColumn } from "./ResourceList";

const SKIP = new Set(["id", "_label", "version"]);
const AUDIT = new Set(["created_at", "updated_at", "created_by", "updated_by"]);
/** Off-path states: shown in the stepper only when the record is in one. */
const NEGATIVE = /(REJECT|CANCEL|VOID|DISPUT|BLOCK|FAIL|LOST|EXPIRED|RETURNED|TERMINATED|BLACKLIST|PASSIVE|INACTIVE|DISPOS|SCRAP|WRITTEN_OFF|ON_HOLD|SUSPEND|EXCEPTION|QUALITY_ISSUE)/;

function FieldValue({ row, field }: { row: Row; field: FieldMeta }) {
  if (field.type === "file") {
    const f = row[field.name] as StoredFileRef | null;
    if (!f) return <span className="muted-cell">{t.none}</span>;
    return f.url ? <a href={f.inline_url ?? f.url} target="_blank" rel="noreferrer" className="file-ref"><FileText aria-hidden />{f.name}</a> : <span>{f.name}</span>;
  }
  const masked = Array.isArray(row._masked) && (row._masked as string[]).includes(field.name);
  if (masked) return <span className="muted">•••</span>;
  const text = displayValue(row, field.name, field.type, field.decimal_places);
  if (isStatusColumn(field.name) && text) return <Badge tone={statusTone(String(row[field.name]))}>{text}</Badge>;
  if (field.type === "boolean") return row[field.name] ? <span className="row-tight"><Check aria-hidden style={{ width: 16, color: "var(--success)" }} />{t.yes}</span> : <span className="muted">{t.no}</span>;
  if (!text) return <span className="muted-cell">{t.none}</span>;
  if (field.type === "url") return <a href={text} target="_blank" rel="noreferrer">{text}</a>;
  if (field.type === "email") return <a href={`mailto:${text}`}>{text}</a>;
  return field.type === "text" ? <span className="pre">{text}</span> : <>{text}</>;
}

// ── workflow stepper ─────────────────────────────────────────────────────────

function statusField(meta: ResourceMeta): FieldMeta | undefined {
  return meta.fields.find((f) => f.name === "status" && f.choices?.length) ?? meta.fields.find((f) => isStatusColumn(f.name) && f.choices?.length);
}

function Stepper({ field, value }: { field: FieldMeta; value: string }) {
  const choices = field.choices ?? [];
  const off = NEGATIVE.test(value.toUpperCase());
  const main = choices.filter((c) => !NEGATIVE.test(String(c.value).toUpperCase()));
  if (main.length < 2 || main.length > 10) return null;
  const idx = main.findIndex((c) => String(c.value) === value);
  return (
    <div className="stepper" aria-label={`${field.label}: ${choices.find((c) => String(c.value) === value)?.label ?? value}`}>
      {main.map((c, i) => {
        const state = off ? (i <= idx ? "done" : "") : i < idx ? "done" : i === idx ? "current" : "";
        return (
          <span key={String(c.value)} className="row-tight" style={{ gap: 0 }}>
            {i > 0 ? <span className={`step-line${state === "done" || state === "current" ? " done" : ""}`} aria-hidden /> : null}
            <span className={`step ${state}`} aria-current={state === "current" ? "step" : undefined}>
              <span className="dot">{state === "done" ? <Check aria-hidden /> : null}</span>{c.label}
            </span>
          </span>
        );
      })}
      {off ? (
        <span className="row-tight" style={{ gap: 0 }}>
          <span className="step-line" aria-hidden />
          <span className="step off" aria-current="step"><span className="dot"><X aria-hidden /></span>{choices.find((c) => String(c.value) === value)?.label ?? value}</span>
        </span>
      ) : null}
    </div>
  );
}

// ── activity: history + comments ────────────────────────────────────────────

interface HistoryEntry { at: string; actor: string; action: string; changes: Record<string, unknown>; note: string }
interface CommentEntry { id: number; author: string; body: string; created_at: string }

const ACTION_LABEL: Record<string, string> = {
  create: "креираше", created: "креираше", update: "измени", updated: "измени", delete: "избриша", deleted: "избриша",
  transition: "ја смени состојбата", status: "ја смени состојбата",
};

function changeText(meta: ResourceMeta, name: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const f = meta.fields.find((x) => x.name === name);
  if (f?.choices) return f.choices.find((c) => String(c.value) === String(v))?.label ?? String(v);
  if (typeof v === "boolean") return v ? t.yes : t.no;
  if (f?.type === "date") return formatDate(v);
  if (f?.type === "datetime") return formatDateTime(v);
  if (f?.type === "decimal") return formatMoney(v);
  if (f?.type === "fk") return `#${v}`;
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

function Activity({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const qc = useQueryClient();
  const toast = useToast();
  const commentsPath = `/records/${meta.model}/${row.id}/comments/`;
  const history = useQuery({
    queryKey: ["history", meta.endpoint, row.id, row.version],
    queryFn: () => api.get<HistoryEntry[]>(`${meta.endpoint}${row.id}/history/`),
  });
  const comments = useQuery({ queryKey: ["comments", commentsPath], queryFn: () => api.get<CommentEntry[]>(commentsPath) });
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const post = async () => {
    if (!body.trim()) return;
    setPosting(true);
    try {
      await api.post(commentsPath, { body: body.trim() });
      setBody("");
      void qc.invalidateQueries({ queryKey: ["comments", commentsPath] });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    } finally {
      setPosting(false);
    }
  };
  type Item = { at: string; kind: "history"; h: HistoryEntry } | { at: string; kind: "comment"; c: CommentEntry };
  const items: Item[] = [
    ...(history.data ?? []).map((h) => ({ at: h.at, kind: "history" as const, h })),
    ...(comments.data ?? []).map((c) => ({ at: c.created_at, kind: "comment" as const, c })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
  const labelOf = (name: string) => meta.fields.find((f) => f.name === name)?.label ?? name.replace(/_/g, " ");
  return (
    <div className="stack">
      <div className="stack-sm">
        <label htmlFor="comment-body" className="sr-only">{t.comments}</label>
        <textarea id="comment-body" className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Напишете коментар…"
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void post(); }} style={{ minHeight: 72 }} />
        <div className="row-tight" style={{ justifyContent: "flex-end" }}>
          <span className="xs muted">Ctrl + Enter</span>
          <Button size="sm" variant="primary" icon={Send} busy={posting} disabled={!body.trim()} onClick={() => void post()}>Објави коментар</Button>
        </div>
      </div>
      {history.isLoading || comments.isLoading ? <Skeleton height={80} /> : !items.length ? <EmptyState compact icon={HistoryIcon} title="Сè уште нема активност" /> : (
        <ol className="timeline">
          {items.map((it, i) => it.kind === "comment" ? (
            <li key={`c${it.c.id}`}>
              <span className="t-icon comment"><MessageSquare aria-hidden /></span>
              <div className="t-head"><strong>{it.c.author}</strong> коментираше · <time dateTime={it.at} title={formatDateTime(it.at)}>{formatRelative(it.at)}</time></div>
              <div className="t-body t-comment">{it.c.body}</div>
            </li>
          ) : (
            <li key={`h${i}`}>
              <span className="t-icon"><HistoryIcon aria-hidden /></span>
              <div className="t-head">
                <strong>{it.h.actor || "Систем"}</strong> {ACTION_LABEL[it.h.action?.toLowerCase()] ?? it.h.action} · <time dateTime={it.at} title={formatDateTime(it.at)}>{formatRelative(it.at)}</time>
              </div>
              {it.h.note ? <div className="t-body small">{it.h.note}</div> : null}
              {Object.keys(it.h.changes ?? {}).length && !/^create/i.test(it.h.action) ? (
                <ul className="change-list">
                  {Object.entries(it.h.changes).slice(0, 12).map(([k, v]) => {
                    const [from, to] = Array.isArray(v) && v.length === 2 ? v : [undefined, v];
                    return (
                      <li key={k}><span className="muted">{labelOf(k)}:</span>{" "}
                        {from !== undefined ? <><span className="from">{changeText(meta, k, from)}</span> → </> : null}
                        <span className="to">{changeText(meta, k, to)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── attachments ──────────────────────────────────────────────────────────────

interface AttachmentRow { id: number; category: string; description: string; created_at: string; file?: StoredFileRef; uploaded_by?: string }

function useAttachments(meta: ResourceMeta, row: Row) {
  const path = `/records/${meta.model}/${row.id}/attachments/`;
  return { path, q: useQuery({ queryKey: ["attachments", path], queryFn: () => api.get<AttachmentRow[]>(path) }) };
}

function Attachments({ meta, row, canEdit }: { meta: ResourceMeta; row: Row; canEdit: boolean }) {
  const { path, q } = useAttachments(meta, row);
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["attachments", path] });
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const stored = await api.post<StoredFileRef>("/files/", form);
      await api.post(path, { file: stored.id, description });
      setDescription("");
      toast(`Прикачено: ${f.name}`, "success");
      refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (a: AttachmentRow) => {
    const ok = await confirm({ title: "Отстрани прилог", text: `„${a.file?.name ?? a.description}“ ќе биде отстранет од записот.`, confirmLabel: "Отстрани прилог", danger: true });
    if (!ok) return;
    try {
      await api.del(`/attachments/${a.id}/`);
      toast("Прилогот е отстранет", "success");
      refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    }
  };
  return (
    <div className="stack">
      {dialog}
      {canEdit ? (
        <div className="stack-sm">
          <DropZone onFile={(f) => void upload(f)} busy={busy} />
          <input className="input" placeholder="Опис на прилогот (незадолжително)" aria-label="Опис на прилогот" value={description}
            onChange={(e) => setDescription(e.target.value)} />
        </div>
      ) : null}
      {q.isLoading ? <Skeleton height={60} /> : q.error ? <ErrorState error={q.error} compact /> : !q.data?.length ? <EmptyState compact icon={Paperclip} title="Нема прилози" /> : (
        <div className="table-wrap" style={{ border: "1px solid var(--rule)", borderRadius: "var(--r)" }}>
          <table className="table">
            <tbody>
              {q.data.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="file-ref"><FileText aria-hidden />
                      {a.file?.url ? <a href={a.file.inline_url ?? a.file.url} target="_blank" rel="noreferrer">{a.file.name}</a> : a.file?.name}
                    </span>
                    {a.description ? <div className="small muted">{a.description}</div> : null}
                  </td>
                  <td className="small muted nowrap">{formatRelative(a.created_at)}{a.uploaded_by ? ` · ${a.uploaded_by}` : ""}</td>
                  {canEdit ? <td className="right" style={{ width: 44 }}><IconButton label={`${t.remove}: ${a.file?.name ?? ""}`} icon={Trash2} size="sm" onClick={() => void remove(a)} /></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── fields, grouped ──────────────────────────────────────────────────────────

function groupFields(fields: FieldMeta[]) {
  const main = fields.filter((f) => !["text", "json"].includes(f.type) && !AUDIT.has(f.name) && f.type !== "decimal");
  const amounts = fields.filter((f) => f.type === "decimal");
  const notes = fields.filter((f) => ["text", "json"].includes(f.type));
  return { main, amounts, notes };
}

function FieldsPanel({ meta, row, fields }: { meta: ResourceMeta; row: Row; fields: FieldMeta[] }) {
  const { main, amounts, notes } = groupFields(fields);
  return (
    <div className="stack">
      <Panel title={t.details}>
        <dl className="dl">
          {main.map((f) => <div key={f.name}><dt>{f.label}</dt><dd><FieldValue row={row} field={f} /></dd></div>)}
        </dl>
      </Panel>
      {amounts.length ? (
        <Panel title="Износи">
          <dl className="dl">
            {amounts.map((f) => <div key={f.name}><dt>{f.label}</dt><dd className="num" style={{ fontWeight: 500 }}><FieldValue row={row} field={f} /></dd></div>)}
          </dl>
        </Panel>
      ) : null}
      {notes.filter((f) => displayValue(row, f.name, f.type)).length ? (
        <Panel title="Опис и белешки">
          <dl className="dl">
            {notes.filter((f) => displayValue(row, f.name, f.type)).map((f) => <div key={f.name} className="wide"><dt>{f.label}</dt><dd><FieldValue row={row} field={f} /></dd></div>)}
          </dl>
        </Panel>
      ) : null}
      {meta.fields.filter((f) => f.type === "rows" && !(HANDLED_ROWS[meta.key] ?? []).includes(f.name)).map((f) => (
        <Panel key={f.name} title={f.label} flush><RowsTable field={f} rows={(row[f.name] as Row[]) ?? []} /></Panel>
      ))}
    </div>
  );
}

function SideFacts({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const facts: [string, ReactNode][] = [];
  const by = (k: string) => (row[`${k}_label`] ?? row[k]) as string | undefined;
  if (row.created_at) facts.push([t.createdAt, <span title={formatDateTime(row.created_at)}>{formatRelative(row.created_at)}{by("created_by") ? ` · ${by("created_by")}` : ""}</span>]);
  if (row.updated_at) facts.push([t.updatedAt, <span title={formatDateTime(row.updated_at)}>{formatRelative(row.updated_at)}{by("updated_by") ? ` · ${by("updated_by")}` : ""}</span>]);
  if (row.version !== undefined) facts.push([t.version, row.version]);
  facts.push(["Број во системот", `#${row.id}`]);
  return (
    <Panel title="Запис">
      <dl className="fact-list">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <p className="xs muted" style={{ marginTop: 8 }}>{meta.title_singular}</p>
    </Panel>
  );
}

// ── the screen ───────────────────────────────────────────────────────────────

type TabKey = string;

export function ResourceDetail({ meta, id, variant = "page" }: { meta: ResourceMeta; id: string; variant?: "page" | "drawer" }) {
  const record = useRecord(meta.endpoint, id);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabKey>("details");
  const navigate = useNavigate();
  const toast = useToast();
  const remove = useDelete(meta.endpoint);
  const invalidate = useInvalidateResource(meta.endpoint);
  const { confirm, dialog } = useConfirm();
  const { pushRecent } = usePrefs();
  const { can } = useSession();
  const row = record.data;
  const route = routeFor(meta.endpoint);
  const title = row ? String(row._label ?? `#${row.id}`) : "";
  const page = variant === "page";
  useDocumentTitle(page ? (title || meta.title_singular) : undefined, page ? title : undefined);

  useEffect(() => {
    if (row && page) pushRecent({ route: `${route}/${row.id}`, title, kind: meta.title_singular || meta.title });
  }, [row?.id, title]); // eslint-disable-line react-hooks/exhaustive-deps

  const childSpecs = useMemo(() => CHILDREN[meta.key] ?? [], [meta.key]);
  const attachments = useQuery({
    queryKey: ["attachments", `/records/${meta.model}/${id}/attachments/`],
    queryFn: () => api.get<AttachmentRow[]>(`/records/${meta.model}/${id}/attachments/`),
    enabled: page && Boolean(row),
  });

  if (record.isLoading) return <div className="stack"><Skeleton width="40%" height={28} /><SkeletonPanel height={260} /></div>;
  if (record.error || !row) return <ErrorState error={record.error} onRetry={() => void record.refetch()} />;

  const actions = meta.actions.filter((a) => a.detail && actionApplies(a, row));
  const transitions = actions.filter((a) => actionKind(a) === "action");
  const reports = actions.filter((a) => actionKind(a) !== "action");
  const primary: ActionMeta | undefined = transitions.find((a) => a.variant === "primary" && !a.danger) ?? transitions.find((a) => !a.danger);
  const others = transitions.filter((a) => a !== primary);
  const fields = meta.fields.filter((f) => !SKIP.has(f.name) && f.type !== "rows" && !f.write_only && !f.hidden);
  const sField = statusField(meta);
  const sValue = sField ? String(row[sField.name] ?? "") : "";
  const sLabel = sField ? displayValue(row, sField.name, sField.type) : "";
  const Custom = CUSTOM[meta.key];
  const panelsFirst = PANELS_FIRST.has(meta.key);

  const onDelete = async () => {
    const ok = await confirm({ title: `${t.delete}: ${title}`, text: t.confirmDelete, confirmLabel: t.deleteRecord, danger: true });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: row.id, version: row.version });
      toast(`${title}: ${t.deleted.toLowerCase()}`, "success");
      navigate(route);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    }
  };

  const menuItems: MenuEntry[] = [
    ...others.map((a) => ({ label: a.label, danger: a.danger, onSelect: () => document.getElementById(`dact-${a.name}`)?.click() })),
    ...reports.map((a) => ({ label: a.label, icon: actionKind(a) === "download" ? Printer : FileText, separatorBefore: false,
      onSelect: () => document.getElementById(`dact-${a.name}`)?.click() })),
    ...(meta.permissions.delete ? [{ label: t.deleteRecord, icon: Trash2, danger: true, separatorBefore: others.length + reports.length > 0, onSelect: () => void onDelete() }] : []),
  ];

  const actionBar = (
    <>
      {primary && !editing ? <ActionButton meta={meta} action={primary} row={row} onDone={invalidate} size="md" variant="primary" /> : null}
      {meta.permissions.edit && !editing ? <Button icon={Pencil} onClick={() => { setEditing(true); setTab("details"); }}>{t.edit}</Button> : null}
      {!editing ? <Menu label={t.moreActions} items={menuItems} /> : null}
      <div style={{ display: "none" }}>
        {[...others, ...reports].map((a) => <ActionButton key={a.name} meta={meta} action={a} row={row} onDone={invalidate} domId={`dact-${a.name}`} />)}
      </div>
    </>
  );

  if (variant === "drawer") {
    return (
      <div className="stack">
        {dialog}
        <div className="row">{sLabel ? <Badge tone={statusTone(sValue)}>{sLabel}</Badge> : null}<span className="spacer" />{actionBar}</div>
        {sField ? <Stepper field={sField} value={sValue} /> : null}
        {editing ? (
          <Panel><ResourceForm meta={meta} row={row} compact onSaved={() => { setEditing(false); invalidate(); }} onCancel={() => setEditing(false)} /></Panel>
        ) : (
          <>
            {Custom && panelsFirst ? <Custom meta={meta} row={row} /> : null}
            <FieldsPanel meta={meta} row={row} fields={fields} />
          </>
        )}
      </div>
    );
  }

  const tabs = [
    { key: "details", label: t.details },
    ...childSpecs.map((s) => ({ key: `child:${s.path}`, label: s.label })),
    { key: "activity", label: t.activity },
    { key: "attachments", label: t.attachments, count: attachments.data?.length || undefined },
  ];

  return (
    <div className="stack">
      {dialog}
      <PageHeader
        back={{ to: route, label: meta.title }}
        title={title}
        status={sLabel ? <Badge tone={statusTone(sValue)}>{sLabel}</Badge> : null}
        subtitle={meta.title_singular}
        actions={actionBar}
      >
        {sField && !editing ? <div style={{ marginTop: 10 }}><Stepper field={sField} value={sValue} /></div> : null}
      </PageHeader>
      {editing ? (
        <Panel title={`${t.edit}: ${title}`}>
          <ResourceForm meta={meta} row={row} onSaved={() => { setEditing(false); invalidate(); }}
            onCancel={() => { setEditing(false); void record.refetch(); }} />
        </Panel>
      ) : (
        <>
          <Tabs<TabKey> value={tab} onChange={setTab} tabs={tabs} label={title} />
          {tab === "details" ? (
            <div className="detail-grid">
              <div className="stack">
                {Custom && panelsFirst ? <Custom meta={meta} row={row} /> : null}
                <FieldsPanel meta={meta} row={row} fields={fields} />
                {Custom && !panelsFirst ? <Custom meta={meta} row={row} /> : null}
              </div>
              <div className="detail-side">
                <SideFacts meta={meta} row={row} />
                {childSpecs.length ? (
                  <Panel title="Поврзани записи">
                    <div className="stack-sm">
                      {childSpecs.map((s) => (
                        <button key={s.path} type="button" className="btn ghost" style={{ justifyContent: "space-between" }} onClick={() => setTab(`child:${s.path}`)}>
                          {s.label}<ChevronRight aria-hidden />
                        </button>
                      ))}
                    </div>
                  </Panel>
                ) : null}
              </div>
            </div>
          ) : null}
          {tab.startsWith("child:") ? (
            <ChildTable spec={childSpecs.find((s) => `child:${s.path}` === tab)!} parent={row} />
          ) : null}
          {tab === "activity" ? <Panel><Activity meta={meta} row={row} /></Panel> : null}
          {tab === "attachments" ? <Panel><Attachments meta={meta} row={row} canEdit={meta.permissions.edit || can("*")} /></Panel> : null}
        </>
      )}
    </div>
  );
}
