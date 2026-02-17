import { LayoutDashboard, Users, CheckSquare, Kanban, Building2 } from "lucide-react";

export const platformNav = [
    { label: "Tenants", path: "/super/tenants" },
    { label: "Billing", path: "/super/billing" },
    { label: "Audit", path: "/super/audit" },
];

export const ownerNav = [
    {
        label: "Dashboard",
        path: "/owner",
        icon: <LayoutDashboard size={18} />
    },
    {
        label: "Workspaces",
        path: "/owner/workspaces",
        icon: <Building2 size={18} />
    },
    {
        label: "Task Boards",
        path: "/owner/boards",
        icon: <Kanban size={18} />
    },
    {
        label: "Members",
        path: "/owner/members",
        icon: <Users size={18} />
    },
    {
        label: "Tasks",
        path: "/owner/tasks",
        icon: <CheckSquare size={18} />
    },
];

export const memberNav = [
    { label: "Dashboard", path: "/member", icon: <LayoutDashboard size={18} /> },
    { label: "Tasks", path: "/member/tasks", icon: <CheckSquare size={18} /> },
    { label: "Members", path: "/member/members", icon: <Users size={18} /> },
];
