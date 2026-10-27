/** Any resource's list, from its metadata: search, filters, sortable columns, paging, export, bulk actions. */
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { api, ApiError, download, type Query } from "@/api/client";
import type { ColumnMeta, FilterMeta, ResourceMeta, Row } from "@/api/types";
import { RelatedSelect } from "@/components/inputs";
import { useTrackTask } from "@/components/tasks";
import { Alert, Badge, Button, EmptyState, Spinner, statusTone, useConfirm, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";
import { displayValue, isNumericType } from "@/lib/format";
import { routeFor, useInvalidateResource, useList } from "@/meta/hooks";

import { ActionButton } from "./actions";

const RESERVED = new Set(["page", "page_size", "search", "ordering"]);

export function isStatusColumn(name: string) {
  return name === "status" || name.endsWith("_status") || name === "state";
}

export function Cell({ row, col }: { row: Row; col: ColumnMeta }) {
  const text = displayValue(row, col.name, col.type);
  if (isStatusColumn(col.name) && text) {
    return <Badge tone={statusTone(String(row[col.name] ?? ""))}>{text}</Badge>;
  }
  return <>{text}</>;
}

function FilterControl({ filter, params, set }: { filter: FilterMeta; params: URLSearchParams; set: (k: string, v: string) => void }) {
  const id = `f-${filter.name}`;
  if (filter.type === "date" && filter.lookups.includes("gte")) {
    return (
      <div className="field">
        <label htmlFor={id}>{filter.label}</label>
        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
          <input id={id} className="input" type="date" value={params.get(`${filter.name}__gte`) ?? ""}
            onChange={(e) => set(`${filter.name}__gte`, e.target.value)} aria-label={`${filter.label} од`} />
          <input className="input" type="date" value={params.get(`${filter.name}__lte`) ?? ""}
            onChange={(e) => set(`${filter.name}__lte`, e.target.value)} aria-label={`${filter.label} до`} />
        </div>
      </div>
    );
  }
  let control;
  if (filter.choices?.length) {
    control = (
      <select id={id} className="input" value={params.get(filter.name) ?? ""} onChange={(e) => set(filter.name, e.target.value)}>
        <option value="">{t.none}</option>
        {filter.choices.map((c) => <option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}
      </select>
    );
  } else if (filter.type === "boolean") {
    control = (
      <select id={id} className="input" value={params.get(filter.name) ?? ""} onChange={(e) => set(filter.name, e.target.value)}>
        <option value="">{t.none}</option>
        <option value="true">{t.yes}</option>
        <option value="false">{t.no}</option>
      </select>
    );
  } else if (filter.type === "fk" && filter.related?.endpoint) {
    const v = params.get(filter.name);
    control = <RelatedSelect id={id} related={filter.related} value={v ? Number(v) : null}
      onChange={(next) => set(filter.name, next ? String(next) : "")} />;
  } else {
    control = <input id={id} className="input" type={filter.type === "date" ? "date" : "text"}
      value={params.get(filter.name) ?? ""} onChange={(e) => set(filter.name, e.target.value)} />;
  }
  return (
    <div className="field">
      <label htmlFor={id}>{filter.label}</label>
      {control}
    </div>
  );
}

export function ResourceList({ meta, baseQuery, embedded }: { meta: ResourceMeta; baseQuery?: Query; embedded?: boolean }) {
  const [params, setParams] = useSearchParams();
  const [localParams, setLocalParams] = useState(() => new URLSearchParams());
  const state = embedded ? localParams : params;
  const setState = (next: URLSearchParams) => (embedded ? setLocalParams(next) : setParams(next, { replace: true }));
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const navigate = useNavigate();
  const toast = useToast();
  const track = useTrackTask();
  const { confirm, dialog } = useConfirm();
  const invalidate = useInvalidateResource(meta.endpoint);

  const query: Query = useMemo(() => {
    const q: Query = { ...baseQuery, page: state.get("page") ?? 1 };
    state.forEach((v, k) => { if (v) q[k] = v; });
    return q;
  }, [state, baseQuery]);
  const list = useList(meta.endpoint, query);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(state);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setState(next);
  };
  const ordering = state.get("ordering") ?? "";
  const sortBy = (col: ColumnMeta) => {
    if (!col.sortable) return;
    set("ordering", ordering === col.name ? `-${col.name}` : col.name);
  };
  const activeFilters = [...state.keys()].filter((k) => !RESERVED.has(k)).length;
  const route = routeFor(meta.endpoint);
  const rows = list.data?.results ?? [];
  const allIds = rows.map((r) => r.id);
  const bulkAllowed = meta.permissions.delete || meta.bulk_actions.length > 0;

  const runBulk = async (name: string, label: string) => {
    if (!(await confirm(`${label}: ${selected.length} ${t.selected}?`, name === "delete"))) return;
    try {
      const res = await api.post<{ count?: number; failed?: { id: number; error: string }[] }>(`${meta.endpoint}bulk/`, { action: name, ids: selected });
      toast(`${t.done} (${res.count ?? selected.length})`);
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
    try {
      const task = await download(`${meta.endpoint}export/`, q);
      if (task) track(task.task_id, `${t.export}: ${meta.title}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : String(err), "danger");
    }
  };

  const listActions = meta.actions.filter((a) => !a.detail && a.allowed);

  return (
    <div className="stack">
      {dialog}
      {!embedded ? (
        <div className="page-head">
          <h1>{meta.title}</h1>
          <span className="muted small">{list.data ? `${list.data.count} ${t.total}` : ""}</span>
          <span className="spacer" />
          {listActions.map((a) => (
            <ActionButton key={a.name} meta={meta} action={a} onDone={invalidate} />
          ))}
          {meta.export_formats.map((f) => (
            <Button key={f} size="sm" onClick={() => exportAs(f)}>{t.export} {f.toUpperCase()}</Button>
          ))}
          {meta.permissions.add ? (
            <Button variant="primary" onClick={() => navigate(`${route}/new`)}>{t.add}</Button>
          ) : null}
        </div>
      ) : null}
      <div className="card flush">
        <div className="filter-bar">
          {meta.search ? (
            <div className="field" style={{ minWidth: 240 }}>
              <label htmlFor="list-search">{t.search}</label>
              <input id="list-search" className="input" type="search" placeholder={t.searchPlaceholder}
                defaultValue={state.get("search") ?? ""}
                onKeyDown={(e) => { if (e.key === "Enter") set("search", (e.target as HTMLInputElement).value); }}
                onBlur={(e) => set("search", e.target.value)} />
            </div>
          ) : null}
          {meta.filters.length ? (
            <Button size="sm" onClick={() => setShowFilters((s) => !s)}>
              {t.filters}{activeFilters ? ` (${activeFilters})` : ""}
            </Button>
          ) : null}
          {activeFilters ? (
            <Button size="sm" variant="ghost" onClick={() => setState(new URLSearchParams())}>
              {t.clearFilters}
            </Button>
          ) : null}
          {selected.length && bulkAllowed ? (
            <div className="row" style={{ marginLeft: "auto" }}>
              <span className="small muted">{selected.length} {t.selected}</span>
              {meta.bulk_actions.map((b) => (
                <Button key={b.name} size="sm" onClick={() => runBulk(b.name, b.label)}>{b.label}</Button>
              ))}
              {meta.permissions.delete ? (
                <Button size="sm" variant="danger" onClick={() => runBulk("delete", t.delete)}>{t.delete}</Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {showFilters ? (
          <div className="filter-bar">
            {meta.filters.map((f) => <FilterControl key={f.name} filter={f} params={state} set={set} />)}
          </div>
        ) : null}
        {list.error ? <div style={{ padding: 12 }}><Alert tone="danger">{(list.error as Error).message}</Alert></div> : null}
        {list.isLoading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {bulkAllowed ? (
                    <th style={{ width: 32 }}>
                      <input type="checkbox" aria-label="Избери ги сите"
                        checked={allIds.length > 0 && allIds.every((id) => selected.includes(id))}
                        onChange={(e) => setSelected(e.target.checked ? allIds : [])} />
                    </th>
                  ) : null}
                  {meta.columns.map((c) => (
                    <th key={c.name} className={`${c.sortable ? "sortable" : ""} ${isNumericType(c.type) ? "num" : ""}`}
                      onClick={() => sortBy(c)} aria-sort={ordering === c.name ? "ascending" : ordering === `-${c.name}` ? "descending" : undefined}>
                      {c.label}{ordering === c.name ? " ▲" : ordering === `-${c.name}` ? " ▼" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="clickable" onClick={() => navigate(`${route}/${row.id}`)}>
                    {bulkAllowed ? (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Избери ${row.id}`} checked={selected.includes(row.id)}
                          onChange={(e) => setSelected((s) => e.target.checked ? [...s, row.id] : s.filter((x) => x !== row.id))} />
                      </td>
                    ) : null}
                    {meta.columns.map((c, i) => (
                      <td key={c.name} className={isNumericType(c.type) ? "num" : ""}>
                        {i === 0 ? <Link to={`${route}/${row.id}`} onClick={(e) => e.stopPropagation()}><Cell row={row} col={c} /></Link>
                          : <Cell row={row} col={c} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && list.data.pages > 1 ? (
          <div className="pager">
            <Button size="sm" disabled={list.data.page <= 1} onClick={() => set("page", String(list.data!.page - 1))}>‹</Button>
            <span className="small">{t.page} {list.data.page} {t.of} {list.data.pages}</span>
            <Button size="sm" disabled={list.data.page >= list.data.pages} onClick={() => set("page", String(list.data!.page + 1))}>›</Button>
            {list.isFetching ? <span className="spinner" aria-hidden /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
