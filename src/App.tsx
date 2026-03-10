import { Routes, Route } from "react-router-dom";
import { WorkspaceProvider } from "./shared-components/workspace-context";
import Dashboard from "./features/platform-admin/pages/Dashboard";
import Tenants from "./features/platform-admin/pages/TenantsPage";
import AuthRedirect from "./auth-redirect";
import NoAccessPage from "./features/auth/pages/NoAccessPage";
import SuspendedPage from "./features/auth/pages/SuspendedPage";
import MemberShell from "./layouts/MemberShell";
import OwnerShell from "./layouts/OwnerShell";
import PlatformShell from "./layouts/PlatformAdminShell";
import TenantAdminShell from "./layouts/TenantAdminShell";
import GeneralMemberShell from "./layouts/GeneralMemberShell";
import MembersPage from "./features/members/pages/MembersPage";
import TenantDetail from "./features/platform-admin/pages/TenantDetails";
import AcceptInvitationPage from "./features/tenant-admin/pages/AcceptInvitationPage";
import AuditLogsPage from "./features/tenant-admin/pages/AuditLogsPage";
import OrganizationsPage from "./features/tenant-admin/pages/OrganizationsPage";
import WorkspacesPage from "./features/tenant-admin/pages/WorkspacesPage";
import TenantDashboard from "./features/tenant-admin/pages/TenantDashboard";
import { Toaster } from "sonner";
import useGlobalNotifications from "./hooks/useGlobalNotifications";
import GlobalTaskModal from "./components/shared/modals/global-task-modal";
import { ConfirmProvider } from "./shared-components/confirm-context";
import TasksPage from "./features/tasks/pages/TasksPage";
import AcceptOrgInvitationPage from "./features/owners/pages/AcceptOrgInvitationPage";
import OwnerDashboard from "./features/owners/pages/OwnerDashboard";
import OwnerWorkspacesPage from "./features/owners/pages/OwnerWorkspacesPage";
import MemberDashboard from "./features/members/pages/MemberDashboard";
import Login from "./features/auth/pages/Login";
import { useWorkspace } from "./shared-components/workspace-context";
import GeneralDashboard from "./features/general/pages/GeneralDashboard";
import GeneralWorkspacesPage from "./features/general/pages/GeneralWorkspacesPage";
import AdminUserDirectoryPage from "./features/admin/pages/AdminUserDirectoryPage";
import ProfilePage from "./features/profile/pages/ProfilePage";
import SettingsPage from "./features/profile/pages/SettingsPage";
import WelcomePage from "./features/tenant-admin/pages/WelcomePage";
import NotificationsPage from "./features/notifications/pages/NotificationsPage";
import AnalyticsPage from "./features/platform-admin/pages/AnalyticsPage";
import PilotsPage from "./features/platform-admin/pages/PilotsPage";
import PilotDetail from "./features/platform-admin/pages/PilotDetail";

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
    <ConfirmProvider>
      <WorkspaceProvider>
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
          </Route>

          {/* ================= OWNER ================= */}
          <Route path="/owner" element={<OwnerShell />}>
            <Route index element={<OwnerDashboard />} />
            <Route path="my-tasks" element={<TasksPage role="OWNER" assignedToMe />} />
            <Route path="workspaces" element={<OwnerWorkspacesPage />} />
            <Route path="members" element={<MembersPage />} />
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

        </Routes>
        <GlobalTaskModal />

        <Toaster
          richColors
          position="top-right"
          expand={true}
          duration={4000}
        />
      </WorkspaceProvider>
    </ConfirmProvider>
  );
}
