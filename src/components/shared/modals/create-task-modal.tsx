import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { displayName } from "../../../libs/displayName";
import type { Schema } from "../../../../amplify/data/resource";
import { useConfirm } from "../../../shared-components/confirm-context";

interface CreateTaskModalProps {
    board: any;
    members: any[];
    defaultStatus?: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
    onClose: () => void;
    onCreated: () => void;
}

export default function CreateTaskModal({
    board,
    members,
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

                    <label>Task title</label>
                    <input
                        placeholder="Enter task title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    <label>Description</label>
                    <textarea
                        placeholder="Optional description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <div className="modal-row">
                        <div>
                            <label>Status</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                                <option value="TODO">To Do</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="DONE">Done</option>
                                <option value="ARCHIVED">Archived</option>
                            </select>
                        </div>

                        <div>
                            <label>Priority</label>
                            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                    </div>

                    <label>Assign To</label>
                    <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                        <option value="">Unassigned</option>
                        {members.map((m: any) => (
                            <option key={m.userSub} value={m.userSub}>
                                {m.firstName || m.lastName
                                    ? `${m.firstName || ""} ${m.lastName || ""}`.trim()
                                    : displayName(m.email || m.userSub)}
                            </option>
                        ))}
                    </select>

                    <label>Due Date</label>
                    <input
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
