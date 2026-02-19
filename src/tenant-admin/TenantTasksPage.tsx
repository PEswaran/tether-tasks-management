import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { dataClient } from "../libs/data-client";
import { useWorkspace } from "../shared-components/workspace-context";
import { displayName } from "../libs/displayName";
import CreateTaskBoardModal from "../owner/CreateTaskBoardModal";
import CreateTaskModal from "../pages/shared/modals/create-task-modal";
import EditTaskModal from "../pages/shared/modals/edit-task-modal";
import { useConfirm } from "../shared-components/confirm-context";

type View = "boards" | "tasks";

export default function TenantTasksPage() {
    const client = dataClient();
    const { tenantId } = useWorkspace();
    const { confirm, alert } = useConfirm();
    const [searchParams, setSearchParams] = useSearchParams();
    const filterWorkspaceId = searchParams.get("workspace");

    const [view, setView] = useState<View>("boards");
    const [boards, setBoards] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [selectedBoard, setSelectedBoard] = useState<any>(null);
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [editTask, setEditTask] = useState<any>(null);

    useEffect(() => { load(); }, [tenantId]);

    async function load() {
        if (!tenantId) return;

        const [orgRes, boardRes, taskRes, profRes] = await Promise.all([
            client.models.Workspace.list({ filter: { tenantId: { eq: tenantId } } }),
            client.models.TaskBoard.list({ filter: { tenantId: { eq: tenantId } } }),
            client.models.Task.list({ filter: { tenantId: { eq: tenantId } } }),
            client.models.UserProfile.list({ filter: { tenantId: { eq: tenantId } } }),
        ]);

        setOrganizations(orgRes.data);
        setBoards(boardRes.data);
        setProfiles(profRes.data);

        // Enrich tasks with creator info
        const enrichedTasks = (taskRes.data || []).map((t: any) => {
            const profile = (profRes.data || []).find((p: any) => p.userId === t.createdBy);
            return {
                ...t,
                _createdByEmail: profile?.email || t.createdBy,
                _createdByRole: "TENANT_ADMIN",
            };
        });
        setTasks(enrichedTasks);

        // Build members list from profiles for the edit modal assignee dropdown
        const enrichedMembers = (profRes.data || []).map((p: any) => ({
            userSub: p.userId,
            _profileEmail: p.email || p.userId,
        }));
        setMembers(enrichedMembers);
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

    async function deleteTask(task: any) {
        if (!await confirm({ title: "Delete Task", message: `Delete task "${task.title}"?`, confirmLabel: "Delete", variant: "danger" })) return;
        try {
            await client.models.Task.delete({ id: task.id });
            load();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error deleting task", variant: "danger" });
        }
    }

    async function deleteBoard(board: any) {
        if (!await confirm({ title: "Delete Board", message: `Delete board "${board.name}"?`, confirmLabel: "Delete", variant: "danger" })) return;
        try {
            await client.models.TaskBoard.delete({ id: board.id });
            load();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error deleting board", variant: "danger" });
        }
    }

    const filteredBoards = filterWorkspaceId
        ? boards.filter((b) => b.workspaceId === filterWorkspaceId)
        : boards;

    const boardTasks = selectedBoard
        ? tasks.filter((t) => t.taskBoardId === selectedBoard.id)
        : [];

    const filterOrgName = filterWorkspaceId
        ? organizations.find((o) => o.id === filterWorkspaceId)?.name
        : null;

    return (
        <div>
            <div className="page-title">Tasks</div>

            {view === "boards" && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <button
                        className="btn"
                        onClick={() => setShowCreateBoard(true)}
                    >
                        + Create Board
                    </button>

                    {filterWorkspaceId && (
                        <span style={{ fontSize: 13, color: "#64748b" }}>
                            Filtered by: <strong>{filterOrgName || filterWorkspaceId}</strong>
                            <button
                                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", marginLeft: 6, fontSize: 13 }}
                                onClick={() => setSearchParams({})}
                            >
                                Clear
                            </button>
                        </span>
                    )}
                </div>
            )}

            {showCreateBoard && (
                <CreateTaskBoardModal
                    organizations={organizations}
                    tenantId={tenantId}
                    onClose={() => setShowCreateBoard(false)}
                    onCreated={() => { setShowCreateBoard(false); load(); }}
                />
            )}

            {/* BOARDS VIEW */}
            {view === "boards" && (
                <table className="table">
                    <thead>
                        <tr>
                            <th>Board Name</th>
                            <th>Workspace</th>
                            <th>Tasks</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBoards.map((b) => {
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
                                    <td>
                                        <button className="btn secondary" style={{ fontSize: 12 }} onClick={() => deleteBoard(b)}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredBoards.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8" }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <button className="btn secondary" onClick={backToBoards}>
                            &larr; Back to Boards
                        </button>
                        <button className="btn" onClick={() => setShowCreateTask(true)}>
                            + Add Task
                        </button>
                    </div>

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
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {boardTasks.map((t) => (
                                <tr key={t.id}>
                                    <td>
                                        <button
                                            style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 500, fontSize: 14, padding: 0 }}
                                            onClick={() => setEditTask(t)}
                                        >
                                            {t.title}
                                        </button>
                                    </td>
                                    <td><span className={`status-badge ${t.status?.toLowerCase()}`}>{t.status}</span></td>
                                    <td><span className={`role-badge ${t.priority?.toLowerCase()}`}>{t.priority}</span></td>
                                    <td>{t.assignedTo ? displayName(profileEmail(t.assignedTo)) : "—"}</td>
                                    <td>{t.createdBy ? displayName(profileEmail(t.createdBy)) : "—"}</td>
                                    <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                                    <td>
                                        <button
                                            className="btn secondary"
                                            style={{ fontSize: 12, marginRight: 6 }}
                                            onClick={() => setEditTask(t)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn secondary"
                                            style={{ fontSize: 12 }}
                                            onClick={() => deleteTask(t)}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {boardTasks.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8" }}>
                                        No tasks on this board.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {showCreateTask && (
                        <CreateTaskModal
                            board={selectedBoard}
                            members={members}
                            onClose={() => setShowCreateTask(false)}
                            onCreated={() => { setShowCreateTask(false); load(); }}
                        />
                    )}

                    {editTask && (
                        <EditTaskModal
                            task={editTask}
                            members={members}
                            onClose={() => setEditTask(null)}
                            onUpdated={() => { setEditTask(null); load(); }}
                        />
                    )}
                </>
            )}
        </div>
    );
}
