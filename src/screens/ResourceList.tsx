/** The list page type (branding_rules/04 §3 "List"): page head (Извези + the create button), a context bar for
 * active filters, the status overview (counts per status; a click filters), the filter form (search + up to
 * three selects + [Филтрирај] [Исчисти], kept in the URL), the table with its count in the panel head, and
 * paging. Rows open the record; the row menu holds open, edit, duplicate. Delete is never in a row. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError, download, type Query } from "@/api/client";
import type { ColumnMeta, FilterMeta, ResourceMeta, Row } from "@/api/types";
import { useStored } from "@/app/prefs";
import { useCount } from "@/components/dashboard";
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Copy, Download, ExternalLink, FileSpreadsheet, MoreHorizontal, Pencil, Plus,
  Search, SearchX, Star, Trash2, X,
} from "@/components/icons";
import { DateInput, RelatedSelect } from "@/components/inputs";
import { useTrackTask } from "@/components/tasks";
import {
  Button, EmptyState, ErrorState, IconButton, LinkButton, Menu, PageHeader, Panel, Popover, SkeletonRows, Status, statusTone,
  useConfirm, useToast, type MenuEntry,
} from "@/components/ui";
import { t } from "@/i18n/mk";
import { displayValue, formatDate, formatNumber, isNumericType } from "@/lib/format";
import { routeFor, useInvalidateResource, useList } from "@/meta/hooks";

import { ActionButton, actionKind } from "./actions";

const RESERVED = new Set(["page", "page_size", "search", "ordering", "from"]);
const PAGE_SIZE = 25;

export function isStatusColumn(name: string) {
  return name === "status" || name.endsWith("_status") || name === "state" || name === "stage";
}

export function Cell({ row, col }: { row: Row; col: ColumnMeta }) {
  const text = displayValue(row, col.name, col.type);
  if (isStatusColumn(col.name) && text) return <Status tone={statusTone(String(row[col.name] ?? ""))}>{text}</Status>;
  if (col.type === "boolean") return row[col.name] ? <span>{t.yes}</span> : <span className="muted-cell">{t.no}</span>;
  if (!text) return <span className="muted-cell">—</span>;
  if (col.type === "decimal" && String(row[col.name]).startsWith("-")) return <span className="neg">{text}</span>;
  return <>{text}</>;
}

/** The ids of the list page last shown, so a record can offer previous / next ("3 од 25 во „…“"). */
export function rememberListPage(key: string, ids: number[], title: string, search: string) {
  try { window.sessionStorage.setItem(`eacore.list.${key}`, JSON.stringify({ ids, title, search })); } catch { /* storage unavailable */ }
}

// ── filters ──────────────────────────────────────────────────────────────────

