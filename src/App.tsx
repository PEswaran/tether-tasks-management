import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { WorkspaceProvider } from "./shared-components/workspace-context";
import AuthRedirect from "./auth-redirect";
import MemberShell from "./layouts/MemberShell";
import OwnerShell from "./layouts/OwnerShell";
import PlatformShell from "./layouts/PlatformAdminShell";
import TenantAdminShell from "./layouts/TenantAdminShell";
import GeneralMemberShell from "./layouts/GeneralMemberShell";
import { Toaster } from "sonner";
import useGlobalNotifications from "./hooks/useGlobalNotifications";
import GlobalTaskModal from "./components/shared/modals/global-task-modal";
import { ConfirmProvider } from "./shared-components/confirm-context";
import { useWorkspace } from "./shared-components/workspace-context";
import ErrorBoundary from "./shared-components/ErrorBoundary";

const Dashboard = lazy(() => import("./features/platform-admin/pages/Dashboard"));
const Tenants = lazy(() => import("./features/platform-admin/pages/TenantsPage"));
const NoAccessPage = lazy(() => import("./features/auth/pages/NoAccessPage"));
const SuspendedPage = lazy(() => import("./features/auth/pages/SuspendedPage"));
const MembersPage = lazy(() => import("./features/members/pages/MembersPage"));
const TenantDetail = lazy(() => import("./features/platform-admin/pages/TenantDetails"));
const AcceptInvitationPage = lazy(() => import("./features/tenant-admin/pages/AcceptInvitationPage"));
const AuditLogsPage = lazy(() => import("./features/tenant-admin/pages/AuditLogsPage"));
const OrganizationsPage = lazy(() => import("./features/tenant-admin/pages/OrganizationsPage"));
const WorkspacesPage = lazy(() => import("./features/tenant-admin/pages/WorkspacesPage"));
const TenantDashboard = lazy(() => import("./features/tenant-admin/pages/TenantDashboard"));
const TasksPage = lazy(() => import("./features/tasks/pages/TasksPage"));
const AcceptOrgInvitationPage = lazy(() => import("./features/owners/pages/AcceptOrgInvitationPage"));
const OwnerDashboard = lazy(() => import("./features/owners/pages/OwnerDashboard"));
const OwnerWorkspacesPage = lazy(() => import("./features/owners/pages/OwnerWorkspacesPage"));
const MemberDashboard = lazy(() => import("./features/members/pages/MemberDashboard"));
const Login = lazy(() => import("./features/auth/pages/Login"));
const GeneralDashboard = lazy(() => import("./features/general/pages/GeneralDashboard"));
const GeneralWorkspacesPage = lazy(() => import("./features/general/pages/GeneralWorkspacesPage"));
const AdminUserDirectoryPage = lazy(() => import("./features/admin/pages/AdminUserDirectoryPage"));
const ProfilePage = lazy(() => import("./features/profile/pages/ProfilePage"));
const SettingsPage = lazy(() => import("./features/profile/pages/SettingsPage"));
const WelcomePage = lazy(() => import("./features/tenant-admin/pages/WelcomePage"));
const NotificationsPage = lazy(() => import("./features/notifications/pages/NotificationsPage"));
const AnalyticsPage = lazy(() => import("./features/platform-admin/pages/AnalyticsPage"));
const PilotsPage = lazy(() => import("./features/platform-admin/pages/PilotsPage"));
const PilotDetail = lazy(() => import("./features/platform-admin/pages/PilotDetail"));
const AgreementsPage = lazy(() => import("./features/platform-admin/pages/AgreementsPage"));
const ReportsPage = lazy(() => import("./features/tenant-admin/pages/ReportsPage"));
const ErrorTestPage = lazy(() => import("./test/ErrorTestPage"));

function RouteFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#5f7694", background: "#eef5fb" }}>
      Loading...
    </div>
  );
}

