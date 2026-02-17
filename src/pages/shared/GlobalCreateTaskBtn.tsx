import { useState, useEffect } from "react";
import { dataClient } from "../../libs/data-client";
import { useWorkspace } from "../../shared-components/workspace-context";
import CreateTaskModal from "../shared/modals/create-task-modal";
import { Plus } from "lucide-react";

export default function GlobalCreateTaskButton() {
    const client = dataClient();
    const { workspaceId, tenantId } = useWorkspace();

    const [open, setOpen] = useState(false);
    const [boards, setBoards] = useState<any[]>([]);
    const [selectedBoard, setSelectedBoard] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);

    useEffect(() => {
        loadContext();
    }, [workspaceId, tenantId]);

    async function loadContext() {
        if (!workspaceId || !tenantId) return;

        try {
            const [boardRes, memRes, profRes] = await Promise.all([
                client.models.TaskBoard.list({ filter: { workspaceId: { eq: workspaceId } } }),
                client.models.Membership.listMembershipsByWorkspace({ workspaceId }),
                client.models.UserProfile.list({ filter: { tenantId: { eq: tenantId } } }),
            ]);

            const wsBoards = boardRes.data || [];
            setBoards(wsBoards);
            setSelectedBoard(wsBoards[0] || null);

            const activeMembers = (memRes.data || []).filter((m: any) => m.status !== "REMOVED");
            const enriched = activeMembers.map((m: any) => ({
                ...m,
                _profileEmail: (profRes.data || []).find((p: any) => p.userId === m.userSub)?.email || m.userSub,
            }));
            setMembers(enriched);
        } catch (err) {
            console.error("Global create load error", err);
        }
    }

    if (!workspaceId) return null;

    return (
        <>
            <div
                className="global-create-btn"
                onClick={() => setOpen(true)}
                title="Create Task"
            >
                <Plus size={22} />
            </div>

            {open && !selectedBoard && (
                <div className="modal-backdrop" onClick={() => setOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>No Task Boards</h3>
                        <p style={{ color: "#64748b", fontSize: 14 }}>
                            Create a task board first before adding tasks.
                        </p>
                        <button className="btn" onClick={() => setOpen(false)} style={{ marginTop: 16 }}>
                            OK
                        </button>
                    </div>
                </div>
            )}

            {open && selectedBoard && (
                <>
                    {boards.length > 1 && (
                        <div style={{
                            position: "fixed", top: 0, left: 0, right: 0,
                            zIndex: 1001, background: "white", padding: "8px 20px",
                            borderBottom: "1px solid #e2e8f0", display: "flex",
                            alignItems: "center", gap: 10,
                        }}>
                            <label style={{ fontSize: 13, fontWeight: 500 }}>Board:</label>
                            <select
                                className="modal-select"
                                style={{ maxWidth: 260 }}
                                value={selectedBoard.id}
                                onChange={(e) => {
                                    const b = boards.find((b: any) => b.id === e.target.value);
                                    if (b) setSelectedBoard(b);
                                }}
                            >
                                {boards.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <CreateTaskModal
                        board={selectedBoard}
                        members={members}
                        onClose={() => setOpen(false)}
                        onCreated={() => { setOpen(false); }}
                    />
                </>
            )}
        </>
    );
}
