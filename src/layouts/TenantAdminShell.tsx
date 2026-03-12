import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell";
import { useWorkspace } from "../shared-components/workspace-context";
import { tenantAdminNav } from "../config/tenantAdminNav";
import { dataClient } from "../libs/data-client";

export default function TenantAdminShell() {
    const navigate = useNavigate();
    const { tenantName, tenantId, organizationId, workspaces, organizations, setWorkspaceId, setOrganizationId } = useWorkspace();
    const client = dataClient();
    const currentOrgName = organizations.find((org: any) => org.id === organizationId)?.name || "";

    const [workspaceCount, setWorkspaceCount] = useState(0);
    const [boardCount, setBoardCount] = useState(0);
    const [memberCount, setMemberCount] = useState(0);
    const organizationDepsKey = organizations.map((org: any) => `${org.id}:${org.name || ""}`).join("|");
    const workspaceDepsKey = workspaces.map((ws: any) => `${ws.id}:${ws.organizationId || ""}:${ws.updatedAt || ""}`).join("|");

    useEffect(() => {
        if (!tenantId) return;
        loadCounts();
    }, [tenantId, organizationId, organizationDepsKey, workspaceDepsKey]);

    async function loadCounts() {
        try {
            if (organizationId) {
                const [workspaceRes, boardRes, memberRes] = await Promise.all([
                    client.models.Workspace.list({ filter: { organizationId: { eq: organizationId } } }),
                    client.models.TaskBoard.list({ filter: { organizationId: { eq: organizationId } } }),
                    client.models.Membership.listMembershipsByOrganization({ organizationId }),
                ]);

                const uniqueMembers = new Set<string>();
                (memberRes.data || [])
                    .filter((m: any) => m.status === "ACTIVE")
                    .forEach((m: any) => {
                        if (m.userSub) uniqueMembers.add(m.userSub);
                    });

                setWorkspaceCount((workspaceRes.data || []).length);
                setBoardCount((boardRes.data || []).length);
                setMemberCount(uniqueMembers.size);
                return;
            }

            const [workspaceRes, boardRes, membershipRes] = await Promise.all([
                client.models.Workspace.list({ filter: { tenantId: { eq: tenantId! } } }),
                client.models.TaskBoard.list({ filter: { tenantId: { eq: tenantId! } } }),
                client.models.Membership.list({ filter: { tenantId: { eq: tenantId! } } }),
            ]);

            const uniqueMembers = new Set<string>();
            (membershipRes.data || [])
                .filter((m: any) => m.status === "ACTIVE")
                .forEach((m: any) => {
                    if (m.userSub) uniqueMembers.add(m.userSub);
                });

            setWorkspaceCount((workspaceRes.data || []).length);
            setBoardCount((boardRes.data || []).length);
            setMemberCount(uniqueMembers.size);
        } catch (err) {
            console.error("TenantAdminShell loadCounts error", err);
        }
    }

    const badge = (
        <div className="cc-nav-counts">
            {!organizationId && <span className="cc-count">Orgs {organizations.length}</span>}
            {organizationId && (
                <div className="cc-current-org" title={currentOrgName}>
                    <span className="cc-current-org-label">Viewing</span>
                    <span className="cc-current-org-name">{currentOrgName || "Selected Organization"}</span>
                </div>
            )}
            <span className="cc-count">Workspaces {workspaceCount}</span>
            <button
                className="cc-count cc-count-btn"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate("/tenant");
                }}
            >
                Boards {boardCount}
            </button>
            <button
                className="cc-count cc-count-btn"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate("/tenant/members");
                }}
            >
                Members {memberCount}
            </button>
        </div>
    );

    const navItems = tenantAdminNav.map((item) => ({
        ...item,
        badge: item.path === "/tenant" ? badge : undefined,
        onClick: item.path === "/tenant"
            ? () => {
                setWorkspaceId(null);
                setOrganizationId(null);
            }
            : undefined,
    }));

    return (
        <AppShell
            companyName={tenantName || "Admin"}
            navItems={navItems}
            hideWorkspaceContext
        />
    );
}
