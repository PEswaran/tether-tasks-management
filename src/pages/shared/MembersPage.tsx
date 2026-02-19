import { useEffect, useState } from "react";
import { dataClient } from "../../libs/data-client";
import { useWorkspace } from "../../shared-components/workspace-context";
import { useUserRole } from "../../hooks/useUserRole";
import InviteMemberModal from "./modals/invite-members-modal";
import { displayName } from "../../libs/displayName";
import { Search } from "lucide-react";
import { useConfirm } from "../../shared-components/confirm-context";

export default function MembersPage() {
    const client = dataClient();
    const { workspaceId: contextWorkspaceId, tenantId, tenantName } = useWorkspace();
    const { getRole } = useUserRole();

    const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [search, setSearch] = useState("");
    const { confirm, alert } = useConfirm();

    // The active workspace for this page — local state, not global context
    const activeWsId = selectedWsId || contextWorkspaceId;

    // Sync from context on tenant switch
    useEffect(() => {
        setSelectedWsId(null);
    }, [tenantId]);

    useEffect(() => {
        loadWorkspaces();
    }, [tenantId]);

    useEffect(() => {
        loadMembers();
    }, [activeWsId, tenantId]);

    async function loadWorkspaces() {
        const r = await getRole();
        setRole(r);

        if (tenantId) {
            const wsRes = await client.models.Workspace.list({
                filter: { tenantId: { eq: tenantId } }
            });
            setWorkspaces(wsRes.data);
        }
    }

    async function loadMembers() {
        setLoading(true);

        if (!activeWsId) {
            setMembers([]);
            setInvites([]);
            setLoading(false);
            return;
        }

        /* MEMBERS */
        const memRes = await client.models.Membership.list({
            filter: { workspaceId: { eq: activeWsId } }
        });
        setMembers(memRes.data);

        /* INVITES */
        const invRes = await client.models.Invitation.list({
            filter: { workspaceId: { eq: activeWsId } }
        });
        setInvites(invRes.data);

        /* PROFILES */
        const profRes = await client.models.UserProfile.list();
        setProfiles(profRes.data);

        setLoading(false);
    }

    function profileFor(userSub: string) {
        return profiles.find((p: any) => p.userId === userSub);
    }

    /* ============================= ACTIONS ============================= */

    async function removeMember(member: any) {
        if (!await confirm({ title: "Remove Member", message: "Remove this member from workspace?", confirmLabel: "Remove", variant: "danger" })) return;

        await client.models.Membership.update({
            id: member.id,
            status: "REMOVED"
        });

        loadMembers();
    }

    async function revokeInvite(inv: any) {
        await client.models.Invitation.update({
            id: inv.id,
            status: "REVOKED"
        });

        loadMembers();
    }

    async function resendInvite(inv: any) {
        await client.models.Invitation.update({
            id: inv.id,
            sentAt: new Date().toISOString()
        });

        try {
            const profRes = await client.models.UserProfile.list({
                filter: { email: { eq: inv.email } }
            });
            const userSub = profRes.data?.[0]?.userId;
            if (userSub) {
                await client.mutations.sendAssignmentEmail({
                    userSub,
                    type: "INVITE",
                    itemName: "Workspace",
                    workspaceId: inv.workspaceId,
                });
            }
        } catch (emailErr) {
            console.warn("Resend email failed (non-critical):", emailErr);
        }

        await alert({ title: "Success", message: "Invitation resent", variant: "success" });
    }

    async function changeRole(member: any, newRole: string) {
        if (newRole === "OWNER") {
            const hasOwner = members.some(
                (m: any) => m.id !== member.id && m.role === "OWNER" && m.status === "ACTIVE"
            );
            if (hasOwner) {
                await alert({ title: "Owner Exists", message: "This workspace already has an owner. Remove the current owner first.", variant: "warning" });
                return;
            }
        }

        await client.models.Membership.update({
            id: member.id,
            role: newRole as any,
        });

        loadMembers();
    }

    function formatDate(iso: string | null | undefined) {
        if (!iso) return "—";
        return new Date(iso).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric"
        });
    }

    /* ============================= FILTERED DATA ============================= */

    const q = search.toLowerCase();
    const filteredMembers = members
        .filter((m: any) => m.status !== "REMOVED")
        .filter((m: any) => {
            if (!q) return true;
            const prof = profileFor(m.userSub);
            const email = (prof?.email || "").toLowerCase();
            const name = displayName(prof?.email).toLowerCase();
            return email.includes(q) || name.includes(q);
        });

    const filteredInvites = invites
        .filter((i: any) => {
            if (i.status !== "PENDING") return false;
            const activeEmails = members
                .filter((m: any) => m.status !== "REMOVED")
                .map((m: any) => profileFor(m.userSub)?.email?.toLowerCase())
                .filter(Boolean);
            return !activeEmails.includes(i.email?.toLowerCase());
        })
        .filter((i: any) => {
            if (!q) return true;
            return (i.email || "").toLowerCase().includes(q);
        });

    /* ============================= */

    if (loading) return <div className="page"><h2>Loading members...</h2></div>;

    const canManage = role === "TENANT_ADMIN" || role === "OWNER";
    const canRemove = role === "TENANT_ADMIN";

    return (
        <div className="page">

            {/* HEADER */}
            <div className="page-header">
                <div>
                    <h1>Members</h1>
                    <div className="page-sub">Workspace users & permissions</div>
                </div>

                {/* WORKSPACE SELECTOR */}
                <select
                    className="workspace-select"
                    value={activeWsId || ""}
                    onChange={(e) => setSelectedWsId(e.target.value || null)}
                >
                    <option value="">Select workspace</option>
                    {workspaces.map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>

                {/* INVITE */}
                {canManage && activeWsId && (
                    <button className="btn-primary" onClick={() => setShowInvite(true)}>
                        + Invite Member
                    </button>
                )}
            </div>

            {/* SEARCH BAR */}
            {activeWsId && (
                <div style={{ position: "relative", marginBottom: 16, maxWidth: 320 }}>
                    <Search size={16} style={{ position: "absolute", left: 12, top: 10, color: "#94a3b8" }} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "8px 12px 8px 36px",
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            fontSize: 14,
                            outline: "none",
                            background: "#fff",
                        }}
                    />
                </div>
            )}

            {/* ACTIVE MEMBERS TABLE */}
            <div className="card">
                <table className="tt-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Joined</th>
                            {canManage && <th></th>}
                        </tr>
                    </thead>

                    <tbody>
                        {filteredMembers.map((m: any) => {
                            const prof = profileFor(m.userSub);
                            const canChangeRole = canRemove && m.role !== "TENANT_ADMIN";

                            return (
                                <tr key={m.id}>
                                    <td className="user-cell">
                                        <div className="avatar-sm">
                                            {displayName(prof?.email || "U")[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="user-name">
                                                {displayName(prof?.email || m.userSub)}
                                            </div>
                                            <div className="user-sub">
                                                <span className="badge green">Active</span>
                                            </div>
                                        </div>
                                    </td>

                                    <td style={{ color: "#64748b", fontSize: 13 }}>
                                        {prof?.email || "\u2014"}
                                    </td>

                                    <td>
                                        {canChangeRole ? (
                                            <select
                                                value={m.role}
                                                onChange={(e) => changeRole(m, e.target.value)}
                                                style={{
                                                    padding: "3px 8px",
                                                    borderRadius: 6,
                                                    border: "1px solid #e2e8f0",
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    background: "#f8fafc",
                                                }}
                                            >
                                                <option value="MEMBER">MEMBER</option>
                                                <option value="OWNER">OWNER</option>
                                            </select>
                                        ) : (
                                            <span className={`role-badge role-${m.role?.toLowerCase()}`}>
                                                {m.role}
                                            </span>
                                        )}
                                    </td>

                                    <td style={{ color: "#64748b", fontSize: 13 }}>
                                        {formatDate(m.joinedAt || m.createdAt)}
                                    </td>

                                    {canManage && (
                                        <td className="actions-cell">
                                            {canRemove && m.role !== "TENANT_ADMIN" && (
                                                <button
                                                    className="btn-table danger"
                                                    onClick={() => removeMember(m)}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}

                        {filteredMembers.length === 0 && filteredInvites.length === 0 && (
                            <tr>
                                <td colSpan={canManage ? 5 : 4} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                                    {search ? "No members match your search" : "No members yet"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* PENDING INVITATIONS */}
            {filteredInvites.length > 0 && (
                <>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "24px 0 12px" }}>
                        Pending Invitations ({filteredInvites.length})
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {filteredInvites.map((inv: any) => (
                            <div
                                key={inv.id}
                                className="card"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "14px 20px",
                                    gap: 16,
                                    borderLeft: "3px solid #f59e0b",
                                }}
                            >
                                <div className="avatar-sm amber"
                                     style={{ flexShrink: 0, fontSize: 14 }}>
                                    {displayName(inv.email)[0].toUpperCase()}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                                        {displayName(inv.email)}
                                    </div>
                                    <div style={{ fontSize: 13, color: "#64748b" }}>
                                        {inv.email}
                                    </div>
                                </div>

                                <span className={`role-badge role-${inv.role?.toLowerCase()}`}>
                                    {inv.role}
                                </span>

                                <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                                    Sent {formatDate(inv.sentAt)}
                                </div>

                                {canManage && (
                                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                        <button
                                            className="btn-table"
                                            onClick={() => resendInvite(inv)}
                                        >
                                            Resend
                                        </button>
                                        <button
                                            className="btn-table danger"
                                            onClick={() => revokeInvite(inv)}
                                        >
                                            Revoke
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* INVITE MODAL */}
            {showInvite && canManage && activeWsId && tenantId && (
                <InviteMemberModal
                    tenantId={tenantId}
                    tenantName={tenantName}
                    currentWorkspaceId={activeWsId}
                    workspaces={workspaces}
                    onClose={() => { setShowInvite(false); loadMembers(); }}
                    onInvited={() => {}}
                />
            )}
        </div>
    );
}
