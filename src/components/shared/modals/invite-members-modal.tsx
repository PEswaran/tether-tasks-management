import { useEffect, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { displayName } from "../../../libs/displayName";
import { useConfirm } from "../../../shared-components/confirm-context";
import { isAuthed } from "../../../libs/isAuthed";

type Organization = {
    id: string;
    name?: string | null;
};

export default function InviteMemberModal({
    tenantId,
    tenantName,
    currentOrganizationId,
    organizations = [],
    onClose,
}: {
    tenantId: string;
    tenantName?: string | null;
    currentOrganizationId?: string | null;
    organizations?: Organization[];
    onClose: () => void;
    onInvited: () => void;
}) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [email, setEmail] = useState("");
    const [organizationId, setOrganizationId] = useState<string>("");
    const [role, setRole] = useState<"MEMBER" | "OWNER">("MEMBER");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [members, setMembers] = useState<any[]>([]);

    /* auto-close after success */
    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => onClose(), 2000);
        return () => clearTimeout(timer);
    }, [success]);

    /* ===============================
       INIT
    =============================== */

    useEffect(() => {
        // default organization
        if (currentOrganizationId) setOrganizationId(currentOrganizationId);
        else if (organizations.length === 1) setOrganizationId(organizations[0].id);

        loadMembers();
    }, []);

    async function loadMembers() {

        if (!(await isAuthed())) return;
        if (!tenantId) return;

        const res = await client.models.Membership.list({
            filter: { tenantId: { eq: tenantId } }
        });

        setMembers(res.data);
    }

    /* ===============================
       VALIDATIONS
    =============================== */
    function workspaceHasOwner(wsId: string) {
        return members.some(
            (m: any) =>
                m.organizationId === wsId &&
                m.role === "OWNER" &&
                m.status === "ACTIVE"
        );
    }

    /* ===============================
       SEND INVITE
    =============================== */
    async function sendInvite() {
        if (!email.trim()) {
            await alert({ title: "Missing Email", message: "Enter an email", variant: "warning" });
            return;
        }

        if (!organizationId) {
            await alert({ title: "Missing Organization", message: "Select organization", variant: "warning" });
            return;
        }

        if (role === "OWNER" && workspaceHasOwner(organizationId)) {
            await alert({ title: "Owner Exists", message: "Organization already has an owner", variant: "warning" });
            return;
        }

        setLoading(true);

        try {
            const result = await client.mutations.inviteMemberToOrg({
                email: email.trim().toLowerCase(),
                organizationId,
                tenantId,
                role,
            });

            const res = result.data;

            if (!res?.success) {
                await alert({ title: "Invite Failed", message: res?.message || "Invite failed", variant: "danger" });
                setLoading(false);
                return;
            }

            setLoading(false);
            setSuccess(true);

        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Server error sending invite", variant: "danger" });
        }

        setLoading(false);
    }

    /* ===============================
       UI
    =============================== */
    return (
        <div className="modal-backdrop">
            <div className="modal modern">

                <div className="modal-header">
                    <h2>Invite Member</h2>
                    <div className="modal-sub">
                        {tenantName
                            ? `Add users to ${tenantName}`
                            : "Add users to your organization"}
                    </div>
                </div>

                {success ? (
                    <div className="modal-body" style={{ textAlign: "center", padding: "40px 0" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>&#10003;</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#16a34a" }}>
                            Invite sent successfully!
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                            {displayName(email)}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="modal-body">

                            {/* EMAIL */}
                            <label htmlFor="invite-email">Email address</label>
                            <input
                                id="invite-email"
                                name="invite_email"
                                type="email"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />

                            {/* WORKSPACE SELECT */}
                            <label htmlFor="invite-organization">Organization</label>
                            <select
                                id="invite-organization"
                                name="invite_organization"
                                className="modal-select"
                                value={organizationId}
                                onChange={(e) => setOrganizationId(e.target.value)}
                            >
                                <option value="">Select organization</option>
                                {organizations.map(org => (
                                    <option key={org.id} value={org.id}>
                                        {org.name}
                                    </option>
                                ))}
                            </select>

                            {/* ROLE */}
                            <label htmlFor="invite-role">Role</label>
                            <select
                                id="invite-role"
                                name="invite_role"
                                className="modal-select"
                                value={role}
                                onChange={(e) => setRole(e.target.value as any)}
                            >
                                <option value="MEMBER">Member</option>
                                <option value="OWNER">Owner</option>
                            </select>

                            {/* OWNER WARNING */}
                            {role === "OWNER" && workspaceHasOwner(organizationId) && (
                                <div className="modal-warning">
                                    ⚠ This organization already has an owner
                                </div>
                            )}

                        </div>

                        <div className="modal-footer">
                            <button className="btn ghost" onClick={onClose}>
                                Cancel
                            </button>

                            <button
                                className="btn primary"
                                onClick={sendInvite}
                                disabled={loading}
                            >
                                {loading ? "Sending..." : "Send Invite"}
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}
