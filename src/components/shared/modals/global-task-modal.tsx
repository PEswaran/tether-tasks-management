import { useEffect, useState } from "react";
import { useTaskModal } from "../../../pages/shared/stores/taskModalStore";
import { dataClient } from "../../../libs/data-client";
import EditTaskModal from "./edit-task-modal";

export default function GlobalTaskModal() {
    const { taskId, closeTask } = useTaskModal();
    const client = dataClient();

    const [task, setTask] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);

    useEffect(() => {
        if (taskId) {
            loadTask(taskId);
        }
    }, [taskId]);

    async function loadTask(id: string) {
        try {
            console.log("GLOBAL MODAL loading task:", id);

            const res = await client.models.Task.get({ id });
            if (!res.data) {
                console.log("task not found");
                return;
            }

            const t = res.data;
            setTask({ ...t, fromNotification: true });


            // load members for edit modal
            const memRes = await client.models.Membership.list({
                filter: { workspaceId: { eq: t.workspaceId } }
            });

            setMembers(memRes.data || []);
        } catch (err) {
            console.error("global modal load error", err);
        }
    }

    if (!taskId || !task) return null;

    return (
        <EditTaskModal
            task={task}
            members={members}
            onClose={() => {
                setTask(null);
                closeTask();
            }}
            onUpdated={() => {
                setTask(null);
                closeTask();
                window.dispatchEvent(new Event("taskUpdated"));
            }}
        />
    );
}
