import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dataClient } from "../../../libs/data-client";
import { displayName } from "../../../libs/displayName";
import { getUrl } from "aws-amplify/storage";
import {
    ArrowLeft, FlaskConical, Users, Kanban, Clock,
    Download, Calendar, FileText,
} from "lucide-react";
import CountUp from "react-countup";
import { useConfirm } from "../../../shared-components/confirm-context";

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

export default function PilotDetail() {
    const { tenantId } = useParams();
    const navigate = useNavigate();
    const client = dataClient();
    const { confirm } = useConfirm();

    const [tenant, setTenant] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingNotes, setEditingNotes] = useState(false);
    const [notesValue, setNotesValue] = useState("");

    const [showConvertModal, setShowConvertModal] = useState(false);
    const [convertPlan, setConvertPlan] = useState("PROFESSIONAL");

    useEffect(() => {
        if (tenantId) load();
    }, [tenantId]);

    async function load() {
        setLoading(true);
        try {
            const [t, mem, orgRes] = await Promise.all([
                client.models.Tenant.get({ id: tenantId! }),
                client.models.Membership.list({ filter: { tenantId: { eq: tenantId! } } }),
                client.models.Organization.list({ filter: { tenantId: { eq: tenantId! } } }),
            ]);

            setTenant(t.data);
            setOrgs(orgRes.data);
            setNotesValue(t.data?.pilotNotes || "");

            const enriched = await Promise.all(
                mem.data.map(async (m: any) => {
                    try {
                        const profile = await client.models.UserProfile.get({ userId: m.userSub });
                        return { ...m, _email: profile.data?.email || m.userSub };
                    } catch {
                        return { ...m, _email: m.userSub };
                    }
                })
            );
            setMembers(enriched);
        } catch (err) {
            console.error("PilotDetail load error:", err);
        }
        setLoading(false);
    }

    function getDaysRemaining(): number | null {
        if (!tenant?.pilotEndDate) return null;
        const diffMs = new Date(tenant.pilotEndDate).getTime() - Date.now();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    async function extendPilot(days: number) {
        if (!tenant?.pilotEndDate) return;
        const newEnd = new Date(tenant.pilotEndDate);
        newEnd.setDate(newEnd.getDate() + days);
        const newDuration = (tenant.pilotDurationDays || 30) + days;
        await client.models.Tenant.update({
            id: tenantId!,
            pilotEndDate: newEnd.toISOString(),
            pilotDurationDays: newDuration,
        });
        load();
    }

    async function completePilot() {
        if (!await confirm({
            title: "Complete Pilot",
            message: `Mark the pilot for ${tenant.companyName} as completed?`,
            confirmLabel: "Complete",
        })) return;

        await client.models.Tenant.update({
            id: tenantId!,
            pilotStatus: "COMPLETED",
        });
        load();
    }

    async function cancelPilot() {
        if (!await confirm({
            title: "Cancel Pilot",
            message: `Cancel the pilot for ${tenant.companyName}? This will mark it as cancelled.`,
            confirmLabel: "Cancel Pilot",
            variant: "danger",
        })) return;

        await client.models.Tenant.update({
            id: tenantId!,
            pilotStatus: "CANCELLED",
        });
        load();
    }

    async function convertToPaid(newPlan: string) {
        await client.models.Tenant.update({
            id: tenantId!,
            plan: newPlan,
            subscriptionStatus: "ACTIVE",
            pilotStatus: "COMPLETED",
        });
        setShowConvertModal(false);
        load();
    }

    async function saveNotes() {
        await client.models.Tenant.update({
            id: tenantId!,
            pilotNotes: notesValue,
        });
        setEditingNotes(false);
        load();
    }

    async function downloadAgreement() {
        if (!tenant?.pilotAgreementS3Key) return;
        try {
            const result = await getUrl({
                path: tenant.pilotAgreementS3Key,
            });
            window.open(result.url.toString(), "_blank");
        } catch (err) {
            console.error("Error getting agreement URL:", err);
        }
    }

    if (loading) {
        return (
            <div className="dash">
                <div className="dash-skeleton">
                    <div className="skel-row">
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

    if (!tenant) return <div><p>Pilot not found.</p></div>;

    const activeMembers = members.filter(m => m.status !== "REMOVED");
    const daysLeft = getDaysRemaining();
    const isExpired = daysLeft !== null && daysLeft <= 0;
    const statusBadge = getStatusBadge(tenant.pilotStatus);
    const isActive = tenant.pilotStatus === "ACTIVE";

    return (
        <div>
            {/* BACK */}
            <button
                className="btn secondary"
                onClick={() => navigate("/super/pilots")}
                style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
                <ArrowLeft size={16} /> Pilots
            </button>

            {/* HEADER */}
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <FlaskConical size={22} />
                        {tenant.companyName}
                        <span style={{
                            background: "#dbeafe",
                            color: "#1d4ed8",
                            fontSize: 12,
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontWeight: 600,
                        }}>
                            PILOT
                        </span>
                        <span style={{
                            background: statusBadge.bg,
                            color: statusBadge.color,
                            fontSize: 12,
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontWeight: 600,
                        }}>
                            {statusBadge.label}
                        </span>
                    </h1>
                    <p className="page-sub">
                        Created {new Date(tenant.createdAt).toLocaleDateString()}
                        {tenant.pilotContactEmail && ` — ${tenant.pilotContactEmail}`}
                    </p>
                </div>

                {isActive && (
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn secondary" onClick={() => setShowConvertModal(true)}>
                            Convert to Paid
                        </button>
                        <button className="btn secondary" onClick={completePilot}>
                            Complete Pilot
                        </button>
                        <button
                            className="btn"
                            style={{ backgroundColor: "#dc3545", borderColor: "#dc3545" }}
                            onClick={cancelPilot}
                        >
                            Cancel Pilot
                        </button>
                    </div>
                )}
            </div>

            {/* KPI CARDS */}
            <div className="kpi-grid">
                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{
                        background: isActive ? (isExpired ? "#fef2f2" : "#ecfdf5") : "#f1f5f9",
                        color: isActive ? (isExpired ? "#dc2626" : "#16a34a") : "#64748b",
                    }}>
                        <FlaskConical size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Pilot Status</span>
                        <span className="kpi-value" style={{ fontSize: 16 }}>
                            {statusBadge.label}
                        </span>
                    </div>
                </div>

                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{
                        background: isExpired ? "#fef2f2" : "#fef3c7",
                        color: isExpired ? "#dc2626" : "#d97706",
                    }}>
                        <Clock size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Days Remaining</span>
                        <span className="kpi-value">
                            {isActive
                                ? (isExpired ? "Expired" : <CountUp end={daysLeft || 0} duration={0.8} />)
                                : "—"
                            }
                        </span>
                    </div>
                </div>

                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#ecfdf5", color: "#10b981" }}>
                        <Users size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Members</span>
                        <span className="kpi-value">
                            <CountUp end={activeMembers.length} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#e8f0fa", color: "#1e3a5f" }}>
                        <Kanban size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Organizations</span>
                        <span className="kpi-value">
                            <CountUp end={orgs.length} duration={0.8} />
                        </span>
                    </div>
                </div>
            </div>

            {/* PILOT INFO */}
            {isActive && (() => {
                return (
                    <div style={{
                        marginTop: 20,
                        padding: "20px 24px",
                        background: isExpired ? "#fef2f2" : "#f0f9ff",
                        border: `1px solid ${isExpired ? "#fecaca" : "#bae6fd"}`,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: isExpired ? "#fee2e2" : "#dbeafe",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: isExpired ? "#dc2626" : "#1d4ed8",
                            }}>
                                <Calendar size={20} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 15, color: isExpired ? "#991b1b" : "#1e40af" }}>
                                    {isExpired
                                        ? "Pilot Expired"
                                        : `Pilot — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`
                                    }
                                </div>
                                <div style={{ fontSize: 13, color: isExpired ? "#b91c1c" : "#3b82f6", marginTop: 2 }}>
                                    {tenant.pilotStartDate && (
                                        <>Start: {new Date(tenant.pilotStartDate).toLocaleDateString()}</>
                                    )}
                                    {tenant.pilotEndDate && (
                                        <> &middot; End: {new Date(tenant.pilotEndDate).toLocaleDateString()}</>
                                    )}
                                    {tenant.pilotDurationDays && (
                                        <> &middot; Duration: {tenant.pilotDurationDays} days</>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn secondary" onClick={() => extendPilot(7)} style={{ fontSize: 13 }}>+7 days</button>
                            <button className="btn secondary" onClick={() => extendPilot(14)} style={{ fontSize: 13 }}>+14 days</button>
                            <button className="btn secondary" onClick={() => extendPilot(30)} style={{ fontSize: 13 }}>+30 days</button>
                        </div>
                    </div>
                );
            })()}

            {/* AGREEMENT SECTION */}
            {tenant.pilotAgreementS3Key && (
                <div style={{
                    marginTop: 20,
                    padding: "16px 20px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: "#e8f0fa", color: "#1e3a5f",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Pilot Agreement</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                                {tenant.pilotAgreementS3Key.split("/").pop()}
                            </div>
                        </div>
                    </div>
                    <button className="btn secondary" onClick={downloadAgreement} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Download size={14} /> Download PDF
                    </button>
                </div>
            )}

            {/* NOTES SECTIONS */}
            {(tenant.agreementNotes || tenant.pilotNotes || editingNotes) && (
                <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
                    {tenant.agreementNotes && (
                        <div style={{
                            flex: 1,
                            padding: "16px 20px",
                            background: "#fffbeb",
                            border: "1px solid #fde68a",
                            borderRadius: 10,
                        }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#92400e", marginBottom: 6 }}>Agreement Notes</div>
                            <div style={{ fontSize: 13, color: "#78350f", whiteSpace: "pre-wrap" }}>{tenant.agreementNotes}</div>
                        </div>
                    )}

                    <div style={{
                        flex: 1,
                        padding: "16px 20px",
                        background: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#475569" }}>Internal Notes</div>
                            {!editingNotes ? (
                                <button
                                    className="btn-table"
                                    onClick={() => setEditingNotes(true)}
                                    style={{ fontSize: 12 }}
                                >
                                    Edit
                                </button>
                            ) : (
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button className="btn-table" onClick={() => { setEditingNotes(false); setNotesValue(tenant.pilotNotes || ""); }}>Cancel</button>
                                    <button className="btn-table" onClick={saveNotes}>Save</button>
                                </div>
                            )}
                        </div>
                        {editingNotes ? (
                            <textarea
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                rows={4}
                                style={{
                                    width: "100%",
                                    padding: "8px 10px",
                                    borderRadius: 6,
                                    border: "1px solid #cbd5e1",
                                    fontSize: 13,
                                    fontFamily: "inherit",
                                    resize: "vertical",
                                }}
                            />
                        ) : (
                            <div style={{ fontSize: 13, color: "#64748b", whiteSpace: "pre-wrap" }}>
                                {tenant.pilotNotes || "No internal notes"}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MEMBERS TABLE */}
            <h2 style={{ marginTop: 32, marginBottom: 16 }}>Members</h2>
            <table className="table">
                <thead>
                    <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {members.map(m => {
                        const name = displayName(m._email);
                        const statusLabel = m.status === "REMOVED" ? "Inactive" : "Active";
                        const statusColor = m.status === "REMOVED" ? "#ef4444" : "#10b981";
                        return (
                            <tr key={m.id}>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div className="member-avatar">
                                            {name[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{name}</div>
                                            <div style={{ fontSize: 12, color: "#64748b" }}>{m._email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span
                                        className="role-badge"
                                        style={{
                                            background: m.role === "TENANT_ADMIN" ? "#fef3c7" : m.role === "OWNER" ? "#e8f0fa" : "#f1f5f9",
                                            color: m.role === "TENANT_ADMIN" ? "#d97706" : m.role === "OWNER" ? "#1e3a5f" : "#64748b",
                                        }}
                                    >
                                        {m.role}
                                    </span>
                                </td>
                                <td>
                                    <span style={{ fontSize: 12, fontWeight: 500, color: statusColor }}>
                                        {statusLabel}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* ORGANIZATIONS TABLE */}
            <h2 style={{ marginTop: 32, marginBottom: 16 }}>Organizations</h2>
            <table className="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Members</th>
                    </tr>
                </thead>
                <tbody>
                    {orgs.map(org => {
                        const orgMemberCount = members.filter(
                            m => m.organizationId === org.id && m.status !== "REMOVED"
                        ).length;
                        return (
                            <tr key={org.id}>
                                <td>{org.name}</td>
                                <td>{orgMemberCount}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* CONVERT TO PAID MODAL */}
            {showConvertModal && (
                <div className="modal-backdrop" onClick={() => setShowConvertModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Convert to Paid Plan</h2>
                            <div className="modal-sub">Choose a paid plan for {tenant.companyName}</div>
                        </div>

                        <div className="modal-form">
                            <div style={{ display: "flex", gap: 12 }}>
                                {[
                                    { id: "STARTER", name: "Starter", price: "Free", color: "#64748b" },
                                    { id: "PROFESSIONAL", name: "Professional", price: "$29/mo", color: "#1e3a5f" },
                                    { id: "ENTERPRISE", name: "Enterprise", price: "$99/mo", color: "#0ea5b8" },
                                ].map(p => {
                                    const isActive = convertPlan === p.id;
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => setConvertPlan(p.id)}
                                            style={{
                                                flex: 1,
                                                padding: "16px 14px",
                                                borderRadius: 10,
                                                border: isActive ? `2px solid ${p.color}` : "2px solid #e5e7eb",
                                                background: isActive ? `${p.color}08` : "#fff",
                                                cursor: "pointer",
                                                textAlign: "center",
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, fontSize: 14, color: isActive ? p.color : "#1e293b" }}>
                                                {p.name}
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>
                                                {p.price}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn secondary" onClick={() => setShowConvertModal(false)}>Cancel</button>
                            <button className="btn" onClick={() => convertToPaid(convertPlan)}>Convert Plan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
