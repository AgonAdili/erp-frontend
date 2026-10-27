/** My approvals inbox (decide here, or open the record when the module decides there) and my notifications. */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight, CornerUpLeft, ExternalLink, Inbox, X } from "lucide-react";

import { api, ApiError } from "@/api/client";
import type { Page as ApiPage, Row } from "@/api/types";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, IconButton, LinkButton, Modal, PageHeader, Panel, Segmented, SkeletonRows, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";
import { Page } from "@/layout/Page";
import { formatDateTime, formatMoney, formatNumber, formatRelative } from "@/lib/format";

type Decision = "APPROVE" | "ACCEPT" | "REJECT" | "RETURN";

const DECISION: Record<Decision, { title: string; button: string; done: string }> = {
  APPROVE: { title: "Одобри", button: "Одобри", done: "Одобрено" },
  ACCEPT: { title: "Прифати", button: "Прифати", done: "Прифатено" },
  RETURN: { title: "Врати на дополнување", button: "Врати", done: "Вратено" },
  REJECT: { title: "Одбиј", button: "Одбиј", done: "Одбиено" },
};

const PAGE = 50;

function Pager({ page, pages, set }: { page: number; pages: number; set: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <span className="spacer" />
      <IconButton label="Претходна страна" icon={ChevronLeft} size="sm" variant="default" disabled={page <= 1} onClick={() => set(page - 1)} />
      <span className="num">{t.page} {page} {t.of} {pages}</span>
      <IconButton label="Следна страна" icon={ChevronRight} size="sm" variant="default" disabled={page >= pages} onClick={() => set(page + 1)} />
    </div>
  );
}