function FilterControl({ filter, draft, set }: { filter: FilterMeta; draft: URLSearchParams; set: (k: string, v: string) => void }) {
  const id = `f-${filter.name}`;
  if (filter.type === "date" && filter.lookups.includes("gte")) {
    return (
      <div className="field">
        <label htmlFor={id}>{filter.label}</label>
        <div className="date-range">
          <DateInput id={id} value={draft.get(`${filter.name}__gte`)} onChange={(v) => set(`${filter.name}__gte`, v ?? "")} aria-label={`${filter.label}: ${t.from.toLowerCase()}`} />
          <span className="muted" aria-hidden>–</span>
          <DateInput value={draft.get(`${filter.name}__lte`)} onChange={(v) => set(`${filter.name}__lte`, v ?? "")} aria-label={`${filter.label}: ${t.to.toLowerCase()}`} />
        </div>
      </div>
    );
  }
  let control: ReactNode;
  if (filter.choices?.length) {
    control = (
      <select id={id} className="input" value={draft.get(filter.name) ?? ""} onChange={(e) => set(filter.name, e.target.value)}>
        <option value="">{t.all}</option>
        {filter.choices.map((c) => <option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}
      </select>
    );
  } else if (filter.type === "boolean") {
    control = (
      <select id={id} className="input" value={draft.get(filter.name) ?? ""} onChange={(e) => set(filter.name, e.target.value)}>
        <option value="">{t.all}</option>
        <option value="true">{t.yes}</option>
        <option value="false">{t.no}</option>
      </select>
    );
  } else if (filter.type === "fk" && filter.related?.endpoint) {
    const v = draft.get(filter.name);
    control = <RelatedSelect id={id} related={filter.related} value={v ? Number(v) : null} placeholder={t.all}
      onChange={(next) => set(filter.name, next ? String(next) : "")} />;
  } else if (filter.type === "date") {
    control = <DateInput id={id} value={draft.get(filter.name)} onChange={(v) => set(filter.name, v ?? "")} />;
  } else {
    control = <input id={id} className="input" value={draft.get(filter.name) ?? ""} onChange={(e) => set(filter.name, e.target.value)} />;
  }
  return <div className="field"><label htmlFor={id}>{filter.label}</label>{control}</div>;
}

function FkLabel({ endpoint, id }: { endpoint: string; id: string }) {
  const q = useQuery({ queryKey: ["record", endpoint, id], queryFn: () => api.get<Row>(`${endpoint}${id}/`), staleTime: 60_000 });
  return <>{q.data ? String(q.data._label ?? q.data.name ?? `#${id}`) : `#${id}`}</>;
}

function chipFor(meta: ResourceMeta, key: string, value: string): { label: ReactNode; value: ReactNode } {
  const base = key.replace(/__(gte|lte|exact|in|icontains)$/, "");
  const f = meta.filters.find((x) => x.name === base);
  const label = f?.label ?? base;
  if (key.endsWith("__gte")) return { label: `${label} од`, value: formatDate(value) };
  if (key.endsWith("__lte")) return { label: `${label} до`, value: formatDate(value) };
  if (f?.choices?.length) return { label, value: f.choices.find((c) => String(c.value) === value)?.label ?? value };
  if (f?.type === "boolean") return { label, value: value === "true" ? t.yes : t.no };
  if (f?.type === "fk" && f.related?.endpoint) return { label, value: <FkLabel endpoint={f.related.endpoint} id={value} /> };
  return { label, value };
}

/** The status-like filter whose counts lead the page. */
function statusFilter(meta: ResourceMeta): FilterMeta | undefined {
  return meta.filters.find((f) => isStatusColumn(f.name) && f.choices && f.choices.length >= 2 && f.choices.length <= 8);
}

/** Counts per status; a click filters the list (and a second click clears it). */
function StatusOverview({ meta, filter, base, value, onPick }: {
  meta: ResourceMeta; filter: FilterMeta; base: Query; value: string; onPick: (v: string) => void;
}) {
  return (
    <div className="status-overview" role="group" aria-label={filter.label}>
      {filter.choices!.map((c) => <StatusCount key={String(c.value)} meta={meta} filter={filter} choice={c} base={base}
        active={value === String(c.value)} onPick={onPick} />)}
    </div>
  );
}

function StatusCount({ meta, filter, choice, base, active, onPick }: {
  meta: ResourceMeta; filter: FilterMeta; choice: { value: string | number; label: string }; base: Query; active: boolean; onPick: (v: string) => void;
}) {
  const count = useCount(meta.endpoint, { ...base, [filter.name]: choice.value });
  return (
    <button type="button" aria-pressed={active} onClick={() => onPick(active ? "" : String(choice.value))}>
      <Status tone={statusTone(String(choice.value))}>{choice.label}</Status>
      <span className="so-n">{count.data === undefined ? "—" : formatNumber(count.data, 0)}</span>
    </button>
  );
}

// ── saved views ──────────────────────────────────────────────────────────────

interface SavedView { name: string; query: string }

function ViewsMenu({ meta, state, apply }: { meta: ResourceMeta; state: URLSearchParams; apply: (q: string) => void }) {
  const [views, setViews] = useStored<SavedView[]>(`views.${meta.key}`, []);
  const [name, setName] = useState("");
  const current = (() => { const s = new URLSearchParams(state); s.delete("page"); return s.toString(); })();
  const saveView = () => {
    const n = name.trim();
    if (!n || !current) return;
    setViews((list) => [...list.filter((v) => v.name !== n), { name: n, query: current }]);
    setName("");
  };
  return (
    <Popover align="end" trigger={<Button size="sm" variant="ghost" icon={Star}>{views.length ? `Прикази · ${views.length}` : "Прикази"}</Button>}>
      <div className="col-picker stack-sm">
        {views.length ? <span className="ea-label">Зачувани прикази</span> : null}
        {views.map((v) => (
          <div key={v.name} className="row-tight">
            <button type="button" className="link-button grow" onClick={() => apply(v.query)}>{v.name}</button>
            <IconButton size="sm" label={`${t.remove}: ${v.name}`} icon={Trash2} onClick={() => setViews((l) => l.filter((x) => x.name !== v.name))} />
          </div>
        ))}
        <div className="field">
          <label htmlFor="view-name">Зачувај го овој приказ</label>
          <div className="row-tight">
            <input id="view-name" className="input" placeholder="на пр. Мои отворени" value={name} disabled={!current}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveView(); }} />
            <Button size="sm" disabled={!name.trim() || !current} onClick={saveView}>{t.save}</Button>
          </div>
          {!current ? <span className="help">Прво поставете филтер или пребарување.</span> : null}
        </div>
      </div>
    </Popover>
  );
}

