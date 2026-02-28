import { useEffect, useMemo, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import CountUp from "react-countup";
import { useNavigate } from "react-router-dom";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
    LayoutDashboard, Users, CheckCircle2, ListTodo,
    Clock, TrendingUp, Kanban, Layers, ArrowUpRight,
} from "lucide-react";
import { displayName } from "../../../libs/displayName";
import { getPlanLimits } from "../../../libs/planLimits";

type Stats = {
    boards: number;
    members: number;
    todo: number;
    inProgress: number;
    done: number;
    total: number;
    pendingInvites: number;
};

type WsStats = {
    boards: number;
    members: number;
    tasks: number;
};

type BoardDirectoryItem = {
    id: string;
    name?: string | null;
    workspaceId?: string | null;
    workspaceName?: string | null;
    organizationId?: string | null;
    isActive?: boolean | null;
    taskCount: number;
};

type MemberDirectoryItem = {
    id: string;
    userSub?: string | null;
    email: string;
    role?: string | null;
    status?: string | null;
    organizationId?: string | null;
    organizationName?: string | null;
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

const controlCenterStatsCache = new Map<string, {
    ts: number;
    wsStats: Record<string, WsStats>;
    boardDirectory: BoardDirectoryItem[];
    memberDirectory: MemberDirectoryItem[];
}>();

function enrichBoardsWithCounts(boardList: any[], tasks: any[]) {
    const map = new Map<string, { todo: number; inProgress: number; done: number; total: number }>();
    tasks.forEach((t: any) => {
        const bid = t.taskBoardId;
        if (!bid) return;
        if (!map.has(bid)) map.set(bid, { todo: 0, inProgress: 0, done: 0, total: 0 });
        const c = map.get(bid)!;
        c.total++;
        if (t.status === "TODO") c.todo++;
        else if (t.status === "IN_PROGRESS") c.inProgress++;
        else if (t.status === "DONE") c.done++;
    });
    return boardList.map((b: any) => ({
        ...b,
        _counts: map.get(b.id) || { todo: 0, inProgress: 0, done: 0, total: 0 },
    }));
}

export default function TenantDashboard() {
    const client = dataClient();
    const navigate = useNavigate();
    const {
        tenantId, organizationId, workspaceId, setWorkspaceId, setOrganizationId,
        organizations, workspaces, refreshOrganizations,
    } = useWorkspace();

    // ─── Mode 1: Workspace grid stats ───
    const [wsStats, setWsStats] = useState<Record<string, WsStats>>({});
    const [gridLoading, setGridLoading] = useState(true);

    // ─── Mode 2: Workspace dashboard state ───
    const [stats, setStats] = useState<Stats>({
        boards: 0, members: 0, todo: 0,
        inProgress: 0, done: 0, total: 0, pendingInvites: 0,
    });
    const [boards, setBoards] = useState<any[]>([]);
    const [recentMembers, setRecentMembers] = useState<any[]>([]);
    const [dashLoading, setDashLoading] = useState(true);
    const [workspaceQuery, setWorkspaceQuery] = useState("");
    const [workspaceSort, setWorkspaceSort] = useState<"name" | "boards" | "members">("name");
    const [workspaceStatus, setWorkspaceStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
    const [boardDirectory, setBoardDirectory] = useState<BoardDirectoryItem[]>([]);
    const [boardQuery, setBoardQuery] = useState("");
    const [boardSort, setBoardSort] = useState<"name" | "workspace" | "tasks">("name");
    const [boardStatus, setBoardStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
    const [memberDirectory, setMemberDirectory] = useState<MemberDirectoryItem[]>([]);
    const [memberQuery, setMemberQuery] = useState("");
    const [memberSort, setMemberSort] = useState<"name" | "role" | "organization">("name");
    const [memberStatus, setMemberStatus] = useState<"ALL" | "ACTIVE" | "REMOVED">("ACTIVE");
    const [usageMetrics, setUsageMetrics] = useState({
        plan: "STARTER",
        orgUsed: 0,
        orgLimit: 1,
        workspaceUsed: 0,
        workspaceLimit: 1,
    });

    const currentWsName = workspaces.find((w: any) => w.id === workspaceId)?.name;
    const currentOrgName = organizations.find((org: any) => org.id === organizationId)?.name || "Organization";
    const allOrganizationsSelected = !organizationId;
    const workspaceLabel = `${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""}`;
    const organizationLabel = `${organizations.length} organization${organizations.length !== 1 ? "s" : ""}`;

    const filteredWorkspaces = useMemo(() => {
        const normalizedQuery = workspaceQuery.trim().toLowerCase();
        const base = workspaces.filter((ws: any) => {
            if (workspaceStatus === "ACTIVE" && ws.isActive === false) return false;
            if (workspaceStatus === "INACTIVE" && ws.isActive !== false) return false;
            if (!normalizedQuery) return true;
            const name = (ws.name || "").toLowerCase();
            const description = (ws.description || "").toLowerCase();
            return name.includes(normalizedQuery) || description.includes(normalizedQuery);
        });

        return [...base].sort((a: any, b: any) => {
            if (workspaceSort === "boards") return (wsStats[b.id]?.boards || 0) - (wsStats[a.id]?.boards || 0);
            if (workspaceSort === "members") return (wsStats[b.id]?.members || 0) - (wsStats[a.id]?.members || 0);
            return String(a.name || a.id).localeCompare(String(b.name || b.id));
        });
    }, [workspaceQuery, workspaceSort, workspaceStatus, workspaces, wsStats]);

    const filteredBoards = useMemo(() => {
        const normalizedQuery = boardQuery.trim().toLowerCase();
        const base = boardDirectory.filter((board) => {
            if (boardStatus === "ACTIVE" && board.isActive === false) return false;
            if (boardStatus === "INACTIVE" && board.isActive !== false) return false;
            if (!normalizedQuery) return true;
            const name = (board.name || "").toLowerCase();
            const workspaceName = (board.workspaceName || "").toLowerCase();
            return name.includes(normalizedQuery) || workspaceName.includes(normalizedQuery);
        });

        return [...base].sort((a, b) => {
            if (boardSort === "workspace") return String(a.workspaceName || "").localeCompare(String(b.workspaceName || ""));
            if (boardSort === "tasks") return (b.taskCount || 0) - (a.taskCount || 0);
            return String(a.name || a.id).localeCompare(String(b.name || b.id));
        });
    }, [boardDirectory, boardQuery, boardSort, boardStatus]);

    const filteredMemberDirectory = useMemo(() => {
        const normalizedQuery = memberQuery.trim().toLowerCase();
        const base = memberDirectory.filter((member) => {
            if (memberStatus === "ACTIVE" && member.status !== "ACTIVE") return false;
            if (memberStatus === "REMOVED" && member.status !== "REMOVED") return false;
            if (!normalizedQuery) return true;
            const email = (member.email || "").toLowerCase();
            const role = (member.role || "").toLowerCase();
            const org = (member.organizationName || "").toLowerCase();
            return email.includes(normalizedQuery) || role.includes(normalizedQuery) || org.includes(normalizedQuery);
        });

        return [...base].sort((a, b) => {
            if (memberSort === "role") return String(a.role || "").localeCompare(String(b.role || ""));
            if (memberSort === "organization") return String(a.organizationName || "").localeCompare(String(b.organizationName || ""));
            return String(a.email || "").localeCompare(String(b.email || ""));
        });
    }, [memberDirectory, memberQuery, memberSort, memberStatus]);

    const selectedWorkspace = filteredWorkspaces.find((ws: any) => ws.id === selectedWorkspaceId) || null;
    const workspacesDepsKey = workspaces
        .map((ws: any) => `${ws.id}:${ws.organizationId || ""}:${ws.updatedAt || ""}`)
        .join("|");
    const organizationsDepsKey = organizations
        .map((org: any) => `${org.id}:${org.name || ""}:${org.updatedAt || ""}`)
        .join("|");
    const workspacePlanPercent = Math.min(
        100,
        Math.round((usageMetrics.workspaceUsed / Math.max(usageMetrics.workspaceLimit, 1)) * 100)
    );
    const organizationPlanPercent = Math.min(
        100,
        Math.round((usageMetrics.orgUsed / Math.max(usageMetrics.orgLimit, 1)) * 100)
    );
    const workspacePlanOverLimit = usageMetrics.workspaceUsed > usageMetrics.workspaceLimit;
    const organizationPlanOverLimit = usageMetrics.orgUsed > usageMetrics.orgLimit;
    function usageCard(label: string, used: number, limit: number, percent: number, overLimit = false) {
        return (
            <div className="directory-usage-mini">
                <div className="directory-usage-head">
                    <span>{label}</span>
                    <strong>{used} / {limit}</strong>
                </div>
                <div className="directory-usage-track">
                    <div
                        className={`directory-usage-fill ${overLimit ? "over" : ""}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
        );
    }
    function organizationInitialsForWorkspace(workspace: any) {
        const orgName = organizations.find((org: any) => org.id === workspace.organizationId)?.name || "";
        const parts = orgName.trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "ORG";
        return parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase() || "").join("");
    }

    useEffect(() => {
        if (!tenantId) return;
        refreshOrganizations();
    }, [tenantId]);

    useEffect(() => {
        if (!tenantId) return;
        const currentTenantId = tenantId;

        let cancelled = false;
        async function loadWorkspacePlanUsage() {
            try {
                const [tenantRes, workspaceRes] = await Promise.all([
                    client.models.Tenant.get({ id: currentTenantId }),
                    client.models.Workspace.list({ filter: { tenantId: { eq: currentTenantId } } }),
                ]);

                const rawPlan = String(tenantRes?.data?.plan || "STARTER").toUpperCase();
                const limits = getPlanLimits(rawPlan);
                const maxWorkspaceTenantWide = limits.workspaces * limits.orgs;
                const workspaceUsedTenantWide = (workspaceRes.data || []).filter(
                    (ws: any) => ws.isActive !== false && Boolean(ws.organizationId)
                ).length;
                const workspaceUsedForSelectedOrg = organizationId
                    ? (workspaceRes.data || []).filter(
                        (ws: any) => ws.isActive !== false && ws.organizationId === organizationId
                    ).length
                    : workspaceUsedTenantWide;

                if (cancelled) return;
                setUsageMetrics({
                    plan: rawPlan,
                    orgUsed: organizations.length,
                    orgLimit: limits.orgs,
                    workspaceUsed: workspaceUsedForSelectedOrg,
                    workspaceLimit: organizationId ? limits.workspaces : maxWorkspaceTenantWide,
                });
            } catch (err) {
                console.error("workspace plan usage load failed", err);
            }
        }

        loadWorkspacePlanUsage();
        return () => {
            cancelled = true;
        };
    }, [tenantId, organizationId, workspacesDepsKey, organizationsDepsKey]);

    useEffect(() => {
        if (!filteredWorkspaces.length) {
            setSelectedWorkspaceId(null);
            return;
        }
        if (selectedWorkspaceId && !filteredWorkspaces.some((ws: any) => ws.id === selectedWorkspaceId)) {
            setSelectedWorkspaceId(null);
        }
    }, [filteredWorkspaces, selectedWorkspaceId]);

    // ─── Load workspace grid stats ───
    useEffect(() => {
        if (workspaceId || !tenantId) return;
        loadGridStats();
    }, [tenantId, workspaceId, workspacesDepsKey, organizationsDepsKey]);

    async function loadGridStats() {
        setGridLoading(true);
        try {
            const cacheKey = [
                tenantId || "no-tenant",
                organizationId || "all-orgs",
                ...workspaces.map((ws: any) => `${ws.id}:${ws.updatedAt || ""}`),
            ].join("|");

            const organizationIds = organizationId
                ? [organizationId]
                : Array.from(
                    new Set([
                        ...organizations.map((org: any) => org.id).filter(Boolean),
                        ...workspaces.map((ws: any) => ws.organizationId).filter(Boolean),
                    ])
                ) as string[];

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

            const orgStatsMap = new Map(
                organizationStats.map((item) => [item.orgId, item])
            );

            const workspaceResults = await Promise.all(
                workspaces.map(async (ws: any) => {
                    const boardRes = await client.models.TaskBoard.list({
                        filter: { workspaceId: { eq: ws.id } }
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

                    return {
                        workspaceId: ws.id,
                        stats: {
                            boards: boardsForWorkspace.length,
                            members: memberCount,
                            tasks: taskData.length,
                        },
                        boardItems,
                    };
                })
            );

            const map: Record<string, WsStats> = {};
            const boardIndex: BoardDirectoryItem[] = [];
            const memberIndexByOrgUser = new Map<string, MemberDirectoryItem>();

            const userProfilesRes = tenantId
                ? await client.models.UserProfile.list({ filter: { tenantId: { eq: tenantId } } })
                : { data: [] };
            const emailByUserSub = new Map<string, string>();
            (userProfilesRes.data || []).forEach((profile: any) => {
                if (profile?.userId) {
                    emailByUserSub.set(profile.userId, profile.email || profile.userId);
                }
            });

            organizationStats.forEach((orgStats) => {
                const orgName = organizations.find((org: any) => org.id === orgStats.orgId)?.name || orgStats.orgId;
                (orgStats.memberships || []).forEach((member: any) => {
                    if (!member?.id) return;
                    const userSub = member.userSub || member.id;
                    const key = `${orgStats.orgId}:${userSub}`;
                    const nextItem: MemberDirectoryItem = {
                        id: member.id,
                        userSub: member.userSub,
                        email: emailByUserSub.get(member.userSub) || member.userSub || "unknown",
                        role: member.role,
                        status: member.status,
                        organizationId: orgStats.orgId,
                        organizationName: orgName,
                    };

                    const existing = memberIndexByOrgUser.get(key);
                    if (!existing) {
                        memberIndexByOrgUser.set(key, nextItem);
                        return;
                    }

                    // Prefer ACTIVE rows over non-ACTIVE when duplicate memberships exist.
                    if (existing.status !== "ACTIVE" && nextItem.status === "ACTIVE") {
                        memberIndexByOrgUser.set(key, nextItem);
                    }
                });
            });

            workspaceResults.forEach((result) => {
                map[result.workspaceId] = result.stats;
                boardIndex.push(...result.boardItems);
            });
            const memberIndex = Array.from(memberIndexByOrgUser.values());

            controlCenterStatsCache.set(cacheKey, {
                ts: Date.now(),
                wsStats: map,
                boardDirectory: boardIndex,
                memberDirectory: memberIndex,
            });
            setWsStats(map);
            setBoardDirectory(boardIndex);
            setMemberDirectory(memberIndex);
        } finally {
            setGridLoading(false);
        }
    }

    // ─── Load workspace-scoped dashboard ───
    useEffect(() => {
        if (!workspaceId || !tenantId) return;
        loadDashboard();
    }, [tenantId, workspaceId]);

    async function loadDashboard() {
        if (!tenantId || !workspaceId) return;
        setDashLoading(true);

        try {
            let tenantOrgs: any[];
            if (organizationId) {
                const orgRes = await client.models.Organization.get({ id: organizationId });
                tenantOrgs = orgRes?.data ? [orgRes.data] : [];
            } else {
                const orgRes = await client.models.Organization.list({
                    filter: { tenantId: { eq: tenantId } },
                });
                tenantOrgs = orgRes.data || [];
            }

            const profRes = await client.models.UserProfile.list({
                filter: { tenantId: { eq: tenantId } },
            });

            let memberCount = 0;
            let pendingCount = 0;
            let allTasks: any[] = [];
            let allMembers: any[] = [];

            for (const org of tenantOrgs) {
                const [memRes, taskRes, invRes] = await Promise.all([
                    client.models.Membership.listMembershipsByOrganization({ organizationId: org.id }),
                    client.models.Task.listTasksByOrganization({ organizationId: org.id }),
                    client.models.Invitation.listInvitesByOrganization({ organizationId: org.id }),
                ]);

                const activeMembers = memRes.data.filter((m: any) => m.status !== "REMOVED");
                memberCount += activeMembers.length;
                allTasks = allTasks.concat(taskRes.data);
                allMembers = allMembers.concat(activeMembers);
                pendingCount += invRes.data.filter((i: any) => i.status === "PENDING").length;
            }

            // Scope tasks to selected workspace
            allTasks = allTasks.filter((t: any) => t.workspaceId === workspaceId);

            // Load boards for workspace
            const boardRes = await client.models.TaskBoard.list({
                filter: { workspaceId: { eq: workspaceId } }
            });
            const boardList = boardRes.data;

            const enrichedBoards = enrichBoardsWithCounts(boardList, allTasks);
            setBoards(enrichedBoards);

            setStats({
                boards: boardList.length,
                members: memberCount,
                todo: allTasks.filter(t => t.status === "TODO").length,
                inProgress: allTasks.filter(t => t.status === "IN_PROGRESS").length,
                done: allTasks.filter(t => t.status === "DONE").length,
                total: allTasks.length,
                pendingInvites: pendingCount,
            });

            const enriched = allMembers.map((m: any) => ({
                ...m,
                _email: profRes.data.find((p: any) => p.userId === m.userSub)?.email || m.userSub,
            }));
            setRecentMembers(enriched.slice(0, 5));
        } catch (err) {
            console.error("Dashboard load error:", err);
        }

        setDashLoading(false);
    }

    // ═══════════════════════════════════════
    // MODE 1 — Workspace Grid (no workspace)
    // ═══════════════════════════════════════
    if (!workspaceId) {
        return (
            <div className="dash">
                <div className="dash-header">
                    <div>
                        <h1 className="dash-title">
                            <LayoutDashboard size={24} />
                            Control Center
                        </h1>
                        <p className="dash-sub">Select an organization first, then a workspace · {organizationLabel} · {workspaceLabel}</p>
                    </div>
                </div>

                <div className="workspace-directory">
                    <div className="workspace-directory-head">
                        <h3>Organization Directory</h3>
                        <div className="workspace-directory-head-right">
                            <span className="workspace-directory-total">{organizationLabel}</span>
                            {usageCard(
                                "Plan Limit",
                                usageMetrics.orgUsed,
                                usageMetrics.orgLimit,
                                organizationPlanPercent,
                                organizationPlanOverLimit
                            )}
                            <button
                                className="directory-expand-btn"
                                onClick={() => navigate("/tenant/organizations")}
                                title="Manage organizations"
                            >
                                <ArrowUpRight size={14} />
                            </button>
                        </div>
                    </div>
                    {organizations.length === 0 ? (
                        <div className="workspace-directory-empty">No organizations available for this tenant.</div>
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
                            {organizations.map((org: any) => (
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
                        <h3>Workspace Directory</h3>
                        <div className="workspace-directory-head-right">
                            <span className="workspace-directory-total">
                                {filteredWorkspaces.length} workspace{filteredWorkspaces.length !== 1 ? "s" : ""}
                            </span>
                            {organizationId && usageCard(
                                "Plan Limit",
                                usageMetrics.workspaceUsed,
                                usageMetrics.workspaceLimit,
                                workspacePlanPercent,
                                workspacePlanOverLimit
                            )}
                            <button
                                className="directory-expand-btn"
                                onClick={() => navigate("/tenant/workspaces")}
                                title="Manage workspaces"
                            >
                                <ArrowUpRight size={14} />
                            </button>
                        </div>
                    </div>
                    {allOrganizationsSelected ? (
                        <div className="workspace-directory-empty">
                            Workspace details are collapsed. Select an organization to view workspace cards and details.
                        </div>
                    ) : (
                        <>
                            <div className="workspace-filter-bar board-filter-bar">
                                <input
                                    id="workspace-directory-search"
                                    name="workspace_directory_search"
                                    className="workspace-filter-input"
                                    placeholder="Search workspace by name or description"
                                    value={workspaceQuery}
                                    onChange={(e) => setWorkspaceQuery(e.target.value)}
                                />
                                <select
                                    id="workspace-directory-sort"
                                    name="workspace_directory_sort"
                                    className="workspace-filter-select"
                                    value={workspaceSort}
                                    onChange={(e) => setWorkspaceSort(e.target.value as "name" | "boards" | "members")}
                                >
                                    <option value="name">Sort: Name</option>
                                    <option value="boards">Sort: Most Boards</option>
                                    <option value="members">Sort: Most Members</option>
                                </select>
                                <select
                                    id="workspace-directory-status"
                                    name="workspace_directory_status"
                                    className="workspace-filter-select"
                                    value={workspaceStatus}
                                    onChange={(e) => setWorkspaceStatus(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                                >
                                    <option value="ALL">Status: All</option>
                                    <option value="ACTIVE">Status: Active</option>
                                    <option value="INACTIVE">Status: Inactive</option>
                                </select>
                            </div>
                            {selectedWorkspace && (
                                <div className="workspace-section-actions">
                                    <button
                                        className="workspace-section-btn"
                                        onClick={() => setWorkspaceId(selectedWorkspace.id)}
                                    >
                                        Open Workspace
                                    </button>
                                    <button
                                        className="workspace-section-btn"
                                        onClick={() => {
                                            setWorkspaceId(selectedWorkspace.id);
                                            navigate("/tenant/tasks");
                                        }}
                                    >
                                        View Tasks
                                    </button>
                                    <button
                                        className="workspace-section-btn"
                                        onClick={() => {
                                            setWorkspaceId(selectedWorkspace.id);
                                            navigate("/tenant/members");
                                        }}
                                    >
                                        Manage Members
                                    </button>
                                </div>
                            )}
                            {gridLoading ? (
                                <div className="workspace-directory-empty">Loading workspaces...</div>
                            ) : filteredWorkspaces.length === 0 ? (
                                <div className="workspace-directory-empty">No workspaces available for this organization.</div>
                            ) : (
                                <div className="cc-content-grid">
                                    <div className="ws-grid">
                                        {filteredWorkspaces.map((ws) => {
                                            const s = wsStats[ws.id] || { boards: 0, members: 0, tasks: 0 };
                                            const isSelected = ws.id === selectedWorkspaceId;
                                            return (
                                                <div
                                                    key={ws.id}
                                                    className={`ws-card ${isSelected ? "selected" : ""}`}
                                                    onClick={() => setSelectedWorkspaceId(ws.id)}
                                                >
                                                    <div className="ws-card-header">
                                                        <div className="ws-card-name">{ws.name || ws.id}</div>
                                                        <div className="ws-org-icon" title={organizations.find((org: any) => org.id === ws.organizationId)?.name || "Organization"}>
                                                            {organizationInitialsForWorkspace(ws)}
                                                        </div>
                                                    </div>
                                                    {ws.description && (
                                                        <div className="ws-card-desc">{ws.description}</div>
                                                    )}
                                                    <div className="ws-card-stats">
                                                        <span className="ws-stat">
                                                            <Kanban size={14} /> {s.boards} boards
                                                        </span>
                                                        <span className="ws-stat">
                                                            <Users size={14} /> {s.members} members
                                                        </span>
                                                        <span className="ws-stat">
                                                            <ListTodo size={14} /> {s.tasks} tasks
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <aside className="workspace-drawer">
                                        {selectedWorkspace ? (
                                            <>
                                                <h3 className="workspace-drawer-title">{selectedWorkspace.name || selectedWorkspace.id}</h3>
                                                <p className="workspace-drawer-sub">
                                                    {(selectedWorkspace.description || "No description") as string}
                                                </p>
                                                <div className="workspace-drawer-stats">
                                                    <div><strong>{wsStats[selectedWorkspace.id]?.boards || 0}</strong><span>Boards</span></div>
                                                    <div><strong>{wsStats[selectedWorkspace.id]?.members || 0}</strong><span>Members</span></div>
                                                    <div><strong>{wsStats[selectedWorkspace.id]?.tasks || 0}</strong><span>Tasks</span></div>
                                                </div>
                                                <div className="workspace-drawer-actions">
                                                    <button
                                                        className="btn"
                                                        onClick={() => setWorkspaceId(selectedWorkspace.id)}
                                                    >
                                                        Open Workspace Dashboard
                                                    </button>
                                                    <button
                                                        className="btn secondary"
                                                        onClick={() => {
                                                            setWorkspaceId(selectedWorkspace.id);
                                                            navigate("/tenant/tasks");
                                                        }}
                                                    >
                                                        View Tasks
                                                    </button>
                                                    <button
                                                        className="btn secondary"
                                                        onClick={() => {
                                                            setWorkspaceId(selectedWorkspace.id);
                                                            navigate("/tenant/members");
                                                        }}
                                                    >
                                                        Manage Members
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="workspace-directory-empty">Select a workspace to view quick details.</div>
                                        )}
                                    </aside>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="workspace-directory">
                    <div className="workspace-directory-head">
                        <h3>Board Directory</h3>
                        <div className="workspace-directory-head-right">
                            <span className="workspace-directory-total">
                                {filteredBoards.length} board{filteredBoards.length !== 1 ? "s" : ""}
                            </span>
                            <button
                                className="directory-expand-btn"
                                onClick={() => navigate("/tenant/tasks")}
                                title="Manage task boards"
                            >
                                <ArrowUpRight size={14} />
                            </button>
                        </div>
                    </div>
                    {allOrganizationsSelected ? (
                        <div className="workspace-directory-empty">
                            Board details are collapsed. Select an organization to view board cards and filters.
                        </div>
                    ) : (
                        <>
                            <div className="workspace-filter-bar board-filter-bar">
                                <input
                                    id="board-directory-search"
                                    name="board_directory_search"
                                    className="workspace-filter-input"
                                    placeholder="Search board by name or workspace"
                                    value={boardQuery}
                                    onChange={(e) => setBoardQuery(e.target.value)}
                                />
                                <select
                                    id="board-directory-sort"
                                    name="board_directory_sort"
                                    className="workspace-filter-select"
                                    value={boardSort}
                                    onChange={(e) => setBoardSort(e.target.value as "name" | "workspace" | "tasks")}
                                >
                                    <option value="name">Sort: Name</option>
                                    <option value="workspace">Sort: Workspace</option>
                                    <option value="tasks">Sort: Most Tasks</option>
                                </select>
                                <select
                                    id="board-directory-status"
                                    name="board_directory_status"
                                    className="workspace-filter-select"
                                    value={boardStatus}
                                    onChange={(e) => setBoardStatus(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                                >
                                    <option value="ALL">Status: All</option>
                                    <option value="ACTIVE">Status: Active</option>
                                    <option value="INACTIVE">Status: Inactive</option>
                                </select>
                            </div>
                            {gridLoading ? (
                                <div className="workspace-directory-empty">Loading boards...</div>
                            ) : filteredBoards.length === 0 ? (
                                <div className="workspace-directory-empty">No boards match your current filters.</div>
                            ) : (
                                <div className="board-grid">
                                    {filteredBoards.map((board) => (
                                        <div key={board.id} className="board-card board-directory-card">
                                            <div className="board-card-name">{board.name || board.id}</div>
                                            <div className="board-card-stats">
                                                <span>{board.workspaceName}</span>
                                                <span>{board.taskCount} task{board.taskCount !== 1 ? "s" : ""}</span>
                                                <span>{board.isActive === false ? "Inactive" : "Active"}</span>
                                            </div>
                                            {board.workspaceId && (
                                                <button
                                                    className="btn secondary"
                                                    style={{ marginTop: 10 }}
                                                    onClick={() => setWorkspaceId(board.workspaceId || null)}
                                                >
                                                    Open Workspace Details
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="workspace-directory">
                    <div className="workspace-directory-head">
                        <h3>Member Directory</h3>
                        <div className="workspace-directory-head-right">
                            <span className="workspace-directory-total">
                                {filteredMemberDirectory.length} member{filteredMemberDirectory.length !== 1 ? "s" : ""}
                            </span>
                            <button
                                className="directory-expand-btn"
                                onClick={() => navigate("/tenant/members")}
                                title="Manage members"
                            >
                                <ArrowUpRight size={14} />
                            </button>
                        </div>
                    </div>
                    {allOrganizationsSelected ? (
                        <div className="workspace-directory-empty">
                            Member details are collapsed. Select an organization to view member cards and filters.
                        </div>
                    ) : (
                        <>
                            <div className="workspace-filter-bar board-filter-bar">
                                <input
                                    id="member-directory-search"
                                    name="member_directory_search"
                                    className="workspace-filter-input"
                                    placeholder="Search member by email, role, or organization"
                                    value={memberQuery}
                                    onChange={(e) => setMemberQuery(e.target.value)}
                                />
                                <select
                                    id="member-directory-sort"
                                    name="member_directory_sort"
                                    className="workspace-filter-select"
                                    value={memberSort}
                                    onChange={(e) => setMemberSort(e.target.value as "name" | "role" | "organization")}
                                >
                                    <option value="name">Sort: Email</option>
                                    <option value="role">Sort: Role</option>
                                    <option value="organization">Sort: Organization</option>
                                </select>
                                <select
                                    id="member-directory-status"
                                    name="member_directory_status"
                                    className="workspace-filter-select"
                                    value={memberStatus}
                                    onChange={(e) => setMemberStatus(e.target.value as "ALL" | "ACTIVE" | "REMOVED")}
                                >
                                    <option value="ACTIVE">Status: Active</option>
                                    <option value="ALL">Status: All</option>
                                    <option value="REMOVED">Status: Removed</option>
                                </select>
                            </div>
                            {gridLoading ? (
                                <div className="workspace-directory-empty">Loading members...</div>
                            ) : filteredMemberDirectory.length === 0 ? (
                                <div className="workspace-directory-empty">No members match your current filters.</div>
                            ) : (
                                <div className="board-grid">
                                    {filteredMemberDirectory.map((member) => (
                                        <div key={member.id} className="board-card board-directory-card">
                                            <div className="board-card-name">{member.email}</div>
                                            <div className="board-card-stats">
                                                <span>{member.organizationName || "Organization"}</span>
                                                <span>{member.role || "MEMBER"}</span>
                                                <span>{member.status || "ACTIVE"}</span>
                                            </div>
                                            <button
                                                className="btn secondary"
                                                style={{ marginTop: 10 }}
                                                onClick={() => navigate("/tenant/members")}
                                            >
                                                Open Members
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

            </div>
        );
    }

    // ═══════════════════════════════════════
    // MODE 2 — Workspace Dashboard
    // ═══════════════════════════════════════

    if (dashLoading) {
        return (
            <div className="dash">
                <div className="dash-skeleton">
                    <div className="skel-row">
                        <div className="skel-card shimmer" />
                        <div className="skel-card shimmer" />
                        <div className="skel-card shimmer" />
                        <div className="skel-card shimmer" />
                    </div>
                    <div className="skel-row">
                        <div className="skel-wide shimmer" />
                        <div className="skel-wide shimmer" />
                    </div>
                </div>
            </div>
        );
    }

    const completionRate = stats.total > 0
        ? Math.round((stats.done / stats.total) * 100) : 0;

    const barData = [
        { name: "Todo", value: stats.todo, fill: "#94a3b8" },
        { name: "In Progress", value: stats.inProgress, fill: "#3b82f6" },
        { name: "Done", value: stats.done, fill: "#10b981" },
    ];

    const pieData = [
        { name: "Todo", value: stats.todo },
        { name: "In Progress", value: stats.inProgress },
        { name: "Done", value: stats.done },
    ].filter(d => d.value > 0);

    const PIE_COLORS = ["#94a3b8", "#3b82f6", "#10b981"];

    return (
        <div className="dash">

            {/* BREADCRUMB */}
            <div className="breadcrumb">
                <button
                    className="breadcrumb-link"
                    onClick={() => {
                        setOrganizationId(null);
                        setWorkspaceId(null);
                        navigate("/tenant");
                    }}
                >
                    Control Center
                </button>
                <span className="breadcrumb-sep">/</span>
                <button
                    className="breadcrumb-link"
                    onClick={() => {
                        setWorkspaceId(null);
                        navigate("/tenant/organizations");
                    }}
                >
                    {currentOrgName}
                </button>
                <span className="breadcrumb-sep">/</span>
                <button
                    className="breadcrumb-link"
                    onClick={() => navigate("/tenant/workspaces")}
                >
                    {currentWsName || "Workspace"}
                </button>
            </div>

            {/* HEADER */}
            <div className="dash-header">
                <div>
                    <h1 className="dash-title">
                        <Layers size={24} />
                        {currentWsName || "Workspace"}
                    </h1>
                    <p className="dash-sub">
                        {stats.boards} board{stats.boards !== 1 ? "s" : ""} &middot; {stats.total} task{stats.total !== 1 ? "s" : ""} &middot; {workspaceLabel} &middot; {organizationLabel}
                    </p>
                </div>
            </div>

            <div className="workspace-directory">
                <div className="workspace-directory-head">
                    <h3>Organization Directory</h3>
                    <span className="workspace-directory-total">{organizationLabel}</span>
                </div>
                {organizations.length === 0 ? (
                    <div className="workspace-directory-empty">No organizations available for this tenant.</div>
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
                        {organizations.map((org: any) => (
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
                    <h3>Workspace Directory</h3>
                    <button className="workspace-directory-clear" onClick={() => setWorkspaceId(null)}>
                        View all
                    </button>
                </div>
                <div className="workspace-pill-list">
                    {workspaces.map((ws: any) => (
                        <button
                            key={ws.id}
                            className={`workspace-pill ${ws.id === workspaceId ? "active" : ""}`}
                            onClick={() => setWorkspaceId(ws.id)}
                        >
                            {ws.name || ws.id}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="kpi-grid">

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                        <TrendingUp size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Active Tasks</span>
                        <span className="kpi-value">
                            <CountUp end={stats.inProgress} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                        <ListTodo size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Total Tasks</span>
                        <span className="kpi-value">
                            <CountUp end={stats.total} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                        <CheckCircle2 size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Completion</span>
                        <span className="kpi-value">
                            <CountUp end={completionRate} duration={1} />%
                        </span>
                    </div>
                </div>

            </div>

            {/* BOARD CARDS */}
            {boards.length > 0 && (
                <>
                    <h3 className="board-section-title">Task Boards</h3>
                    <div className="board-grid">
                        {boards.map((b: any) => {
                            const c = b._counts;
                            return (
                                <div key={b.id} className="board-card">
                                    <div className="board-card-name">{b.name}</div>
                                    <div className="board-card-bar">
                                        {c.total > 0 && (
                                            <>
                                                <div className="progress-segment todo" style={{ width: `${(c.todo / c.total) * 100}%` }} />
                                                <div className="progress-segment active" style={{ width: `${(c.inProgress / c.total) * 100}%` }} />
                                                <div className="progress-segment done" style={{ width: `${(c.done / c.total) * 100}%` }} />
                                            </>
                                        )}
                                    </div>
                                    <div className="board-card-stats">
                                        <span><span className="dot todo" />{c.todo}</span>
                                        <span><span className="dot active" />{c.inProgress}</span>
                                        <span><span className="dot done" />{c.done}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* PROGRESS BAR */}
            <div className="progress-strip">
                <div className="progress-row">
                    <div className="progress-segment todo"
                        style={{ width: `${stats.total ? (stats.todo / stats.total) * 100 : 0}%` }} />
                    <div className="progress-segment active"
                        style={{ width: `${stats.total ? (stats.inProgress / stats.total) * 100 : 0}%` }} />
                    <div className="progress-segment done"
                        style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }} />
                </div>
                <div className="progress-legend">
                    <span><span className="dot todo" /> Todo ({stats.todo})</span>
                    <span><span className="dot active" /> In Progress ({stats.inProgress})</span>
                    <span><span className="dot done" /> Done ({stats.done})</span>
                </div>
            </div>

            {/* CHARTS ROW */}
            <div className="chart-row">

                {/* BAR CHART */}
                <div className="dash-panel">
                    <h3 className="panel-title">Task Breakdown</h3>
                    {stats.total > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={barData} barSize={36}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}
                                />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                    {barData.map((d, i) => (
                                        <Cell key={i} fill={d.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-chart">No tasks yet</div>
                    )}
                </div>

                {/* PIE CHART */}
                <div className="dash-panel">
                    <h3 className="panel-title">Distribution</h3>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={3}
                                >
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-chart">No tasks yet</div>
                    )}
                </div>

            </div>

            {/* BOTTOM ROW */}
            <div className="chart-row">

                {/* STATUS BREAKDOWN */}
                <div className="dash-panel">
                    <h3 className="panel-title">Status Breakdown</h3>
                    <div className="status-list">
                        <div className="status-row">
                            <div className="status-left">
                                <Clock size={16} color="#94a3b8" />
                                <span>Todo</span>
                            </div>
                            <span className="status-count">{stats.todo}</span>
                        </div>
                        <div className="status-row">
                            <div className="status-left">
                                <TrendingUp size={16} color="#3b82f6" />
                                <span>In Progress</span>
                            </div>
                            <span className="status-count">{stats.inProgress}</span>
                        </div>
                        <div className="status-row">
                            <div className="status-left">
                                <CheckCircle2 size={16} color="#10b981" />
                                <span>Done</span>
                            </div>
                            <span className="status-count">{stats.done}</span>
                        </div>
                    </div>
                </div>

                {/* RECENT MEMBERS */}
                <div className="dash-panel">
                    <h3 className="panel-title">Team Members</h3>
                    {recentMembers.length === 0 ? (
                        <div className="empty-chart">No members yet</div>
                    ) : (
                        <div className="member-list">
                            {recentMembers.map((m: any) => {
                                const statusLabel = m.status === "REMOVED" ? "Inactive" : "Active";
                                const statusColor = m.status === "REMOVED" ? "#ef4444" : "#10b981";
                                return (
                                    <div key={m.id} className="member-row">
                                        <div className="member-avatar">
                                            {displayName(m._email)[0].toUpperCase()}
                                        </div>
                                        <div className="member-info">
                                            <span className="member-id">{displayName(m._email)}</span>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: statusColor }}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
