import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Kanban } from "lucide-react";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";

type WsStats = {
    id: string;
    members: number;
    boards: number;
};

export default function OwnerWorkspacesPage() {
    const client = dataClient();
    const navigate = useNavigate();
    const { workspaces, memberships, setWorkspaceId } = useWorkspace();

    const [statsMap, setStatsMap] = useState<Record<string, WsStats>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, [workspaces]);

    async function loadStats() {
        if (!workspaces.length) { setLoading(false); return; }

        const map: Record<string, WsStats> = {};

        await Promise.all(
            workspaces.map(async (ws) => {
                const [memRes, boardRes] = await Promise.all([
                    client.models.Membership.listMembershipsByWorkspace({ workspaceId: ws.id }),
                    client.models.TaskBoard.list({ filter: { workspaceId: { eq: ws.id } } }),
                ]);

                map[ws.id] = {
                    id: ws.id,
                    members: memRes.data.filter((m: any) => m.status !== "REMOVED").length,
                    boards: boardRes.data.length,
                };
            })
        );

        setStatsMap(map);
        setLoading(false);
    }

    function getRole(wsId: string): string {
        const mem = memberships.find((m: any) => m.workspaceId === wsId);
        return mem?.role || "MEMBER";
    }

    function handleClick(ws: any) {
        const role = getRole(ws.id);
        setWorkspaceId(ws.id);

        if (role === "MEMBER") {
            navigate("/member");
        } else {
            navigate("/owner/boards");
        }
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Building2 size={24} />
                        My Workspaces
                    </h1>
                    <p className="page-sub">
                        {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="dash-skeleton">
                    <div className="skel-row">
                        <div className="skel-card shimmer" />
                        <div className="skel-card shimmer" />
                        <div className="skel-card shimmer" />
                    </div>
                </div>
            ) : workspaces.length === 0 ? (
                <div className="empty-chart">
                    No workspaces yet. Ask your tenant admin to invite you.
                </div>
            ) : (
                <div className="ws-grid">
                    {workspaces.map((ws: any) => {
                        const role = getRole(ws.id);
                        const st = statsMap[ws.id];
                        return (
                            <div
                                key={ws.id}
                                className="ws-card"
                                onClick={() => handleClick(ws)}
                            >
                                <div className="ws-card-header">
                                    <span className="ws-card-name">{ws.name}</span>
                                    <span className={`ws-role-badge ${role.toLowerCase()}`}>
                                        {role === "OWNER" ? "Owner" : "Member"}
                                    </span>
                                </div>

                                {ws.description && (
                                    <p className="ws-card-desc">{ws.description}</p>
                                )}

                                <div className="ws-card-stats">
                                    <span className="ws-stat">
                                        <Users size={14} />
                                        {st?.members ?? 0} member{(st?.members ?? 0) !== 1 ? "s" : ""}
                                    </span>
                                    <span className="ws-stat">
                                        <Kanban size={14} />
                                        {st?.boards ?? 0} board{(st?.boards ?? 0) !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
