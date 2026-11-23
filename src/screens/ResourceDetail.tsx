/** The record page type (branding_rules/04 §3 "Record"): page head (status chip, Уреди, ⋯, the one main action
 * for the current step), the record toolkit (previous / next in the list), then two independent columns: wide =
 * facts, the record's sections, related records, comments and history; narrow = next steps (stepper and the
 * other actions), documents and the record's own facts. Delete is the last item of ⋯, after a divider. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/api/client";
import type { ActionMeta, FieldMeta, ResourceMeta, Row } from "@/api/types";
import { usePrefs } from "@/app/prefs";
import { useSession } from "@/auth/session";
import {
  Check, ChevronLeft, ChevronRight, Copy, FileText, History as HistoryIcon, MessageSquare, Paperclip, Pencil, Printer, Send, Trash2, X,
} from "@/components/icons";
import { DropZone, type StoredFileRef } from "@/components/inputs";
import { RowsTable } from "@/components/rows";
import {
  Badge, Button, EmptyState, ErrorState, IconButton, LinkButton, Menu, PageHeader, Panel, Skeleton, SkeletonPanel, statusTone, Tabs,
  useConfirm, useToast, type MenuEntry,
} from "@/components/ui";
import { t } from "@/i18n/mk";
import { useDocumentTitle } from "@/layout/Page";
import { displayValue, formatDate, formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { routeFor, useDelete, useInvalidateResource, useRecord } from "@/meta/hooks";

import { ActionButton, actionApplies, actionKind } from "./actions";
import { CHILDREN, ChildTable, CUSTOM, HANDLED_ROWS, PANELS_FIRST } from "./extensions";
import { isStatusColumn } from "./ResourceList";

const SKIP = new Set(["id", "_label", "version"]);
const AUDIT = new Set(["created_at", "updated_at", "created_by", "updated_by"]);
/** Off-path states: shown in the stepper only when the record is in one. */
const NEGATIVE = /(REJECT|CANCEL|VOID|DISPUT|BLOCK|FAIL|LOST|EXPIRED|RETURNED|TERMINATED|BLACKLIST|PASSIVE|INACTIVE|DISPOS|SCRAP|WRITTEN_OFF|ON_HOLD|SUSPEND|EXCEPTION|QUALITY_ISSUE)/;

function FieldValue({ row, field }: { row: Row; field: FieldMeta }) {
  if (field.type === "file") {
    const f = row[field.name] as StoredFileRef | null;
    if (!f) return <span className="muted-cell">{t.none}</span>;
    return f.url ? <a href={f.inline_url ?? f.url} target="_blank" rel="noreferrer" className="file-ref"><FileText />{f.name}</a> : <span>{f.name}</span>;
  }
  const masked = Array.isArray(row._masked) && (row._masked as string[]).includes(field.name);
  if (masked) return <span className="muted">•••</span>;
  const text = displayValue(row, field.name, field.type, field.decimal_places);
  if (isStatusColumn(field.name) && text) return <Badge tone={statusTone(String(row[field.name]))}>{text}</Badge>;
  if (field.type === "boolean") return row[field.name] ? <span>{t.yes}</span> : <span className="muted">{t.no}</span>;
  if (!text) return <span className="muted-cell">{t.none}</span>;
  if (field.type === "fk" && field.related?.endpoint && row[field.name]) {
    return <Link to={`${routeFor(field.related.endpoint)}/${String(row[field.name])}`}>{text}</Link>;
  }
  if (field.type === "decimal" && String(row[field.name]).startsWith("-")) return <span className="neg num">{text}</span>;
  if (field.type === "url") return <a href={text} target="_blank" rel="noreferrer">{text}</a>;
  if (field.type === "email") return <a href={`mailto:${text}`}>{text}</a>;
  return field.type === "text" ? <span className="pre">{text}</span> : <>{text}</>;
}

// ── stepper: done ✓ green, current ink ring, waiting grey ring, rejected × red ──

function statusField(meta: ResourceMeta): FieldMeta | undefined {
  return meta.fields.find((f) => f.name === "status" && f.choices?.length) ?? meta.fields.find((f) => isStatusColumn(f.name) && f.choices?.length);
}

