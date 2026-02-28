import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { displayName } from "../../../libs/displayName";
import type { Schema } from "../../../../amplify/data/resource";
import { useConfirm } from "../../../shared-components/confirm-context";

interface CreateTaskModalProps {
    board: any;
    defaultStatus?: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
    onClose: () => void;
    onCreated: () => void;
}

export default function CreateTaskModal({
    board,
    defaultStatus,
    onClose,
    onCreated,
}: CreateTaskModalProps) {

    const client = dataClient();
    const { tenantId } = useWorkspace();
    const { alert } = useConfirm();

    // 🔥 Amplify schema types (single source of truth)
    type TaskStatus = NonNullable<Schema["Task"]["type"]["status"]>;
    type TaskPriority = NonNullable<Schema["Task"]["type"]["priority"]>;

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    // 🔥 sanitize null/undefined BEFORE state hits React select
    const initialStatus: TaskStatus =
        defaultStatus && defaultStatus !== null
            ? (defaultStatus as TaskStatus)
            : "TODO";

    const [status, setStatus] = useState<TaskStatus>(initialStatus);

    const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
    const [assignedTo, setAssignedTo] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [loading, setLoading] = useState(false);
    const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);

    /* ===============================
       LOAD WORKSPACE MEMBERS
       Memberships are stored at the organization level,
       so query by organizationId first, then fall back to workspaceId.
    =============================== */
    useEffect(() => {
        const activeTenantId = tenantId;
        if (!board?.workspaceId || !activeTenantId) return;

        async function loadMembers() {
            try {
                const memRes = board.organizationId
                    ? await client.models.Membership.listMembershipsByOrganization({ organizationId: board.organizationId })
                    : await client.models.Membership.listMembershipsByWorkspace({ workspaceId: board.workspaceId });

                const profRes = await client.models.UserProfile.list({ filter: { tenantId: { eq: activeTenantId ?? undefined } } });

                const profiles = profRes.data || [];
                const profileByUser = new Map(profiles.map((p: any) => [p.userId, p]));

                const active = (memRes.data || []).filter(
                    (m: any) => m.status === "ACTIVE" && m.role !== "TENANT_ADMIN"
                );

                const enriched = active.map((m: any) => ({
                    userSub: m.userSub,
                    workspaceId: m.workspaceId,
                    organizationId: m.organizationId,
                    role: m.role,
                    email: profileByUser.get(m.userSub)?.email || m.userSub,
                    firstName: profileByUser.get(m.userSub)?.firstName,
                    lastName: profileByUser.get(m.userSub)?.lastName,
                }));

                setWorkspaceMembers(enriched);

                // Default assign to board owner if they are a member
                if (board.ownerUserSub && enriched.some((m: any) => m.userSub === board.ownerUserSub)) {
                    setAssignedTo(board.ownerUserSub);
                }
            } catch (err) {
                console.error("Failed to load workspace members", err);
            }
        }

        loadMembers();
    }, [board?.workspaceId, board?.organizationId, board?.ownerUserSub, tenantId]);

    async function createTask() {

        if (!title) {
            await alert({ title: "Missing Title", message: "Enter a task title", variant: "warning" });
            return;
        }

        if (!tenantId) {
            await alert({ title: "Error", message: "Tenant not loaded yet", variant: "warning" });
            return;
        }

        setLoading(true);

        try {
            const session = await fetchAuthSession();
            const sub = session.tokens?.accessToken.payload.sub as string;

            /* ===============================
               CREATE TASK
            =============================== */
            const newTask = await client.models.Task.create({
                tenantId,
                organizationId: board.organizationId || undefined,
                workspaceId: board.workspaceId,
                taskBoardId: board.id,
                title,
                description: description || undefined,
                status,
                priority,
                ownerUserSub: sub,
                assignedTo: assignedTo || undefined,
                assignedBy: assignedTo ? sub : undefined,
                createdBy: sub,
                isActive: true,
                dueDate: dueDate
                    ? new Date(dueDate).toISOString()
                    : undefined,
                createdAt: new Date().toISOString(),
            });

            if (!newTask.data) {
                console.error("Task creation failed", newTask);
                await alert({ title: "Error", message: "Task failed to create", variant: "danger" });
                setLoading(false);
                return;
            }

            /* ===============================
               NOTIFICATIONS
            =============================== */
            if (assignedTo) {
                try {
                    await client.models.Notification.create({
                        tenantId,
                        organizationId: board.organizationId || undefined,
                        workspaceId: board.workspaceId,
                        recipientId: assignedTo,
                        senderId: sub,
                        type: "TASK_ASSIGNED",
                        title: "New Task Assigned",
                        message: `${title} was assigned to you`,
                        link: `/tasks/${newTask.data.id}`,
                        isRead: false,
                        createdAt: new Date().toISOString(),
                    });

                    await client.mutations.sendAssignmentEmail({
                        userSub: assignedTo,
                        type: "TASK",
                        itemName: title,
                        workspaceId: board.workspaceId,
                    });

                } catch (err) {
                    console.error("notification failed", err);
                }
            }

            onCreated();

        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error creating task", variant: "danger" });
        }

        setLoading(false);
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">

                <div className="modal-header">
                    <h2>Create Task</h2>
                    <p className="modal-sub">Board: {board.name}</p>
                </div>

                <div className="modal-form">

                    <label htmlFor="task-title">Task title</label>
                    <input
                        id="task-title"
                        name="task_title"
                        placeholder="Enter task title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    <label htmlFor="task-description">Description</label>
                    <textarea
                        id="task-description"
                        name="task_description"
                        placeholder="Optional description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <div className="modal-row">
                        <div>
                            <label htmlFor="task-status">Status</label>
                            <select
                                id="task-status"
                                name="task_status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                            >
                                <option value="TODO">To Do</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="DONE">Done</option>
                                <option value="ARCHIVED">Archived</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="task-priority">Priority</label>
                            <select
                                id="task-priority"
                                name="task_priority"
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                    </div>

                    <label htmlFor="task-assigned-to">Assign To</label>
                    <select
                        id="task-assigned-to"
                        name="task_assigned_to"
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                    >
                        <option value="">Unassigned</option>
                        {workspaceMembers.map((m: any) => (
                            <option key={m.userSub} value={m.userSub}>
                                {m.firstName || m.lastName
                                    ? `${m.firstName || ""} ${m.lastName || ""}`.trim()
                                    : displayName(m.email || m.userSub)}
                            </option>
                        ))}
                    </select>

                    <label htmlFor="task-due-date">Due Date</label>
                    <input
                        id="task-due-date"
                        name="task_due_date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                    />

                </div>

                <div className="modal-footer">
                    <button className="btn" onClick={createTask} disabled={loading}>
                        {loading ? "Creating..." : "Create Task"}
                    </button>

                    <button className="btn secondary" onClick={onClose}>
                        Cancel
                    </button>
                </div>


            </div>
        </div>

    );
}
