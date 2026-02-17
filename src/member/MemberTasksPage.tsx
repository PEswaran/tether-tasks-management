import { useEffect, useState } from "react";
import { dataClient } from "../libs/data-client";
import { getMySub } from "../libs/isMember";
import CreateTaskBoardModal from "../owner/CreateTaskBoardModal";
import { useWorkspace } from "../shared-components/workspace-context";
import CreateTaskModal from "../pages/shared/modals/create-task-modal";
import EditTaskModal from "../pages/shared/modals/edit-task-modal";
import RequestTaskDeleteModal from "../pages/shared/modals/request-task-delete";

type View = "boards" | "tasks";

export default function MemberTasksPage() {
    const client = dataClient();
    const { workspaceId, tenantId, workspaces } = useWorkspace();

    const [view, setView] = useState<View>("boards");
    const [boards, setBoards] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [selectedBoard, setSelectedBoard] = useState<any>(null);
    const [mySub, setMySub] = useState<string | null>(null);

    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [createTaskBoard, setCreateTaskBoard] = useState<any>(null);
    const [editTask, setEditTask] = useState<any>(null);
    const [requestDeleteTask, setRequestDeleteTask] = useState<any>(null);

    useEffect(() => { load(); }, [workspaceId, tenantId]);

    async function load() {
        const sub = await getMySub();
        setMySub(sub);

        if (!workspaceId || !tenantId) return;

        setOrganizations(workspaces as any[]);

        const profRes = await client.models.UserProfile.list({ filter: { tenantId: { eq: tenantId } } });
        setProfiles(profRes.data);

        const targetIds = workspaceId ? [workspaceId] : workspaces.map((w: any) => w.id);

        let allBoards: any[] = [];
        let allMembers: any[] = [];
        let allTasks: any[] = [];

        for (const wsId of targetIds) {
            const [boardRes, memRes, taskRes] = await Promise.all([
                client.models.TaskBoard.list({ filter: { workspaceId: { eq: wsId } } }),
                client.models.Membership.listMembershipsByWorkspace({ workspaceId: wsId }),
                client.models.Task.listTasksByWorkspace({ workspaceId: wsId }),
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
        return profiles.find((p) => p.userId === userSub)?.email || "—";
    }

    async function deleteTask(task: any) {
        if (!window.confirm(`Delete task "${task.title}"?`)) return;
        try {
            // Log the deletion
            if (tenantId && mySub) {
                await client.models.AuditLog.create({
                    tenantId,
                    workspaceId: task.workspaceId,
                    userId: mySub,
                    action: "DELETE",
                    resourceType: "Task",
                    resourceId: task.id,
                    timestamp: new Date().toISOString(),
                    result: "SUCCESS",
                    metadata: JSON.stringify({ taskTitle: task.title }),
                });
            }

            await client.models.Task.delete({ id: task.id });
            load();
        } catch (err) {
            console.error(err);
            alert("Error deleting task");
        }
    }

    function handleDeleteClick(task: any) {
        if (task.createdBy === mySub) {
            deleteTask(task);
        } else {
            setRequestDeleteTask(task);
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

    useEffect(() => {
        window.addEventListener("taskUpdated", load);
        return () => window.removeEventListener("taskUpdated", load);
    }, []);

    return (
        <div>
            <div className="page-title">Tasks</div>

            {/* BOARDS VIEW */}
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
                                        No task boards yet. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </>
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

                    <button className="btn" style={{ marginBottom: 20 }} onClick={() => setCreateTaskBoard(selectedBoard)}>
                        + Create Task
                    </button>

                    {createTaskBoard && (
                        <CreateTaskModal
                            board={createTaskBoard}
                            members={boardMembers}
                            onClose={() => setCreateTaskBoard(null)}
                            onCreated={() => { setCreateTaskBoard(null); load(); }}
                        />
                    )}

                    {editTask && (
                        <EditTaskModal
                            task={editTask}
                            members={boardMembers}
                            onClose={() => setEditTask(null)}
                            onUpdated={() => { setEditTask(null); load(); }}
                        />
                    )}

                    {requestDeleteTask && (
                        <RequestTaskDeleteModal
                            task={requestDeleteTask}
                            profiles={profiles}
                            onClose={() => setRequestDeleteTask(null)}
                            onRequested={() => { setRequestDeleteTask(null); alert("Delete request sent to task creator."); load(); }}
                        />
                    )}

                    <table className="table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Assigned To</th>
                                <th>Due Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {boardTasks.map((t) => (
                                <tr key={t.id}>
                                    <td>{t.title}</td>
                                    <td><span className={`status-badge ${t.status?.toLowerCase()}`}>{t.status}</span></td>
                                    <td><span className={`role-badge ${t.priority?.toLowerCase()}`}>{t.priority}</span></td>
                                    <td>{t.assignedTo ? profileEmail(t.assignedTo) : "—"}</td>
                                    <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                                    <td>
                                        <button className="btn secondary" style={{ marginRight: 8 }} onClick={() => setEditTask(t)}>
                                            Edit
                                        </button>
                                        <button className="btn secondary" onClick={() => handleDeleteClick(t)}>
                                            {t.createdBy === mySub ? "Delete" : "Request Delete"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {boardTasks.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>
                                        No tasks yet. Create one above.
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
