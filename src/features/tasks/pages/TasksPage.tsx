import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { useConfirm } from "../../../shared-components/confirm-context";
import { displayName } from "../../../libs/displayName";
import { dataClient } from "../../../libs/data-client";


import CreateTaskBoardModal from "../../../components/shared/modals/create-task-board-modal";
import CreateTaskModal from "../../../components/shared/modals/create-task-modal";
import EditTaskModal from "../../../components/shared/modals/edit-task-modal";
import RequestTaskDeleteModal from "../../../components/shared/modals/request-task-delete";
import { taskPermissions, type TaskRole } from "../../../config/tasksPermissions";
import { useTasks } from "../../../hooks/useTasks";

type View = "boards" | "tasks";

export default function TasksPage({ role }: { role: TaskRole }) {
    const perms = taskPermissions[role];
    const client = useMemo(() => dataClient(), []);
    const { workspaceId, tenantId, userId, email } = useWorkspace();
    const location = useLocation();
    const { confirm, alert } = useConfirm();

    const {
        boards,
        tasks,
        members,
        profiles,
        organizations,
        reload,
        loading,
    } = useTasks({ workspaceId, tenantId });

    const [view, setView] = useState<View>("boards");
    const [selectedBoard, setSelectedBoard] = useState<any>(null);

    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [createTaskBoard, setCreateTaskBoard] = useState<any>(null);
    const [editTask, setEditTask] = useState<any>(null);
    const [requestDeleteTask, setRequestDeleteTask] = useState<any>(null);

    const [mySub, setMySub] = useState<string | null>(null);

    useEffect(() => {
        if (userId) {
            setMySub(userId);
            return;
        }
        (async () => {
            try {
                const session = await fetchAuthSession();
                const sub = session.tokens?.accessToken?.payload?.sub as string | undefined;
                if (sub) setMySub(sub);
            } catch {
                /* ignore */
            }
        })();
    }, [userId]);

    const showAssignedIndicators = useMemo(() => {
        const search = location.search || window.location.search || "";
        return new URLSearchParams(search).get("assigned") === "me";
    }, [location.search]);

    useEffect(() => {
        if (!showAssignedIndicators) return;
        setSelectedBoard(null);
        setView("boards");
    }, [showAssignedIndicators]);

    function orgName(id: string) {
        return organizations.find((o: any) => o.id === id)?.name || "—";
    }

    function profileEmail(userSub: string) {
        return profiles.find((p: any) => p.userId === userSub)?.email || userSub;
    }

    const myEmail = useMemo(() => {
        if (email) return email;
        if (!mySub) return null;
        return profiles.find((p: any) => p.userId === mySub)?.email || null;
    }, [profiles, mySub, email]);

    const assigneeId = userId || mySub || null;
    const assigneeEmail = email || myEmail || null;

    function canDeleteTask(task: any) {
        if (perms.canDeleteAnyTask) return true;
        return task.createdBy === mySub;
    }

    async function deleteTask(task: any) {
        if (
            !(await confirm({
                title: "Delete Task",
                message: `Delete task "${task.title}"?`,
                confirmLabel: "Delete",
                variant: "danger",
            }))
        )
            return;

        try {
            await client.models.Task.delete({ id: task.id });
            reload();
        } catch (err) {
            console.error(err);
            await alert({
                title: "Error",
                message: "Error deleting task",
                variant: "danger",
            });
        }
    }

    async function deleteBoard(board: any) {
        if (!perms.canDeleteBoard) return;

        if (
            !(await confirm({
                title: "Delete Board",
                message: `Delete board "${board.name}"?`,
                confirmLabel: "Delete",
                variant: "danger",
            }))
        )
            return;

        try {
            await client.models.TaskBoard.delete({ id: board.id });
            reload();
        } catch (err) {
            console.error(err);
            await alert({
                title: "Error",
                message: "Error deleting board",
                variant: "danger",
            });
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
        ? tasks.filter((t: any) => t.taskBoardId === selectedBoard.id)
        : [];


    const boardMembers = selectedBoard
        ? members.filter((m: any) => m.workspaceId === selectedBoard.workspaceId)
        : members;



    if (loading) return <div style={{ padding: 20 }}>Loading tasks...</div>;



    return (
        <div>
            <div className="page-title">Tasks</div>

            {/* ───────── BOARDS VIEW ───────── */}
            {view === "boards" && (
                <>
                    {perms.canCreateBoard && (
                        <button
                            className="btn"
                            style={{ marginBottom: 20 }}
                            onClick={() => setShowCreateBoard(true)}
                        >
                            + Create Board
                        </button>
                    )}

                    {showCreateBoard && (
                        <CreateTaskBoardModal
                            organizations={organizations}
                            tenantId={tenantId}
                            onClose={() => setShowCreateBoard(false)}
                            onCreated={() => {
                                setShowCreateBoard(false);
                                reload();
                            }}
                        />
                    )}

                    <table className="table">
                        <thead>
                            <tr>
                                <th>Board Name</th>
                                <th>Workspace</th>
                                <th>Tasks</th>
                                <th>Created</th>
                                {perms.canDeleteBoard && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {boards.map((b: any) => {
                                const count = tasks.filter(
                                    (t: any) => t.taskBoardId === b.id
                                ).length;
                                const assignedCount = showAssignedIndicators && (assigneeId || assigneeEmail)
                                    ? tasks.filter(
                                        (t: any) =>
                                            t.taskBoardId === b.id &&
                                            (t.assignedTo === assigneeId || (assigneeEmail && t.assignedTo === assigneeEmail)) &&
                                            t.status !== "DONE" &&
                                            t.status !== "ARCHIVED"
                                    ).length
                                    : 0;
                                return (
                                    <tr key={b.id}>
                                        <td>
                                            <button
                                                className="breadcrumb-link"
                                                onClick={() => openBoard(b)}
                                            >
                                                {b.name}
                                            </button>
                                            {assignedCount >= 1 && (
                                                <span className="pill-badge amber" style={{ marginLeft: 8 }}>
                                                    Assigned
                                                </span>
                                            )}
                                        </td>
                                        <td>{orgName(b.workspaceId)}</td>
                                        <td>{count}</td>
                                        <td>
                                            {b.createdAt
                                                ? new Date(b.createdAt).toLocaleDateString()
                                                : "—"}
                                        </td>

                                        {perms.canDeleteBoard && (
                                            <td>
                                                <button
                                                    className="btn-table danger"
                                                    onClick={() => deleteBoard(b)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}

                            {boards.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8" }}>
                                        No boards yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </>
            )}

            {/* ───────── TASKS VIEW ───────── */}
            {view === "tasks" && selectedBoard && (
                <>
                    <button className="btn secondary" onClick={backToBoards}>
                        ← Back to Boards
                    </button>

                    <h3 style={{ marginTop: 12 }}>{selectedBoard.name}</h3>

                    <button
                        className="btn"
                        style={{ margin: "16px 0" }}
                        onClick={() => setCreateTaskBoard(selectedBoard)}
                    >
                        + Create Task
                    </button>

                    {createTaskBoard && (
                        <CreateTaskModal
                            board={createTaskBoard}
                            members={boardMembers}
                            onClose={() => setCreateTaskBoard(null)}
                            onCreated={() => {
                                setCreateTaskBoard(null);
                                reload();
                            }}
                        />
                    )}

                    {editTask && (
                        <EditTaskModal
                            task={editTask}
                            members={boardMembers}
                            onClose={() => setEditTask(null)}
                            onUpdated={() => {
                                setEditTask(null);
                                reload();
                            }}
                        />
                    )}

                    {requestDeleteTask && (
                        <RequestTaskDeleteModal
                            task={requestDeleteTask}
                            profiles={profiles}
                            onClose={() => setRequestDeleteTask(null)}
                            onRequested={() => {
                                setRequestDeleteTask(null);
                                reload();
                            }}
                        />
                    )}

                    <table className="table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Assigned</th>
                                <th>Due</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {boardTasks.map((t: any) => (
                                <tr key={t.id}>
                                    <td>
                                        <button
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "#2563eb",
                                                cursor: "pointer",
                                                fontWeight: 500,
                                                padding: 0,
                                                fontSize: 14
                                            }}
                                            onClick={() => setEditTask(t)}
                                        >
                                            {t.title}
                                        </button>
                                    </td>
                                    <td>{t.status}</td>
                                    <td>{t.priority}</td>
                                    <td>
                                        {t.assignedTo
                                            ? displayName(profileEmail(t.assignedTo))
                                            : "—"}
                                    </td>
                                    <td>
                                        {t.dueDate
                                            ? new Date(t.dueDate).toLocaleDateString()
                                            : "—"}
                                    </td>
                                    <td>
                                        <button
                                            className="btn secondary"
                                            style={{ marginRight: 8 }}
                                            onClick={() => setEditTask(t)}
                                        >
                                            Edit
                                        </button>

                                        {canDeleteTask(t) ? (
                                            <button
                                                className="btn secondary"
                                                onClick={() => deleteTask(t)}
                                            >
                                                Delete
                                            </button>
                                        ) : (
                                            <button
                                                className="btn secondary"
                                                onClick={() => setRequestDeleteTask(t)}
                                            >
                                                Request Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {boardTasks.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>
                                        No tasks yet
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
