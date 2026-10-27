/**
 * Server push (GET /api/v1/events/stream, SSE). Events carry identifiers only; the screens refetch what they
 * show. Changes are batched for a second so a burst (a payroll run) causes one refetch, not hundreds.
 * EventSource reconnects by itself and sends Last-Event-ID, so missed events are replayed by the server.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { API_BASE } from "@/api/client";

export function useLiveUpdates(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const source = new EventSource(`${API_BASE}/events/stream`, { withCredentials: true });
    let pending: number | null = null;
    const refreshData = () => {
      if (pending !== null) return;
      pending = window.setTimeout(() => {
        pending = null;
        void queryClient.invalidateQueries({ queryKey: ["list"] });
        void queryClient.invalidateQueries({ queryKey: ["record"] });
      }, 1000);
    };
    source.addEventListener("change", refreshData);
    source.addEventListener("notification", () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    });
    source.addEventListener("resync", () => void queryClient.invalidateQueries());
    source.addEventListener("end", () => source.close());
    return () => {
      if (pending !== null) window.clearTimeout(pending);
      source.close();
    };
  }, [enabled, queryClient]);
}
