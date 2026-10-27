/** Routes. Static screens first; every API resource is reachable generically at /<module>/<resource>. */
import { Navigate, Route, Routes } from "react-router-dom";

import { useSession } from "@/auth/session";
import { Spinner } from "@/components/ui";
import { AppShell } from "@/layout/AppShell";
import { Home } from "@/screens/Home";
import { AttendanceDay, AttendanceMonth, HrDashboard, KpiMonth } from "@/screens/hr";
import { Login } from "@/screens/Login";
import { Profile } from "@/screens/Profile";
import { Analytics, BudgetPortfolio } from "@/screens/reports";
import { StockOverview } from "@/screens/inventory";
import { FleetDashboard, FuelEfficiency } from "@/screens/fleet";
import { LeaveTimeline, OfferApprovals, ResourceBoard } from "@/screens/boards";
import { AccountingDashboard, FinanceDashboard, OffersDashboard, ProcurementDashboard, WorkOrdersDashboard } from "@/screens/overviews";
import { ResourceScreen } from "@/screens/ResourceScreen";
import { InboxScreen, NotificationsScreen } from "@/screens/Workflow";

export function App() {
  const { session, loading } = useSession();
  if (loading) return <Spinner />;
  const signedIn = Boolean(session?.authenticated && session.user && !session.mfa?.pending);
  if (!signedIn) return <Login />;
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/workflow/inbox-screen" element={<InboxScreen />} />
        <Route path="/workflow/notifications" element={<NotificationsScreen />} />
        <Route path="/hr/attendance-day" element={<AttendanceDay />} />
        <Route path="/hr/attendance-month" element={<AttendanceMonth />} />
        <Route path="/hr/dashboard" element={<HrDashboard />} />
        <Route path="/hr/kpi-month" element={<KpiMonth />} />
        <Route path="/budget/portfolio" element={<BudgetPortfolio />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/inventory/stock" element={<StockOverview />} />
        <Route path="/fleet/dashboard" element={<FleetDashboard />} />
        <Route path="/fleet/efficiency" element={<FuelEfficiency />} />
        <Route path="/offers/dashboard" element={<OffersDashboard />} />
        <Route path="/offers/approvals" element={<OfferApprovals />} />
        <Route path="/procurement/dashboard" element={<ProcurementDashboard />} />
        <Route path="/accounting/dashboard" element={<AccountingDashboard />} />
        <Route path="/finance/dashboard" element={<FinanceDashboard />} />
        <Route path="/workorders/dashboard" element={<WorkOrdersDashboard />} />
        <Route path="/workorders/resource-board" element={<ResourceBoard />} />
        <Route path="/hr/leave-timeline" element={<LeaveTimeline />} />
        <Route path="/:module/:path" element={<ResourceScreen mode="list" />} />
        <Route path="/:module/:path/new" element={<ResourceScreen mode="new" />} />
        <Route path="/:module/:path/:id" element={<ResourceScreen mode="detail" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
