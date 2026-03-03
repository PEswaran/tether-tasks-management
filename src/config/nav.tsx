import { Bell, LayoutDashboard, Users, Kanban, UserCheck, Compass } from "lucide-react";

export const ownerNav = [
    {
        label: "Workspace Hub",
        path: "/general",
        icon: <Compass size={18} />
    },
    {
        label: "My Dashboard",
        path: "/owner",
        icon: <LayoutDashboard size={18} />
    },
    {
        label: "My Tasks",
        path: "/owner/my-tasks",
        icon: <UserCheck size={18} />
    },
    {
        label: "Task Boards",
        path: "/owner/boards",
        icon: <Kanban size={18} />,
        parent: "/owner/workspaces",
        section: "Manage"
    },
    {
        label: "Notifications",
        path: "/owner/notifications",
        icon: <Bell size={18} />,
        section: "Manage"
    },
    {
        label: "Members",
        path: "/owner/members",
        icon: <Users size={18} />,
        section: "Manage"
    },
];

export const memberNav = [
    { label: "Workspace Hub", path: "/general", icon: <Compass size={18} /> },
    { label: "My Dashboard", path: "/member", icon: <LayoutDashboard size={18} /> },
    { label: "My Tasks", path: "/member/my-tasks", icon: <UserCheck size={18} /> },
    { label: "Notifications", path: "/member/notifications", icon: <Bell size={18} /> },
    { label: "Team Members", path: "/member/members", icon: <Users size={18} /> },
];
