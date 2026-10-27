/** The navigation map: rail groups, their overview and custom screens, and which API resources they show
 * first. Every other resource the user may view lands in its group's "more" fold by its URL section. */
import {
  Archive, BookOpen, Building2, ChartLine, Construction, FileSignature, HardHat, Handshake, ShoppingCart, Settings,
  Truck, Users, Wallet, Warehouse, type LucideIcon,
} from "lucide-react";

export interface NavLink {
  to: string;
  label: string;
  /** Permission code; without one the link shows when the group has any viewable resource. */
  code?: string;
  /** The module's overview (dashboard). */
  overview?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  /** First URL section(s) of the API resources this group owns. */
  segments: string[];
  links: NavLink[];
  /** Resource routes (without leading slash) shown first, in this order. */
  primary: string[];
}

export const NAV: NavGroup[] = [
  {
    key: "offers", label: "Понуди", icon: FileSignature, segments: ["offers"],
    links: [
      { to: "/offers", label: "Преглед", code: "offers.dashboard.view", overview: true },
      { to: "/offers/approvals", label: "Одобрување понуди", code: "offers.approval.view" },
    ],
    primary: ["offers/requests", "offers/offers", "offers/followups", "offers/site-visits", "offers/master-price-list", "offers/price-list-versions"],
  },
  {
    key: "workorders", label: "Работни налози", icon: HardHat, segments: ["workorders"],
    links: [
      { to: "/workorders", label: "Преглед", code: "work_orders.dashboard.view", overview: true },
      { to: "/workorders/resource-board", label: "Распоред на ресурси", code: "work_orders.resource_board.view" },
    ],
    primary: ["workorders/work-orders", "workorders/daily-reports"],
  },
  {
    key: "procurement", label: "Набавка", icon: ShoppingCart, segments: ["procurement"],
    links: [{ to: "/procurement", label: "Преглед", code: "procurement.dashboard.view", overview: true }],
    primary: ["procurement/requests", "procurement/rfqs", "procurement/quotations", "procurement/purchase-orders",
      "procurement/goods-receipts", "procurement/invoices"],
  },
  {
    key: "projects", label: "Проекти и буџет", icon: Construction, segments: ["projects", "budget"],
    links: [
      { to: "/projects", label: "Преглед", overview: true },
      { to: "/budget/portfolio", label: "Буџет по проекти", code: "finance.budget.view" },
    ],
    primary: ["projects/projects", "projects/boqs", "projects/certificates", "projects/diary-books", "projects/measurement-books",
      "budget/budgets", "budget/costs"],
  },
  {
    key: "inventory", label: "Магацин", icon: Warehouse, segments: ["inventory", "catalog"],
    links: [
      { to: "/inventory", label: "Преглед", code: "inventory.movements.view", overview: true },
      { to: "/inventory/stock", label: "Залиха и вреднување", code: "inventory.movements.view" },
    ],
    primary: ["inventory/documents", "inventory/movements", "catalog/items", "catalog/warehouses"],
  },
  {
    key: "fleet", label: "Возен парк", icon: Truck, segments: ["fleet"],
    links: [
      { to: "/fleet", label: "Преглед", code: "fleet.dashboard.view", overview: true },
      { to: "/fleet/efficiency", label: "Потрошувачка наспроти норма", code: "fleet.reports.view" },
    ],
    primary: ["fleet/daily-reports", "fleet/travel-orders", "assets/vehicles", "fleet/drivers", "fleet/maintenance", "fleet/fines",
      "fleet/documents", "fleet/expenses", "fleet/wheels", "fleet/schedules"],
  },
  {
    key: "assets", label: "Основни средства", icon: Building2, segments: ["assets"],
    links: [{ to: "/assets", label: "Преглед", overview: true }],
    primary: ["assets/fixed-assets", "assets/depreciation-runs", "assets/transfers", "assets/disposals", "assets/stocktakes", "assets/locations"],
  },
  {
    key: "people", label: "Луѓе", icon: Users, segments: ["hr", "people"],
    links: [
      { to: "/hr", label: "Преглед", code: "hr.dashboard.view", overview: true },
      { to: "/hr/attendance-day", label: "Присуство по ден", code: "hr.attendance.add" },
      { to: "/hr/attendance-month", label: "Присуство по месец", code: "hr.attendance.add" },
      { to: "/hr/leave-timeline", label: "Распоред на отсуства", code: "hr.leaves.view" },
      { to: "/hr/kpi-month", label: "Показатели по месец", code: "hr.kpi.view" },
    ],
    primary: ["people/employees", "hr/attendance", "hr/leaves", "hr/payroll", "hr/mpin", "hr/loans", "hr/bailiffs",
      "hr/disciplinary-actions", "hr/employee-documents"],
  },
  {
    key: "finance", label: "Финансии", icon: Wallet, segments: ["finance", "payables", "receivables"],
    links: [
      { to: "/finance", label: "Преглед", code: "finance.dashboard.view", overview: true },
      { to: "/payables", label: "Обврски кон добавувачи" },
      { to: "/receivables", label: "Побарувања од купувачи" },
    ],
    primary: ["finance/cashbook", "payables/invoices", "payables/open-items", "payables/payments", "receivables/invoices",
      "receivables/open-items", "receivables/receipts", "finance/loans", "finance/forecasts"],
  },
  {
    key: "accounting", label: "Сметководство", icon: BookOpen, segments: ["accounting"],
    links: [{ to: "/accounting", label: "Преглед", code: "accounting.dashboard.view", overview: true }],
    primary: ["accounting/journal-entries", "accounting/ledger", "accounting/accounts", "accounting/fiscal-periods",
      "accounting/close-tasks", "accounting/vat-entries", "accounting/tax-periods"],
  },
  {
    key: "partners", label: "Партнери", icon: Handshake, segments: ["partners"],
    links: [{ to: "/partners", label: "Преглед", overview: true }],
    primary: ["partners/partners"],
  },
  {
    key: "dms", label: "Архива", icon: Archive, segments: ["dms"],
    links: [{ to: "/dms", label: "Преглед", overview: true }],
    primary: ["dms/center", "dms/documents", "dms/registers", "dms/ledger", "dms/classifications"],
  },
  {
    key: "analytics", label: "Аналитика", icon: ChartLine, segments: ["analytics"],
    links: [{ to: "/analytics", label: "Профитабилност и трошоци", code: "analytics.dashboard.view", overview: true }],
    primary: [],
  },
  {
    key: "admin", label: "Администрација", icon: Settings, segments: ["identity", "org", "reference", "workflow", "core"],
    links: [],
    primary: ["identity/users", "identity/roles", "identity/entity-access", "org/legal-entities", "org/departments",
      "workflow/definitions", "identity/access-reviews", "identity/auth-events"],
  },
];

