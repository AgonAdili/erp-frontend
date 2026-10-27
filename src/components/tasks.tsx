/** Background jobs started from the UI (large exports, payroll generation, PDF lists): progress lives in a
 * toast that turns into the result (with the file to download) or the failure reason. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { api } from "@/api/client";
import { t } from "@/i18n/mk";

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
}

const TasksContext = createContext<(taskId: string, label: string) => void>(() => undefined);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Tracked[]>([]);
  const track = useCallback((id: string, label: string) => {
    toast.loading(label, { id, description: t.taskRunning, duration: Infinity });
    setOpen((list) => (list.some((x) => x.id === id) ? list : [...list, { id, label }]));
  }, []);

  useEffect(() => {
    if (!open.length) return;
    const timer = window.setTimeout(async () => {
      const runs = await Promise.all(open.map((x) => api.get<TaskRun>(`/tasks/${x.id}/`).catch(() => null)));
      const finished = new Set<string>();
      runs.forEach((run, i) => {
        const x = open[i];
        if (!run) return;
        if (!run.finished) {
          toast.loading(x.label, { id: x.id, duration: Infinity,
            description: `${t.taskRunning} ${Math.round(run.progress)}%${run.message ? ` · ${run.message}` : ""}` });
          return;
        }
        finished.add(x.id);
        if (run.status === "SUCCEEDED") {
          const url = run.file?.url;
          toast.success(x.label, {
            id: x.id, duration: url ? 20_000 : 6000,
            description: String(run.result?.message ?? (url ? run.file?.name : t.taskDone)),
            action: url ? { label: t.download, onClick: () => window.open(url, "_blank", "noopener") } : undefined,
          });
        } else {
          toast.error(x.label, { id: x.id, duration: 10_000, description: run.message || t.taskFailed });
        }
      });
      if (finished.size) setOpen((list) => list.filter((x) => !finished.has(x.id)));
      else setOpen((list) => [...list]);   // poll again
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [open]);

  return <TasksContext.Provider value={track}>{children}</TasksContext.Provider>;
}

export function useTrackTask() {
  return useContext(TasksContext);
}
