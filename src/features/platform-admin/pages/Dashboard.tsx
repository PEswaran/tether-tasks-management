import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dataClient } from "../../../libs/data-client";
import CountUp from "react-countup";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
    LayoutDashboard, Users, CheckCircle2, ListTodo,
    Clock, TrendingUp, Kanban, ArrowUpRight, Building2,
} from "lucide-react";

type Stats = {
    tenants: number;
    users: number;
    todo: number;
    inProgress: number;
    done: number;
    total: number;
};

export default function Dashboard() {
    const client = dataClient();
    const navigate = useNavigate();

    const [stats, setStats] = useState<Stats>({
        tenants: 0, users: 0, todo: 0,
        inProgress: 0, done: 0, total: 0,
    });
    const [recentTenants, setRecentTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try {
            const [tenantRes, memberRes, taskRes] = await Promise.all([
                client.models.Tenant.list(),
                client.models.Membership.list(),
                client.models.Task.list(),
            ]);

            const tasks = taskRes.data;

            setStats({
                tenants: tenantRes.data.length,
                users: memberRes.data.length,
                todo: tasks.filter(t => t.status === "TODO").length,
                inProgress: tasks.filter(t => t.status === "IN_PROGRESS").length,
                done: tasks.filter(t => t.status === "DONE").length,
                total: tasks.length,
            });

            const sorted = [...tenantRes.data].sort(
                (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
            );
            setRecentTenants(sorted.slice(0, 5));
        } catch (err) {
            console.error("Dashboard load error:", err);
        }
        setLoading(false);
    }

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

            {/* HEADER */}
            <div className="dash-header">
                <div>
                    <h1 className="dash-title">
                        <LayoutDashboard size={24} />
                        Platform Overview
                    </h1>
                    <p className="dash-sub">
                        Manage {stats.tenants} compan{stats.tenants !== 1 ? "ies" : "y"} across the platform
                    </p>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="kpi-grid">

                <div className="kpi-card" onClick={() => navigate("/super/tenants")}>
                    <div className="kpi-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                        <Building2 size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Companies</span>
                        <span className="kpi-value">
                            <CountUp end={stats.tenants} duration={0.8} />
                        </span>
                    </div>
                    <ArrowUpRight size={16} className="kpi-arrow" />
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#ecfdf5", color: "#10b981" }}>
                        <Users size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Total Users</span>
                        <span className="kpi-value">
                            <CountUp end={stats.users} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                        <ListTodo size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Active Tasks</span>
                        <span className="kpi-value">
                            <CountUp end={stats.todo + stats.inProgress} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                        <Kanban size={20} />
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

                {/* RECENT COMPANIES */}
                <div className="dash-panel">
                    <h3 className="panel-title">Recent Companies</h3>
                    {recentTenants.length === 0 ? (
                        <div className="empty-chart">No companies yet</div>
                    ) : (
                        <div className="member-list">
                            {recentTenants.map((t: any) => (
                                <div
                                    key={t.id}
                                    className="member-row"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => navigate(`/super/tenant/${t.id}`)}
                                >
                                    <div className="member-avatar">
                                        {(t.companyName || "?")[0].toUpperCase()}
                                    </div>
                                    <div className="member-info">
                                        <span className="member-id">{t.companyName}</span>
                                        <span style={{ fontSize: 12, color: "#64748b" }}>
                                            {new Date(t.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
