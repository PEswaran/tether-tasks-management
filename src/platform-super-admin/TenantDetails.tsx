import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dataClient } from "../libs/data-client";
import { displayName } from "../libs/displayName";
import {
    ArrowLeft, Building2, Users, Kanban, CreditCard, ListTodo,
} from "lucide-react";
import CountUp from "react-countup";
import { useConfirm } from "../shared-components/confirm-context";

export default function TenantDetail() {
    const { tenantId } = useParams();
    const navigate = useNavigate();
    const client = dataClient();
    const { confirm } = useConfirm();

    const [tenant, setTenant] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [deleteBlocked, setDeleteBlocked] = useState("");

    const [showReplaceModal, setShowReplaceModal] = useState(false);
    const [replaceTarget, setReplaceTarget] = useState<any>(null);
    const [newAdminEmail, setNewAdminEmail] = useState("");
    const [replacing, setReplacing] = useState(false);
    const [replaceError, setReplaceError] = useState("");

    useEffect(() => {
        if (tenantId) load();
    }, [tenantId]);

    async function load() {
        setLoading(true);
        try {
            const [t, mem, ws, taskRes] = await Promise.all([
                client.models.Tenant.get({ id: tenantId! }),
                client.models.Membership.list({ filter: { tenantId: { eq: tenantId! } } }),
                client.models.Workspace.list({ filter: { tenantId: { eq: tenantId! } } }),
                client.models.Task.list({ filter: { tenantId: { eq: tenantId! } } }),
            ]);

            setTenant(t.data);
            setTasks(taskRes.data);
            setWorkspaces(ws.data);

            // enrich members with email
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
            console.error("TenantDetails load error:", err);
        }
        setLoading(false);
    }

    function handleDeleteClick() {
        setDeleteBlocked("");
        const activeNonAdmins = members.filter(
            (m) => m.role !== "TENANT_ADMIN" && m.status !== "REMOVED"
        );
        if (activeNonAdmins.length > 0) {
            setDeleteBlocked(
                `Cannot delete: ${activeNonAdmins.length} active non-admin member${activeNonAdmins.length > 1 ? "s" : ""} must be removed first.`
            );
            return;
        }
        setShowDeleteConfirm(true);
        setDeleteInput("");
        setDeleteError("");
    }

    async function handleDeleteConfirm() {
        if (deleteInput.trim() !== (tenant.companyName || "").trim()) {
            setDeleteError(`Name doesn't match. You typed "${deleteInput.trim()}", expected "${(tenant.companyName || "").trim()}".`);
            return;
        }

        setDeleting(true);
        setDeleteError("");

        try {
            const res = await client.mutations.removeTenantAndData({ tenantId: tenantId! });
            if (res.data?.success) {
                navigate("/super/tenants");
            } else {
                setDeleteError(res.data?.message || res.errors?.map((e: any) => e.message).join(", ") || "Delete failed.");
                setDeleting(false);
            }
        } catch (err: any) {
            setDeleteError(err.message || "Delete failed.");
            setDeleting(false);
        }
    }

    async function removeMember(member: any) {
        if (!await confirm({ title: "Remove Member", message: `Remove ${displayName(member._email)} from this company?`, confirmLabel: "Remove", variant: "danger" })) return;
        await client.models.Membership.update({
            id: member.id,
            status: "REMOVED",
        });
        load();
    }

    async function reactivateMember(member: any) {
        if (!await confirm({ title: "Re-activate Member", message: `Re-activate ${displayName(member._email)}?`, confirmLabel: "Re-activate" })) return;
        await client.models.Membership.update({
            id: member.id,
            status: "ACTIVE",
        });
        load();
    }

    async function toggleSuspend() {
        const isSuspended = tenant.status === "SUSPENDED";
        const action = isSuspended ? "reactivate" : "suspend";
        if (!await confirm({ title: isSuspended ? "Reactivate Company" : "Suspend Company", message: `Are you sure you want to ${action} ${tenant.companyName}?`, confirmLabel: isSuspended ? "Reactivate" : "Suspend", variant: isSuspended ? "info" : "warning" })) return;

        await client.models.Tenant.update({
            id: tenantId!,
            status: isSuspended ? "ACTIVE" : "SUSPENDED",
            isActive: isSuspended,
        });
        load();
    }

    function openReplaceModal(member: any) {
        setReplaceTarget(member);
        setNewAdminEmail("");
        setReplaceError("");
        setShowReplaceModal(true);
    }

    async function handleReplaceAdmin() {
        if (!newAdminEmail.trim()) {
            setReplaceError("Please enter the new admin's email.");
            return;
        }
        setReplacing(true);
        setReplaceError("");
        try {
            const res = await client.mutations.replaceTenantAdmin({
                tenantId: tenantId!,
                newAdminEmail: newAdminEmail.trim(),
                oldMembershipId: replaceTarget.id,
            });
            if (res.data?.success) {
                setShowReplaceModal(false);
                load();
            } else {
                setReplaceError(
                    res.data?.message ||
                    res.errors?.map((e: any) => e.message).join(", ") ||
                    "Replace failed."
                );
            }
        } catch (err: any) {
            setReplaceError(err.message || "Replace failed.");
        }
        setReplacing(false);
    }

    function getPlanLabel(plan: string | null | undefined) {
        switch (plan) {
            case "PROFESSIONAL": return "Professional";
            case "ENTERPRISE": return "Enterprise";
            default: return "Starter";
        }
    }

    function getPlanColor(plan: string | null | undefined) {
        switch (plan) {
            case "PROFESSIONAL": return { bg: "#eff6ff", color: "#3b82f6" };
            case "ENTERPRISE": return { bg: "#f5f3ff", color: "#7c3aed" };
            default: return { bg: "#f1f5f9", color: "#64748b" };
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

    if (!tenant) return <div><p>Company not found.</p></div>;

    const activeMembers = members.filter(m => m.status !== "REMOVED");
    const planStyle = getPlanColor(tenant.plan);

    return (
        <div>

            {/* BACK BUTTON */}
            <button
                className="btn secondary"
                onClick={() => navigate("/super/tenants")}
                style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
                <ArrowLeft size={16} /> Companies
            </button>

            {/* COMPANY HEADER */}
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Building2 size={22} />
                        {tenant.companyName}
                        <span
                            className="role-badge"
                            style={{
                                background: planStyle.bg,
                                color: planStyle.color,
                                fontSize: 12,
                                padding: "3px 10px",
                                borderRadius: 20,
                                fontWeight: 600,
                            }}
                        >
                            {getPlanLabel(tenant.plan)}
                        </span>
                        <span
                            className="role-badge"
                            style={{
                                background: tenant.status === "SUSPENDED" ? "#fef2f2" : "#ecfdf5",
                                color: tenant.status === "SUSPENDED" ? "#dc2626" : "#16a34a",
                                fontSize: 12,
                                padding: "3px 10px",
                                borderRadius: 20,
                                fontWeight: 600,
                            }}
                        >
                            {tenant.status === "SUSPENDED" ? "Suspended" : "Active"}
                        </span>
                    </h1>
                    <p className="page-sub">
                        Created {new Date(tenant.createdAt).toLocaleDateString()}
                    </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn secondary" onClick={toggleSuspend}>
                        {tenant.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                    </button>
                    <button
                        className="btn"
                        style={{ backgroundColor: "#dc3545", borderColor: "#dc3545" }}
                        onClick={handleDeleteClick}
                    >
                        Delete Company
                    </button>
                </div>
            </div>

            {/* DELETE BLOCKED BANNER */}
            {deleteBlocked && (
                <div style={{
                    padding: "12px 16px",
                    marginBottom: 20,
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    color: "#991b1b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <span>{deleteBlocked}</span>
                    <button
                        onClick={() => setDeleteBlocked("")}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#991b1b",
                            cursor: "pointer",
                            fontSize: 18,
                            padding: "0 4px",
                        }}
                    >
                        &times;
                    </button>
                </div>
            )}

            {/* SUBSCRIPTION + KPI ROW */}
            <div className="kpi-grid">

                {/* SUBSCRIPTION CARD */}
                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                        <CreditCard size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Plan</span>
                        <span className="kpi-value" style={{ fontSize: 18 }}>
                            {getPlanLabel(tenant.plan)}
                        </span>
                    </div>
                </div>

                {/* MEMBERS */}
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

                {/* WORKSPACES */}
                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                        <Kanban size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Workspaces</span>
                        <span className="kpi-value">
                            <CountUp end={workspaces.length} duration={0.8} />
                        </span>
                    </div>
                </div>

                {/* TASKS */}
                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                        <ListTodo size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Tasks</span>
                        <span className="kpi-value">
                            <CountUp end={tasks.length} duration={0.8} />
                        </span>
                    </div>
                </div>

            </div>

            {/* MEMBERS TABLE */}
            <h2 style={{ marginTop: 32, marginBottom: 16 }}>Members</h2>
            <table className="table">
                <thead>
                    <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th></th>
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
                                            background: m.role === "TENANT_ADMIN" ? "#fef3c7" : m.role === "OWNER" ? "#eff6ff" : "#f1f5f9",
                                            color: m.role === "TENANT_ADMIN" ? "#d97706" : m.role === "OWNER" ? "#3b82f6" : "#64748b",
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
                                <td style={{ textAlign: "right" }}>
                                    {m.role === "TENANT_ADMIN" ? (
                                        m.status !== "REMOVED" && (
                                            <button
                                                className="btn-table"
                                                onClick={() => openReplaceModal(m)}
                                            >
                                                Replace
                                            </button>
                                        )
                                    ) : m.status === "REMOVED" ? (
                                        <button
                                            className="btn-table"
                                            onClick={() => reactivateMember(m)}
                                        >
                                            Re-activate
                                        </button>
                                    ) : (
                                        <button
                                            className="btn-table danger"
                                            onClick={() => removeMember(m)}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* WORKSPACES TABLE */}
            <h2 style={{ marginTop: 32, marginBottom: 16 }}>Workspaces</h2>
            <table className="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Members</th>
                    </tr>
                </thead>
                <tbody>
                    {workspaces.map(ws => {
                        const wsMemberCount = members.filter(
                            m => m.workspaceId === ws.id && m.status !== "REMOVED"
                        ).length;
                        return (
                            <tr key={ws.id}>
                                <td>{ws.name}</td>
                                <td>{wsMemberCount}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* REPLACE ADMIN MODAL */}
            {showReplaceModal && replaceTarget && (
                <div className="modal-backdrop" onClick={() => !replacing && setShowReplaceModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>

                        <div className="modal-header">
                            <h2>Replace Tenant Admin</h2>
                            <div className="modal-sub">
                                The current admin will be disabled and removed
                            </div>
                        </div>

                        <div className="modal-form">
                            <p>
                                Replacing <strong>{displayName(replaceTarget._email)}</strong>{" "}
                                ({replaceTarget._email}) as tenant admin
                                for <strong>{tenant.companyName}</strong>.
                            </p>
                            <p style={{ fontSize: 13, color: "#64748b" }}>
                                The old admin's Cognito account will be disabled and their
                                membership marked as removed. The new admin will receive a
                                temporary password via email.
                            </p>
                            <label>New admin email:</label>
                            <input
                                type="email"
                                value={newAdminEmail}
                                onChange={(e) => setNewAdminEmail(e.target.value)}
                                placeholder="newadmin@company.com"
                                disabled={replacing}
                            />
                            {replaceError && (
                                <p style={{ color: "#dc3545", fontSize: 13, marginTop: 8 }}>{replaceError}</p>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn secondary"
                                onClick={() => setShowReplaceModal(false)}
                                disabled={replacing}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn"
                                onClick={handleReplaceAdmin}
                                disabled={!newAdminEmail.trim() || replacing}
                            >
                                {replacing ? "Replacing..." : "Replace Admin"}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {showDeleteConfirm && (
                <div className="modal-backdrop" onClick={() => !deleting && setShowDeleteConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>

                        <div className="modal-header">
                            <h2>Delete Company</h2>
                            <div className="modal-sub">This action cannot be undone</div>
                        </div>

                        <div className="modal-form">
                            <p>
                                This will permanently delete <strong>{tenant.companyName}</strong> and
                                all associated data including members, tasks, workspaces, and the
                                tenant admin's Cognito account.
                            </p>
                            <label>
                                Type <strong>{tenant.companyName}</strong> to confirm:
                            </label>
                            <input
                                type="text"
                                value={deleteInput}
                                onChange={(e) => setDeleteInput(e.target.value)}
                                placeholder={tenant.companyName}
                                disabled={deleting}
                            />
                            {deleteError && (
                                <p style={{ color: "#dc3545", fontSize: 13, marginTop: 8 }}>{deleteError}</p>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn secondary"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn"
                                style={{ backgroundColor: "#dc3545", borderColor: "#dc3545" }}
                                onClick={handleDeleteConfirm}
                                disabled={deleteInput.trim() !== (tenant.companyName || "").trim() || deleting}
                            >
                                {deleting ? "Deleting..." : "Delete Permanently"}
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
