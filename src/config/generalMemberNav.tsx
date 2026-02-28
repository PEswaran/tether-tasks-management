import { LayoutDashboard, Kanban, Users } from "lucide-react";

export const generalMemberNav = [
    {
        label: "Control Center",
        path: "/general",
        icon: <LayoutDashboard size={18} />,
        section: "Overview",
    },
    {
        label: "Taskboards",
        path: "/general/tasks",
        icon: <Kanban size={18} />,
        section: "Explore",
    },
    {
        label: "Members",
        path: "/general/members",
        icon: <Users size={18} />,
        section: "Explore",
    },
];
