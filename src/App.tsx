import { Routes, Route } from "react-router-dom";
import { WorkspaceProvider } from "./shared-components/workspace-context";
import Dashboard from "./platform-super-admin/Dashboard";
import Tenants from "./platform-super-admin/TenantsPage";
import AuthRedirect from "./auth-redirect";
import NoAccessPage from "./NoAccessPage";
import MemberShell from "./layouts/MemberShell";
import OwnerShell from "./layouts/OwnerShell";
import PlatformShell from "./layouts/PlatformAdminShell";
import TenantAdminShell from "./layouts/TenantAdminShell";
import MemberDashboard from "./member/MemberDashboard";
import MemberTasksPage from "./member/MemberTasksPage";
import AcceptOrgInvitationPage from "./owner/AcceptOrgInvitationPage";
import OwnerDashboard from "./owner/OwnerDashboard";
import OwnerTasksPage from "./owner/OwnerTasksPage";
import OwnerWorkspacesPage from "./owner/OwnerWorkspacesPage";
import MembersPage from "./pages/shared/MembersPage";
import TenantDetail from "./platform-super-admin/TenantDetails";
import AcceptInvitationPage from "./tenant-admin/AcceptInvitationPage";
import AuditLogsPage from "./tenant-admin/AuditLogsPage";
import OrganizationsPage from "./tenant-admin/OrganizationsPage";
import TenantDashboard from "./tenant-admin/TenantDashboard";
import TenantTasksPage from "./tenant-admin/TenantTasksPage";
import { Toaster } from "sonner";
import useGlobalNotifications from "./hooks/useGlobalNotifications";
import GlobalTaskModal from "./pages/shared/modals/global-task-modal";

export default function App() {
  useGlobalNotifications();

  return (
    <WorkspaceProvider>
      <Routes>

        {/* LOGIN REDIRECT */}
        <Route path="/" element={<AuthRedirect />} />

        {/* NO ACCESS */}
        <Route path="/no-access" element={<NoAccessPage />} />

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
          <Route path="tasks" element={<TenantTasksPage />} />
          <Route path="audit" element={<AuditLogsPage />} />
        </Route>

        {/* ================= OWNER ================= */}
        <Route path="/owner" element={<OwnerShell />}>
          <Route index element={<OwnerDashboard />} />
          <Route path="workspaces" element={<OwnerWorkspacesPage />} />
          <Route path="boards" element={<OwnerTasksPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="tasks" element={<OwnerTasksPage />} />
        </Route>

        {/* ================= MEMBER ================= */}
        <Route path="/member" element={<MemberShell />}>
          <Route index element={<MemberDashboard />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="tasks" element={<MemberTasksPage />} />
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
  );
}
