/** Any resource's list, from its metadata: live search, filter popover with chips, sortable columns, column
 * picker, saved views, paging with page size, keyboard row navigation, quick view drawer, export, bulk actions. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, Eye, FileSpreadsheet, Filter, Plus, Search,
  SearchX, Star, Trash2, X,
} from "lucide-react";

import { api, ApiError, download, type Query } from "@/api/client";
import type { ColumnMeta, FilterMeta, ResourceMeta, Row } from "@/api/types";
import { useStored } from "@/app/prefs";
import { RelatedSelect } from "@/components/inputs";
import { useTrackTask } from "@/components/tasks";
import {
  Badge, Button, Drawer, EmptyState, ErrorState, IconButton, Menu, PageHeader, Popover, SkeletonRows, statusTone,
  Tooltip, useConfirm, useToast, type MenuEntry,
} from "@/components/ui";
import { t } from "@/i18n/mk";
import { displayValue, formatDate, formatNumber, isNumericType } from "@/lib/format";
import { routeFor, useInvalidateResource, useList } from "@/meta/hooks";

import { ActionButton, actionKind } from "./actions";
import { ResourceDetail } from "./ResourceDetail";

const RESERVED = new Set(["page", "page_size", "search", "ordering"]);
const PAGE_SIZES = [25, 50, 100];

export function isStatusColumn(name: string) {
  return name === "status" || name.endsWith("_status") || name === "state" || name === "stage";
}

export function Cell({ row, col }: { row: Row; col: ColumnMeta }) {
  const text = displayValue(row, col.name, col.type);
  if (isStatusColumn(col.name) && text) return <Badge tone={statusTone(String(row[col.name] ?? ""))}>{text}</Badge>;
  if (col.type === "boolean") {
    const v = row[col.name];
    return v ? <Badge tone="success" plain>{t.yes}</Badge> : <span className="muted-cell">{t.no}</span>;
  }
  if (!text) return <span className="muted-cell">—</span>;
  return <>{text}</>;
}

// ── filters ──────────────────────────────────────────────────────────────────

function FilterControl({ filter, params, set }: { filter: FilterMeta; params: URLSearchParams; set: (k: string, v: string) => void }) {
  const id = `f-${filter.name}`;
  if (filter.type === "date" && filter.lookups.includes("gte")) {
    return (
      <div className="field">
        <label htmlFor={id}>{filter.label}</label>
        <div className="row-tight">
          <input id={id} className="input" type="date" value={params.get(`${filter.name}__gte`) ?? ""}
            onChange={(e) => set(`${filter.name}__gte`, e.target.value)} aria-label={`${filter.label} ${t.from.toLowerCase()}`} />
          <span className="muted" aria-hidden>–</span>
          <input className="input" type="date" value={params.get(`${filter.name}__lte`) ?? ""}
            onChange={(e) => set(`${filter.name}__lte`, e.target.value)} aria-label={`${filter.label} ${t.to.toLowerCase()}`} />
        </div>
      </div>
    );
  }
  let control: ReactNode;
  if (filter.choices?.length) {
    control = (
      <select id={id} className="input" value={params.get(filter.name) ?? ""} onChange={(e) => set(filter.name, e.target.value)}>
        <option value="">{t.all}</option>
        {filter.choices.map((c) => <option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}
      </select>
    );
  } else if (filter.type === "boolean") {
    control = (
      <select id={id} className="input" value={params.get(filter.name) ?? ""} onChange={(e) => set(filter.name, e.target.value)}>
        <option value="">{t.all}</option>
        <option value="true">{t.yes}</option>
        <option value="false">{t.no}</option>
      </select>
    );
  } else if (filter.type === "fk" && filter.related?.endpoint) {
    const v = params.get(filter.name);
    control = <RelatedSelect id={id} related={filter.related} value={v ? Number(v) : null} placeholder={t.all}
      onChange={(next) => set(filter.name, next ? String(next) : "")} />;
  } else {
    control = <input id={id} className="input" type={filter.type === "date" ? "date" : "text"}
      value={params.get(filter.name) ?? ""} onChange={(e) => set(filter.name, e.target.value)} />;
  }
  return <div className="field"><label htmlFor={id}>{filter.label}</label>{control}</div>;
}

function FkLabel({ endpoint, id }: { endpoint: string; id: string }) {
  const q = useQuery({
    queryKey: ["record", endpoint, id],
    queryFn: () => api.get<Row>(`${endpoint}${id}/`),
    staleTime: 60_000,
  });
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

// ── saved views ──────────────────────────────────────────────────────────────

interface SavedView { name: string; query: string }

function ViewsMenu({ meta, state, apply }: { meta: ResourceMeta; state: URLSearchParams; apply: (q: string) => void }) {
  const [views, setViews] = useStored<SavedView[]>(`views.${meta.key}`, []);
  const current = (() => { const s = new URLSearchParams(state); s.delete("page"); return s.toString(); })();
  const items: MenuEntry[] = [
    ...(views.length ? [{ heading: true, label: "Зачувани прикази" } as MenuEntry] : []),
    ...views.map((v) => ({ label: v.name, icon: Star, onSelect: () => apply(v.query), hint: v.query === current ? "активен" : undefined })),
    { label: "Зачувај го овој приказ…", icon: Plus, separatorBefore: views.length > 0, disabled: !current, onSelect: () => {
      const name = window.prompt("Име на приказот", "");
      if (name?.trim()) setViews((list) => [...list.filter((v) => v.name !== name.trim()), { name: name.trim(), query: current }]);
    } },
    ...(views.length ? [{ label: "Избриши ги зачуваните прикази", icon: Trash2, danger: true, onSelect: () => setViews([]) } as MenuEntry] : []),
  ];
  return <Menu label="Прикази" items={items} trigger={<Button size="sm" icon={Star}>{views.length ? `Прикази (${views.length})` : "Прикази"}</Button>} />;
}

// ── list ─────────────────────────────────────────────────────────────────────

export function ResourceList({ meta, baseQuery, embedded, headerExtra }: {
  meta: ResourceMeta; baseQuery?: Query; embedded?: boolean; headerExtra?: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const [localParams, setLocalParams] = useState(() => new URLSearchParams());
  const state = embedded ? localParams : params;
  const setState = (next: URLSearchParams) => (embedded ? setLocalParams(next) : setParams(next, { replace: true }));
  const [selected, setSelected] = useState<number[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [peek, setPeek] = useState<number | null>(null);
  const [hidden, setHidden] = useStored<string[]>(`cols.${meta.key}`, []);
  const [pageSize, setPageSize] = useStored<number>("pageSize", 25);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const track = useTrackTask();
  const { confirm, dialog } = useConfirm();
  const invalidate = useInvalidateResource(meta.endpoint);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const [searchText, setSearchText] = useState(state.get("search") ?? "");

  const query: Query = useMemo(() => {
    const q: Query = { ...baseQuery, page: state.get("page") ?? 1, page_size: embedded ? 10 : pageSize };
    state.forEach((v, k) => { if (v) q[k] = v; });
    return q;
  }, [state, baseQuery, pageSize, embedded]);
  const list = useList(meta.endpoint, query);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(state);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setState(next);
  };

  // live search, debounced
  useEffect(() => {
    const current = state.get("search") ?? "";
    if (searchText.trim() === current) return;
    const h = window.setTimeout(() => set("search", searchText.trim()), 300);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const ordering = state.get("ordering") ?? "";
  const sortBy = (col: ColumnMeta) => {
    if (!col.sortable) return;
    set("ordering", ordering === col.name ? `-${col.name}` : ordering === `-${col.name}` ? "" : col.name);
  };
  const activeKeys = [...state.keys()].filter((k) => !RESERVED.has(k));
  const route = routeFor(meta.endpoint);
  const rows = list.data?.results ?? [];
  const allIds = rows.map((r) => r.id);
  const bulkAllowed = meta.permissions.delete || meta.bulk_actions.length > 0;
  const columns = meta.columns.filter((c) => !hidden.includes(c.name));

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
      else if (e.key === "n" && meta.permissions.add) { e.preventDefault(); navigate(`${route}/new`); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embedded, rows, cursor, navigate, route, meta.permissions.add]);

  useEffect(() => {
    if (cursor >= 0) tableRef.current?.children[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const runBulk = async (name: string, label: string) => {
    const ok = await confirm({
      title: `${label}: ${selected.length} ${t.selected}`,
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
      else toast(`${t.export}: ${meta.title}`, "success");
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

  const filterCount = activeKeys.length;
  const toolbar = (
    <div className="list-bar">
      {meta.search ? (
        <div className="input-icon list-search">
          <Search aria-hidden />
          <input ref={searchRef} className="input" type="search" placeholder={embedded ? t.searchPlaceholder : `${t.searchPlaceholder}  ( / )`}
            aria-label={`${t.search}: ${meta.title}`} value={searchText} onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") set("search", searchText.trim()); if (e.key === "Escape") setSearchText(""); }} />
        </div>
      ) : null}
      {meta.filters.length ? (
        <Popover align="start" trigger={
          <Button size="sm" icon={Filter} aria-label={`${t.filters}${filterCount ? `: ${filterCount}` : ""}`}>
            {t.filters}{filterCount ? <span className="count">{filterCount}</span> : null}
          </Button>
        }>
          <div className="filter-panel">
            {meta.filters.map((f) => <FilterControl key={f.name} filter={f} params={state} set={set} />)}
          </div>
          <div className="filter-panel-foot">
            <Button size="sm" variant="ghost" disabled={!filterCount} onClick={() => { const n = new URLSearchParams(); if (state.get("search")) n.set("search", state.get("search")!); setState(n); }}>{t.clearFilters}</Button>
            <span className="small muted">{list.data ? `${formatNumber(list.data.count, 0)} ${t.rows}` : ""}</span>
          </div>
        </Popover>
      ) : null}
      <span className="spacer" />
      {list.isFetching && !list.isLoading ? <span className="spinner" style={{ color: "var(--ink-faint)" }} aria-label={t.loading} /> : null}
      {!embedded ? <ViewsMenu meta={meta} state={state} apply={(q) => setState(new URLSearchParams(q))} /> : null}
      {meta.columns.length > 3 ? (
        <Popover align="end" trigger={<Button size="sm" icon={Columns3} aria-label={t.columns}>{embedded ? null : t.columns}</Button>}>
          <div className="col-picker">
            {meta.columns.map((c, i) => (
              <label key={c.name}>
                <input type="checkbox" checked={!hidden.includes(c.name)} disabled={i === 0}
                  onChange={(e) => setHidden((h) => (e.target.checked ? h.filter((x) => x !== c.name) : [...h, c.name]))} />
                {c.label}
              </label>
            ))}
            {hidden.length ? <div style={{ padding: 6 }}><Button size="sm" variant="ghost" onClick={() => setHidden([])}>{t.showAll}</Button></div> : null}
          </div>
        </Popover>
      ) : null}
      {embedded ? headerExtra : null}
    </div>
  );

  const chips = filterCount ? (
    <div className="filter-chips" aria-label={t.filters}>
      {activeKeys.map((k) => {
        const c = chipFor(meta, k, state.get(k) ?? "");
        return (
          <span key={k} className="chip">
            <span className="truncate"><span style={{ opacity: .75 }}>{c.label}:</span> {c.value}</span>
            <button type="button" aria-label={`${t.remove}: ${typeof c.label === "string" ? c.label : k}`} onClick={() => set(k, "")}><X aria-hidden /></button>
          </span>
        );
      })}
      <Button size="sm" variant="ghost" onClick={() => { const n = new URLSearchParams(); if (state.get("search")) n.set("search", state.get("search")!); setState(n); }}>{t.clearFilters}</Button>
    </div>
  ) : null;

  const filtered = filterCount > 0 || Boolean(state.get("search"));
  const page = list.data?.page ?? 1;
  const size = list.data?.page_size ?? pageSize;
  const count = list.data?.count ?? 0;

  const table = list.isLoading ? <SkeletonRows rows={embedded ? 3 : 8} cols={Math.min(columns.length, 6)} />
    : list.error ? <ErrorState error={list.error} onRetry={() => void list.refetch()} />
    : rows.length === 0 ? (
      filtered ? (
        <EmptyState icon={SearchX} title={t.noResultsFiltered}
          action={<Button size="sm" onClick={() => { setSearchText(""); setState(new URLSearchParams()); }}>{t.clearFilters}</Button>} />
      ) : (
        <EmptyState compact={embedded} title={`${meta.title}: ${t.noResults.toLowerCase()}`}
          action={meta.permissions.add && !embedded ? <Button variant="primary" icon={Plus} onClick={() => navigate(`${route}/new`)}>{t.add}</Button> : undefined}>
          {meta.permissions.add && !embedded ? "Креирајте го првиот запис." : undefined}
        </EmptyState>
      )
    ) : (
      <div className="table-wrap" style={{ maxHeight: embedded ? 440 : "calc(100vh - 290px)" }}>
        <table className="table">
          <caption className="sr-only">{meta.title}</caption>
          <thead>
            <tr>
              {bulkAllowed ? (
                <th className="col-check">
                  <input type="checkbox" aria-label="Избери ги сите на страната"
                    checked={allIds.length > 0 && allIds.every((id) => selected.includes(id))}
                    ref={(el) => { if (el) el.indeterminate = selected.length > 0 && !allIds.every((id) => selected.includes(id)); }}
                    onChange={(e) => setSelected(e.target.checked ? allIds : [])} />
                </th>
              ) : null}
              {columns.map((c, i) => {
                const dir = ordering === c.name ? "ascending" : ordering === `-${c.name}` ? "descending" : undefined;
                return (
                  <th key={c.name} scope="col" className={`${c.sortable ? "sortable" : ""} ${isNumericType(c.type) ? "num" : ""} ${i === 0 ? "sticky-col" : ""}`}
                    aria-sort={dir ?? (c.sortable ? "none" : undefined)} onClick={() => sortBy(c)}
                    tabIndex={c.sortable ? 0 : undefined} onKeyDown={(e) => { if (c.sortable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); sortBy(c); } }}>
                    <span className="sort">{c.label}{dir === "ascending" ? <ArrowUp aria-hidden /> : dir === "descending" ? <ArrowDown aria-hidden /> : null}</span>
                  </th>
                );
              })}
              <th aria-label={t.actions} style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody ref={tableRef}>
            {rows.map((row, ri) => (
              <tr key={row.id} className={`clickable${selected.includes(row.id) ? " selected" : ""}${ri === cursor ? " active-row" : ""}`}
                onClick={(e) => { if ((e.target as HTMLElement).closest("a,button,input")) return; navigate(`${route}/${row.id}`); }}
                onMouseEnter={() => prefetch(row.id)}>
                {bulkAllowed ? (
                  <td className="col-check">
                    <input type="checkbox" aria-label={`Избери ${String(row._label ?? row.id)}`} checked={selected.includes(row.id)}
                      onChange={(e) => setSelected((s) => e.target.checked ? [...s, row.id] : s.filter((x) => x !== row.id))} />
                  </td>
                ) : null}
                {columns.map((c, i) => (
                  <td key={c.name} className={`${isNumericType(c.type) ? "num" : ""} ${i === 0 ? "sticky-col" : ""}`}>
                    {i === 0 ? <Link to={`${route}/${row.id}`}><Cell row={row} col={c} /></Link> : <Cell row={row} col={c} />}
                  </td>
                ))}
                <td className="right">
                  <span className="row-actions">
                    <IconButton label={t.peek} icon={Eye} size="sm" onClick={() => setPeek(row.id)} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const pager = list.data && (list.data.pages > 1 || !embedded) && rows.length ? (
    <div className="pager">
      <span className="num">{formatNumber((page - 1) * size + 1, 0)}–{formatNumber(Math.min(page * size, count), 0)} {t.of} {formatNumber(count, 0)}</span>
      {!embedded ? (
        <label className="row-tight" style={{ marginLeft: 8 }}>
          <select className="input sm" style={{ width: 76 }} value={pageSize} aria-label={t.perPage}
            onChange={(e) => { setPageSize(Number(e.target.value)); set("page", ""); }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>{t.perPage}</span>
        </label>
      ) : null}
      <span className="spacer" />
      {list.data.pages > 1 ? (
        <>
          <IconButton label="Претходна страна" icon={ChevronLeft} size="sm" variant="default" disabled={page <= 1} onClick={() => set("page", String(page - 1))} />
          <span className="num">{t.page} {page} {t.of} {list.data.pages}</span>
          <IconButton label="Следна страна" icon={ChevronRight} size="sm" variant="default" disabled={page >= list.data.pages} onClick={() => set("page", String(page + 1))} />
        </>
      ) : null}
    </div>
  ) : null;

  const exportItems: MenuEntry[] = meta.export_formats.map((f) => ({
    label: f.toUpperCase(), icon: FileSpreadsheet, onSelect: () => void exportAs(f),
  }));

  const body = (
    <div className={embedded ? "" : "panel"} style={{ overflow: "hidden" }}>
      {toolbar}
      {chips}
      {table}
      {pager}
    </div>
  );

  return (
    <div className={embedded ? "stack-sm" : "stack"}>
      {dialog}
      {!embedded ? (
        <PageHeader
          title={meta.title}
          subtitle={list.data ? `${formatNumber(list.data.count, 0)} ${count === 1 ? "запис" : "записи"}${filtered ? " според филтрите" : ""}` : " "}
          actions={<>
            {operations.slice(0, 2).map((a) => <ActionButton key={a.name} meta={meta} action={a} onDone={invalidate} size="md" />)}
            {reports.length || operations.length > 2 ? (
              <Menu label={t.moreActions} trigger={<Button>Извештаи и акции</Button>} items={[
                ...reports.map((a) => ({ label: a.label, onSelect: () => document.getElementById(`act-${a.name}`)?.click() })),
                ...operations.slice(2).map((a) => ({ label: a.label, onSelect: () => document.getElementById(`act-${a.name}`)?.click(), separatorBefore: false })),
              ]} />
            ) : null}
            {exportItems.length ? (
              <Menu label={t.export} items={exportItems} trigger={<Button icon={Download}>{t.export}</Button>} />
            ) : null}
            {meta.permissions.add ? (
              <Tooltip content={<>{t.addNew} <kbd>N</kbd></>}>
                <Button variant="primary" icon={Plus} onClick={() => navigate(`${route}/new`)}>{t.add}</Button>
              </Tooltip>
            ) : null}
          </>}
        />
      ) : null}
      {/* report and operation dialogs live here (their buttons are hidden; the menu clicks them) */}
      {!embedded ? (
        <div style={{ display: "none" }}>
          {[...reports, ...operations.slice(2)].map((a) => <ActionButton key={a.name} meta={meta} action={a} onDone={invalidate} domId={`act-${a.name}`} />)}
        </div>
      ) : null}
      {body}
      {selected.length && bulkAllowed ? (
        <div className="bulk-bar" role="region" aria-label={t.selected}>
          <span className="small strong">{selected.length} {t.selected}</span>
          {meta.bulk_actions.map((b) => <Button key={b.name} size="sm" onClick={() => runBulk(b.name, b.label)}>{b.label}</Button>)}
          {meta.permissions.delete ? <Button size="sm" variant="danger" icon={Trash2} onClick={() => runBulk("delete", t.delete)}>{t.delete}</Button> : null}
          <IconButton label="Откажи избор" icon={X} size="sm" onClick={() => setSelected([])} style={{ color: "inherit" }} />
        </div>
      ) : null}
      {peek !== null ? (
        <Drawer title={String(rows.find((r) => r.id === peek)?._label ?? `#${peek}`)} onClose={() => setPeek(null)}
          actions={<Button size="sm" onClick={() => navigate(`${route}/${peek}`)}>{t.openFull}</Button>}>
          <ResourceDetail meta={meta} id={String(peek)} variant="drawer" />
        </Drawer>
      ) : null}
    </div>
  );
}
