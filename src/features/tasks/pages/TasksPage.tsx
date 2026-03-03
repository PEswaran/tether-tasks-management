import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { useConfirm } from "../../../shared-components/confirm-context";
import { displayName } from "../../../libs/displayName";
import { dataClient } from "../../../libs/data-client";
import { ListTodo, AlertTriangle, CalendarClock, Clock, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import CreateTaskBoardModal from "../../../components/shared/modals/create-task-board-modal";
import CreateTaskModal from "../../../components/shared/modals/create-task-modal";
import EditTaskModal from "../../../components/shared/modals/edit-task-modal";
import RequestTaskDeleteModal from "../../../components/shared/modals/request-task-delete";
import { taskPermissions, type TaskRole } from "../../../config/tasksPermissions";
import { useTasks } from "../../../hooks/useTasks";
import { logAudit } from "../../../libs/audit";

type View = "boards" | "tasks";

export default function TasksPage({ role, assignedToMe }: { role: TaskRole; assignedToMe?: boolean }) {
    const perms = taskPermissions[role];
    const client = useMemo(() => dataClient(), []);
    const { workspaceId, organizationId, tenantId, userId, email, organizations, setOrganizationId } = useWorkspace();
    const location = useLocation();
    const navigate = useNavigate();
    const { confirm, alert } = useConfirm();

    const {
        boards,
        tasks,
        members,
        profiles,
        organizations: workspaces,
        reload,
        loading,
    } = useTasks({
        workspaceId,
        organizationId,
        tenantId,
        scope: role === "TENANT_ADMIN" ? (organizationId ? "organization" : "tenant") : "workspace",
    });

    const [view, setView] = useState<View>("boards");
    const [selectedBoard, setSelectedBoard] = useState<any>(null);
    const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [createTaskBoard, setCreateTaskBoard] = useState<any>(null);
    const [editTask, setEditTask] = useState<any>(null);
    const [requestDeleteTask, setRequestDeleteTask] = useState<any>(null);

    const [sortKey, setSortKey] = useState<"status" | "priority" | "dueDate" | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
        if (assignedToMe) return true;
        const search = location.search || window.location.search || "";
        return new URLSearchParams(search).get("assigned") === "me";
    }, [location.search, assignedToMe]);

    useEffect(() => {
        if (!showAssignedIndicators) return;
        setSelectedBoard(null);
        setView("boards");
    }, [showAssignedIndicators]);

    useEffect(() => {
        const search = location.search || window.location.search || "";
        const params = new URLSearchParams(search);
        const taskId = params.get("task");
        const explicitBoardId = params.get("board");
        const derivedBoardId = taskId ? tasks.find((t: any) => t.id === taskId)?.taskBoardId : null;
        const boardId = explicitBoardId || derivedBoardId || null;

        if (!taskId && !boardId) {
            setFocusTaskId(null);
            return;
        }

        if (taskId) setFocusTaskId(taskId);

        if (!boardId) return;
        const board = boards.find((b: any) => b.id === boardId);
        if (!board) return;
        setSelectedBoard(board);
        setView("tasks");
    }, [location.search, boards, tasks]);

    useEffect(() => {
        if (!focusTaskId || view !== "tasks") return;
        const row = document.getElementById(`task-row-${focusTaskId}`);
        if (!row) return;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [focusTaskId, view, selectedBoard, tasks]);

    function workspaceName(id: string) {
        return workspaces.find((o: any) => o.id === id)?.name || "—";
    }

    function organizationName(id: string) {
        return organizations.find((o: any) => o.id === id)?.name || "—";
    }


    function localTodayStr() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function profileFullName(userSub: string) {
        const prof = profiles.find((p: any) => p.userId === userSub);
        if (!prof) return displayName(userSub);
        const first = prof.firstName?.trim() || "";
        const last = prof.lastName?.trim() || "";
        if (first || last) return `${first} ${last}`.trim();
        return displayName(prof.email);
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
            logAudit({
                tenantId,
                organizationId,
                workspaceId,
                action: "DELETE",
                resourceType: "Task",
                resourceId: task.id,
                userId: mySub || undefined,
                metadata: { title: task.title },
            });
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
            logAudit({
                tenantId,
                organizationId,
                workspaceId,
                action: "DELETE",
                resourceType: "TaskBoard",
                resourceId: board.id,
                userId: mySub || undefined,
                metadata: { name: board.name },
            });
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

    const STATUS_ORDER: Record<string, number> = { TODO: 0, IN_PROGRESS: 1, DONE: 2, ARCHIVED: 3 };
    const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

    function toggleSort(key: "status" | "priority" | "dueDate") {
        if (sortKey === key) {
            setSortDir(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    }

    const boardTasksRaw = selectedBoard
        ? tasks.filter((t: any) => t.taskBoardId === selectedBoard.id)
        : [];

    const boardTasks = useMemo(() => {
        if (!sortKey) return boardTasksRaw;
        const sorted = [...boardTasksRaw].sort((a: any, b: any) => {
            let cmp = 0;
            if (sortKey === "status") {
                cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
            } else if (sortKey === "priority") {
                cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
            } else if (sortKey === "dueDate") {
                const aDate = a.dueDate || "";
                const bDate = b.dueDate || "";
                if (!aDate && !bDate) cmp = 0;
                else if (!aDate) cmp = 1;
                else if (!bDate) cmp = -1;
                else cmp = aDate.localeCompare(bDate);
            }
            return sortDir === "desc" ? -cmp : cmp;
        });
        return sorted;
    }, [boardTasksRaw, sortKey, sortDir]);

    const tasksInCurrentScope = view === "tasks" && selectedBoard ? boardTasks : tasks;
    const boardCount = boards.length;
    const activeBoardCount = boards.filter((b: any) => b.isActive !== false).length;
    const openTaskCount = tasksInCurrentScope.filter(
        (t: any) => t.status !== "DONE" && t.status !== "ARCHIVED"
    ).length;
    const doneTaskCount = tasksInCurrentScope.filter((t: any) => t.status === "DONE").length;
    const assignedToMeCount = tasksInCurrentScope.filter(
        (t: any) =>
            Boolean(t.assignedTo) &&
            (t.assignedTo === assigneeId || (assigneeEmail && t.assignedTo === assigneeEmail))
    ).length;

    // Urgency metrics for "My Tasks" view
    const myOpenTasks = useMemo(() => {
        if (!assignedToMe) return [];
        return tasksInCurrentScope.filter(
            (t: any) =>
                t.status !== "DONE" && t.status !== "ARCHIVED" &&
                Boolean(t.assignedTo) &&
                (t.assignedTo === assigneeId || (assigneeEmail && t.assignedTo === assigneeEmail))
        );
    }, [tasksInCurrentScope, assignedToMe, assigneeId, assigneeEmail]);

    const urgency = useMemo(() => {
        if (!assignedToMe) return { overdue: 0, dueToday: 0, dueSoon: 0, open: 0 };
        const today = localTodayStr();
        const soon = new Date();
        soon.setDate(soon.getDate() + 3);
        const soonStr = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;

        let overdue = 0, dueToday = 0, dueSoon = 0;
        for (const t of myOpenTasks) {
            if (!t.dueDate) continue;
            const d = t.dueDate.split("T")[0];
            if (d < today) overdue++;
            else if (d === today) dueToday++;
            else if (d <= soonStr) dueSoon++;
        }
        return { overdue, dueToday, dueSoon, open: myOpenTasks.length };
    }, [myOpenTasks, assignedToMe]);


    if (loading) return <div style={{ padding: 20 }}>Loading tasks...</div>;

    const orgLabel = selectedBoard?.organizationId
        ? organizationName(selectedBoard.organizationId)
        : organizationId
            ? organizationName(organizationId)
            : null;

    const dashboardPath =
        role === "TENANT_ADMIN"
            ? "/tenant"
            : role === "OWNER"
                ? "/owner"
                : "/member";



    return (
        <div>
            {orgLabel && (
                <div className="breadcrumb">
                    <span className="crumb clickable" onClick={() => navigate(dashboardPath)}>
                        Dashboard
                    </span>
                    <span className="crumb-sep">/</span>
                    <span className="crumb workspace">{orgLabel}</span>
                    <span className="crumb-sep">/</span>
                    <span className="crumb current">Task Boards</span>
                </div>
            )}
            <div className="page-title">{assignedToMe ? "My Tasks" : "Tasks"}</div>

            {view === "boards" && (
                <div className="tasks-page-controls">
                    {role === "TENANT_ADMIN" && organizations.length > 0 && (
                        <select
                            id="tasks-organization-select"
                            name="tasks_organization_select"
                            className="tasks-page-org-select"
                            value={organizationId || ""}
                            onChange={(e) => setOrganizationId(e.target.value || null)}
                        >
                            <option value="">Select organization</option>
                            {organizations.map((org: any) => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                    )}

                    {perms.canCreateBoard && (
                        <button
                            className="tasks-page-btn tasks-page-btn-primary"
                            onClick={() => setShowCreateBoard(true)}
                        >
                            + Create Board
                        </button>
                    )}

                    {role === "TENANT_ADMIN" && (
                        <button
                            className="tasks-page-btn tasks-page-btn-secondary"
                            onClick={() => navigate("/tenant/organizations")}
                        >
                            View Organizations
                        </button>
                    )}
                </div>
            )}

            {assignedToMe ? (
                <div className="tasks-metrics-grid">
                    <div className="tasks-metric-card">
                        <div className="tasks-metric-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                            <ListTodo size={18} />
                        </div>
                        <div className="tasks-metric-label">Open</div>
                        <div className="tasks-metric-value">{urgency.open}</div>
                        <div className="tasks-metric-meta">Assigned to me</div>
                    </div>
                    <div className={`tasks-metric-card${urgency.overdue > 0 ? " tasks-metric-danger" : ""}`}>
                        <div className="tasks-metric-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
                            <AlertTriangle size={18} />
                        </div>
                        <div className="tasks-metric-label">Overdue</div>
                        <div className="tasks-metric-value" style={urgency.overdue > 0 ? { color: "#dc2626" } : undefined}>
                            {urgency.overdue}
                        </div>
                        <div className="tasks-metric-meta">Past due date</div>
                    </div>
                    <div className={`tasks-metric-card${urgency.dueToday > 0 ? " tasks-metric-warn" : ""}`}>
                        <div className="tasks-metric-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>
                            <CalendarClock size={18} />
                        </div>
                        <div className="tasks-metric-label">Due Today</div>
                        <div className="tasks-metric-value" style={urgency.dueToday > 0 ? { color: "#ea580c" } : undefined}>
                            {urgency.dueToday}
                        </div>
                        <div className="tasks-metric-meta">Needs attention</div>
                    </div>
                    <div className="tasks-metric-card">
                        <div className="tasks-metric-icon" style={{ background: "#fefce8", color: "#ca8a04" }}>
                            <Clock size={18} />
                        </div>
                        <div className="tasks-metric-label">Due Soon</div>
                        <div className="tasks-metric-value">{urgency.dueSoon}</div>
                        <div className="tasks-metric-meta">Next 3 days</div>
                    </div>
                </div>
            ) : (
                <div className="tasks-metrics-grid">
                    <div className="tasks-metric-card">
                        <div className="tasks-metric-label">Taskboards</div>
                        <div className="tasks-metric-value">{boardCount}</div>
                        <div className="tasks-metric-meta">Active: {activeBoardCount}</div>
                    </div>
                    <div className="tasks-metric-card">
                        <div className="tasks-metric-label">Open Tasks</div>
                        <div className="tasks-metric-value">{openTaskCount}</div>
                        <div className="tasks-metric-meta">Current scope</div>
                    </div>
                    <div className="tasks-metric-card">
                        <div className="tasks-metric-label">Completed Tasks</div>
                        <div className="tasks-metric-value">{doneTaskCount}</div>
                        <div className="tasks-metric-meta">Current scope</div>
                    </div>
                    <div className="tasks-metric-card">
                        <div className="tasks-metric-label">Assigned to Me</div>
                        <div className="tasks-metric-value">{assignedToMeCount}</div>
                        <div className="tasks-metric-meta">Current scope</div>
                    </div>
                </div>
            )}

            {role === "TENANT_ADMIN" && organizations.length > 0 && view === "tasks" && (
                <div style={{ marginBottom: 16 }}>
                    <select
                        id="tasks-organization-select"
                        name="tasks_organization_select"
                        className="modal-select"
                        value={organizationId || ""}
                        onChange={(e) => setOrganizationId(e.target.value || null)}
                    >
                        <option value="">Select organization</option>
                        {organizations.map((org: any) => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* ───────── BOARDS VIEW ───────── */}
            {view === "boards" && (
                <>
                    {showCreateBoard && (
                        <CreateTaskBoardModal
                            workspaces={workspaces}
                            members={members}
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
                                const myBoardTasks = showAssignedIndicators && (assigneeId || assigneeEmail)
                                    ? tasks.filter(
                                        (t: any) =>
                                            t.taskBoardId === b.id &&
                                            (t.assignedTo === assigneeId || (assigneeEmail && t.assignedTo === assigneeEmail)) &&
                                            t.status !== "DONE" &&
                                            t.status !== "ARCHIVED"
                                    )
                                    : [];
                                const assignedCount = myBoardTasks.length;
                                const todayStr = localTodayStr();
                                const boardOverdue = myBoardTasks.filter(
                                    (t: any) => t.dueDate && t.dueDate.split("T")[0] < todayStr
                                ).length;
                                const boardDueToday = myBoardTasks.filter(
                                    (t: any) => t.dueDate && t.dueDate.split("T")[0] === todayStr
                                ).length;
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
                                                    {assignedCount} Assigned
                                                </span>
                                            )}
                                            {boardOverdue > 0 && (
                                                <span className="pill-badge red" style={{ marginLeft: 6 }}>
                                                    <AlertTriangle size={12} /> {boardOverdue} Overdue
                                                </span>
                                            )}
                                            {boardDueToday > 0 && (
                                                <span className="pill-badge amber" style={{ marginLeft: 6 }}>
                                                    <CalendarClock size={12} /> {boardDueToday} Due Today
                                                </span>
                                            )}
                                        </td>
                                        <td>{workspaceName(b.workspaceId)}</td>
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
                                <th className="th-sortable" onClick={() => toggleSort("status")}>
                                    Status
                                    {sortKey === "status"
                                        ? (sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
                                        : <ArrowUpDown size={13} className="sort-icon-idle" />}
                                </th>
                                <th className="th-sortable" onClick={() => toggleSort("priority")}>
                                    Priority
                                    {sortKey === "priority"
                                        ? (sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
                                        : <ArrowUpDown size={13} className="sort-icon-idle" />}
                                </th>
                                <th>Assigned</th>
                                <th className="th-sortable" onClick={() => toggleSort("dueDate")}>
                                    Due
                                    {sortKey === "dueDate"
                                        ? (sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
                                        : <ArrowUpDown size={13} className="sort-icon-idle" />}
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {boardTasks.map((t: any) => {
                                const assignedToMe =
                                    Boolean(t.assignedTo) &&
                                    (t.assignedTo === assigneeId || (assigneeEmail && t.assignedTo === assigneeEmail));
                                const todayStr = localTodayStr();
                                const dueDateStr = t.dueDate ? t.dueDate.split("T")[0] : null;
                                const isOpen = t.status !== "DONE" && t.status !== "ARCHIVED";
                                const isOverdue = isOpen && dueDateStr && dueDateStr < todayStr;
                                const isDueToday = isOpen && dueDateStr && dueDateStr === todayStr;
                                return (
                                    <tr
                                        key={t.id}
                                        id={`task-row-${t.id}`}
                                        className={focusTaskId === t.id ? "tasks-row-focus" : ""}
                                    >
                                        <td>
                                            {assignedToMe && (
                                                <span className="tasks-assigned-me-pill" title="Assigned to me" aria-label="Assigned to me">
                                                    Assigned
                                                </span>
                                            )}
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
                                                ? profileFullName(t.assignedTo)
                                                : "—"}
                                        </td>
                                        <td>
                                            {t.dueDate
                                                ? new Date(t.dueDate).toLocaleDateString("en-US", { timeZone: "UTC" })
                                                : "—"}
                                            {isOverdue && (
                                                <span className="pill-badge red" style={{ marginLeft: 6 }}>
                                                    <AlertTriangle size={12} /> Overdue
                                                </span>
                                            )}
                                            {isDueToday && (
                                                <span className="pill-badge amber" style={{ marginLeft: 6 }}>
                                                    <CalendarClock size={12} /> Due Today
                                                </span>
                                            )}
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
                                );
                            })}

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
