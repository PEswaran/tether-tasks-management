import { useState } from "react";
import { dataClient } from "../../../libs/data-client";
import type { Schema } from "../../../../amplify/data/resource";
import { displayName } from "../../../libs/displayName";
import { useConfirm } from "../../../shared-components/confirm-context";


export default function EditTaskModal({ task, members, onClose, onUpdated }: any) {
    const client = dataClient();
    const { alert } = useConfirm();

    // 🔥 use schema types (prevents string enum bugs)
    type TaskStatus = NonNullable<Schema["Task"]["type"]["status"]>;
    type TaskPriority = NonNullable<Schema["Task"]["type"]["priority"]>;

    const [title, setTitle] = useState(task.title || "");
    const [description, setDescription] = useState(task.description || "");
    const [status, setStatus] = useState<TaskStatus>(task.status ?? "TODO");
    const [priority, setPriority] = useState<TaskPriority>(task.priority ?? "MEDIUM");
    const [assignedTo, setAssignedTo] = useState(task.assignedTo || "");
    const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split("T")[0] : "");
    const [loading, setLoading] = useState(false);

    async function saveTask() {
        if (!title) {
            await alert({ title: "Missing Title", message: "Enter a task title", variant: "warning" });
            return;
        }

        setLoading(true);

        try {
            const updatePayload: any = {
                id: task.id,
                title,
                description: description || undefined,
                status,
                priority,
                assignedTo: assignedTo || undefined,
                dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
                updatedAt: new Date().toISOString(),
            };

            if (status === "DONE" && task.status !== "DONE") {
                updatePayload.completedAt = new Date().toISOString();
            }

            await client.models.Task.update(updatePayload);

            onUpdated();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error updating task", variant: "danger" });
        }

        setLoading(false);
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">

                {/* HEADER */}
                <div className="modal-header">
                    <h2>Edit Task</h2>
                </div>
                {task?.fromNotification && (
                    <div className="notif-open-banner">
                        Opened from notification
                    </div>
                )}


                {/* FORM */}
                <div className="modal-form">

                    <label>Task title</label>
                    <input
                        placeholder="Enter task title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <div className="created-by-box">
                        <div className="created-by-label">Created By</div>
                        <div className="created-by-value">
                            {displayName(task._createdByEmail) || "Unknown"}
                            <span className="created-by-role">
                                {task._createdByRole || ""}
                            </span>
                        </div>
                    </div>


                    <label>Description</label>
                    <textarea
                        placeholder="Optional description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <div className="modal-row">
                        <div>
                            <label>Status</label>
                            <select
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
                            <label>Priority</label>
                            <select
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


                    <label>Assign To</label>
                    <select
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                    >
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

                {/* FOOTER */}
                <div className="modal-footer">
                    <button className="btn" onClick={saveTask} disabled={loading}>
                        {loading ? "Saving..." : "Save Changes"}
                    </button>

                    <button className="btn secondary" onClick={onClose}>
                        Cancel
                    </button>
                </div>

            </div>
        </div>
    );
}
