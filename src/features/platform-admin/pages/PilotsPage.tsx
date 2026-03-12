import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { dataClient } from "../../../libs/data-client";
import CountUp from "react-countup";
import CreatePilotModal from "../../../components/shared/modals/create-pilot-modal";

function getStatusBadge(status: string | null | undefined) {
    switch (status) {
        case "ACTIVE":
            return { bg: "#ecfdf5", color: "#16a34a", label: "Active" };
        case "COMPLETED":
            return { bg: "#f1f5f9", color: "#64748b", label: "Completed" };
        case "CANCELLED":
            return { bg: "#fef2f2", color: "#dc2626", label: "Cancelled" };
        default:
            return { bg: "#f1f5f9", color: "#64748b", label: status || "—" };
    }
}

function getDaysRemaining(endDate: string | null | undefined): string {
    if (!endDate) return "—";
    const now = new Date();
    const end = new Date(endDate);
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Expired";
    return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
}

export default function PilotsPage() {
    const client = dataClient();
    const navigate = useNavigate();

    const [pilots, setPilots] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        const res = await client.models.Tenant.list();
        const pilotTenants = res.data.filter((t: any) => t.plan === "PILOT");
        setPilots(pilotTenants);
        setLoading(false);
    }

    const active = pilots.filter(p => p.pilotStatus === "ACTIVE").length;
    const completed = pilots.filter(p => p.pilotStatus === "COMPLETED").length;
    const cancelled = pilots.filter(p => p.pilotStatus === "CANCELLED").length;

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
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FlaskConical size={22} />
                        Pilot Programs
                    </h1>
                    <p className="page-sub">
                        {pilots.length} pilot{pilots.length !== 1 ? "s" : ""} on the platform
                    </p>
                </div>
                <button className="btn" onClick={() => setShowCreate(true)}>
                    + Create Pilot
                </button>
            </div>

            {showCreate && (
                <CreatePilotModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        load();
                    }}
                />
            )}

            {/* KPI CARDS */}
            <div className="kpi-grid" style={{ marginBottom: 24 }}>
                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#e8f0fa", color: "#1e3a5f" }}>
                        <FlaskConical size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Total Pilots</span>
                        <span className="kpi-value">
                            <CountUp end={pilots.length} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#ecfdf5", color: "#16a34a" }}>
                        <FlaskConical size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Active</span>
                        <span className="kpi-value">
                            <CountUp end={active} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#f1f5f9", color: "#64748b" }}>
                        <FlaskConical size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Completed</span>
                        <span className="kpi-value">
                            <CountUp end={completed} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
                        <FlaskConical size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Cancelled</span>
                        <span className="kpi-value">
                            <CountUp end={cancelled} duration={0.8} />
                        </span>
                    </div>
                </div>
            </div>

            {/* TABLE */}
            {pilots.length === 0 ? (
                <div style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: "#94a3b8",
                }}>
                    <FlaskConical size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <div style={{ fontSize: 16, fontWeight: 500 }}>No pilots yet</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Create your first pilot program to get started</div>
                </div>
            ) : (
                <table className="table">
                    <thead>
                        <tr>
                            <th>Company</th>
                            <th>Admin</th>
                            <th>Status</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Days Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pilots.map(p => {
                            const badge = getStatusBadge(p.pilotStatus);
                            const daysLeft = getDaysRemaining(p.pilotEndDate);
                            const isExpired = daysLeft === "Expired";
                            return (
                                <tr
                                    key={p.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => navigate(`/super/pilot/${p.id}`)}
                                >
                                    <td style={{ fontWeight: 500 }}>{p.companyName}</td>
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: 500, fontSize: 13 }}>{p.pilotContactName || p.adminName || "—"}</div>
                                            <div style={{ fontSize: 12, color: "#64748b" }}>{p.pilotContactEmail || "—"}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            background: badge.bg,
                                            color: badge.color,
                                            fontSize: 12,
                                            padding: "3px 10px",
                                            borderRadius: 20,
                                            fontWeight: 600,
                                        }}>
                                            {badge.label}
                                        </span>
                                    </td>
                                    <td style={{ color: "#64748b" }}>
                                        {p.pilotStartDate ? new Date(p.pilotStartDate).toLocaleDateString() : "—"}
                                    </td>
                                    <td style={{ color: "#64748b" }}>
                                        {p.pilotEndDate ? new Date(p.pilotEndDate).toLocaleDateString() : "—"}
                                    </td>
                                    <td>
                                        <span style={{
                                            fontSize: 13,
                                            fontWeight: 500,
                                            color: isExpired ? "#dc2626"
                                                : p.pilotStatus === "COMPLETED" ? "#64748b"
                                                : p.pilotStatus === "CANCELLED" ? "#64748b"
                                                : "#16a34a",
                                        }}>
                                            {p.pilotStatus === "ACTIVE" ? daysLeft : "—"}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
