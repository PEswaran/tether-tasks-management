import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dataClient } from "../libs/data-client";

export default function TenantDetail() {
    const { tenantId } = useParams();
    const navigate = useNavigate();
    const client = dataClient();

    const [tenant, setTenant] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [orgs, setOrgs] = useState<any[]>([]);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [deleteBlocked, setDeleteBlocked] = useState("");

    useEffect(() => {
        if (tenantId) load();
    }, [tenantId]);

    async function load() {
        // 🔵 tenant info
        const t = await client.models.Tenant.get({ id: tenantId! });
        setTenant(t.data);

        // 🔵 members (enriched with email from UserProfile)
        const mem = await client.models.Membership.list({
            filter: { tenantId: { eq: tenantId! } }
        });
        const enriched = await Promise.all(
            mem.data.map(async (m: any) => {
                try {
                    const profile = await client.models.UserProfile.get({ userId: m.userId });
                    return { ...m, _email: profile.data?.email || m.userId };
                } catch {
                    return { ...m, _email: m.userId };
                }
            })
        );
        setMembers(enriched);

        // 🔵 orgs
        const org = await client.models.Workspace.list({
            filter: { tenantId: { eq: tenantId! } }
        });
        setOrgs(org.data);
    }

    function handleDeleteClick() {
        setDeleteBlocked("");
        // Client-side guard: check for active non-admin members
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
        const trimmedInput = deleteInput.trim();
        const trimmedName = (tenant.companyName || "").trim();
        console.log("Confirm check:", JSON.stringify(trimmedInput), "vs", JSON.stringify(trimmedName));

        if (trimmedInput !== trimmedName) {
            setDeleteError(`Name doesn't match. You typed "${trimmedInput}", expected "${trimmedName}".`);
            return;
        }

        setDeleting(true);
        setDeleteError("");

        try {
            console.log("Calling removeTenantAndData with tenantId:", tenantId);
            const res = await client.mutations.removeTenantAndData({ tenantId: tenantId! });
            console.log("removeTenantAndData response:", res);
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

    if (!tenant) return <div style={{ padding: 40 }}>Loading...</div>;

    return (
        <div style={{ padding: 40 }}>
            <h1>{tenant.companyName}</h1>

            {/* 🔵 tenant controls */}
            <div style={{ marginBottom: 30 }}>
                <button className="btn">Suspend Tenant</button>
                <button className="btn secondary" style={{ marginLeft: 10 }}>
                    Impersonate Admin
                </button>
                <button
                    className="btn"
                    style={{ marginLeft: 10, backgroundColor: "#dc3545", borderColor: "#dc3545" }}
                    onClick={handleDeleteClick}
                >
                    Delete Company
                </button>
            </div>

            {/* 🔴 delete blocked banner */}
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

            {/* 🔴 delete confirmation */}
            {showDeleteConfirm && (
                <div className="modal-backdrop" onClick={() => !deleting && setShowDeleteConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete Company</h3>
                        <p>
                            This will permanently delete <strong>{tenant.companyName}</strong> and
                            all associated data including members, tasks, organizations, and the
                            tenant admin's Cognito account.
                        </p>
                        <p>
                            Type <strong>{tenant.companyName}</strong> to confirm:
                        </p>
                        <input
                            type="text"
                            value={deleteInput}
                            onChange={(e) => setDeleteInput(e.target.value)}
                            placeholder={tenant.companyName}
                            style={{ width: "100%", padding: 8, marginBottom: 12 }}
                            disabled={deleting}
                        />
                        {deleteError && (
                            <p style={{ color: "#dc3545", marginBottom: 12 }}>{deleteError}</p>
                        )}
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
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

            {/* 🔵 stats */}
            <div className="card-grid">
                <div className="card">
                    <h3>Members</h3>
                    <div className="big">{members.length}</div>
                </div>

                <div className="card">
                    <h3>Organizations</h3>
                    <div className="big">{orgs.length}</div>
                </div>
            </div>

            {/* 🔵 members table */}
            <h2 style={{ marginTop: 40 }}>Members</h2>
            <table className="table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {members.map(m => (
                        <tr key={m.id}>
                            <td>{m._email}</td>
                            <td>{m.role}</td>
                            <td>{m.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* 🔵 orgs */}
            <h2 style={{ marginTop: 40 }}>Organizations</h2>
            <table className="table">
                <thead>
                    <tr>
                        <th>Name</th>
                    </tr>
                </thead>
                <tbody>
                    {orgs.map(o => (
                        <tr key={o.id}>
                            <td>{o.name}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
