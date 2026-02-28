import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell";
import { useWorkspace } from "../shared-components/workspace-context";
import { dataClient } from "../libs/data-client";
import { generalMemberNav } from "../config/generalMemberNav";

export default function GeneralMemberShell() {
    const navigate = useNavigate();
    const {
        tenantName,
        tenantId,
        organizationId,
        workspaceId,
        organizations,
        workspaces,
        memberships,
        setWorkspaceId,
        setOrganizationId,
    } = useWorkspace();
    const client = dataClient();
    const currentOrgName = organizations.find((org: any) => org.id === organizationId)?.name || "";

    const [boardCount, setBoardCount] = useState(0);
    const [memberCount, setMemberCount] = useState(0);
    const [workspaceCount, setWorkspaceCount] = useState(0);
    const [organizationCount, setOrganizationCount] = useState(0);
    const [scopedWorkspaces, setScopedWorkspaces] = useState<any[]>([]);
    const organizationDepsKey = organizations.map((org: any) => `${org.id}:${org.name || ""}`).join("|");
    const workspaceDepsKey = workspaces.map((ws: any) => `${ws.id}:${ws.organizationId || ""}:${ws.updatedAt || ""}`).join("|");
    const membershipsDepsKey = memberships.map((m: any) => `${m.id}:${m.status || ""}:${m.role || ""}:${m.organizationId || ""}:${m.workspaceId || ""}`).join("|");

    useEffect(() => {
        if (!tenantId) return;
        loadCounts();
    }, [tenantId, organizationId, workspaceId, organizationDepsKey, workspaceDepsKey, membershipsDepsKey]);

    async function loadCounts() {
        try {
            const activeMemberships = (memberships || []).filter(
                (m: any) => m.status === "ACTIVE" && m.role !== "TENANT_ADMIN" && m.tenantId === tenantId
            );
            const workspaceIdSet = new Set<string>();
            const orgIdsToExpand = new Set<string>();
            const tenantScopeMembership = activeMemberships.some((m: any) => !m.workspaceId && !m.organizationId);

            activeMemberships.forEach((m: any) => {
                if (m.workspaceId) workspaceIdSet.add(m.workspaceId);
                if (m.organizationId) {
                    if (!m.workspaceId) orgIdsToExpand.add(m.organizationId);
                }
            });

            if (organizationId) {
                orgIdsToExpand.add(organizationId);
            }

            if (tenantScopeMembership && tenantId) {
                const tenantWsRes = await client.models.Workspace.list({
                    filter: { tenantId: { eq: tenantId } },
                });
                (tenantWsRes.data || []).forEach((ws: any) => {
                    if (!ws?.id) return;
                    workspaceIdSet.add(ws.id);
                });
            }

            const orgWorkspaceResults = await Promise.all(
                Array.from(orgIdsToExpand).map((orgId) =>
                    client.models.Workspace.list({ filter: { organizationId: { eq: orgId } } })
                )
            );
            orgWorkspaceResults.forEach((res: any) => {
                (res.data || []).forEach((ws: any) => {
                    if (!ws?.id) return;
                    workspaceIdSet.add(ws.id);
                });
            });

            const workspaceMap = new Map(workspaces.map((ws: any) => [ws.id, ws]));
            const missingWorkspaceIds = Array.from(workspaceIdSet).filter((id) => !workspaceMap.has(id));
            if (missingWorkspaceIds.length) {
                const missingWs = await Promise.all(missingWorkspaceIds.map((id) => client.models.Workspace.get({ id })));
                missingWs.forEach((res: any) => {
                    if (res?.data?.id) workspaceMap.set(res.data.id, res.data);
                });
            }

            const baseScopedWorkspaces = Array.from(workspaceMap.values()).filter((ws: any) => {
                if (!workspaceIdSet.has(ws.id)) return false;
                return true;
            });
            setScopedWorkspaces(baseScopedWorkspaces);

            const metricsScopedWorkspaces = workspaceId
                ? baseScopedWorkspaces.filter((ws: any) => ws.id === workspaceId)
                : baseScopedWorkspaces;

            const scopedOrgIds = Array.from(
                new Set(metricsScopedWorkspaces.map((ws: any) => ws.organizationId).filter(Boolean) as string[])
            );
            if (organizationId && !scopedOrgIds.includes(organizationId)) {
                scopedOrgIds.push(organizationId);
            }
            setWorkspaceCount(metricsScopedWorkspaces.length);
            setOrganizationCount(scopedOrgIds.length);

            const [boardResults, memberResults] = await Promise.all([
                Promise.all(
                    metricsScopedWorkspaces.map((ws: any) =>
                        client.models.TaskBoard.list({ filter: { workspaceId: { eq: ws.id } } })
                    )
                ),
                Promise.all(
                    scopedOrgIds.map((orgId: string) =>
                        client.models.Membership.listMembershipsByOrganization({ organizationId: orgId })
                    )
                ),
            ]);

            const boards = boardResults.reduce((count, res) => count + (res.data?.length || 0), 0);
            const uniqueMembers = new Set<string>();
            memberResults.forEach((res) => {
                (res.data || [])
                    .filter((m: any) => m.status === "ACTIVE")
                    .forEach((m: any) => {
                        if (m.userSub) uniqueMembers.add(m.userSub);
                    });
            });

            setBoardCount(boards);
            setMemberCount(uniqueMembers.size);
        } catch (err) {
            console.error("GeneralMemberShell loadCounts error", err);
            setBoardCount(0);
            setMemberCount(0);
            setWorkspaceCount(0);
            setOrganizationCount(0);
            setScopedWorkspaces([]);
        }
    }

    const badge = (
        <div className="cc-nav-counts">
            <div className="cc-workspace-select-wrap">
                <label className="cc-workspace-label" htmlFor="general-sidebar-workspace-select">Workspace</label>
                <select
                    id="general-sidebar-workspace-select"
                    name="general_sidebar_workspace_select"
                    className="cc-workspace-select"
                    value={workspaceId || ""}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onChange={(e) => {
                        const nextWorkspaceId = e.target.value || null;
                        setWorkspaceId(nextWorkspaceId);
                        if (!nextWorkspaceId) {
                            setOrganizationId(null);
                            return;
                        }
                        const nextWs = scopedWorkspaces.find((ws: any) => ws.id === nextWorkspaceId);
                        if (nextWs?.organizationId) setOrganizationId(nextWs.organizationId);
                    }}
                >
                    <option value="">All Workspaces</option>
                    {scopedWorkspaces.map((ws: any) => (
                        <option key={ws.id} value={ws.id}>
                            {ws.name || ws.id}
                        </option>
                    ))}
                </select>
            </div>
            {!organizationId && <span className="cc-count">Orgs {organizationCount}</span>}
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
                    navigate("/general/tasks");
                }}
            >
                Boards {boardCount}
            </button>
            <button
                className="cc-count cc-count-btn"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate("/general/members");
                }}
            >
                Members {memberCount}
            </button>
        </div>
    );

    const navItems = generalMemberNav.map((item) => ({
        ...item,
        badge: item.path === "/general" ? badge : undefined,
    }));

    return (
        <AppShell
            companyName={tenantName || "Workspace Hub"}
            navItems={navItems}
            hideWorkspaceContext
        />
    );
}
