import { Bell, Kanban, Users, UserCheck, Compass } from "lucide-react";

export const generalMemberNav = [
    {
        label: "Workspace Hub",
        path: "/general",
        icon: <Compass size={18} />,
        section: "Overview",
    },
    {
        label: "Notifications",
        path: "/general/notifications",
        icon: <Bell size={18} />,
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