/** Resources that have their own screen and are not listed in the navigation. */
export const HIDDEN_ROUTES = new Set(["workflow/inbox", "workflow/notifications"]);

/** Old dashboard URLs → new overview routes. */
export const REDIRECTS: Record<string, string> = {
  "/offers/dashboard": "/offers",
  "/procurement/dashboard": "/procurement",
  "/accounting/dashboard": "/accounting",
  "/finance/dashboard": "/finance",
  "/workorders/dashboard": "/workorders",
  "/fleet/dashboard": "/fleet",
  "/hr/dashboard": "/hr",
  "/workflow/inbox-screen": "/inbox",
  "/workflow/notifications": "/notifications",
};

/** `/fleet/travel-orders/12` → "fleet/travel-orders". */
export function resourcePath(pathname: string): string {
  return pathname.replace(/^\/+/, "").split("/").slice(0, 2).join("/");
}

export function groupForPath(pathname: string): NavGroup | undefined {
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  if (!clean) return undefined;
  const res = resourcePath(pathname);
  const byPrimary = NAV.find((g) => g.primary.includes(res));
  if (byPrimary) return byPrimary;
  const byLink = NAV.find((g) => g.links.some((l) => l.to === `/${clean}` || l.to === `/${res}`));
  if (byLink) return byLink;
  const seg = clean.split("/")[0];
  return NAV.find((g) => g.segments.includes(seg)) ?? (seg === "inbox" || seg === "notifications" || seg === "profile" ? undefined : NAV.at(-1));
}

export function overviewOf(group: NavGroup): NavLink | undefined {
  return group.links.find((l) => l.overview);
}
