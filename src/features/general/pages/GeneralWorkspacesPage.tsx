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
    const { workspaces, organizations, workspaceId } = useWorkspace();
    const [loading, setLoading] = useState(true);
    const [statsByWorkspace, setStatsByWorkspace] = useState<Record<string, WorkspaceStats>>({});

    useEffect(() => {
        loadStats();
    }, [workspaces.map((ws: any) => `${ws.id}:${ws.updatedAt || ""}`).join("|"), workspaceId]);

    async function loadStats() {
        if (!workspaces.length) {
            setStatsByWorkspace({});
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const scopedWorkspaces = workspaceId
                ? workspaces.filter((ws: any) => ws.id === workspaceId)
                : workspaces;

            const entries = await Promise.all(
                scopedWorkspaces.map(async (ws: any) => {
                    const [boardRes, taskRes, memRes] = await Promise.all([
                        client.models.TaskBoard.list({ filter: { workspaceId: { eq: ws.id } } }),
                        client.models.Task.listTasksByWorkspace({ workspaceId: ws.id }),
                        client.models.Membership.listMembershipsByWorkspace({ workspaceId: ws.id }),
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
        } finally {
            setLoading(false);
        }
    }

    const scopedWorkspaces = workspaceId
        ? workspaces.filter((ws: any) => ws.id === workspaceId)
        : workspaces;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Building2 size={22} />
                        Workspaces
                    </h1>
                    <p className="page-sub">Read-only workspace directory for your current scope.</p>
                </div>
            </div>

            {loading ? (
                <div className="workspace-directory-empty">Loading workspaces...</div>
            ) : scopedWorkspaces.length === 0 ? (
                <div className="workspace-directory-empty">No workspaces available in this scope.</div>
            ) : (
                <div className="ws-grid">
                    {scopedWorkspaces.map((ws: any) => {
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
