import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";

type BoardDirectoryItem = {
    id: string;
    name?: string | null;
    workspaceId?: string | null;
    workspaceName?: string | null;
    organizationId?: string | null;
    isActive?: boolean | null;
    taskCount: number;
};

type AssignmentItem = {
    id: string;
    title: string;
    status: string;
    dueDate?: string | null;
    taskBoardId?: string | null;
    workspaceId: string;
    workspaceName: string;
    boardName: string;
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

export default function GeneralDashboard() {
    const client = dataClient();
    const navigate = useNavigate();
    const {
        tenantId,
        workspaceId,
        organizationId,
        organizations,
        workspaces,
        memberships,
        userId,
        email,
        setOrganizationId,
        setWorkspaceId,
        refreshOrganizations,
    } = useWorkspace();

    const [userOrgIds, setUserOrgIds] = useState<string[]>([]);

    const [overviewMetrics, setOverviewMetrics] = useState({
        workspaces: 0,
        boards: 0,
        tasks: 0,
        assigned: 0,
    });
    const [assignedTasks, setAssignedTasks] = useState<AssignmentItem[]>([]);

    const workspacesDepsKey = workspaces.map((ws: any) => `${ws.id}:${ws.organizationId || ""}:${ws.updatedAt || ""}`).join("|");
    const organizationsDepsKey = organizations.map((org: any) => `${org.id}:${org.name || ""}:${org.updatedAt || ""}`).join("|");
    const membershipsDepsKey = memberships.map((m: any) => `${m.id}:${m.role || ""}:${m.status || ""}:${m.organizationId || ""}:${m.workspaceId || ""}`).join("|");

    useEffect(() => {
        if (!tenantId) return;
        refreshOrganizations();
    }, [tenantId]);

    useEffect(() => {
        if (!tenantId) return;
        loadOverview();
    }, [tenantId, workspaceId, workspacesDepsKey, organizationsDepsKey, membershipsDepsKey, organizationId]);

    const roleLabel = useMemo(() => {
        const scopedMemberships = (memberships || []).filter((m: any) => {
            if (m.status !== "ACTIVE") return false;
            if (m.role === "TENANT_ADMIN") return false;
            if (workspaceId && m.workspaceId && m.workspaceId !== workspaceId) return false;
            if (!organizationId) return true;
            return m.organizationId === organizationId;
        });
        const roles = Array.from(new Set(scopedMemberships.map((m: any) => m.role).filter(Boolean)));
        if (!roles.length) return "MEMBER";
        return roles.join(" / ");
    }, [memberships, organizationId]);

    const hasOwnerAccess = useMemo(
        () =>
            (memberships || []).some((m: any) => {
                if (m.status !== "ACTIVE") return false;
                if (m.role !== "OWNER") return false;
                if (workspaceId && m.workspaceId && m.workspaceId !== workspaceId) return false;
                if (organizationId && m.organizationId && m.organizationId !== organizationId) return false;
                return true;
            }),
        [memberships, workspaceId, organizationId]
    );

    async function loadOverview() {
        try {
            const activeMemberships = (memberships || []).filter((m: any) => {
                if (m.status !== "ACTIVE") return false;
                if (m.role === "TENANT_ADMIN") return false;
                return m.tenantId === tenantId;
            });

            const workspaceIdSet = new Set<string>();
            const tenantScopeMembership = activeMemberships.some((m: any) => !m.workspaceId && !m.organizationId);
            const orgIdsToExpand = new Set<string>();

            activeMemberships.forEach((m: any) => {
                if (m.workspaceId) {
                    workspaceIdSet.add(m.workspaceId);
                } else if (m.organizationId) {
                    orgIdsToExpand.add(m.organizationId);
                }
            });

            if (tenantScopeMembership && tenantId) {
                const tenantWsRes = await client.models.Workspace.list({
                    filter: { tenantId: { eq: tenantId } },
                });
                (tenantWsRes.data || []).forEach((ws: any) => {
                    if (!ws?.id) return;
                    workspaceIdSet.add(ws.id);
                });
            }

            if (organizationId) {
                orgIdsToExpand.add(organizationId);
            }

            const orgWorkspaceRes = await Promise.all(
                Array.from(orgIdsToExpand).map((orgId) =>
                    client.models.Workspace.list({ filter: { organizationId: { eq: orgId } } })
                )
            );
            orgWorkspaceRes.forEach((res: any) => {
                (res.data || []).forEach((ws: any) => {
                    if (!ws?.id) return;
                    workspaceIdSet.add(ws.id);
                });
            });

            const existingWsMap = new Map(workspaces.map((ws: any) => [ws.id, ws]));
            const missingWorkspaceIds = Array.from(workspaceIdSet).filter((id) => !existingWsMap.has(id));
            if (missingWorkspaceIds.length) {
                const missingResults = await Promise.all(
                    missingWorkspaceIds.map((id) => client.models.Workspace.get({ id }))
                );
                missingResults.forEach((res: any) => {
                    if (res?.data?.id) {
                        existingWsMap.set(res.data.id, res.data);
                    }
                });
            }

            const scopedWorkspaces = Array.from(existingWsMap.values()).filter((ws: any) => {
                if (!workspaceIdSet.has(ws.id)) return false;
                if (organizationId && ws.organizationId !== organizationId) return false;
                if (workspaceId && ws.id !== workspaceId) return false;
                return true;
            });

            const orgIdsFromScopedWorkspaces = new Set(
                scopedWorkspaces.map((ws: any) => ws.organizationId).filter(Boolean) as string[]
            );
            if (organizationId) orgIdsFromScopedWorkspaces.add(organizationId);
            setUserOrgIds(Array.from(orgIdsFromScopedWorkspaces));

            const organizationIds = organizationId
                ? [organizationId]
                : Array.from(orgIdsFromScopedWorkspaces) as string[];

            const organizationStats = await Promise.all(
                organizationIds.map(async (orgId) => {
                    const [memRes, taskRes] = await Promise.all([
                        client.models.Membership.listMembershipsByOrganization({ organizationId: orgId }),
                        client.models.Task.listTasksByOrganization({ organizationId: orgId }),
                    ]);
                    const memberships = memRes.data || [];
                    return {
                        orgId,
                        members: countUniqueActiveMembers(memberships),
                        memberships,
                        tasks: taskRes.data || [],
                    };
                })
            );

            const orgStatsMap = new Map(organizationStats.map((item) => [item.orgId, item]));

            const workspaceResults = await Promise.all(
                scopedWorkspaces.map(async (ws: any) => {
                    const boardRes = await client.models.TaskBoard.list({
                        filter: { workspaceId: { eq: ws.id } },
                    });
                    const boardsForWorkspace = boardRes.data || [];

                    let memberCount = 0;
                    let taskData: any[] = [];
                    if (ws.organizationId && orgStatsMap.has(ws.organizationId)) {
                        const orgStats = orgStatsMap.get(ws.organizationId)!;
                        const workspaceScopedOrgMemberships = (orgStats.memberships || []).filter(
                            (m: any) => m.workspaceId === ws.id
                        );
                        memberCount = workspaceScopedOrgMemberships.length > 0
                            ? countUniqueActiveMembers(workspaceScopedOrgMemberships)
                            : orgStats.members;
                        taskData = orgStats.tasks.filter((t: any) => t.workspaceId === ws.id);
                    } else {
                        const [memRes, taskRes] = await Promise.all([
                            client.models.Membership.listMembershipsByWorkspace({ workspaceId: ws.id }),
                            client.models.Task.listTasksByWorkspace({ workspaceId: ws.id }),
                        ]);
                        memberCount = countUniqueActiveMembers(memRes.data || []);
                        taskData = taskRes.data || [];
                    }

                    const boardTaskCounts = new Map<string, number>();
                    taskData.forEach((t: any) => {
                        if (!t.taskBoardId) return;
                        boardTaskCounts.set(t.taskBoardId, (boardTaskCounts.get(t.taskBoardId) || 0) + 1);
                    });

                    const boardItems: BoardDirectoryItem[] = boardsForWorkspace.map((board: any) => ({
                        id: board.id,
                        name: board.name,
                        workspaceId: ws.id,
                        workspaceName: ws.name || ws.id,
                        organizationId: ws.organizationId || undefined,
                        isActive: board.isActive,
                        taskCount: boardTaskCounts.get(board.id) || 0,
                    }));

                    const boardNameById = new Map<string, string>();
                    boardsForWorkspace.forEach((board: any) => {
                        if (board?.id) boardNameById.set(board.id, board.name || board.id);
                    });

                    const assignmentItems: AssignmentItem[] = taskData
                        .filter((task: any) => {
                            if (!task?.assignedTo) return false;
                            if (userId && task.assignedTo === userId) return true;
                            if (email && task.assignedTo === email) return true;
                            return false;
                        })
                        .map((task: any) => ({
                            id: task.id,
                            title: task.title || task.id,
                            status: task.status || "TODO",
                            dueDate: task.dueDate || null,
                            taskBoardId: task.taskBoardId || null,
                            workspaceId: ws.id,
                            workspaceName: ws.name || ws.id,
                            boardName: boardNameById.get(task.taskBoardId) || "Board",
                        }));

                    return {
                        workspaceId: ws.id,
                        stats: { boards: boardsForWorkspace.length, members: memberCount, tasks: taskData.length },
                        boardCount: boardItems.length,
                        assignmentItems,
                    };
                })
            );

            const assignmentIndex: any[] = [];
            let totalBoards = 0;
            let totalTasks = 0;

            workspaceResults.forEach((result) => {
                totalBoards += result.boardCount || 0;
                assignmentIndex.push(...(result.assignmentItems || []));
                totalTasks += result.stats.tasks || 0;
            });

            setAssignedTasks(
                assignmentIndex.sort((a, b) => {
                    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    return aDue - bDue;
                })
            );
            setOverviewMetrics({
                workspaces: scopedWorkspaces.length,
                boards: totalBoards,
                tasks: totalTasks,
                assigned: assignmentIndex.length,
            });
        } finally {
            // no-op
        }
    }

    return (
        <div className="dash">
            <div className="dash-header">
                <div className="general-header-row">
                    <div>
                        <h1 className="dash-title">Workspace Hub</h1>
                        <p className="dash-sub">
                            {workspaceId
                                ? "Workspace-focused overview for your role, boards, members, and assignments."
                                : "Cross-workspace overview for your organizations, boards, and members."}
                        </p>
                    </div>
                </div>
            </div>

            <div className="general-metrics-grid">
                <div className="general-metric-card">
                    <div className="general-metric-label">Role</div>
                    <div className="general-metric-value">{roleLabel}</div>
                    <div className="general-metric-meta">Current scope</div>
                </div>
                <div className="general-metric-card">
                    <div className="general-metric-label">Workspaces</div>
                    {hasOwnerAccess && (
                        <button
                            className="general-metric-action"
                            title="Open read-only workspace directory"
                            aria-label="Open read-only workspace directory"
                            onClick={() => navigate("/general/workspaces")}
                        >
                            <ExternalLink size={14} />
                        </button>
                    )}
                    <div className="general-metric-value">{overviewMetrics.workspaces}</div>
                    <div className="general-metric-meta">Accessible in scope</div>
                </div>
                <div className="general-metric-card">
                    <div className="general-metric-label">Taskboards</div>
                    <div className="general-metric-value">{overviewMetrics.boards}</div>
                    <div className="general-metric-meta">Across visible workspaces</div>
                </div>
                <div className="general-metric-card">
                    <div className="general-metric-label">Tasks</div>
                    <div className="general-metric-value">{overviewMetrics.tasks}</div>
                    <div className="general-metric-meta">Across visible workspaces</div>
                </div>
                <div className="general-metric-card">
                    <div className="general-metric-label">Assigned to Me</div>
                    <div className="general-metric-value">{overviewMetrics.assigned}</div>
                    <div className="general-metric-meta">User specific</div>
                </div>
            </div>

            <div className="workspace-directory">
                <div className="workspace-directory-head">
                    <h3>Organization Directory</h3>
                    <span className="workspace-directory-total">
                        {userOrgIds.length} organization{userOrgIds.length !== 1 ? "s" : ""}
                    </span>
                </div>
                {userOrgIds.length === 0 ? (
                    <div className="workspace-directory-empty">No organizations available.</div>
                ) : (
                    <div className="workspace-pill-list">
                        <button
                            className={`workspace-pill ${!organizationId ? "active" : ""}`}
                            onClick={() => {
                                setOrganizationId(null);
                                setWorkspaceId(null);
                            }}
                        >
                            All organizations
                        </button>
                        {organizations
                            .filter((org: any) => userOrgIds.includes(org.id))
                            .map((org: any) => (
                            <button
                                key={org.id}
                                className={`workspace-pill ${organizationId === org.id ? "active" : ""}`}
                                onClick={() => {
                                    setOrganizationId(org.id);
                                    setWorkspaceId(null);
                                }}
                            >
                                {org.name || org.id}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="workspace-directory">
                <div className="workspace-directory-head">
                    <h3>My Assignments</h3>
                    <span className="workspace-directory-total">
                        {assignedTasks.length} task{assignedTasks.length !== 1 ? "s" : ""}
                    </span>
                </div>
                {assignedTasks.length === 0 ? (
                    <div className="workspace-directory-empty">No tasks currently assigned to you in this scope.</div>
                ) : (
                    <div className="general-assignment-list">
                        {assignedTasks.slice(0, 12).map((task) => (
                            <button
                                key={task.id}
                                type="button"
                                className="general-assignment-item general-assignment-item-btn"
                                onClick={() => {
                                    setWorkspaceId(task.workspaceId);
                                    const ws = workspaces.find((item: any) => item.id === task.workspaceId);
                                    if (ws?.organizationId) setOrganizationId(ws.organizationId);
                                    const query = new URLSearchParams();
                                    if (task.taskBoardId) query.set("board", task.taskBoardId);
                                    query.set("task", task.id);
                                    navigate(`/general/tasks?${query.toString()}`);
                                }}
                            >
                                <div className="general-assignment-title">{task.title}</div>
                                <div className="general-assignment-meta">
                                    <span>{task.workspaceName}</span>
                                    <span>{task.boardName}</span>
                                    <span>{task.status}</span>
                                    <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
