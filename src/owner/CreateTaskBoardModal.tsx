import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../libs/data-client";
import { getMyTenantId } from "../libs/isOwner";

export default function CreateTaskBoardModal({ organizations, onClose, onCreated }: any) {
    const client = dataClient();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [workspaceId, setworkspaceId] = useState(organizations[0]?.id || "");
    const [loading, setLoading] = useState(false);

    async function createBoard() {
        if (!name) { alert("Enter a board name"); return; }
        if (!workspaceId) { alert("Select an organization"); return; }

        setLoading(true);
        try {
            const tenantId = await getMyTenantId();
            if (!tenantId) { alert("Could not determine tenant"); setLoading(false); return; }

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
            alert("Error creating task board");
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
