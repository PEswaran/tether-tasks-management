import { useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { getMySub, getMyTenantId } from "../../../libs/isMember";
import { displayName } from "../../../libs/displayName";
import { useConfirm } from "../../../shared-components/confirm-context";

export default function RequestTaskDeleteModal({ task, profiles, onClose, onRequested }: any) {
    const client = dataClient();

    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const { alert } = useConfirm();

    function profileEmail(userSub: string) {
        return profiles?.find((p: any) => p.userId === userSub)?.email || userSub || "—";
    }

    async function submitRequest() {
        if (!reason.trim()) { await alert({ title: "Missing Reason", message: "Please provide a reason for the deletion request.", variant: "warning" }); return; }

        setLoading(true);
        try {
            const mySub = await getMySub();
            const tenantId = await getMyTenantId();

            if (!mySub || !tenantId || !task.createdBy) {
                await alert({ title: "Error", message: "Unable to determine required info", variant: "danger" });
                setLoading(false);
                return;
            }

            if (!client.models.Notification) {
                await alert({ title: "Not Available", message: "Notifications not available yet. Please try again after deployment.", variant: "warning" });
                setLoading(false);
                return;
            }

            await client.models.Notification.create({
                tenantId,
                workspaceId: task.workspaceId,
                recipientId: task.createdBy,
                senderId: mySub,
                type: "TASK_DELETE_REQUEST",
                title: `Delete request: ${task.title}`,
                message: reason.trim(),
                resourceId: task.id,
                isRead: false,

                createdAt: new Date().toISOString(),
            });

            onRequested();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error submitting delete request", variant: "danger" });
        }
        setLoading(false);
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">
                <h2>Request Task Deletion</h2>

                <div style={{ fontSize: 14, color: "#334155", marginBottom: 16 }}>
                    <p><strong>Title:</strong> {task.title}</p>
                    <p><strong>Status:</strong> {task.status}</p>
                    <p><strong>Created by:</strong> {displayName(profileEmail(task.createdBy))}</p>
                    <p><strong>Assigned to:</strong> {task.assignedTo ? displayName(profileEmail(task.assignedTo)) : "Unassigned"}</p>
                </div>

                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
                    You cannot delete this task because you did not create it. A deletion request will be sent to the task creator.
                </p>

                <textarea
                    placeholder="Reason for deletion (required)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{
                        width: "100%",
                        minHeight: 80,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        resize: "vertical",
                    }}
                />

                <div style={{ marginTop: 20 }}>
                    <button className="btn" onClick={submitRequest} disabled={loading}>
                        {loading ? "Sending..." : "Send Request"}
                    </button>
                    <button className="btn secondary" style={{ marginLeft: 10 }} onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
