import { useEffect, useMemo, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { displayName } from "../../../libs/displayName";
import CountUp from "react-countup";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    LineChart, Line, Legend, ResponsiveContainer, Tooltip,
} from "recharts";
import {
    BarChart3, CheckCircle2, AlertTriangle, ListTodo,
} from "lucide-react";

type RawData = {
    tasks: any[];
    memberships: any[];
    profiles: any[];
};

type Period = "all" | "7" | "30" | "90";

function filterByPeriod(tasks: any[], period: Period): any[] {
    if (period === "all") return tasks;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(period));
    return tasks.filter((t: any) => {
        const created = t.createdAt ? new Date(t.createdAt) : null;
        return created && created >= cutoff;
    });
}

export default function ReportsPage() {
    const client = dataClient();
    const { tenantId, organizations } = useWorkspace();

    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<RawData>({ tasks: [], memberships: [], profiles: [] });
    const [period, setPeriod] = useState<Period>("all");

    // ─── Data Loading ───
    useEffect(() => {
        if (!tenantId || !organizations?.length) return;
        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                const orgIds = organizations.map((org: any) => org.id).filter(Boolean) as string[];

                const [taskResults, memberResults, profileRes] = await Promise.all([
                    Promise.all(orgIds.map(orgId =>
                        client.models.Task.listTasksByOrganization({ organizationId: orgId })
                    )),
                    Promise.all(orgIds.map(orgId =>
                        client.models.Membership.listMembershipsByOrganization({ organizationId: orgId })
                    )),
                    client.models.UserProfile.listProfilesByTenant({ tenantId: tenantId! }),
                ]);

                if (cancelled) return;

                const allTasks = taskResults.flatMap(r => r.data || []);
                const allMemberships = memberResults.flatMap(r => r.data || []);
                const allProfiles = profileRes.data || [];

                setRawData({ tasks: allTasks, memberships: allMemberships, profiles: allProfiles });
            } catch (err) {
                console.error("Reports data load error:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [tenantId, organizations]);

    // ─── Derived Stats ───
    const stats = useMemo(() => {
        const tasks = filterByPeriod(rawData.tasks, period);
        const now = new Date();

        // Card 1: Task Health
        const total = tasks.length;
        const done = tasks.filter((t: any) => t.status === "DONE").length;
        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
        const overdue = tasks.filter((t: any) => {
            if (!t.dueDate) return false;
            if (t.status === "DONE" || t.status === "ARCHIVED") return false;
            return new Date(t.dueDate) < now;
        }).length;

        // Card 2: Team Workload
        const profileMap = new Map<string, any>();
        (rawData.profiles || []).forEach((p: any) => {
            if (p.userId) profileMap.set(p.userId, p);
        });

        // Deduplicate members by userSub, exclude TENANT_ADMIN
        const memberMap = new Map<string, { userSub: string; name: string; role: string }>();
        (rawData.memberships || []).forEach((m: any) => {
            if (!m.userSub || m.status === "REMOVED") return;
            if (m.role === "TENANT_ADMIN") return;
            if (memberMap.has(m.userSub)) return;
            const profile = profileMap.get(m.userSub);
            const name = profile?.firstName && profile?.lastName
                ? `${profile.firstName} ${profile.lastName}`
                : displayName(profile?.email || m.userSub);
            memberMap.set(m.userSub, { userSub: m.userSub, name, role: m.role });
        });

        const openTasks = tasks.filter((t: any) => t.status === "TODO" || t.status === "IN_PROGRESS");
        const workloadMap = new Map<string, number>();
        openTasks.forEach((t: any) => {
            if (!t.assignedTo) return;
            workloadMap.set(t.assignedTo, (workloadMap.get(t.assignedTo) || 0) + 1);
        });

        const teamWorkload = Array.from(memberMap.values())
            .map(m => ({ name: m.name, tasks: workloadMap.get(m.userSub) || 0 }))
            .sort((a, b) => b.tasks - a.tasks);

        // Card 3: Overdue by Assignee
        const overdueTasks = tasks.filter((t: any) => {
            if (!t.dueDate) return false;
            if (t.status === "DONE" || t.status === "ARCHIVED") return false;
            return new Date(t.dueDate) < now;
        });

        const overdueByAssigneeMap = new Map<string, number>();
        overdueTasks.forEach((t: any) => {
            if (!t.assignedTo) return;
            overdueByAssigneeMap.set(t.assignedTo, (overdueByAssigneeMap.get(t.assignedTo) || 0) + 1);
        });
        const overdueByAssignee = Array.from(overdueByAssigneeMap.entries())
            .map(([userSub, count]) => {
                const member = memberMap.get(userSub);
                const name = member?.name || displayName(profileMap.get(userSub)?.email || userSub);
                return { name, overdue: count };
            })
            .sort((a, b) => b.overdue - a.overdue);

        // Card 4: Weekly Velocity
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const weekEnd = new Date();
        weekEnd.setHours(23, 59, 59, 999);
        const weeks: { label: string; created: number; completed: number }[] = [];
        for (let i = 3; i >= 0; i--) {
            const end = new Date(weekEnd.getTime() - i * weekMs);
            const start = new Date(end.getTime() - weekMs);
            const label = `W${4 - i}`;
            const created = rawData.tasks.filter((t: any) => {
                if (!t.createdAt) return false;
                const d = new Date(t.createdAt);
                return d >= start && d < end;
            }).length;
            const completed = rawData.tasks.filter((t: any) => {
                if (!t.completedAt) return false;
                const d = new Date(t.completedAt);
                return d >= start && d < end;
            }).length;
            weeks.push({ label, created, completed });
        }

        // Card 5: Org Breakdown
        const orgMap = new Map<string, { name: string; total: number; done: number }>();
        organizations.forEach((org: any) => {
            orgMap.set(org.id, { name: org.name || org.id, total: 0, done: 0 });
        });
        tasks.forEach((t: any) => {
            if (!t.organizationId || !orgMap.has(t.organizationId)) return;
            const entry = orgMap.get(t.organizationId)!;
            entry.total++;
            if (t.status === "DONE") entry.done++;
        });
        const orgBreakdown = Array.from(orgMap.values())
            .filter(o => o.total > 0)
            .map(o => ({
                name: o.name,
                rate: Math.round((o.done / o.total) * 100),
            }));

        return {
            total, done, completionRate, overdue,
            teamWorkload, overdueByAssignee, weeks, orgBreakdown,
        };
    }, [rawData, period, organizations]);

    // ─── Loading Skeleton ───
    if (loading) {
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
                    <div className="skel-row">
                        <div className="skel-wide shimmer" />
                        <div className="skel-wide shimmer" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dash">
            {/* HEADER */}
            <div className="dash-header reports-header">
                <div>
                    <h1 className="dash-title">
                        <BarChart3 size={24} />
                        Reports
                    </h1>
                    <p className="dash-sub">
                        Analytics across all organizations
                    </p>
                </div>
                <select
                    value={period}
                    onChange={e => setPeriod(e.target.value as Period)}
                    className="workspace-filter-select"
                >
                    <option value="all">All Time</option>
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                    <option value="90">Last 90 Days</option>
                </select>
            </div>

            {/* CARD 1: Task Health KPIs */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#e8f0fa", color: "#1e3a5f" }}>
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
                        <span className="kpi-label">Completion Rate</span>
                        <span className="kpi-value">
                            <CountUp end={stats.completionRate} duration={1} />%
                        </span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                        <CheckCircle2 size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Completed</span>
                        <span className="kpi-value">
                            <CountUp end={stats.done} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
                        <AlertTriangle size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Overdue</span>
                        <span className="kpi-value">
                            <CountUp end={stats.overdue} duration={0.8} />
                        </span>
                    </div>
                </div>
            </div>

            {/* CARD 2 + 3: Team Workload | Overdue Aging */}
            <div className="chart-row">
                <div className="dash-panel">
                    <h3 className="panel-title">Team Workload</h3>
                    {stats.teamWorkload.length > 0 ? (
                        <ResponsiveContainer width="100%" height={Math.max(220, stats.teamWorkload.length * 36)}>
                            <BarChart data={stats.teamWorkload} layout="vertical" barSize={18}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={120} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }} />
                                <Bar dataKey="tasks" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-chart">No data available</div>
                    )}
                </div>

                <div className="dash-panel">
                    <h3 className="panel-title">Overdue by Assignee</h3>
                    {stats.overdueByAssignee.length > 0 ? (
                        <ResponsiveContainer width="100%" height={Math.max(220, stats.overdueByAssignee.length * 36)}>
                            <BarChart data={stats.overdueByAssignee} layout="vertical" barSize={18}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={120} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }} />
                                <Bar dataKey="overdue" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-chart">No data available</div>
                    )}
                </div>
            </div>

            {/* CARD 4 + 5: Weekly Velocity | Org Breakdown */}
            <div className="chart-row">
                <div className="dash-panel">
                    <h3 className="panel-title">Weekly Velocity</h3>
                    {stats.weeks.some(w => w.created > 0 || w.completed > 0) ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={stats.weeks}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }} />
                                <Legend />
                                <Line type="monotone" dataKey="created" name="Created" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-chart">No data available</div>
                    )}
                </div>

                <div className="dash-panel">
                    <h3 className="panel-title">Org Completion Rate</h3>
                    {stats.orgBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={stats.orgBreakdown} barSize={36}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }} formatter={(value: unknown) => [`${value}%`, "Completion"]} />
                                <Bar dataKey="rate" fill="#10b981" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-chart">No data available</div>
                    )}
                </div>
            </div>
        </div>
    );
}
