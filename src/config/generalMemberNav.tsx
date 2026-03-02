import { LayoutDashboard, Kanban, Users, UserCheck } from "lucide-react";

export const generalMemberNav = [
    {
        label: "Control Center",
        path: "/general",
        icon: <LayoutDashboard size={18} />,
        section: "Overview",
    },
    {
        label: "My Tasks",
        path: "/general/my-tasks",
        icon: <UserCheck size={18} />,
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