function Stepper({ field, value }: { field: FieldMeta; value: string }) {
  const choices = field.choices ?? [];
  const off = NEGATIVE.test(value.toUpperCase());
  const main = choices.filter((c) => !NEGATIVE.test(String(c.value).toUpperCase()));
  if (main.length < 2 || main.length > 7) return null;
  const idx = main.findIndex((c) => String(c.value) === value);
  const label = choices.find((c) => String(c.value) === value)?.label ?? value;
  return (
    <ol className="stepper" aria-label={`${field.label}: ${label}`}>
      {main.map((c, i) => {
        const state = off ? (i <= idx ? "done" : "") : i < idx ? "done" : i === idx ? "current" : "";
        return (
          <li key={String(c.value)} className={`step ${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="mark">{state === "done" ? <Check /> : null}</span>{c.label}
          </li>
        );
      })}
      {off ? <li className="step off" aria-current="step"><span className="mark"><X /></span>{label}</li> : null}
    </ol>
  );
}

// ── comments and history ─────────────────────────────────────────────────────

interface HistoryEntry { at: string; actor: string; action: string; changes: Record<string, unknown>; note: string }
interface CommentEntry { id: number; author: string; body: string; created_at: string }

const ACTION_LABEL: Record<string, string> = {
  create: "креираше", created: "креираше", update: "измени", updated: "измени", delete: "избриша", deleted: "избриша",
  transition: "ја смени состојбата", status: "ја смени состојбата", status_change: "ја смени состојбата",
  submit: "поднесе", submitted: "поднесе", approved: "одобри", rejected: "одби", returned: "врати", cancelled: "откажа",
  sent: "испрати", converted: "конвертира", archived: "архивира", imported: "увезе", duplicated: "дуплира", closed: "затвори",
  noted: "забележа", block: "блокира", blacklist: "стави на црна листа", deactivate: "деактивира", activate: "активира",
  selected: "избра", evaluated: "оцени", bank_verify: "ја потврди банкарската сметка", gate_grace: "користеше преоден период",
};
/** Workflow codes (APPROVAL_APPROVED, RFQ_SENT …) read word by word; an unknown code reads neutrally, never raw. */
const ACTION_WORDS: Record<string, string> = {
  approval: "одобрување", approved: "одобрено", rejected: "одбиено", returned: "вратено", changes: "измени", requested: "побарано",
  finance: "финансии", final: "конечно", pm: "раководител", rfq: "барање за понуди", po: "нарачка", issued: "издадена",
  sent: "испратено", created: "креирано", offer: "понуда", offers: "понуди", received: "примено", invoice: "фактура",
  receipt: "приемница", corrected: "корегирано", stock: "залиха", checked: "проверена", supplier: "добавувач",
  confirmed: "потврдено", quality: "квалитет", issue: "проблем", duplicate: "дупликат", override: "потврден", to: "до",
};
function actionText(action: string | undefined): string {
  const code = (action ?? "").toLowerCase();
  if (!code) return "направи промена";
  if (ACTION_LABEL[code]) return ACTION_LABEL[code];
  const words = code.split("_").map((w) => ACTION_WORDS[w]);
  return words.every(Boolean) ? `евидентираше: ${words.join(" ")}` : "направи промена";
}

/** Audit changes as [field, [from, to]] pairs. Workflow logs wrap them as {old, new, entity_name}: the record's own
 * fields are diffed; a child record's event (an approval, a bank account) is told by the action line alone. */
/** Only the record's own labelled fields: a related list or an internal key would read as a raw English code. */
function changeEntries(meta: ResourceMeta, changes: Record<string, unknown> | null | undefined): [string, unknown][] {
  return rawChangeEntries(meta, changes).filter(([k]) => meta.fields.some((f) => f.name === k));
}

function rawChangeEntries(meta: ResourceMeta, changes: Record<string, unknown> | null | undefined): [string, unknown][] {
  if (!changes) return [];
  const { old: before, new: after, entity_name: entityName } = changes as { old?: unknown; new?: unknown; entity_name?: unknown };
  if ((before !== undefined || after !== undefined) && (typeof before === "object" || typeof after === "object")) {
    const own = !entityName || String(entityName).toLowerCase() === meta.model.split(".").pop();
    if (!own) return [];
    const o = (before ?? {}) as Record<string, unknown>;
    const n = (after ?? {}) as Record<string, unknown>;
    return [...new Set([...Object.keys(o), ...Object.keys(n)])]
      .filter((k) => !/(^id$|_id$|_at$|_by$)/.test(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
      .map((k) => [k, [o[k], n[k]]]);
  }
  return Object.entries(changes).filter(([k]) => !k.startsWith("entity_"));
}

function changeText(meta: ResourceMeta, name: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const f = meta.fields.find((x) => x.name === name);
  if (f?.choices) return f.choices.find((c) => String(c.value) === String(v))?.label ?? String(v);
  if (typeof v === "boolean") return v ? t.yes : t.no;
  if (f?.type === "date") return formatDate(v);
  if (f?.type === "datetime") return formatDateTime(v);
  if (f?.type === "decimal") return formatMoney(v);
  if (f?.type === "fk") return `#${v}`;
  if (Array.isArray(v)) return v.length === 1 ? "1 ставка" : `${v.length} ставки`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const name = o.label ?? o.name ?? o.title ?? o.number;
    return name != null ? String(name) : "изменето";
  }
  const s = String(v);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

function When({ at }: { at: string }) {
  return <time dateTime={at} title={formatDateTime(at)}>{formatRelative(at)}</time>;
}

function Activity({ meta, row }: { meta: ResourceMeta; row: Row }) {
  const qc = useQueryClient();
  const toast = useToast();
  const commentsPath = `/records/${meta.model}/${row.id}/comments/`;
  const history = useQuery({ queryKey: ["history", meta.endpoint, row.id, row.version], queryFn: () => api.get<HistoryEntry[]>(`${meta.endpoint}${row.id}/history/`) });
  const comments = useQuery({ queryKey: ["comments", commentsPath], queryFn: () => api.get<CommentEntry[]>(commentsPath) });
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const post = async () => {
    if (!body.trim()) return;
    setPosting(true);
    try {
      await api.post(commentsPath, { body: body.trim() });
      setBody("");
      toast("Коментарот е објавен.", "success");
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
    <Panel title="Коментари и историја" sub={items.length ? String(items.length) : undefined}>
      <div className="comment-box">
        <label htmlFor="comment-body" className="sr-only">{t.comments}</label>
        <textarea id="comment-body" className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Напишете коментар…"
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void post(); }} />
        <div className="row-end">
          <Button size="sm" icon={Send} busy={posting} disabled={!body.trim()} onClick={() => void post()}>Објави</Button>
        </div>
      </div>
      {history.isLoading || comments.isLoading ? <Skeleton height={80} /> : !items.length ? <EmptyState compact icon={HistoryIcon} title="Сè уште нема активност." /> : (
        <ol className="timeline">
          {items.slice(0, 40).map((it, i) => it.kind === "comment" ? (
            <li key={`c${it.c.id}`}>
              <span className="t-icon"><MessageSquare /></span>
              <div>
                <div className="t-head"><strong>{it.c.author}</strong> · <When at={it.at} /></div>
                <div className="t-body t-comment">{it.c.body}</div>
              </div>
            </li>
          ) : (
            <li key={`h${i}`}>
              <span className="t-icon"><HistoryIcon /></span>
              <div>
                <div className="t-head"><strong>{it.h.actor || "Систем"}</strong> {actionText(it.h.action)} · <When at={it.at} /></div>
                {it.h.note ? <div className="t-body">{it.h.note}</div> : null}
                {changeEntries(meta, it.h.changes).length && !/^create/i.test(it.h.action) ? (
                  <ul className="change-list">
                    {changeEntries(meta, it.h.changes).slice(0, 12).map(([k, v]) => {
                      const [from, to] = Array.isArray(v) && v.length === 2 ? v : [undefined, v];
                      return (
                        <li key={k}>{labelOf(k)}:{" "}
                          {from !== undefined ? <><span className="from">{changeText(meta, k, from)}</span> → </> : null}
                          <span className="to">{changeText(meta, k, to)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

// ── documents ────────────────────────────────────────────────────────────────

interface AttachmentRow { id: number; category: string; description: string; created_at: string; file?: StoredFileRef; uploaded_by?: string }

function Documents({ meta, row, canEdit }: { meta: ResourceMeta; row: Row; canEdit: boolean }) {
  const path = `/records/${meta.model}/${row.id}/attachments/`;
  const q = useQuery({ queryKey: ["attachments", path], queryFn: () => api.get<AttachmentRow[]>(path) });
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["attachments", path] });
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const stored = await api.post<StoredFileRef>("/files/", form);
      await api.post(path, { file: stored.id, description: "" });
      toast("Документот е прикачен.", "success", { description: f.name });
      refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (a: AttachmentRow) => {
    const name = a.file?.name ?? a.description;
    const ok = await confirm({ title: `Да се отстрани „${name}“?`, text: "Документот ќе биде отстранет од записот.", confirmLabel: "Отстрани документ", danger: true });
    if (!ok) return;
    try {
      await api.del(`/attachments/${a.id}/`);
      toast("Документот е отстранет.", "success");
      refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    }
  };
  return (
    <Panel title={t.documents} sub={q.data?.length ? String(q.data.length) : undefined}>
      <div className="stack-sm">
        {dialog}
        {q.isLoading ? <Skeleton height={40} /> : q.error ? <ErrorState error={q.error} compact /> : q.data?.length ? (
          <ul className="stack-sm">
            {q.data.map((a) => (
              <li key={a.id} className="row-tight">
                <span className="file-ref grow"><Paperclip />
                  <span className="grow">
                    {a.file?.url ? <a href={a.file.inline_url ?? a.file.url} target="_blank" rel="noreferrer" className="truncate block">{a.file.name}</a> : a.file?.name}
                    <span className="xs muted"><When at={a.created_at} />{a.uploaded_by ? ` · ${a.uploaded_by}` : ""}</span>
                  </span>
                </span>
                {canEdit ? <IconButton label={`${t.remove}: ${a.file?.name ?? ""}`} icon={Trash2} size="sm" onClick={() => void remove(a)} /> : null}
              </li>
            ))}
          </ul>
        ) : <p className="muted">Нема документи.</p>}
        {canEdit ? <DropZone onFile={(f) => void upload(f)} busy={busy} /> : null}
      </div>
    </Panel>
  );
}

// ── the record's previous / next in its list ─────────────────────────────────

function Toolkit({ meta, id }: { meta: ResourceMeta; id: number }) {
  const route = routeFor(meta.endpoint);
  const ctx = useMemo(() => {
    try { return JSON.parse(window.sessionStorage.getItem(`eacore.list.${meta.key}`) ?? "null") as { ids: number[]; title: string; search: string } | null; }
    catch { return null; }
  }, [meta.key]);
  const i = ctx?.ids.indexOf(id) ?? -1;
  if (!ctx || i < 0) return null;
  const prev = ctx.ids[i - 1], next = ctx.ids[i + 1];
  return (
    <nav className="record-toolkit" aria-label="Записи во листата">
      {prev ? <LinkButton size="sm" variant="ghost" icon={ChevronLeft} to={`${route}/${prev}`}>{t.previous}</LinkButton> : <Button size="sm" variant="ghost" icon={ChevronLeft} disabled>{t.previous}</Button>}
      <span className="num">{i + 1} {t.of} {ctx.ids.length} {t.inList} <Link to={`${route}${ctx.search}`}>„{ctx.title}“</Link></span>
      {next ? <LinkButton size="sm" variant="ghost" to={`${route}/${next}`}>{t.next}<ChevronRight /></LinkButton> : <Button size="sm" variant="ghost" disabled>{t.next}<ChevronRight /></Button>}
    </nav>
  );
}

// ── the page ─────────────────────────────────────────────────────────────────

export function ResourceDetail({ meta, id }: { meta: ResourceMeta; id: string; variant?: "page" | "drawer" }) {
  const record = useRecord(meta.endpoint, id);
  const [related, setRelated] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const remove = useDelete(meta.endpoint);
  const invalidate = useInvalidateResource(meta.endpoint);
  const { confirm, dialog } = useConfirm();
  const { pushRecent } = usePrefs();
  const { can } = useSession();
  const row = record.data;
  const route = routeFor(meta.endpoint);
  const title = row ? String(row._label ?? `#${row.id}`) : "";
  useDocumentTitle(title ? `${title} — ${meta.title}` : meta.title_singular, title);

  useEffect(() => {
    if (row) pushRecent({ route: `${route}/${row.id}`, title, kind: meta.title_singular || meta.title });
  }, [row?.id, title]); // eslint-disable-line react-hooks/exhaustive-deps

  const childSpecs = useMemo(() => CHILDREN[meta.key] ?? [], [meta.key]);

  if (record.isLoading) return <div className="page-block"><Skeleton width={320} height={32} /><div className="record-cols"><SkeletonPanel height={320} /><SkeletonPanel height={320} /></div></div>;
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
  const activeChild = childSpecs.find((s) => s.path === related) ?? childSpecs[0];
  const here = `${location.pathname}${location.search}`;
  const facts = fields.filter((f) => !["text", "json"].includes(f.type) && !AUDIT.has(f.name) && f.type !== "decimal" && f !== sField);
  const amounts = fields.filter((f) => f.type === "decimal");
  const notes = fields.filter((f) => ["text", "json"].includes(f.type) && displayValue(row, f.name, f.type));
  const by = (k: string) => (row[`${k}_label`] ?? row[k]) as string | undefined;

  const onDelete = async () => {
    const ok = await confirm({
      title: `Да се избрише „${title}“?`, text: t.confirmDelete,
      confirmLabel: `${t.delete} ${(meta.title_singular || "запис").toLowerCase()}`, danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: row.id, version: row.version });
      toast("Записот е избришан.", "success", { description: title });
      navigate(route);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    }
  };

  const menuItems: MenuEntry[] = [
    ...reports.map((a) => ({ label: a.label, icon: actionKind(a) === "download" ? Printer : FileText, onSelect: () => document.getElementById(`dact-${a.name}`)?.click() })),
    ...(meta.permissions.add ? [{ label: t.duplicate, icon: Copy, to: `${route}/new?copy=${row.id}` }] : []),
    ...(meta.permissions.delete ? [{ label: t.delete, icon: Trash2, danger: true, separatorBefore: true, onSelect: () => void onDelete() }] : []),
  ];

  const sub = (
    <>
      <span>{meta.title_singular}</span>
      <span className="ea-id">#{row.id}</span>
      {row.updated_at ? <span>изменето <When at={String(row.updated_at)} />{by("updated_by") ? ` · ${by("updated_by")}` : ""}</span> : null}
    </>
  );

  return (
    <div className="page-block">
      {dialog}
      <PageHeader back={{ to: route, label: meta.title }} title={title} subtitle={sub}
        status={sLabel ? <Badge tone={statusTone(sValue)}>{sLabel}</Badge> : null}
        actions={<>
          {meta.permissions.edit ? <LinkButton icon={Pencil} to={`${route}/${row.id}/edit?from=${encodeURIComponent(here)}`}>{t.edit}</LinkButton> : null}
          <Menu label={t.moreActions} items={menuItems} />
          {primary ? <ActionButton meta={meta} action={primary} row={row} onDone={invalidate} size="md" variant="primary" /> : null}
        </>} />
      <div hidden>
        {reports.map((a) => <ActionButton key={a.name} meta={meta} action={a} row={row} onDone={invalidate} domId={`dact-${a.name}`} />)}
      </div>
      <Toolkit meta={meta} id={row.id} />

      <div className="record-cols">
        <div className="record-col">
          {Custom && panelsFirst ? <Custom meta={meta} row={row} /> : null}
          <Panel title={t.details}>
            <dl className="ea-kv">{facts.map((f) => <div key={f.name}><dt>{f.label}</dt><dd><FieldValue row={row} field={f} /></dd></div>)}</dl>
          </Panel>
          {amounts.length ? (
            <Panel title="Износи">
              <dl className="ea-kv">{amounts.map((f) => <div key={f.name}><dt>{f.label}</dt><dd className="num"><FieldValue row={row} field={f} /></dd></div>)}</dl>
            </Panel>
          ) : null}
          {notes.length ? (
            <Panel title="Опис и белешки">
              <dl className="ea-kv">{notes.map((f) => <div key={f.name} className="wide"><dt>{f.label}</dt><dd><FieldValue row={row} field={f} /></dd></div>)}</dl>
            </Panel>
          ) : null}
          {meta.fields.filter((f) => f.type === "rows" && !(HANDLED_ROWS[meta.key] ?? []).includes(f.name)).map((f) => (
            <Panel key={f.name} title={f.label} flush><RowsTable field={f} rows={(row[f.name] as Row[]) ?? []} /></Panel>
          ))}
          {Custom && !panelsFirst ? <Custom meta={meta} row={row} /> : null}
          {activeChild ? (
            <section className="page-block" aria-label="Поврзани записи">
              {childSpecs.length > 1 ? (
                <Tabs value={activeChild.path} onChange={setRelated} label="Поврзани записи" tabs={childSpecs.map((s) => ({ key: s.path, label: s.label }))} />
              ) : null}
              <ChildTable key={activeChild.path} spec={activeChild} parent={row} />
            </section>
          ) : null}
          <Activity meta={meta} row={row} />
        </div>

        <aside className="record-col" aria-label={t.nextSteps}>
          {sField || others.length ? (
            <Panel title={t.nextSteps} className="next-steps">
              <div className="stack">
                {sField ? <Stepper field={sField} value={sValue} /> : null}
                {others.length ? (
                  <div className="next-actions">
                    {others.map((a) => <ActionButton key={a.name} meta={meta} action={a} row={row} onDone={invalidate} size="md" variant="default" />)}
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}
          <Documents meta={meta} row={row} canEdit={meta.permissions.edit || can("*")} />
          <Panel title="Запис">
            <dl className="fact-list">
              {row.created_at ? <div><dt>{t.createdAt}</dt><dd><When at={String(row.created_at)} />{by("created_by") ? ` · ${by("created_by")}` : ""}</dd></div> : null}
              {row.updated_at ? <div><dt>{t.updatedAt}</dt><dd><When at={String(row.updated_at)} /></dd></div> : null}
              <div><dt>Број во системот</dt><dd className="ea-id">#{row.id}</dd></div>
            </dl>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
