/** Routes. Module overviews and tools first; every API resource is reachable generically at /<module>/<resource>.
 * Each screen file is its own chunk, so the first load carries only the shell. */
import { Component, lazy, Suspense, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { useSession } from "@/auth/session";
import { Button, EmptyState, LinkButton, Spinner } from "@/components/ui";
import { t } from "@/i18n/mk";
import { AppShell } from "@/layout/AppShell";
import { NotFound } from "@/layout/NotFound";
import { REDIRECTS } from "@/nav/modules";
import { Login } from "@/screens/Login";

function named<T extends Record<string, ComponentType<never>>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }));
}

const Home = named(() => import("@/screens/Home"), "Home");
const Profile = named(() => import("@/screens/Profile"), "Profile");
const InboxScreen = named(() => import("@/screens/Workflow"), "InboxScreen");
const NotificationsScreen = named(() => import("@/screens/Workflow"), "NotificationsScreen");
const ResourceScreen = lazy(async () => ({ default: (await import("@/screens/ResourceScreen")).ResourceScreen }));

const OffersOverview = named(() => import("@/screens/overviews/offers"), "OffersOverview");
const OfferApprovals = named(() => import("@/screens/boards"), "OfferApprovals");
const WorkOrdersOverview = named(() => import("@/screens/overviews/workorders"), "WorkOrdersOverview");
const ResourceBoard = named(() => import("@/screens/boards"), "ResourceBoard");
const ProcurementOverview = named(() => import("@/screens/overviews/procurement"), "ProcurementOverview");
const ProjectsOverview = named(() => import("@/screens/overviews/projects"), "ProjectsOverview");
const BudgetPortfolio = named(() => import("@/screens/overviews/projects"), "BudgetPortfolio");
const InventoryOverview = named(() => import("@/screens/overviews/inventory"), "InventoryOverview");
const StockOverview = named(() => import("@/screens/inventory"), "StockOverview");
const FleetOverview = named(() => import("@/screens/overviews/fleet"), "FleetOverview");
const FuelEfficiency = named(() => import("@/screens/fleet"), "FuelEfficiency");
const AssetsOverview = named(() => import("@/screens/overviews/assets"), "AssetsOverview");
const HrOverview = named(() => import("@/screens/overviews/hr"), "HrOverview");
const AttendanceDay = named(() => import("@/screens/hr"), "AttendanceDay");
const AttendanceMonth = named(() => import("@/screens/hr"), "AttendanceMonth");
const KpiMonth = named(() => import("@/screens/hr"), "KpiMonth");
const LeaveTimeline = named(() => import("@/screens/boards"), "LeaveTimeline");
const FinanceOverview = named(() => import("@/screens/overviews/finance"), "FinanceOverview");
const PayablesOverview = named(() => import("@/screens/overviews/finance"), "PayablesOverview");
const ReceivablesOverview = named(() => import("@/screens/overviews/finance"), "ReceivablesOverview");
const AccountingOverview = named(() => import("@/screens/overviews/accounting"), "AccountingOverview");
const PartnersOverview = named(() => import("@/screens/overviews/partners"), "PartnersOverview");
const DmsOverview = named(() => import("@/screens/overviews/dms"), "DmsOverview");
const Analytics = named(() => import("@/screens/overviews/analytics"), "Analytics");

/** A screen that throws shows a way out instead of a blank page; navigating away resets it. */
class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /dynamically imported module|Failed to fetch|Loading chunk/i.test(this.state.error.message);
    return (
      <div className="page">
        <EmptyState icon={AlertTriangle} title={chunk ? "Достапна е нова верзија" : "Екранот не може да се прикаже"}
          action={<div className="row">
            <Button variant="primary" onClick={() => window.location.reload()}>Вчитај повторно</Button>
            <LinkButton to="/">{t.goHome}</LinkButton>
          </div>}>
          {chunk ? "Апликацијата е ажурирана. Вчитајте ја страницата повторно." : this.state.error.message}
        </EmptyState>
      </div>
    );
  }
}

function Shell() {
  const location = useLocation();
  const redirect = REDIRECTS[location.pathname.replace(/\/+$/, "")];
  if (redirect) return <Navigate to={redirect} replace />;
  return (
    <AppShell>
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/inbox" element={<InboxScreen />} />
            <Route path="/notifications" element={<NotificationsScreen />} />

            <Route path="/offers" element={<OffersOverview />} />
            <Route path="/offers/approvals" element={<OfferApprovals />} />
            <Route path="/workorders" element={<WorkOrdersOverview />} />
            <Route path="/workorders/resource-board" element={<ResourceBoard />} />
            <Route path="/procurement" element={<ProcurementOverview />} />
            <Route path="/projects" element={<ProjectsOverview />} />
            <Route path="/budget" element={<Navigate to="/budget/portfolio" replace />} />
            <Route path="/budget/portfolio" element={<BudgetPortfolio />} />
            <Route path="/inventory" element={<InventoryOverview />} />
            <Route path="/inventory/stock" element={<StockOverview />} />
            <Route path="/fleet" element={<FleetOverview />} />
            <Route path="/fleet/efficiency" element={<FuelEfficiency />} />
            <Route path="/assets" element={<AssetsOverview />} />
            <Route path="/hr" element={<HrOverview />} />
            <Route path="/hr/attendance-day" element={<AttendanceDay />} />
            <Route path="/hr/attendance-month" element={<AttendanceMonth />} />
            <Route path="/hr/kpi-month" element={<KpiMonth />} />
            <Route path="/hr/leave-timeline" element={<LeaveTimeline />} />
            <Route path="/finance" element={<FinanceOverview />} />
            <Route path="/payables" element={<PayablesOverview />} />
            <Route path="/receivables" element={<ReceivablesOverview />} />
            <Route path="/accounting" element={<AccountingOverview />} />
            <Route path="/partners" element={<PartnersOverview />} />
            <Route path="/dms" element={<DmsOverview />} />
            <Route path="/analytics" element={<Analytics />} />

            <Route path="/:module/:path" element={<ResourceScreen mode="list" />} />
            <Route path="/:module/:path/new" element={<ResourceScreen mode="new" />} />
            <Route path="/:module/:path/:id" element={<ResourceScreen mode="detail" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

export function App() {
  const { session, loading } = useSession();
  if (loading) return <Spinner />;
  const signedIn = Boolean(session?.authenticated && session.user && !session.mfa?.pending);
  if (!signedIn) return <Login />;
  return <Shell />;
}
