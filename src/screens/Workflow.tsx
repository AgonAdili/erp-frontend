/** My approvals inbox (decide here, or open the record when the module decides there) and my notifications. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/api/client";
import type { Page, Row } from "@/api/types";
import { Alert, Badge, Button, EmptyState, Field, Modal, Spinner, useToast } from "@/components/ui";
import { t } from "@/i18n/mk";
import { formatDateTime, formatMoney } from "@/lib/format";

type Decision = "APPROVE" | "ACCEPT" | "REJECT" | "RETURN";

export function InboxScreen() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["inbox", "all"], queryFn: () => api.get<Page<Row>>("/workflow/inbox/", { page_size: 100 }) });
  const [acting, setActing] = useState<{ row: Row; decision: Decision } | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const act = async () => {
    if (!acting) return;
    setError("");
    try {
      await api.post(`/workflow/inbox/${acting.row.id}/act/`, { decision: acting.decision, comment });
      toast(t.done);
      setActing(null);
      setComment("");
      void qc.invalidateQueries({ queryKey: ["inbox"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  return (
    <div className="stack">
      <div className="page-head"><h1>{t.inbox}</h1></div>
      <div className="card flush">
        {q.isLoading ? <Spinner /> : !(q.data?.results ?? []).length ? <EmptyState /> : (
          <table className="table">
            <thead><tr><th>Барање</th><th>Тек</th><th>Фаза</th><th className="num">Износ</th><th>Поднесено</th><th /></tr></thead>
            <tbody>
              {(q.data?.results ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.target_route ? <Link to={String(r.target_route)}>{String(r.title)}</Link> : String(r.title)}</td>
                  <td>{String(r.definition_label ?? r.definition_code ?? "")}</td>
                  <td><Badge tone="warning">{String(r.stage_name ?? "")}</Badge></td>
                  <td className="num">{formatMoney(r.amount)}</td>
                  <td className="small">{formatDateTime(r.created_at)}<div className="muted">{String(r.initiated_by_label ?? "")}</div></td>
                  <td className="right nowrap">
                    {r.requires_external_action ? (
                      r.target_route ? <Link className="btn sm" to={String(r.target_route)}>Отвори</Link> : null
                    ) : (
                      <div className="row" style={{ justifyContent: "flex-end", gap: 4 }}>
                        <Button size="sm" variant="primary" onClick={() => setActing({ row: r, decision: "APPROVE" })}>
                          {String(r.approve_label || "Одобри")}
                        </Button>
                        <Button size="sm" onClick={() => setActing({ row: r, decision: "RETURN" })}>Врати</Button>
                        <Button size="sm" variant="danger" onClick={() => setActing({ row: r, decision: "REJECT" })}>Одбиј</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {acting ? (
        <Modal title={String(acting.row.title)} onClose={() => setActing(null)}
          footer={<>
            <Button onClick={() => setActing(null)}>{t.cancel}</Button>
            <Button variant={acting.decision === "REJECT" ? "danger" : "primary"} onClick={act}
              disabled={(acting.decision === "REJECT" || acting.decision === "RETURN") && !comment.trim()}>
              {t.confirm}
            </Button>
          </>}>
          <div className="stack">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Field label="Коментар" required={acting.decision !== "APPROVE"} htmlFor="wf-comment">
              <textarea id="wf-comment" className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function NotificationsScreen() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(true);
  const q = useQuery({
    queryKey: ["notifications", "list", unreadOnly],
    queryFn: () => api.get<Page<Row>>("/workflow/notifications/", { page_size: 100, ...(unreadOnly ? { is_read: "false" } : {}) }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["notifications"] });
  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t.notifications}</h1>
        <span className="spacer" />
        <label className="check"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Само непрочитани</label>
        <Button size="sm" onClick={async () => { await api.post("/workflow/notifications/read-all/"); refresh(); }}>{t.markAllRead}</Button>
      </div>
      <div className="card flush">
        {q.isLoading ? <Spinner /> : !(q.data?.results ?? []).length ? <EmptyState /> : (
          <table className="table">
            <tbody>
              {(q.data?.results ?? []).map((n) => (
                <tr key={n.id} style={{ fontWeight: n.is_read ? 400 : 600 }}>
                  <td style={{ width: 90 }}><Badge tone={n.level === "WARNING" ? "danger" : n.level === "ACTION" ? "warning" : n.level === "SUCCESS" ? "success" : "info"}>
                    {String(n.level_display ?? n.level)}</Badge></td>
                  <td>
                    {n.route ? <Link to={String(n.route)} onClick={() => void api.post(`/workflow/notifications/${n.id}/read/`).then(refresh)}>
                      {String(n.title)}</Link> : String(n.title)}
                    {n.message ? <div className="small muted">{String(n.message)}</div> : null}
                  </td>
                  <td className="small muted nowrap">{formatDateTime(n.created_at)}</td>
                  <td className="right">
                    {!n.is_read ? <Button size="sm" variant="ghost" onClick={async () => {
                      await api.post(`/workflow/notifications/${n.id}/read/`); refresh();
                    }}>✓</Button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
