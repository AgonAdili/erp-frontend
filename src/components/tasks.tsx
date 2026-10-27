/** Background jobs started from the UI (large exports, payroll generation, PDF lists): progress and result. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { api } from "@/api/client";
import { t } from "@/i18n/mk";

import { Button } from "./ui";

interface TaskRun {
  id: string;
  name: string;
  status: string;
  progress: number;
  message: string;
  finished: boolean;
  result: Record<string, unknown> | null;
  file: { name: string; url: string | null } | null;
}

interface Tracked {
  id: string;
  label: string;
  run?: TaskRun;
}

const TasksContext = createContext<(taskId: string, label: string) => void>(() => undefined);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Tracked[]>([]);
  const track = useCallback((id: string, label: string) => {
    setTasks((list) => (list.some((x) => x.id === id) ? list : [...list, { id, label }]));
  }, []);

  useEffect(() => {
    const open = tasks.filter((x) => !x.run?.finished);
    if (!open.length) return;
    const timer = window.setTimeout(async () => {
      const updates = await Promise.all(open.map((x) => api.get<TaskRun>(`/tasks/${x.id}/`).catch(() => null)));
      setTasks((list) => list.map((x) => {
        const u = updates.find((r) => r?.id === x.id);
        return u ? { ...x, run: u } : x;
      }));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [tasks]);

  return (
    <TasksContext.Provider value={track}>
      {children}
      {tasks.length ? (
        <div className="toasts" style={{ bottom: 80 }} aria-live="polite">
          {tasks.map((x) => (
            <div key={x.id} className="card" style={{ minWidth: 300, padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong className="small">{x.label}</strong>
                <Button size="sm" variant="ghost" aria-label={t.close}
                  onClick={() => setTasks((list) => list.filter((y) => y.id !== x.id))}>✕</Button>
              </div>
              {!x.run || !x.run.finished ? (
                <div className="small muted">{t.taskRunning} {x.run ? `${Math.round(x.run.progress)}%` : ""} {x.run?.message}</div>
              ) : x.run.status === "SUCCEEDED" ? (
                <div className="small">
                  {String(x.run.result?.message ?? t.taskDone)}{" "}
                  {x.run.file?.url ? <a href={x.run.file.url}>{x.run.file.name}</a> : null}
                </div>
              ) : (
                <div className="small" style={{ color: "var(--danger)" }}>{x.run.message || t.taskFailed}</div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </TasksContext.Provider>
  );
}

export function useTrackTask() {
  return useContext(TasksContext);
}
