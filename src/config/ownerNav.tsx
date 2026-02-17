import {
    LayoutDashboard,
    Users,
    CheckSquare,
    FolderKanban
} from "lucide-react";

export const ownerNav = [
    {
        label: "Dashboard",
        path: "/app",
        icon: <LayoutDashboard size={18} />
    },
    {
        label: "Members",
        path: "/app/members",
        icon: <Users size={18} />
    },
    {
        label: "Workspaces",
        path: "/app/tasks",
        icon: <FolderKanban size={18} />
    },
    {
        label: "Tasks",
        path: "/app/tasks",
        icon: <CheckSquare size={18} />
    }
];
