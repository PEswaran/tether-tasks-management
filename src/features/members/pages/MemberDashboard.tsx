import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, AlertTriangle, UserCheck, ListTodo } from "lucide-react";
import { getMyMemberships, getMySub } from "../../../libs/isMember";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";

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

export default function MemberDashboard() {
    const client = dataClient();
    const navigate = useNavigate();
    const { tenantId, email, workspaceId, workspaces } = useWorkspace();

    const [notifications, setNotifications] = useState<any[]>([]);
    const [boards, setBoards] = useState<any[]>([]);
    const [stats, setStats] = useState({ dueToday: 0, overdue: 0, assignedToMe: 0, totalTasks: 0 });
    const [loading, setLoading] = useState(true);

    const currentWsName = workspaces.find((w: any) => w.id === workspaceId)?.name;

    useEffect(() => { load(); }, [tenantId, workspaceId]);

    async function load() {
        const sub = await getMySub();
        if (!sub) { setLoading(false); return; }

        const myMemberships = await getMyMemberships();
        const activeMemberships = myMemberships.filter((m: any) => m.status !== "REMOVED");

        if (!tenantId) { setLoading(false); return; }

        const orgIds = activeMemberships
            .filter((m: any) => m.role === "MEMBER" && m.tenantId === tenantId)
            .map((m: any) => m.organizationId)
            .filter(Boolean);

        // load tasks assigned to me
        const allTasks = await loadAssignedTasks(sub);
        const tenantTasks = allTasks.filter((t: any) => orgIds.includes(t.organizationId));

        const scopedTasks = workspaceId
            ? tenantTasks.filter((t: any) => t.workspaceId === workspaceId)
            : tenantTasks;
        calcStats(scopedTasks);

        // load boards
        try {
            let boardList: any[] = [];
            if (workspaceId) {
                const boardRes = await client.models.TaskBoard.list({ filter: { workspaceId: { eq: workspaceId } } });
                boardList = boardRes.data;
            } else if (orgIds.length > 0) {
                for (const oid of orgIds) {
                    const boardRes = await client.models.TaskBoard.listTaskBoardsByOrganization({ organizationId: oid });
                    boardList = boardList.concat(boardRes.data);
                }
            }
            const enrichedBoards = enrichBoardsWithCounts(boardList, scopedTasks);
            setBoards(enrichedBoards);
        } catch (err) {
            console.warn("Could not load boards:", err);
        }

        // load notifications
        try {
            if (client.models.Notification) {
                const notifRes = await client.models.Notification.list({
                    filter: { recipientId: { eq: sub } },
                });
                const sorted = [...notifRes.data].sort(
                    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setNotifications(sorted);
            }
        } catch (err) {
            console.warn("Notifications not available yet:", err);
        }

        setLoading(false);
    }

    async function loadAssignedTasks(sub: string) {
        const results = await Promise.all([
            client.models.Task.list({ filter: { assignedTo: { eq: sub } } }),
            email && email !== sub
                ? client.models.Task.list({ filter: { assignedTo: { eq: email } } })
                : Promise.resolve({ data: [] }),
        ]);

        const merged = new Map<string, any>();
        results.forEach((r: any) => {
            (r.data || []).forEach((t: any) => merged.set(t.id, t));
        });
        return Array.from(merged.values());
    }

    function calcStats(tasks: any[]) {
        const today = new Date().toISOString().split("T")[0];

        const dueToday = tasks.filter(
            (t: any) => t.dueDate && t.dueDate.split("T")[0] === today && t.status !== "DONE" && t.status !== "ARCHIVED"
        ).length;

        const overdue = tasks.filter(
            (t: any) => t.dueDate && t.dueDate.split("T")[0] < today && t.status !== "DONE" && t.status !== "ARCHIVED"
        ).length;

        const assignedToMe = tasks.filter(
            (t: any) => t.status !== "DONE" && t.status !== "ARCHIVED"
        ).length;

        setStats({ dueToday, overdue, assignedToMe, totalTasks: tasks.length });
    }

    async function markAsRead(notif: any) {
        try {
            await client.models.Notification.update({ id: notif.id, isRead: true });
            setNotifications((prev) =>
                prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
            );
        } catch (err) {
            console.error(err);
        }
    }

    if (loading) return <div>Loading dashboard...</div>;

    return (
        <div className="dash">
            <div className="dash-header">
                <div>
                    <h1 className="dash-title" style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                        Dashboard
                    </h1>
                    <p className="dash-sub">
                        {currentWsName ? currentWsName : "All workspaces"}
                    </p>
                </div>
            </div>

            {/* TASK METRIC CARDS */}
            <div className="kpi-grid">
                <div className="kpi-card" onClick={() => navigate("/member/tasks")} style={{ cursor: "pointer" }}>
                    <div className="kpi-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>
                        <CalendarClock size={18} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Due Today</span>
                        <span className="kpi-value">{stats.dueToday}</span>
                    </div>
                </div>
                <div className="kpi-card" onClick={() => navigate("/member/tasks")} style={{ cursor: "pointer" }}>
                    <div className="kpi-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
                        <AlertTriangle size={18} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Overdue</span>
                        <span className="kpi-value" style={{ color: stats.overdue > 0 ? "#dc2626" : undefined }}>{stats.overdue}</span>
                    </div>
                </div>
                <div className="kpi-card" onClick={() => navigate("/member/tasks?assigned=me")} style={{ cursor: "pointer" }}>
                    <div className="kpi-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                        <UserCheck size={18} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Assigned to Me</span>
                        <span className="kpi-value">{stats.assignedToMe}</span>
                    </div>
                </div>
                <div className="kpi-card" onClick={() => navigate("/member/tasks")} style={{ cursor: "pointer" }}>
                    <div className="kpi-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                        <ListTodo size={18} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Total Tasks</span>
                        <span className="kpi-value">{stats.totalTasks}</span>
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
                                <div key={b.id} className="board-card" onClick={() => navigate("/member/tasks")}>
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

            {/* NOTIFICATIONS */}
            <div style={{ marginTop: 20 }}>
                <h3 className="board-section-title">Notifications</h3>
                {notifications.length === 0 && (
                    <p style={{ color: "#94a3b8", fontSize: 14 }}>No notifications.</p>
                )}
                {notifications.map((n) => (
                    <div
                        key={n.id}
                        style={{
                            padding: "12px 16px",
                            marginBottom: 8,
                            borderRadius: 8,
                            background: "white",
                            borderLeft: n.isRead ? "4px solid #e2e8f0" : "4px solid #2563eb",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <strong style={{ fontSize: 14 }}>{n.title}</strong>
                                {n.message && <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>{n.message}</p>}
                                <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>
                                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                                </p>
                            </div>
                            {!n.isRead && (
                                <button
                                    className="btn secondary"
                                    style={{ fontSize: 12, padding: "4px 10px" }}
                                    onClick={() => markAsRead(n)}
                                >
                                    Mark as Read
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
