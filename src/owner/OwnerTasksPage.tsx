import { useEffect, useState } from "react";
import { dataClient } from "../libs/data-client";
import { getOwnerOrgIds, getMyTenantId } from "../libs/isOwner";
import CreateTaskBoardModal from "./CreateTaskBoardModal";
import { useWorkspace } from "../shared-components/workspace-context";
import { displayName } from "../libs/displayName";
import CreateTaskModal from "../pages/shared/modals/create-task-modal";
import EditTaskModal from "../pages/shared/modals/edit-task-modal";

type View = "boards" | "tasks";

const COLUMNS = [
    { key: "TODO", label: "Todo", css: "todo" },
    { key: "IN_PROGRESS", label: "In Progress", css: "in-progress" },
    { key: "DONE", label: "Done", css: "done" },
] as const;

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

export default function OwnerTasksPage() {
    const client = dataClient();
    const { workspaceId } = useWorkspace();

    const [view, setView] = useState<View>("boards");
    const [boards, setBoards] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [selectedBoard, setSelectedBoard] = useState<any>(null);

    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [createTaskStatus, setCreateTaskStatus] = useState<TaskStatus | null>(null);
    const [editTask, setEditTask] = useState<any>(null);

    useEffect(() => { load(); }, [workspaceId]);

    async function load() {
        const tenantId = await getMyTenantId();
        if (!tenantId) return;

        const orgIds = await getOwnerOrgIds();

        const orgRes = await client.models.Workspace.list({ filter: { tenantId: { eq: tenantId } } });
        const myOrgs = orgRes.data.filter((o: any) => orgIds.includes(o.id));
        setOrganizations(myOrgs);

        const profRes = await client.models.UserProfile.list({ filter: { tenantId: { eq: tenantId } } });
        setProfiles(profRes.data);

        let allBoards: any[] = [];
        let allMembers: any[] = [];
        let allTasks: any[] = [];

        const targetOrgIds = workspaceId ? [workspaceId] : orgIds;

        for (const orgId of targetOrgIds) {
            const [boardRes, memRes, taskRes] = await Promise.all([
                client.models.TaskBoard.list({ filter: { workspaceId: { eq: orgId } } }),
                client.models.Membership.list({ filter: { workspaceId: { eq: orgId } } }),
                client.models.Task.list({ filter: { workspaceId: { eq: orgId } } }),
            ]);
            allBoards = allBoards.concat(boardRes.data);
            allMembers = allMembers.concat(memRes.data.filter((m: any) => m.status !== "REMOVED"));
            allTasks = allTasks.concat(taskRes.data);
        }

        const enrichedMembers = allMembers.map((m: any) => ({
            ...m,
            _profileEmail: profRes.data.find((p: any) => p.userId === m.userSub)?.email || m.userSub,
        }));

        const enrichedTasks = allTasks.map((t: any) => {
            const profile = profRes.data.find((p: any) => p.userId === t.createdBy);
            const membership = allMembers.find((m: any) => m.userSub === t.createdBy);

            return {
                ...t,
                _createdByEmail: profile?.email || t.createdBy,
                _createdByRole: membership?.role || "Member",
            };
        });
        setBoards(allBoards);
        setMembers(enrichedMembers);
        setTasks(enrichedTasks);
    }

    function orgName(orgId: string) {
        return organizations.find((o) => o.id === orgId)?.name || "—";
    }

    function profileEmail(userSub: string) {
        return profiles.find((p) => p.userId === userSub)?.email || "";
    }

    function getInitials(userSub: string) {
        const email = profileEmail(userSub);
        if (!email || email === userSub) return "?";
        return displayName(email)[0].toUpperCase();
    }

    async function deleteBoard(board: any) {
        if (!window.confirm(`Delete board "${board.name}"? All tasks on this board will remain.`)) return;
        try {
            await client.models.TaskBoard.delete({ id: board.id });
            load();
        } catch (err) {
            console.error(err);
            alert("Error deleting board");
        }
    }

    async function deleteTask(task: any) {
        if (!window.confirm(`Delete task "${task.title}"?`)) return;
        try {
            await client.models.Task.delete({ id: task.id });
            load();
        } catch (err) {
            console.error(err);
            alert("Error deleting task");
        }
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

    const boardMembers = selectedBoard
        ? members.filter((m) => m.workspaceId === selectedBoard.workspaceId)
        : members;

    function isOverdue(dueDate: string) {
        return new Date(dueDate) < new Date(new Date().toDateString());
    }

    useEffect(() => {
        window.addEventListener("taskUpdated", load);
        return () => window.removeEventListener("taskUpdated", load);
    }, []);

    return (
        <div>
            <div className="page-title">Task Boards</div>

            {/* ─── BOARDS VIEW ─── */}
            {view === "boards" && (
                <>
                    <button className="btn" style={{ marginBottom: 20 }} onClick={() => setShowCreateBoard(true)}>
                        + Create Board
                    </button>

                    {showCreateBoard && (
                        <CreateTaskBoardModal
                            organizations={organizations}
                            onClose={() => setShowCreateBoard(false)}
                            onCreated={() => { setShowCreateBoard(false); load(); }}
                        />
                    )}

                    <table className="table">
                        <thead>
                            <tr>
                                <th>Board Name</th>
                                <th>Organization</th>
                                <th>Tasks</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {boards.map((b) => {
                                const count = tasks.filter((t) => t.taskBoardId === b.id).length;
                                return (
                                    <tr key={b.id}>
                                        <td>
                                            <button
                                                className="breadcrumb-link"
                                                style={{ fontWeight: 500, fontSize: 14 }}
                                                onClick={() => openBoard(b)}
                                            >
                                                {b.name}
                                            </button>
                                        </td>
                                        <td>{orgName(b.workspaceId)}</td>
                                        <td>{count}</td>
                                        <td>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "—"}</td>
                                        <td>
                                            <button className="btn-table danger" onClick={() => deleteBoard(b)} title="Delete board">
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {boards.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8" }}>
                                        No task boards yet. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </>
            )}

            {/* ─── KANBAN TASKS VIEW ─── */}
            {view === "tasks" && selectedBoard && (
                <>
                    {/* Breadcrumb */}
                    <div className="breadcrumb">
                        <button className="breadcrumb-link" onClick={backToBoards}>All Boards</button>
                        <span className="breadcrumb-sep">/</span>
                        <span>{orgName(selectedBoard.workspaceId)}</span>
                        <span className="breadcrumb-sep">/</span>
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{selectedBoard.name}</span>
                    </div>

                    {selectedBoard.description && (
                        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                            {selectedBoard.description}
                        </p>
                    )}

                    {/* Kanban columns */}
                    <div className="kanban">
                        {COLUMNS.map((col) => {
                            const colTasks = boardTasks.filter((t) => t.status === col.key);
                            return (
                                <div className="kanban-col" key={col.key}>
                                    <div className={`kanban-col-header ${col.css}`}>
                                        <span className="kanban-col-title">{col.label}</span>
                                        <span className="kanban-count">{colTasks.length}</span>
                                    </div>
                                    <div className="kanban-cards">
                                        {colTasks.map((t) => (
                                            <div className="task-card" key={t.id} onClick={() => setEditTask(t)}>
                                                <div className="task-card-title">{t.title}</div>
                                                <div className="task-card-meta">
                                                    {t.priority && (
                                                        <span className={`priority-badge ${t.priority.toLowerCase()}`}>
                                                            {t.priority}
                                                        </span>
                                                    )}
                                                    {t.dueDate && (
                                                        <span className={`task-card-due ${isOverdue(t.dueDate) && t.status !== "DONE" ? "overdue" : ""}`}>
                                                            {isOverdue(t.dueDate) && t.status !== "DONE" ? "Overdue · " : ""}
                                                            {new Date(t.dueDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                    <div className="task-card-avatars">
                                                        {t.ownerUserSub && (
                                                            <div className="task-card-avatar owner" title={`Owner: ${displayName(profileEmail(t.ownerUserSub) || t.ownerUserSub)}`}>
                                                                {getInitials(t.ownerUserSub)}
                                                            </div>
                                                        )}
                                                        {t.assignedTo && (
                                                            <div className="task-card-avatar assignee" title={`Assignee: ${displayName(profileEmail(t.assignedTo) || t.assignedTo)}`}>
                                                                {getInitials(t.assignedTo)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="task-card-actions">
                                                    <button
                                                        className="btn-table"
                                                        onClick={(e) => { e.stopPropagation(); setEditTask(t); }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn-table danger"
                                                        onClick={(e) => { e.stopPropagation(); deleteTask(t); }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="kanban-add" onClick={() => setCreateTaskStatus(col.key)}>
                                        + Add Task
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Create Task Modal */}
                    {createTaskStatus && (
                        <CreateTaskModal
                            board={selectedBoard}
                            members={boardMembers}
                            defaultStatus={createTaskStatus}
                            onClose={() => setCreateTaskStatus(null)}
                            onCreated={() => { setCreateTaskStatus(null); load(); }}
                        />
                    )}

                    {/* Edit Task Modal */}
                    {editTask && (
                        <EditTaskModal
                            task={editTask}
                            members={boardMembers}
                            onClose={() => setEditTask(null)}
                            onUpdated={() => { setEditTask(null); load(); }}
                        />
                    )}
                </>
            )}
        </div>
    );
}
