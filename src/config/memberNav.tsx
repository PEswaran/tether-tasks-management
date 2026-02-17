import {
    LayoutDashboard,
    CheckSquare,
    Users
} from "lucide-react";

export const memberNav = [
    {
        label: "Dashboard",
        path: "/member",
        icon: <LayoutDashboard size={18} />
    },
    {
        label: "Tasks",
        path: "/member/tasks",
        icon: <CheckSquare size={18} />
    },
    {
        label: "Members",
        path: "/member/members",
        icon: <Users size={18} />
    }
];