// ── list ─────────────────────────────────────────────────────────────────────

export function ResourceList({ meta, baseQuery, embedded }: {
  meta: ResourceMeta; baseQuery?: Query; embedded?: boolean; headerExtra?: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const [localParams, setLocalParams] = useState(() => new URLSearchParams());
  const state = embedded ? localParams : params;
  const setState = (next: URLSearchParams) => (embedded ? setLocalParams(next) : setParams(next, { replace: true }));
  const [draft, setDraft] = useState(() => new URLSearchParams(state));
  const [moreOpen, setMoreOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [hidden, setHidden] = useStored<string[]>(`cols.${meta.key}`, []);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const track = useTrackTask();
  const { confirm, dialog } = useConfirm();
  const invalidate = useInvalidateResource(meta.endpoint);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => { setDraft(new URLSearchParams(state)); }, [state.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const query: Query = useMemo(() => {
    const q: Query = { ...baseQuery, page: state.get("page") ?? 1, page_size: embedded ? 10 : PAGE_SIZE };
    state.forEach((v, k) => { if (v && k !== "from") q[k] = v; });
    return q;
  }, [state, baseQuery, embedded]);
  const list = useList(meta.endpoint, query);
  const route = routeFor(meta.endpoint);
  const rows = list.data?.results ?? [];

  useEffect(() => {
    if (!embedded && list.data) rememberListPage(meta.key, rows.map((r) => r.id), meta.title, location.search);
  }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(state);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setState(next);
  };
  const setDraftValue = (key: string, value: string) => {
    setDraft((d) => { const n = new URLSearchParams(d); if (value) n.set(key, value); else n.delete(key); return n; });
  };
  const applyDraft = () => { const n = new URLSearchParams(draft); n.delete("page"); setState(n); };
  const clearAll = () => { setDraft(new URLSearchParams()); setState(new URLSearchParams()); };

  const ordering = state.get("ordering") ?? "";
  const sortBy = (col: ColumnMeta) => {
    if (!col.sortable) return;
    set("ordering", ordering === col.name ? `-${col.name}` : ordering === `-${col.name}` ? "" : col.name);
  };
  const sFilter = embedded ? undefined : statusFilter(meta);
  const otherFilters = meta.filters.filter((f) => f !== sFilter);
  const inline = otherFilters.slice(0, 3);
  const extra = otherFilters.slice(3);
  const activeKeys = [...state.keys()].filter((k) => !RESERVED.has(k) && state.get(k));
  const allIds = rows.map((r) => r.id);
  const bulkAllowed = !embedded && (meta.permissions.delete || meta.bulk_actions.length > 0);
  const columns = meta.columns.filter((c) => !hidden.includes(c.name));
  const canAdd = meta.permissions.add;
  const here = `${location.pathname}${location.search}`;
  const childPrefill = embedded && baseQuery ? new URLSearchParams(Object.entries(baseQuery).map(([k, v]) => [k, String(v)])) : null;
  const newLink = embedded
    ? `${route}/new?${childPrefill?.toString() ?? ""}&from=${encodeURIComponent(here)}`
    : `${route}/new`;

  useEffect(() => { setCursor(-1); }, [list.data]);

  // keyboard: / search, j/k move, Enter open, n new
  useEffect(() => {
    if (embedded) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "j") { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); }
      else if (e.key === "k") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      else if (e.key === "Enter" && cursor >= 0 && rows[cursor]) navigate(`${route}/${rows[cursor].id}`);
      else if (e.key === "n" && canAdd) { e.preventDefault(); navigate(newLink); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embedded, rows, cursor, navigate, route, canAdd, newLink]);

  useEffect(() => {
    if (cursor >= 0) tableRef.current?.children[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const runBulk = async (name: string, label: string) => {
    const ok = await confirm({
      title: name === "delete" ? `Да се избришат ${selected.length} записи?` : `${label}: ${selected.length} записи?`,
      text: name === "delete" ? t.confirmDelete : `Акцијата „${label}“ ќе се примени на ${selected.length} записи.`,
      confirmLabel: name === "delete" ? `${t.delete} (${selected.length})` : label,
      danger: name === "delete",
    });
    if (!ok) return;
    try {
      const res = await api.post<{ count?: number; failed?: { id: number; error: string }[] }>(`${meta.endpoint}bulk/`, { action: name, ids: selected });
      toast(`${label}: ${res.count ?? selected.length}`, "success");
      if (res.failed?.length) toast(res.failed.map((f) => `#${f.id}: ${f.error}`).join("; "), "danger");
      setSelected([]);
      invalidate();
    } catch (err) {
      toast((err as Error).message, "danger");
    }
  };

  const exportAs = async (fmt: string) => {
    const q: Query = { ...query, file_format: fmt };
    delete q.page;
    delete q.page_size;
    try {
      const task = await download(`${meta.endpoint}export/`, q);
      if (task) track(task.task_id, `${t.export}: ${meta.title}`);
      else toast(`Извезено: ${meta.title}.`, "success");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    }
  };

  const prefetch = (id: number) => {
    void qc.prefetchQuery({ queryKey: ["record", meta.endpoint, String(id)], queryFn: () => api.get<Row>(`${meta.endpoint}${id}/`), staleTime: 30_000 });
  };

  const listActions = meta.actions.filter((a) => !a.detail && a.allowed && !a.methods?.includes("PUT"));
  const reports = listActions.filter((a) => actionKind(a) !== "action");
  const operations = listActions.filter((a) => actionKind(a) === "action");
  const filtered = activeKeys.length > 0 || Boolean(state.get("search"));
  const page = list.data?.page ?? 1;
  const size = list.data?.page_size ?? PAGE_SIZE;
  const count = list.data?.count ?? 0;

  // ── the filter form (Филтрирај applies; everything is in the URL) ──
  const filterForm = (
    <form className="stack-sm" role="search" onSubmit={(e) => { e.preventDefault(); applyDraft(); }}>
      <div className="filter-form">
        {meta.search ? (
          <div className="field f-search">
            <label htmlFor={`q-${meta.key}`}>{t.search}</label>
            <div className="input-icon">
              <Search />
              <input ref={searchRef} id={`q-${meta.key}`} className="input" type="search" placeholder={t.searchPlaceholder}
                value={draft.get("search") ?? ""} onChange={(e) => setDraftValue("search", e.target.value)} />
            </div>
          </div>
        ) : null}
        {(embedded ? [] : inline).map((f) => <FilterControl key={f.name} filter={f} draft={draft} set={setDraftValue} />)}
        <div className="f-actions">
          <Button type="submit" variant={embedded ? "default" : "default"}>{t.applyFilters}</Button>
          {filtered ? <Button variant="ghost" onClick={clearAll}>{t.clearFilters}</Button> : null}
          {!embedded && extra.length ? <Button variant="ghost" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>{t.moreFilters}</Button> : null}
        </div>
      </div>
      {moreOpen ? <div className="more-filters">{extra.map((f) => <FilterControl key={f.name} filter={f} draft={draft} set={setDraftValue} />)}</div> : null}
    </form>
  );

  const contextBar = !embedded && activeKeys.filter((k) => k !== sFilter?.name).length ? (
    <div className="context-bar" aria-label={t.filters}>
      <span>Филтер:</span>
      {activeKeys.filter((k) => k !== sFilter?.name).map((k) => {
        const c = chipFor(meta, k, state.get(k) ?? "");
        return (
          <span key={k} className="chip">
            <span className="truncate">{c.label}: {c.value}</span>
            <button type="button" aria-label={`${t.remove}: ${typeof c.label === "string" ? c.label : k}`} onClick={() => set(k, "")}><X /></button>
          </span>
        );
      })}
      <span className="spacer" />
      <button type="button" className="link-button" onClick={clearAll}>Сите записи</button>
    </div>
  ) : null;

  const rowMenu = (row: Row): MenuEntry[] => [
    { label: t.open, icon: ExternalLink, to: `${route}/${row.id}` },
    ...(meta.permissions.edit ? [{ label: t.edit, icon: Pencil, to: `${route}/${row.id}/edit?from=${encodeURIComponent(here)}` }] : []),
    ...(canAdd && !embedded ? [{ label: t.duplicate, icon: Copy, to: `${route}/new?copy=${row.id}` }] : []),
  ];

  const table = list.isLoading ? <SkeletonRows rows={embedded ? 3 : 8} cols={Math.min(columns.length, 6)} />
    : list.error ? <ErrorState error={list.error} onRetry={() => void list.refetch()} />
    : rows.length === 0 ? (
      filtered ? (
        <EmptyState icon={SearchX} title={t.noResultsFiltered} action={<Button size="sm" onClick={clearAll}>{t.clearFilters}</Button>} />
      ) : (
        <EmptyState compact={embedded} title={t.noResults}
          action={canAdd ? <LinkButton to={newLink} variant={embedded ? "default" : "primary"} icon={Plus}>{t.add}</LinkButton> : undefined} />
      )
    ) : (
      <div className="table-wrap tall">
        <table className="table">
          <caption className="sr-only">{meta.title}</caption>
          <thead>
            <tr>
              {bulkAllowed ? (
                <th className="col-check" scope="col">
                  <input type="checkbox" aria-label="Избери ги сите на страната"
                    checked={allIds.length > 0 && allIds.every((id) => selected.includes(id))}
                    ref={(el) => { if (el) el.indeterminate = selected.length > 0 && !allIds.every((id) => selected.includes(id)); }}
                    onChange={(e) => setSelected(e.target.checked ? allIds : [])} />
                </th>
              ) : null}
              {columns.map((c, i) => {
                const dir = ordering === c.name ? "ascending" : ordering === `-${c.name}` ? "descending" : undefined;
                return (
                  <th key={c.name} scope="col" className={`${isNumericType(c.type) ? "num" : ""} ${i === 0 ? "sticky-col" : ""}`}
                    aria-sort={dir ?? (c.sortable ? "none" : undefined)} onClick={() => sortBy(c)}>
                    {c.sortable ? (
                      <button type="button" className="sort-btn">{c.label}{dir === "ascending" ? <ArrowUp /> : dir === "descending" ? <ArrowDown /> : null}</button>
                    ) : c.label}
                  </th>
                );
              })}
              <th scope="col"><span className="sr-only">{t.actions}</span></th>
            </tr>
          </thead>
          <tbody ref={tableRef}>
            {rows.map((row, ri) => (
              <tr key={row.id} className={`clickable${selected.includes(row.id) ? " selected" : ""}${ri === cursor ? " active-row" : ""}`}
                onClick={(e) => { if ((e.target as HTMLElement).closest("a,button,input,[role=menu]")) return; navigate(`${route}/${row.id}`); }}
                onMouseEnter={() => prefetch(row.id)}>
                {bulkAllowed ? (
                  <td className="col-check">
                    <input type="checkbox" aria-label={`Избери ${String(row._label ?? row.id)}`} checked={selected.includes(row.id)}
                      onChange={(e) => setSelected((s) => e.target.checked ? [...s, row.id] : s.filter((x) => x !== row.id))} />
                  </td>
                ) : null}
                {columns.map((c, i) => (
                  <td key={c.name} className={`${isNumericType(c.type) ? "num" : ""} ${i === 0 ? "sticky-col" : ""}`}>
                    {i === 0 ? <Link to={`${route}/${row.id}`} className="rec-link"><Cell row={row} col={c} /></Link> : <Cell row={row} col={c} />}
                  </td>
                ))}
                <td className="row-menu right">
                  <Menu label={`${t.moreActions}: ${String(row._label ?? row.id)}`} items={rowMenu(row)}
                    trigger={<button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`${t.moreActions}: ${String(row._label ?? row.id)}`}><MoreHorizontal /></button>} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const pager = list.data && rows.length && (list.data.pages > 1 || !embedded) ? (
    <div className="pager">
      <span className="num">{t.shown} {formatNumber((page - 1) * size + 1, 0)}–{formatNumber(Math.min(page * size, count), 0)} {t.of} {formatNumber(count, 0)}</span>
      <span className="spacer" />
      {list.data.pages > 1 ? (
        <>
          <IconButton label={t.previous} icon={ChevronLeft} size="sm" variant="default" disabled={page <= 1} onClick={() => set("page", String(page - 1))} />
          <span className="num">{page} / {list.data.pages}</span>
          <IconButton label={t.next} icon={ChevronRight} size="sm" variant="default" disabled={page >= list.data.pages} onClick={() => set("page", String(page + 1))} />
        </>
      ) : null}
    </div>
  ) : null;

  const tableTools = (
    <div className="row-tight">
      {list.isFetching && !list.isLoading ? <span className="spinner" aria-label={t.loading} /> : null}
      {!embedded ? <ViewsMenu meta={meta} state={state} apply={(q) => setState(new URLSearchParams(q))} /> : null}
      {meta.columns.length > 3 ? (
        <Popover align="end" trigger={<Button size="sm" variant="ghost" icon={Columns3}>{t.columns}</Button>}>
          <div className="col-picker">
            {meta.columns.map((c, i) => (
              <label key={c.name}>
                <input type="checkbox" checked={!hidden.includes(c.name)} disabled={i === 0}
                  onChange={(e) => setHidden((h) => (e.target.checked ? h.filter((x) => x !== c.name) : [...h, c.name]))} />
                {c.label}
              </label>
            ))}
            {hidden.length ? <Button size="sm" variant="ghost" onClick={() => setHidden([])}>{t.showAll}</Button> : null}
          </div>
        </Popover>
      ) : null}
      {embedded && canAdd ? <LinkButton size="sm" to={newLink} icon={Plus}>{t.add}</LinkButton> : null}
    </div>
  );

  const panel = (
    <Panel flush title={embedded ? meta.title : "Записи"} sub={list.data ? formatNumber(count, 0) : undefined} actions={tableTools}>
      {embedded ? <div className="ea-panel-body">{filterForm}</div> : null}
      {table}
      {pager}
    </Panel>
  );

  if (embedded) return <>{dialog}{panel}</>;

  const exportItems: MenuEntry[] = meta.export_formats.map((f) => ({ label: f.toUpperCase(), icon: FileSpreadsheet, onSelect: () => void exportAs(f) }));

  return (
    <div className="page-block">
      {dialog}
      <PageHeader
        title={meta.title}
        subtitle={list.data ? `${formatNumber(count, 0)} ${count === 1 ? "запис" : "записи"}${filtered ? " според филтрите" : ""}` : " "}
        actions={<>
          {operations.slice(0, 2).map((a) => <ActionButton key={a.name} meta={meta} action={a} onDone={invalidate} size="md" variant="default" />)}
          {reports.length || operations.length > 2 ? (
            <Menu label={t.moreActions} trigger={<Button>Извештаи</Button>} items={[
              ...reports.map((a) => ({ label: a.label, onSelect: () => document.getElementById(`act-${a.name}`)?.click() })),
              ...operations.slice(2).map((a) => ({ label: a.label, onSelect: () => document.getElementById(`act-${a.name}`)?.click() })),
            ]} />
          ) : null}
          {exportItems.length ? <Menu label={t.export} items={exportItems} trigger={<Button icon={Download}>{t.export}</Button>} /> : null}
          {canAdd ? <LinkButton variant="primary" icon={Plus} to={newLink}>{t.add}</LinkButton> : null}
        </>}
      />
      {/* report and operation dialogs live here (their buttons are hidden; the menu clicks them) */}
      <div hidden>
        {[...reports, ...operations.slice(2)].map((a) => <ActionButton key={a.name} meta={meta} action={a} onDone={invalidate} domId={`act-${a.name}`} />)}
      </div>
      {contextBar}
      {sFilter ? <StatusOverview meta={meta} filter={sFilter} base={{ ...baseQuery, search: state.get("search") ?? undefined }} value={state.get(sFilter.name) ?? ""}
        onPick={(v) => set(sFilter.name, v)} /> : null}
      {filterForm}
      {panel}
      {selected.length && bulkAllowed ? (
        <div className="bulk-bar" role="region" aria-label={t.selected}>
          <span>{selected.length} {t.selected}</span>
          {meta.bulk_actions.map((b) => <Button key={b.name} size="sm" variant="ghost" onClick={() => runBulk(b.name, b.label)}>{b.label}</Button>)}
          {meta.permissions.delete ? <Button size="sm" variant="ghost" icon={Trash2} onClick={() => runBulk("delete", t.delete)}>{t.delete}</Button> : null}
          <IconButton label="Откажи избор" icon={X} size="sm" onClick={() => setSelected([])} />
        </div>
      ) : null}
    </div>
  );
}
