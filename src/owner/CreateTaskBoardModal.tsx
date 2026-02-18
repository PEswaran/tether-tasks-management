import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../libs/data-client";
import { getMyTenantId } from "../libs/isOwner";
import { useConfirm } from "../shared-components/confirm-context";

export default function CreateTaskBoardModal({ organizations, onClose, onCreated }: any) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [workspaceId, setworkspaceId] = useState(organizations[0]?.id || "");
    const [loading, setLoading] = useState(false);

    async function createBoard() {
        if (!name) { await alert({ title: "Missing Name", message: "Enter a board name", variant: "warning" }); return; }
        if (!workspaceId) { await alert({ title: "Missing Organization", message: "Select an organization", variant: "warning" }); return; }

        setLoading(true);
        try {
            const tenantId = await getMyTenantId();
            if (!tenantId) { await alert({ title: "Error", message: "Could not determine tenant", variant: "danger" }); setLoading(false); return; }

            const session = await fetchAuthSession();
            const sub = session.tokens?.accessToken.payload.sub as string;

            await client.models.TaskBoard.create({
                tenantId,
                workspaceId,
                name,
                description: description || undefined,
                createdBy: sub,
                isActive: true,
                createdAt: new Date().toISOString(),
            });

            onCreated();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error creating task board", variant: "danger" });
        }
        setLoading(false);
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">
                <h2>Create Task Board</h2>

                <input placeholder="Board name" value={name} onChange={(e) => setName(e.target.value)} />
                <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

                {organizations.length > 1 && (
                    <select className="modal-select" value={workspaceId} onChange={(e) => setworkspaceId(e.target.value)}>
                        {organizations.map((org: any) => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                )}

                <div style={{ marginTop: 20 }}>
                    <button className="btn" onClick={createBoard} disabled={loading}>
                        {loading ? "Creating..." : "Create Board"}
                    </button>
                    <button className="btn secondary" style={{ marginLeft: 10 }} onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
