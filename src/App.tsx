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
import MembersPage from "./features/members/pages/MembersPage";
import TenantDetail from "./features/platform-admin/pages/TenantDetails";
import AcceptInvitationPage from "./features/tenant-admin/pages/AcceptInvitationPage";
import AuditLogsPage from "./features/tenant-admin/pages/AuditLogsPage";
import OrganizationsPage from "./features/tenant-admin/pages/OrganizationsPage";
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

          {/* ================= PLATFORM ADMIN ================= */}
          <Route path="/super" element={<PlatformShell />}>
            <Route index element={<Dashboard />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="tenant/:tenantId" element={<TenantDetail />} />
            <Route path="audit" element={<AuditLogsPage />} />
          </Route>

          {/* ================= TENANT ADMIN ================= */}
          <Route path="/tenant" element={<TenantAdminShell />}>
            <Route index element={<TenantDashboard />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="tasks" element={<TasksPage role="TENANT_ADMIN" />} />
            <Route path="audit" element={<AuditLogsPage />} />
          </Route>

          {/* ================= OWNER ================= */}
          <Route path="/owner" element={<OwnerShell />}>
            <Route index element={<OwnerDashboard />} />
            <Route path="workspaces" element={<OwnerWorkspacesPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="tasks" element={<TasksPage role="OWNER" />} />
            <Route path="boards" element={<TasksPage role="OWNER" />} />
          </Route>

          {/* ================= MEMBER ================= */}
          <Route path="/member" element={<MemberShell />}>
            <Route index element={<MemberDashboard />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="tasks" element={<TasksPage role="MEMBER" />} />
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
