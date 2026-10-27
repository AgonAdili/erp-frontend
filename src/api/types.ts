/** Shapes returned by the backend (see backend apps/identity/auth_api.py and apps/core/api/metadata.py). */

export interface LegalEntityAccess {
  id: number;
  code: string;
  name: string;
  short_name: string;
  clearance: string;
  is_primary: boolean;
}

export interface SessionUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  tier?: string;
  is_admin?: boolean;
  is_superuser?: boolean;
  procurement_role?: string;
  daily_work_role?: string;
  department_id?: number | null;
  department?: string;
  employee_id?: number | null;
  language?: string;
}

export interface Session {
  authenticated: boolean;
  csrf_token: string;
  sso_enabled: boolean;
  local_login: boolean;
  languages: { code: string; name: string }[];
  language: string;
  session: { idle_timeout: number; idle_warning: number; keepalive_interval: number };
  version: string;
  mfa?: { pending: boolean; enrolled: boolean; required: boolean; verified: boolean; auth_method: string };
  user?: SessionUser;
  access?: {
    codes: string[];
    all_entities: boolean;
    all_departments: boolean;
    default_entity_id: number | null;
    entities: LegalEntityAccess[];
  };
}

export interface Page<T> {
  count: number;
  page: number;
  page_size: number;
  pages: number;
  results: T[];
}

export type FieldType =
  | "string" | "text" | "email" | "url" | "integer" | "decimal" | "boolean" | "date" | "datetime" | "time"
  | "choice" | "fk" | "m2m" | "file" | "json" | "rows" | "upload";

export interface Choice {
  value: string | number;
  label: string;
}

export interface RelatedRef {
  resource?: string;
  endpoint?: string;
  title?: string;
  model?: string;
}

export interface FieldMeta {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  read_only: boolean;
  nullable: boolean;
  help_text: string;
  max_length?: number;
  max_digits?: number;
  decimal_places?: number;
  choices?: Choice[];
  related?: RelatedRef;
  default?: unknown;
  image?: boolean;
  sensitive?: boolean;
  children?: FieldMeta[];
  /** Related options filtered by other form fields: {query param: form field}. */
  depends_on?: Record<string, string>;
  /** Form fields filled from the picked related row: {form field: row attribute}. */
  fills?: Record<string, string>;
  /** Sent, never returned (uploads, passwords). */
  write_only?: boolean;
  /** An API helper not shown to people. */
  hidden?: boolean;
}

export interface ColumnMeta {
  name: string;
  label: string;
  type: FieldType;
  sortable: boolean;
}

export interface FilterMeta {
  name: string;
  label: string;
  lookups: string[];
  type: FieldType;
  choices?: Choice[];
  related?: RelatedRef;
}

export interface ActionInput {
  name: string;
  type: string;
  required?: boolean;
  label?: string;
  endpoint?: string;
  choices?: Choice[];
}

export interface ActionMeta {
  name: string;
  url_path: string;
  detail: boolean;
  methods: string[];
  label: string;
  confirm: string;
  danger: boolean;
  when: Record<string, string[]>;
  input: ActionInput[];
  variant: string;
  group: string;
  download: boolean;
  kind?: "action" | "report" | "download";
  allowed: boolean;
}

export interface ResourceMeta {
  key: string;
  model: string;
  title: string;
  title_singular: string;
  module: string;
  endpoint: string;
  resources: string[];
  permissions: { view: boolean; add: boolean; edit: boolean; delete: boolean };
  fields: FieldMeta[];
  columns: ColumnMeta[];
  filters: FilterMeta[];
  search: boolean;
  ordering: string[];
  ordering_fields: string[] | null;
  actions: ActionMeta[];
  bulk_actions: { name: string; label: string; perm: string }[];
  export_formats: string[];
  entity_scoped: boolean;
  form_layout: unknown;
  detail_layout: unknown;
  versioned: boolean;
}

export interface ResourceIndexEntry {
  key: string;
  title: string;
  module: string;
  endpoint: string;
  permissions: { view: boolean; add: boolean; edit: boolean; delete: boolean };
}

/** A row as returned by a resource: id + fields + `<fk>_label` + `<choice>_display`. */
export type Row = Record<string, unknown> & { id: number; version?: number };
