//Zustand is a tiny global state library for React.
//open a task modal from anywhere in the app
//(notifications, dashboard, boards, etc)

import { create } from "zustand";

interface TaskModalState {
    taskId: string | null;
    openTask: (id: string) => void;
    closeTask: () => void;
}

export const useTaskModal = create<TaskModalState>((set) => ({
    taskId: null,
    openTask: (id) => set({ taskId: id }),
    closeTask: () => set({ taskId: null }),
}));
