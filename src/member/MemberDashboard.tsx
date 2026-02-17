import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dataClient } from "../libs/data-client";
import { getMyMemberships, getMemberOrgIds, getMyTenantId, getMySub } from "../libs/isMember";

export default function MemberDashboard() {
    const client = dataClient();
    const navigate = useNavigate();

    const [memberships, setMemberships] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [dueDateFilter, setDueDateFilter] = useState("");
    const [stats, setStats] = useState({ dueToday: 0, overdue: 0, assignedToMe: 0, totalTasks: 0 });
    const [loading, setLoading] = useState(true);
    const [mySub, setMySub] = useState<string | null>(null);

    useEffect(() => { load(); }, []);
    useEffect(() => { if (mySub) recalcStats(); }, [dueDateFilter]);

    async function load() {
        const sub = await getMySub();
        if (!sub) { setLoading(false); return; }
        setMySub(sub);

        const myMemberships = await getMyMemberships();
        const activeMemberships = myMemberships.filter((m: any) => m.status !== "REMOVED");
        setMemberships(activeMemberships);

        const tenantId = await getMyTenantId();
        if (!tenantId) { setLoading(false); return; }

        const orgIds = await getMemberOrgIds();

        // load orgs
        const orgRes = await client.models.Workspace.list({
            filter: { tenantId: { eq: tenantId } },
        });
        const myOrgs = orgRes.data.filter((o: any) => orgIds.includes(o.id));
        setOrganizations(myOrgs);

        // load tasks assigned to me
        const taskRes = await client.models.Task.list({
            filter: { assignedTo: { eq: sub } },
        });
        const allTasks = taskRes.data;

        calcStats(allTasks, "");

        // load notifications (guard against model not yet deployed)
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

    async function recalcStats() {
        if (!mySub) return;
        const taskRes = await client.models.Task.list({
            filter: { assignedTo: { eq: mySub } },
        });
        calcStats(taskRes.data, dueDateFilter);
    }

    function calcStats(tasks: any[], filterDate: string) {
        const today = new Date().toISOString().split("T")[0];

        let filtered = tasks;
        if (filterDate) {
            filtered = tasks.filter((t: any) => t.dueDate && t.dueDate.split("T")[0] <= filterDate);
        }

        const dueToday = filtered.filter(
            (t: any) => t.dueDate && t.dueDate.split("T")[0] === today && t.status !== "DONE" && t.status !== "ARCHIVED"
        ).length;

        const overdue = filtered.filter(
            (t: any) => t.dueDate && t.dueDate.split("T")[0] < today && t.status !== "DONE" && t.status !== "ARCHIVED"
        ).length;

        const assignedToMe = filtered.filter(
            (t: any) => t.status !== "DONE" && t.status !== "ARCHIVED"
        ).length;

        setStats({ dueToday, overdue, assignedToMe, totalTasks: filtered.length });
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
        <div>
            <div className="page-title">Dashboard</div>

            {/* org membership cards */}
            <div className="card-grid">
                {organizations.map((org) => {
                    const mem = memberships.find((m: any) => m.workspaceId === org.id);
                    return (
                        <div className="card" key={org.id} onClick={() => navigate("/member/tasks")} style={{ cursor: "pointer" }}>
                            <h3>{org.name}</h3>
                            <p>
                                <span className={`role-badge ${mem?.role?.toLowerCase()}`}>
                                    {mem?.role}
                                </span>
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* due date filter */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: "#64748b", marginRight: 8 }}>Filter by due date:</label>
                <input
                    type="date"
                    value={dueDateFilter}
                    onChange={(e) => setDueDateFilter(e.target.value)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
                {dueDateFilter && (
                    <button
                        className="btn secondary"
                        style={{ marginLeft: 8, fontSize: 12, padding: "4px 10px" }}
                        onClick={() => setDueDateFilter("")}
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* task metric cards */}
            <div className="card-grid">
                <div className="card" onClick={() => navigate("/member/tasks")} style={{ cursor: "pointer" }}>
                    <h3>Due Today</h3>
                    <p>{stats.dueToday}</p>
                </div>
                <div className="card" onClick={() => navigate("/member/tasks")} style={{ cursor: "pointer" }}>
                    <h3>Overdue</h3>
                    <p style={{ color: stats.overdue > 0 ? "#dc2626" : undefined }}>{stats.overdue}</p>
                </div>
                <div className="card" onClick={() => navigate("/member/tasks")} style={{ cursor: "pointer" }}>
                    <h3>Assigned to Me</h3>
                    <p>{stats.assignedToMe}</p>
                </div>
                <div className="card" onClick={() => navigate("/member/tasks")} style={{ cursor: "pointer" }}>
                    <h3>Total Tasks</h3>
                    <p>{stats.totalTasks}</p>
                </div>
            </div>

            {/* notifications */}
            <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Notifications</h3>
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
