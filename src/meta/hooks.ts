/** Resource metadata and the generic data hooks every metadata-driven screen uses. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, API_BASE, type Query } from "@/api/client";
import type { Page, ResourceIndexEntry, ResourceMeta, Row } from "@/api/types";

/** `/api/v1/fleet/travel-orders/` ⇄ route `/fleet/travel-orders`. */
export function endpointFor(module: string, path: string): string {
  return `${API_BASE}/${module}/${path}/`;
}

export function routeFor(endpoint: string): string {
  return "/" + endpoint.replace(API_BASE, "").replace(/^\/+|\/+$/g, "");
}

export function useResourceIndex(enabled = true) {
  return useQuery({
    queryKey: ["meta", "resources"],
    queryFn: () => api.get<ResourceIndexEntry[]>("/meta/resources/"),
    staleTime: 10 * 60_000,
    enabled,
  });
}

export function useMeta(endpoint: string | undefined) {
  return useQuery({
    queryKey: ["meta", endpoint],
    queryFn: () => api.get<ResourceMeta>(`${endpoint}meta/`),
    staleTime: 10 * 60_000,
    enabled: Boolean(endpoint),
  });
}

export function useList(endpoint: string | undefined, query: Query, enabled = true) {
  return useQuery({
    queryKey: ["list", endpoint, query],
    queryFn: ({ signal }) => api.get<Page<Row>>(endpoint as string, query, signal),
    enabled: Boolean(endpoint) && enabled,
    placeholderData: (previous) => previous,
  });
}

export function useRecord(endpoint: string | undefined, id: string | number | undefined) {
  return useQuery({
    queryKey: ["record", endpoint, String(id)],
    queryFn: () => api.get<Row>(`${endpoint}${id}/`),
    enabled: Boolean(endpoint) && id !== undefined && id !== "new",
  });
}

/** Invalidate everything shown for a resource after a write. */
export function useInvalidateResource(endpoint: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["list", endpoint] });
    void queryClient.invalidateQueries({ queryKey: ["record", endpoint] });
  };
}

export function useSave(endpoint: string) {
  const invalidate = useInvalidateResource(endpoint);
  return useMutation({
    mutationFn: ({ id, data, version }: { id?: number; data: Record<string, unknown> | FormData; version?: number }) =>
      id
        ? api.patch<Row>(`${endpoint}${id}/`, data instanceof FormData ? data : { ...data, version }, version)
        : api.post<Row>(endpoint, data),
    onSuccess: invalidate,
  });
}

export function useDelete(endpoint: string) {
  const invalidate = useInvalidateResource(endpoint);
  return useMutation({
    mutationFn: ({ id, version }: { id: number; version?: number }) => api.del(`${endpoint}${id}/`, version),
    onSuccess: invalidate,
  });
}
