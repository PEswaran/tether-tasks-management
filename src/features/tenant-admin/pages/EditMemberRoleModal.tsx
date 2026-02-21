import { useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useConfirm } from "../../../shared-components/confirm-context";

export default function EditMemberRoleModal({ member, members, onClose, onUpdated }: any) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [role, setRole] = useState(member.role || "MEMBER");
    const [loading, setLoading] = useState(false);

    function orgHasOtherOwner() {
        return members.some(
            (m: any) =>
                m.workspaceId === member.workspaceId &&
                m.role === "OWNER" &&
                m.status !== "REMOVED" &&
                m.id !== member.id
        );
    }

    async function saveRole() {
        if (role === member.role) {
            onClose();
            return;
        }

        // single-owner guard
        if (role === "OWNER" && orgHasOtherOwner()) {
            await alert({ title: "Owner Exists", message: "This organization already has an owner. Change the existing owner's role first.", variant: "warning" });
            return;
        }

        setLoading(true);

        try {
            await client.models.Membership.update({
                id: member.id,
                role,
            });

            onUpdated();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error updating role", variant: "danger" });
        }

        setLoading(false);
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">
                <h2>Edit Member Role</h2>

                <p style={{ fontSize: 14, color: "#64748b", marginBottom: 4 }}>
                    Current role: <strong>{member.role}</strong>
                </p>

                <select
                    className="modal-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                >
                    <option value="MEMBER">Member</option>
                    <option value="OWNER">Owner</option>
                </select>

                {role === "OWNER" && orgHasOtherOwner() && (
                    <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>
                        This organization already has an owner.
                    </p>
                )}

                <div style={{ marginTop: 20 }}>
                    <button className="btn" onClick={saveRole} disabled={loading}>
                        {loading ? "Saving..." : "Save Role"}
                    </button>

                    <button
                        className="btn secondary"
                        style={{ marginLeft: 10 }}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