export function InboxScreen() {
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["inbox", "all", page], queryFn: () => api.get<ApiPage<Row>>("/workflow/inbox/", { page_size: PAGE, page }), placeholderData: (p) => p });
  const [acting, setActing] = useState<{ row: Row; decision: Decision } | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = q.data?.results ?? [];
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const k = String(r.definition_label ?? r.definition_code ?? "Друго");
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [rows]);

  const act = async () => {
    if (!acting) return;
    setError("");
    setBusy(true);
    try {
      await api.post(`/workflow/inbox/${acting.row.id}/act/`, { decision: acting.decision, comment });
      toast(`${DECISION[acting.decision].done}: ${String(acting.row.title)}`, "success");
      setActing(null);
      setComment("");
      void qc.invalidateQueries({ queryKey: ["inbox"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const needsComment = acting && (acting.decision === "REJECT" || acting.decision === "RETURN");

  return (
    <Page title={t.inbox}>
      <PageHeader title={t.inbox} subtitle={q.data ? (q.data.count ? `${formatNumber(q.data.count, 0)} барања чекаат ваша одлука` : "Нема ништо што чека ваша одлука") : " "} />
      {q.isLoading ? <Panel flush><SkeletonRows rows={6} cols={5} /></Panel> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !rows.length ? (
        <Panel><EmptyState icon={Inbox} title="Сè е решено">Кога некој ќе побара ваше одобрување, ќе се појави тука и во известувањата.</EmptyState></Panel>
      ) : groups.map(([flow, list]) => (
        <Panel key={flow} title={flow} sub={`${list.length} ${list.length === 1 ? "барање" : "барања"}`} flush>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Барање</th><th>Фаза</th><th className="num">Износ</th><th>Поднесено</th><th aria-label={t.actions} /></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="wrap">{r.target_route ? <Link to={String(r.target_route)}>{String(r.title)}</Link> : <span className="strong">{String(r.title)}</span>}</td>
                    <td><Badge tone="warning">{String(r.stage_name ?? "")}</Badge></td>
                    <td className="num">{r.amount ? formatMoney(r.amount) : <span className="muted-cell">—</span>}</td>
                    <td className="small nowrap"><span title={formatDateTime(r.created_at)}>{formatRelative(r.created_at)}</span><div className="xs muted">{String(r.initiated_by_label ?? "")}</div></td>
                    <td className="right nowrap">
                      {r.requires_external_action ? (
                        r.target_route ? <LinkButton size="sm" icon={ExternalLink} to={String(r.target_route)}>Одлучи во записот</LinkButton> : null
                      ) : (
                        <div className="row-tight" style={{ justifyContent: "flex-end" }}>
                          <Button size="sm" variant="primary" icon={Check} onClick={() => { setError(""); setActing({ row: r, decision: "APPROVE" }); }}>
                            {String(r.approve_label || "Одобри")}
                          </Button>
                          <Button size="sm" icon={CornerUpLeft} onClick={() => { setError(""); setActing({ row: r, decision: "RETURN" }); }}>Врати</Button>
                          <Button size="sm" variant="danger" icon={X} onClick={() => { setError(""); setActing({ row: r, decision: "REJECT" }); }}>Одбиј</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
      {q.data ? <Pager page={page} pages={q.data.pages} set={setPage} /> : null}
      {acting ? (
        <Modal title={`${DECISION[acting.decision].title}: ${String(acting.row.title)}`}
          description={`${String(acting.row.definition_label ?? "")} · ${String(acting.row.stage_name ?? "")}${acting.row.amount ? ` · ${formatMoney(acting.row.amount)} ден.` : ""}`}
          onClose={() => setActing(null)}
          footer={<>
            <Button onClick={() => setActing(null)}>{t.cancel}</Button>
            <Button variant={acting.decision === "REJECT" ? "danger-solid" : "primary"} busy={busy} onClick={() => void act()}
              disabled={Boolean(needsComment) && !comment.trim()}>
              {acting.decision === "APPROVE" ? String(acting.row.approve_label || DECISION.APPROVE.button) : DECISION[acting.decision].button}
            </Button>
          </>}>
          <div className="stack">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Field label={needsComment ? "Причина" : "Коментар (незадолжително)"} required={Boolean(needsComment)} htmlFor="wf-comment"
              help={needsComment ? "Подносителот ќе ја види причината." : undefined}>
              <textarea id="wf-comment" className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
          </div>
        </Modal>
      ) : null}
    </Page>
  );
}

const LEVEL_TONE: Record<string, string> = { WARNING: "danger", ACTION: "warning", SUCCESS: "success" };

export function NotificationsScreen() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [filter, setFilter] = useState<"unread" | "all">("unread");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["notifications", "list", filter, page],
    queryFn: () => api.get<ApiPage<Row>>("/workflow/notifications/", { page_size: PAGE, page, ...(filter === "unread" ? { is_read: "false" } : {}) }),
    placeholderData: (p) => p,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = async (n: Row) => {
    await api.post(`/workflow/notifications/${n.id}/read/`).catch(() => undefined);
    refresh();
  };
  const rows = q.data?.results ?? [];
  return (
    <Page title={t.notifications} narrow>
      <PageHeader title={t.notifications}
        actions={<>
          <Segmented label="Прикажи" value={filter} onChange={(v) => { setFilter(v); setPage(1); }}
            options={[{ value: "unread", label: "Непрочитани" }, { value: "all", label: "Сите" }]} />
          <Button icon={CheckCheck} onClick={async () => {
            try { await api.post("/workflow/notifications/read-all/"); toast("Сите известувања се означени како прочитани", "success"); refresh(); }
            catch (err) { toast((err as Error).message, "danger"); }
          }}>{t.markAllRead}</Button>
        </>} />
      <Panel flush>
        {q.isLoading ? <SkeletonRows rows={6} cols={3} /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !rows.length ? (
          <EmptyState icon={Bell} title={filter === "unread" ? "Нема непрочитани известувања" : "Нема известувања"} />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((n) => (
              <li key={n.id} className="notif-row" style={{ fontWeight: n.is_read ? 400 : 500 }}>
                <Badge tone={LEVEL_TONE[String(n.level)] ?? "info"}>{String(n.level_display ?? n.level)}</Badge>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {n.route ? (
                    <button type="button" className="link-button" onClick={() => { void markRead(n); navigate(String(n.route)); }}>{String(n.title)}</button>
                  ) : <span>{String(n.title)}</span>}
                  {n.message ? <div className="small muted" style={{ fontWeight: 400 }}>{String(n.message)}</div> : null}
                </div>
                <span className="xs muted nowrap" title={formatDateTime(n.created_at)}>{formatRelative(n.created_at)}</span>
                {!n.is_read ? <IconButton label={t.markRead} icon={Check} size="sm" onClick={() => void markRead(n)} /> : <span style={{ width: 28 }} />}
              </li>
            ))}
          </ul>
        )}
        {q.data ? <Pager page={page} pages={q.data.pages} set={setPage} /> : null}
      </Panel>
    </Page>
  );
}
