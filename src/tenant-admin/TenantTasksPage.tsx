import { useEffect, useState } from "react";
import { dataClient } from "../libs/data-client";
import { getTenantId } from "../libs/isTenantAdmin";
import { displayName } from "../libs/displayName";

type View = "boards" | "tasks";

export default function TenantTasksPage() {
    const client = dataClient();

    const [view, setView] = useState<View>("boards");
    const [boards, setBoards] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [selectedBoard, setSelectedBoard] = useState<any>(null);

    useEffect(() => { load(); }, []);

    async function load() {
        const tenantId = await getTenantId();
        if (!tenantId) return;

        const [orgRes, boardRes, taskRes, profRes] = await Promise.all([
            client.models.Workspace.list({ filter: { tenantId: { eq: tenantId } } }),
            client.models.TaskBoard.list({ filter: { tenantId: { eq: tenantId } } }),
            client.models.Task.list({ filter: { tenantId: { eq: tenantId } } }),
            client.models.UserProfile.list({ filter: { tenantId: { eq: tenantId } } }),
        ]);

        setOrganizations(orgRes.data);
        setBoards(boardRes.data);
        setTasks(taskRes.data);
        setProfiles(profRes.data);
    }

    function orgName(orgId: string) {
        return organizations.find((o) => o.id === orgId)?.name || "—";
    }

    function profileEmail(userSub: string) {
        return profiles.find((p) => p.userId === userSub)?.email || "—";
    }

    function openBoard(board: any) {
        setSelectedBoard(board);
        setView("tasks");
    }

    function backToBoards() {
        setSelectedBoard(null);
        setView("boards");
    }

    const boardTasks = selectedBoard
        ? tasks.filter((t) => t.taskBoardId === selectedBoard.id)
        : [];

    return (
        <div>
            <div className="page-title">Tasks</div>

            {/* BOARDS VIEW */}
            {view === "boards" && (
                <table className="table">
                    <thead>
                        <tr>
                            <th>Board Name</th>
                            <th>Workspace</th>
                            <th>Tasks</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {boards.map((b) => {
                            const count = tasks.filter((t) => t.taskBoardId === b.id).length;
                            return (
                                <tr key={b.id}>
                                    <td>
                                        <button
                                            style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 500, fontSize: 14, padding: 0 }}
                                            onClick={() => openBoard(b)}
                                        >
                                            {b.name}
                                        </button>
                                    </td>
                                    <td>{orgName(b.workspaceId)}</td>
                                    <td>{count}</td>
                                    <td>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "—"}</td>
                                </tr>
                            );
                        })}
                        {boards.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ textAlign: "center", color: "#94a3b8" }}>
                                    No task boards yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}

            {/* TASKS VIEW (inside a board) */}
            {view === "tasks" && selectedBoard && (
                <>
                    <button className="btn secondary" style={{ marginBottom: 16 }} onClick={backToBoards}>
                        &larr; Back to Boards
                    </button>

                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{selectedBoard.name}</h3>
                    <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                        {orgName(selectedBoard.workspaceId)}
                        {selectedBoard.description ? ` · ${selectedBoard.description}` : ""}
                    </p>

                    <table className="table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Assigned To</th>
                                <th>Created By</th>
                                <th>Due Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {boardTasks.map((t) => (
                                <tr key={t.id}>
                                    <td>{t.title}</td>
                                    <td><span className={`status-badge ${t.status?.toLowerCase()}`}>{t.status}</span></td>
                                    <td><span className={`role-badge ${t.priority?.toLowerCase()}`}>{t.priority}</span></td>
                                    <td>{t.assignedTo ? displayName(profileEmail(t.assignedTo)) : "—"}</td>
                                    <td>{t.createdBy ? displayName(profileEmail(t.createdBy)) : "—"}</td>
                                    <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                                </tr>
                            ))}
                            {boardTasks.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>
                                        No tasks on this board.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
}
