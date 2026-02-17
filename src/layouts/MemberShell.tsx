import AppShell from "./AppShell";
import { useWorkspace } from "../shared-components/workspace-context";
import { memberNav } from "../config/nav";

export default function MemberShell() {
    const { tenantName } = useWorkspace();

    return (
        <AppShell
            companyName={tenantName || "Workspace"}
            navItems={memberNav}
        />
    );
}
