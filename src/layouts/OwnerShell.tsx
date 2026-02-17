import AppShell from "./AppShell";
import { useWorkspace } from "../shared-components/workspace-context";
import { ownerNav } from "../config/nav";

export default function OwnerShell() {
    const { tenantName } = useWorkspace();

    return (
        <AppShell
            companyName={tenantName || "Workspace"}
            navItems={ownerNav}
        />
    );
}
