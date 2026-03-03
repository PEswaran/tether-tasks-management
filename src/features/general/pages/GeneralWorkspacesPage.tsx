import { useEffect, useState } from "react";
import { Building2, Kanban, ListTodo, Users } from "lucide-react";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";

type WorkspaceStats = {
    boards: number;
    tasks: number;
    members: number;
};

function countUniqueActiveMembers(memberships: any[] = []) {
    const activeSubs = new Set<string>();
    memberships.forEach((m: any) => {
        if (m?.status === "REMOVED") return;
        if (!m?.userSub) return;
        activeSubs.add(m.userSub);
    });
    return activeSubs.size;
}

export default function GeneralWorkspacesPage() {
    const client = dataClient();
    const { organizations, tenantId, memberships, organizationId, workspaceId } = useWorkspace();
    const [loading, setLoading] = useState(true);
    const [discoveredWorkspaces, setDiscoveredWorkspaces] = useState<any[]>([]);
    const [statsByWorkspace, setStatsByWorkspace] = useState<Record<string, WorkspaceStats>>({});

    const membershipsDepsKey = memberships.map((m: any) => `${m.id}:${m.status}:${m.role}:${m.organizationId}:${m.workspaceId}`).join("|");

    useEffect(() => {
        if (!tenantId || memberships.length === 0) return;
        loadWorkspaces();
    }, [tenantId, membershipsDepsKey, organizationId, workspaceId]);

    async function loadWorkspaces() {
        setLoading(true);
        try {
            const activeMemberships = (memberships || []).filter(
                (m: any) => m.status === "ACTIVE" && m.role !== "TENANT_ADMIN" && m.tenantId === tenantId
            );

            // Collect workspace IDs from memberships
            const workspaceIdSet = new Set<string>();
            const orgIdsToExpand = new Set<string>();

            activeMemberships.forEach((m: any) => {
                if (m.workspaceId) workspaceIdSet.add(m.workspaceId);
                if (m.organizationId && !m.workspaceId) orgIdsToExpand.add(m.organizationId);
            });

            if (organizationId) orgIdsToExpand.add(organizationId);

            // Expand org-level memberships to find workspaces
            const orgWorkspaceResults = await Promise.all(
                Array.from(orgIdsToExpand).map((orgId) =>
                    client.models.Workspace.list({ filter: { organizationId: { eq: orgId } } })
                )
            );
            orgWorkspaceResults.forEach((res: any) => {
                (res.data || []).forEach((ws: any) => {
                    if (ws?.id) workspaceIdSet.add(ws.id);
                });
            });

            // Build full workspace objects
            const workspaceMap = new Map<string, any>();
            orgWorkspaceResults.forEach((res: any) => {
                (res.data || []).forEach((ws: any) => {
                    if (ws?.id) workspaceMap.set(ws.id, ws);
                });
            });

            // Fetch any direct workspace-level memberships not yet loaded
            const missingIds = Array.from(workspaceIdSet).filter((id) => !workspaceMap.has(id));
            if (missingIds.length) {
                const fetched = await Promise.all(missingIds.map((id) => client.models.Workspace.get({ id })));
                fetched.forEach((res: any) => {
                    if (res?.data?.id) workspaceMap.set(res.data.id, res.data);
                });
            }

            let allWs = Array.from(workspaceMap.values()).filter((ws: any) => workspaceIdSet.has(ws.id));

            // Apply workspace scope if a specific workspace is selected
            if (workspaceId) {
                allWs = allWs.filter((ws: any) => ws.id === workspaceId);
            }

            setDiscoveredWorkspaces(allWs);

            // Load stats
            const entries = await Promise.all(
                allWs.map(async (ws: any) => {
                    const orgId = ws.organizationId;
                    const [boardRes, taskRes, memRes] = await Promise.all([
                        client.models.TaskBoard.list({ filter: { workspaceId: { eq: ws.id } } }),
                        client.models.Task.listTasksByWorkspace({ workspaceId: ws.id }),
                        orgId
                            ? client.models.Membership.listMembershipsByOrganization({ organizationId: orgId })
                            : client.models.Membership.listMembershipsByWorkspace({ workspaceId: ws.id }),
                    ]);
                    return [
                        ws.id,
                        {
                            boards: (boardRes.data || []).length,
                            tasks: (taskRes.data || []).length,
                            members: countUniqueActiveMembers(memRes.data || []),
                        },
                    ] as const;
                })
            );
            setStatsByWorkspace(Object.fromEntries(entries));
        } catch (err) {
            console.error("GeneralWorkspacesPage load error:", err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Building2 size={22} />
                        Workspaces
                    </h1>
                    <p className="page-sub">Workspace directory for your current scope.</p>
                </div>
            </div>

            {loading ? (
                <div className="workspace-directory-empty">Loading workspaces...</div>
            ) : discoveredWorkspaces.length === 0 ? (
                <div className="workspace-directory-empty">No workspaces available in this scope.</div>
            ) : (
                <div className="ws-grid">
                    {discoveredWorkspaces.map((ws: any) => {
                        const stats = statsByWorkspace[ws.id] || { boards: 0, tasks: 0, members: 0 };
                        const orgName = organizations.find((o: any) => o.id === ws.organizationId)?.name || "Organization";
                        return (
                            <div key={ws.id} className="ws-card">
                                <div className="ws-card-header">
                                    <span className="ws-card-name">{ws.name || ws.id}</span>
                                    <span className={`workspace-pill static ${ws.isActive === false ? "" : "active"}`}>
                                        {ws.isActive === false ? "Inactive" : "Active"}
                                    </span>
                                </div>
                                <div className="ws-card-desc">{orgName}</div>
                                {ws.description && <div className="ws-card-desc">{ws.description}</div>}
                                <div className="ws-card-stats">
                                    <span className="ws-stat"><Kanban size={14} /> {stats.boards} boards</span>
                                    <span className="ws-stat"><ListTodo size={14} /> {stats.tasks} tasks</span>
                                    <span className="ws-stat"><Users size={14} /> {stats.members} members</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