function GeneralTasksRoute({ assignedToMe }: { assignedToMe?: boolean } = {}) {
  const { role, memberships, workspaceId, organizationId, workspaces, tenantId } = useWorkspace();

  const activeMemberships = (memberships || []).filter(
    (m: any) => m.status === "ACTIVE" && (!tenantId || m.tenantId === tenantId)
  );

  const scopedWorkspaceIds = new Set(
    (workspaceId
      ? workspaces.filter((ws: any) => ws.id === workspaceId)
      : organizationId
        ? workspaces.filter((ws: any) => ws.organizationId === organizationId)
        : workspaces
    ).map((ws: any) => ws.id)
  );

  const ownerInScope = activeMemberships.some((m: any) => {
    if (m.role !== "OWNER") return false;
    if (workspaceId) {
      if (m.workspaceId) return m.workspaceId === workspaceId;
      if (m.organizationId) return workspaces.some((ws: any) => ws.id === workspaceId && ws.organizationId === m.organizationId);
      return true;
    }
    if (organizationId) {
      if (m.organizationId) return m.organizationId === organizationId;
      if (m.workspaceId) return scopedWorkspaceIds.has(m.workspaceId);
      return true;
    }
    return true;
  });

  const tenantAdminInScope = role === "TENANT_ADMIN" || activeMemberships.some((m: any) => m.role === "TENANT_ADMIN");
  const resolvedRole = tenantAdminInScope ? "TENANT_ADMIN" : ownerInScope ? "OWNER" : "MEMBER";
  return <TasksPage role={resolvedRole} assignedToMe={assignedToMe} />;
}

export default function App() {
  useGlobalNotifications();

  return (
    <ErrorBoundary level="app">
    <ConfirmProvider>
      <WorkspaceProvider>
        <Suspense fallback={<RouteFallback />}>
        <Routes>

          {/* LOGIN REDIRECT */}
          <Route path="/" element={<AuthRedirect />} />
          <Route path="/auth-redirect" element={<AuthRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* NO ACCESS */}
          <Route path="/no-access" element={<NoAccessPage />} />
          <Route path="/suspended" element={<SuspendedPage />} />

          {/* ACCEPT INVITES */}
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          <Route path="/accept-org-invitation" element={<AcceptOrgInvitationPage />} />

          {/* PROFILE */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/welcome" element={<WelcomePage />} />

          {/* ================= PLATFORM ADMIN ================= */}
          <Route path="/super" element={<PlatformShell />}>
            <Route index element={<Dashboard />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="tenant/:tenantId" element={<TenantDetail />} />
            <Route path="pilots" element={<PilotsPage />} />
            <Route path="pilot/:tenantId" element={<PilotDetail />} />
            <Route path="agreements" element={<AgreementsPage />} />
            <Route path="user-directory" element={<AdminUserDirectoryPage mode="platform" />} />
            <Route path="audit" element={<AuditLogsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* ================= TENANT ADMIN ================= */}
          <Route path="/tenant" element={<TenantAdminShell />}>
            <Route index element={<TenantDashboard />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="workspaces" element={<WorkspacesPage />} />
            <Route path="user-directory" element={<AdminUserDirectoryPage mode="tenant" />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="tasks" element={<TasksPage role="TENANT_ADMIN" />} />
            <Route path="audit" element={<AuditLogsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>

          {/* ================= OWNER ================= */}
          <Route path="/owner" element={<OwnerShell />}>
            <Route index element={<OwnerDashboard />} />
            <Route path="my-tasks" element={<TasksPage role="OWNER" assignedToMe />} />
            <Route path="workspaces" element={<OwnerWorkspacesPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="user-directory" element={<AdminUserDirectoryPage mode="tenant" />} />
            <Route path="tasks" element={<TasksPage role="OWNER" />} />
            <Route path="boards" element={<TasksPage role="OWNER" />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* ================= MEMBER ================= */}
          <Route path="/member" element={<MemberShell />}>
            <Route index element={<MemberDashboard />} />
            <Route path="my-tasks" element={<TasksPage role="MEMBER" assignedToMe />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="tasks" element={<TasksPage role="MEMBER" />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* ================= GENERAL MEMBER ================= */}
          <Route path="/general" element={<GeneralMemberShell />}>
            <Route index element={<GeneralDashboard />} />
            <Route path="my-tasks" element={<GeneralTasksRoute assignedToMe />} />
            <Route path="workspaces" element={<GeneralWorkspacesPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="tasks" element={<GeneralTasksRoute />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* DEV-ONLY: test routes for Playwright */}
          {import.meta.env.DEV && (
            <Route path="/test/error-boundary" element={<ErrorTestPage />} />
          )}

        </Routes>
        </Suspense>
        <GlobalTaskModal />

        <Toaster
          richColors
          position="top-right"
          expand={true}
          duration={4000}
        />
      </WorkspaceProvider>
    </ConfirmProvider>
    </ErrorBoundary>
  );
}
