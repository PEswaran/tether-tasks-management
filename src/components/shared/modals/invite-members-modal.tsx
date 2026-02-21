import { useEffect, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { displayName } from "../../../libs/displayName";
import { useConfirm } from "../../../shared-components/confirm-context";
import { isAuthed } from "../../../libs/isAuthed";

type Workspace = {
    id: string;
    name: string;
};

export default function InviteMemberModal({
    tenantId,
    tenantName,
    currentWorkspaceId,
    workspaces = [],
    onClose,
}: {
    tenantId: string;
    tenantName?: string | null;
    currentWorkspaceId?: string | null;
    workspaces?: Workspace[];
    onClose: () => void;
    onInvited: () => void;
}) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [email, setEmail] = useState("");
    const [workspaceId, setWorkspaceId] = useState<string>("");
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
        // default workspace
        if (currentWorkspaceId) setWorkspaceId(currentWorkspaceId);
        else if (workspaces.length === 1) setWorkspaceId(workspaces[0].id);

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
                m.workspaceId === wsId &&
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

        if (!workspaceId) {
            await alert({ title: "Missing Workspace", message: "Select workspace", variant: "warning" });
            return;
        }

        if (role === "OWNER" && workspaceHasOwner(workspaceId)) {
            await alert({ title: "Owner Exists", message: "Workspace already has an owner", variant: "warning" });
            return;
        }

        setLoading(true);

        try {
            const result = await client.mutations.inviteMemberToOrg({
                email: email.trim().toLowerCase(),
                workspaceId,
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
                            : "Add users to your workspace"}
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
                            <label>Email address</label>
                            <input
                                type="email"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />

                            {/* WORKSPACE SELECT */}
                            <label>Workspace</label>
                            <select
                                className="modal-select"
                                value={workspaceId}
                                onChange={(e) => setWorkspaceId(e.target.value)}
                            >
                                <option value="">Select workspace</option>
                                {workspaces.map(ws => (
                                    <option key={ws.id} value={ws.id}>
                                        {ws.name}
                                    </option>
                                ))}
                            </select>

                            {/* ROLE */}
                            <label>Role</label>
                            <select
                                className="modal-select"
                                value={role}
                                onChange={(e) => setRole(e.target.value as any)}
                            >
                                <option value="MEMBER">Member</option>
                                <option value="OWNER">Owner</option>
                            </select>

                            {/* OWNER WARNING */}
                            {role === "OWNER" && workspaceHasOwner(workspaceId) && (
                                <div className="modal-warning">
                                    ⚠ This workspace already has an owner
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
