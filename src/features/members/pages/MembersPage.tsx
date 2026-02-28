import { useEffect, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { displayName } from "../../../libs/displayName";
import { Search } from "lucide-react";
import { useConfirm } from "../../../shared-components/confirm-context";
import InviteMemberModal from "../../../components/shared/modals/invite-members-modal";
import { isAuthed } from "../../../libs/isAuthed";

export default function MembersPage() {
    const client = dataClient();
    const { organizationId: contextOrganizationId, tenantId, tenantName, role, organizations, setOrganizationId } = useWorkspace();

    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [search, setSearch] = useState("");
    const { confirm, alert } = useConfirm();

    // The active organization for this page — local state, not global context
    const activeOrgId = selectedOrgId || contextOrganizationId;

    // Sync from context on tenant switch
    useEffect(() => {
        setSelectedOrgId(null);
    }, [tenantId]);

    useEffect(() => {
        if (!contextOrganizationId && organizations.length > 0) {
            setOrganizationId(organizations[0].id);
        }
    }, [contextOrganizationId, organizations, setOrganizationId]);

    useEffect(() => {
        loadMembers();
    }, [activeOrgId, tenantId]);

    async function loadMembers() {

        if (!(await isAuthed())) return;
        setLoading(true);

        if (!activeOrgId) {
            setMembers([]);
            setInvites([]);
            setLoading(false);
            return;
        }

        /* MEMBERS */
        const memRes = await client.models.Membership.list({
            filter: { organizationId: { eq: activeOrgId } }
        });
        setMembers(memRes.data);

        /* INVITES */
        const invRes = await client.models.Invitation.list({
            filter: { organizationId: { eq: activeOrgId } }
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
        console.log("CLICK REMOVE", member);

        const ok = await confirm({
            title: "Remove Member",
            message: `Remove ${member.userSub} from organization?`,
            confirmLabel: "Remove",
            variant: "danger"
        });

        console.log("CONFIRM RESULT:", ok);

        if (!ok) return;

        try {
            await client.models.Membership.update({
                id: member.id,
                status: "REMOVED"
            });

            await alert({
                title: "Removed",
                message: "Member removed successfully",
                variant: "success"
            });

            loadMembers();

        } catch (err) {
            console.error(err);
            await alert({
                title: "Error",
                message: "Failed to remove member",
                variant: "danger"
            });
        }
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
                        itemName: "Organization",
                    workspaceId: inv.organizationId || inv.workspaceId,
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
                await alert({ title: "Owner Exists", message: "This organization already has an owner. Remove the current owner first.", variant: "warning" });
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
                    <div className="page-sub">Organization users & permissions</div>
                </div>

                {/* WORKSPACE SELECTOR */}
                <select
                    id="members-organization-select"
                    name="members_organization_select"
                    className="workspace-select"
                    value={activeOrgId || ""}
                    onChange={(e) => {
                        const id = e.target.value || null;
                        setSelectedOrgId(id);
                        if (id) setOrganizationId(id);
                    }}
                >
                    <option value="">Select organization</option>
                    {organizations.map((o: any) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>

                {/* INVITE */}
                {canManage && activeOrgId && (
                    <button className="btn-primary" onClick={() => setShowInvite(true)}>
                        + Invite Member
                    </button>
                )}
            </div>

            {/* SEARCH BAR */}
            {activeOrgId && (
                <div style={{ position: "relative", marginBottom: 16, maxWidth: 320 }}>
                    <Search size={16} style={{ position: "absolute", left: 12, top: 10, color: "#94a3b8" }} />
                    <input
                        id="members-search-input"
                        name="members_search_input"
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
                                                id={`member-role-${m.id}`}
                                                name={`member_role_${m.id}`}
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
            {showInvite && canManage && activeOrgId && tenantId && (
                <InviteMemberModal
                    tenantId={tenantId}
                    tenantName={tenantName}
                    currentOrganizationId={activeOrgId}
                    organizations={organizations}
                    onClose={() => { setShowInvite(false); loadMembers(); }}
                    onInvited={() => { }}
                />
            )}
        </div>
    );
}
