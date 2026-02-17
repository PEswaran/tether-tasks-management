import { useEffect, useState } from "react";
import { dataClient } from "../../libs/data-client";
import { useWorkspace } from "../../shared-components/workspace-context";
import { useUserRole } from "../../hooks/useUserRole";
import InviteMemberModal from "./modals/invite-members-modal";
import { getMyTenantId } from "../../libs/isOwner";

export default function MembersPage() {
    const client = dataClient();
    const { workspaceId, setWorkspaceId } = useWorkspace();
    const { getRole } = useUserRole();

    const [tenantId, setTenantId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);

    useEffect(() => {
        init();
    }, [workspaceId]);

    /* ============================= */
    async function init() {
        setLoading(true);

        const r = await getRole();
        setRole(r);

        const tid = await getMyTenantId();
        setTenantId(tid);

        if (tid) {
            const wsRes = await client.models.Workspace.list({
                filter: { tenantId: { eq: tid } }
            });
            setWorkspaces(wsRes.data);
        }

        if (!workspaceId) {
            setMembers([]);
            setInvites([]);
            setLoading(false);
            return;
        }

        /* MEMBERS */
        const memRes = await client.models.Membership.list({
            filter: { workspaceId: { eq: workspaceId } }
        });
        setMembers(memRes.data);

        /* INVITES */
        const invRes = await client.models.Invitation.list({
            filter: { workspaceId: { eq: workspaceId } }
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
        if (!confirm("Remove this member from workspace?")) return;

        await client.models.Membership.update({
            id: member.id,
            status: "REMOVED"
        });

        init();
    }

    async function revokeInvite(inv: any) {
        await client.models.Invitation.update({
            id: inv.id,
            status: "REVOKED"
        });

        init();
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

        alert("Invitation resent");
    }

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
                    value={workspaceId || ""}
                    onChange={(e) => setWorkspaceId(e.target.value)}
                >
                    <option value="">Select workspace</option>
                    {workspaces.map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>

                {/* INVITE */}
                {canManage && workspaceId && (
                    <button className="btn-primary" onClick={() => setShowInvite(true)}>
                        + Invite Member
                    </button>
                )}
            </div>

            {/* TABLE */}
            <div className="card">
                <table className="tt-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Status</th>
                            {(canManage) && <th></th>}
                        </tr>
                    </thead>

                    <tbody>

                        {/* ACTIVE MEMBERS */}
                        {members
                            .filter((m: any) => m.status !== "REMOVED")
                            .map((m: any) => {
                                const prof = profileFor(m.userSub);

                                return (
                                    <tr key={m.id}>
                                        <td className="user-cell">
                                            <div className="avatar-sm">
                                                {(prof?.email || "U")[0].toUpperCase()}
                                            </div>

                                            <div>
                                                <div className="user-name">
                                                    {prof?.email || m.userSub}
                                                </div>
                                                <div className="user-sub">
                                                    {m.userSub.slice(0, 8)}
                                                </div>
                                            </div>
                                        </td>

                                        <td>
                                            <span className={`role-badge role-${m.role?.toLowerCase()}`}>
                                                {m.role}
                                            </span>
                                        </td>

                                        <td>
                                            <span className="badge green">ACTIVE</span>
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

                        {/* PENDING INVITES */}
                        {invites
                            .filter((i: any) => i.status === "PENDING")
                            .map((inv: any) => (
                                <tr key={inv.id} className="pending-row">

                                    <td className="user-cell">
                                        <div className="avatar-sm amber">✉</div>
                                        <div>
                                            <div className="user-name">{inv.email}</div>
                                            <div className="user-sub">Invitation pending</div>
                                        </div>
                                    </td>

                                    <td>
                                        <span className={`role-badge role-${inv.role?.toLowerCase()}`}>
                                            {inv.role}
                                        </span>
                                    </td>

                                    <td>
                                        <span className="badge amber">PENDING</span>
                                    </td>

                                    <td className="actions-cell">
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
                                    </td>
                                </tr>
                            ))}

                        {members.length === 0 && invites.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                                    No members yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* INVITE MODAL */}
            {showInvite && canManage && workspaceId && tenantId && (
                <InviteMemberModal
                    tenantId={tenantId}
                    currentWorkspaceId={workspaceId}
                    workspaces={workspaces}
                    onClose={() => { setShowInvite(false); init(); }}
                    onInvited={() => {}}
                />
            )}
        </div>
    );
}
