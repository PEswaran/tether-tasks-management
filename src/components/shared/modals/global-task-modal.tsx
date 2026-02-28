import { useEffect, useState } from "react";
import { useTaskModal } from "../../../pages/shared/stores/taskModalStore";
import { dataClient } from "../../../libs/data-client";
import EditTaskModal from "./edit-task-modal";

export default function GlobalTaskModal() {
    const { taskId, closeTask } = useTaskModal();
    const client = dataClient();

    const [task, setTask] = useState<any>(null);

    useEffect(() => {
        if (taskId) {
            loadTask(taskId);
        }
    }, [taskId]);

    async function loadTask(id: string) {
        try {
            const res = await client.models.Task.get({ id });
            if (!res.data) return;

            setTask({ ...res.data, fromNotification: true });
        } catch (err) {
            console.error("global modal load error", err);
        }
    }

    if (!taskId || !task) return null;

    return (
        <EditTaskModal
            task={task}
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
