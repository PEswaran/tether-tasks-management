import AppShell from "./AppShell";
import { useWorkspace } from "../shared-components/workspace-context";
import { tenantAdminNav } from "../config/tenantAdminNav";

export default function TenantAdminShell() {
    const { tenantName } = useWorkspace();
    return <AppShell companyName={tenantName || "Admin"} navItems={tenantAdminNav} />;
}
