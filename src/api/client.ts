/**
 * The one way the SPA talks to the API.
 *
 * - Session cookie authentication; the CSRF token comes in the JSON of /auth/session/ (the cookie is
 *   HttpOnly) and is sent as X-CSRFToken on every unsafe request.
 * - The backend's single error shape {detail, code, errors} becomes an ApiError.
 * - Optimistic concurrency: pass `version` and it is sent as If-Match.
 * - POSTs may carry an Idempotency-Key so a retried submit is not applied twice.
 */

export const API_BASE = "/api/v1";

export interface ApiErrorBody {
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
  current_version?: number;
}

export class ApiError extends Error {
  status: number;
  code: string;
  errors: Record<string, string[]>;
  currentVersion?: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail || defaultMessage(status));
    this.name = "ApiError";
    this.status = status;
    this.code = body.code || String(status);
    this.errors = body.errors || {};
    this.currentVersion = body.current_version;
  }

  /** First message for a field, for form error display. */
  fieldError(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return "Сесијата истече. Најавете се повторно.";
  if (status === 403) return "Немате дозвола за оваа акција.";
  if (status === 404) return "Записот не е пронајден.";
  if (status === 409) return "Записот е изменет од друг корисник. Освежете и обидете се повторно.";
  if (status === 428) return "Потребна е верзијата на записот.";
  if (status === 429) return "Премногу барања. Обидете се повторно подоцна.";
  if (status >= 500) return "Грешка на серверот. Обидете се повторно.";
  return "Барањето не успеа.";
}

let csrfToken = "";
let onUnauthorized: (() => void) | null = null;

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export function buildUrl(path: string, query?: Query): string {
  const base = path.startsWith("http") || path.startsWith(API_BASE) ? path : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  version?: number | null;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Return the raw Response (downloads). */
  raw?: boolean;
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (method !== "GET") {
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
    if (options.version !== undefined && options.version !== null) headers["If-Match"] = `"${options.version}"`;
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  }
  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    body,
    credentials: "same-origin",
    signal: options.signal,
  });
  if (response.status === 401 && onUnauthorized) onUnauthorized();
  if (!response.ok) {
    let data: ApiErrorBody = {};
    try {
      data = (await response.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error page */
    }
    throw new ApiError(response.status, data);
  }
  if (options.raw) return response as unknown as T;
  if (response.status === 204) return undefined as T;
  const type = response.headers.get("Content-Type") || "";
  if (type.includes("application/json")) return (await response.json()) as T;
  return (await response.blob()) as unknown as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, extra: Omit<RequestOptions, "method" | "body"> = {}) =>
    request<T>(path, { ...extra, method: "POST", body }),
  patch: <T>(path: string, body: unknown, version?: number | null) =>
    request<T>(path, { method: "PATCH", body, version }),
  put: <T>(path: string, body: unknown, version?: number | null) =>
    request<T>(path, { method: "PUT", body, version }),
  del: (path: string, version?: number | null) => request<void>(path, { method: "DELETE", version }),
};

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Download a file response (PDF, export) and save it under the server's filename. */
export interface TaskRef {
  task_id: string;
  status: string;
}

/** Saves the file, or returns the background task when the server queued it (202). */
export async function download(path: string, query?: Query, method: "GET" | "POST" = "GET"): Promise<TaskRef | void> {
  const response = await request<Response>(path, { method, query, raw: true });
  if ((response.headers.get("Content-Type") || "").includes("application/json")) {
    return (await response.json()) as TaskRef;
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const name = match ? match[1] : "download";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open a PDF endpoint in a new tab (inline disposition). */
export function openInNewTab(path: string, query?: Query) {
  window.open(buildUrl(path, query), "_blank", "noopener");
}
