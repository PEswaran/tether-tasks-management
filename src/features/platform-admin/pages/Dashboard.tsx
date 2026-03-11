import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dataClient } from "../../../libs/data-client";
import CountUp from "react-countup";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
    LayoutDashboard, Users, ArrowUpRight, Building2, FlaskConical,
    Briefcase, LayoutGrid, Kanban,
} from "lucide-react";

type Stats = {
    tenants: number;
    activePilots: number;
    users: number;
    organizations: number;
    workspaces: number;
    taskBoards: number;
    planBreakdown: { name: string; value: number }[];
};

const PLAN_COLORS: Record<string, string> = {
    STARTER: "#94a3b8",
    PROFESSIONAL: "#1d4ed8",
    ENTERPRISE: "#7c3aed",
    PILOT: "#0ea5e9",
    TRIAL: "#f59e0b",
    OTHER: "#64748b",
};

const PLAN_ORDER = ["STARTER", "PROFESSIONAL", "ENTERPRISE", "PILOT", "TRIAL", "OTHER"];

export default function Dashboard() {
    const client = dataClient();
    const navigate = useNavigate();

    const [stats, setStats] = useState<Stats>({
        tenants: 0, activePilots: 0, users: 0,
        organizations: 0, workspaces: 0, taskBoards: 0,
        planBreakdown: [],
    });
    const [recentTenants, setRecentTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try {
            const [tenantRes, memberRes, orgRes, wsRes, boardRes] = await Promise.all([
                client.models.Tenant.list(),
                client.models.Membership.list(),
                client.models.Organization.list(),
                client.models.Workspace.list(),
                client.models.TaskBoard.list(),
            ]);

            const tenants = tenantRes.data;

            const activePilots = tenants.filter(
                (t: any) => t.plan === "PILOT" && t.pilotStatus === "ACTIVE"
            ).length;

            // Build plan breakdown
            const planCounts: Record<string, number> = {};
            for (const t of tenants) {
                const plan = (t as any).plan || "OTHER";
                const key = PLAN_ORDER.includes(plan) ? plan : "OTHER";
                planCounts[key] = (planCounts[key] || 0) + 1;
            }
            const planBreakdown = PLAN_ORDER
                .filter(p => planCounts[p])
                .map(p => ({ name: p, value: planCounts[p] }));

            setStats({
                tenants: tenants.length,
                activePilots,
                users: memberRes.data.length,
                organizations: orgRes.data.length,
                workspaces: wsRes.data.length,
                taskBoards: boardRes.data.length,
                planBreakdown,
            });

            const sorted = [...tenants].sort(
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

                <div className="kpi-card" onClick={() => navigate("/super/pilots")}>
                    <div className="kpi-icon" style={{ background: "#dbeafe", color: "#1d4ed8" }}>
                        <FlaskConical size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Active Pilots</span>
                        <span className="kpi-value">
                            <CountUp end={stats.activePilots} duration={0.8} />
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
                    <div className="kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
                        <Briefcase size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Organizations</span>
                        <span className="kpi-value">
                            <CountUp end={stats.organizations} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#e8f0fa", color: "#1e3a5f" }}>
                        <LayoutGrid size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Workspaces</span>
                        <span className="kpi-value">
                            <CountUp end={stats.workspaces} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                        <Kanban size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Task Boards</span>
                        <span className="kpi-value">
                            <CountUp end={stats.taskBoards} duration={0.8} />
                        </span>
                    </div>
                </div>

            </div>

            {/* CHARTS ROW */}
            <div className="chart-row">

                {/* COMPANIES BY PLAN */}
                <div className="dash-panel">
                    <h3 className="panel-title">Companies by Plan</h3>
                    {stats.planBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={stats.planBreakdown}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={85}
                                    paddingAngle={3}
                                    label={({ name, value }) => `${name} (${value})`}
                                >
                                    {stats.planBreakdown.map((d) => (
                                        <Cell key={d.name} fill={PLAN_COLORS[d.name] || PLAN_COLORS.OTHER} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}
                                />
                                <Legend
                                    formatter={(value: string) => (
                                        <span style={{ fontSize: 12, color: "#475569" }}>{value}</span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-chart">No companies yet</div>
                    )}
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
                                            {t.plan || "—"} &middot; {new Date(t.createdAt).toLocaleDateString()}
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
