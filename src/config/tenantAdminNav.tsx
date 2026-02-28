import { Building2, Kanban, LayoutDashboard, Layers, Users } from "lucide-react";

export const tenantAdminNav = [
    {
        label: "Control Center",
        path: "/tenant",
        icon: <LayoutDashboard size={18} />,
        section: "Overview",
    },
    {
        label: "Organizations",
        path: "/tenant/organizations",
        icon: <Building2 size={18} />,
        section: "Management Controls",
    },
    {
        label: "Workspaces",
        path: "/tenant/workspaces",
        icon: <Layers size={18} />,
        section: "Management Controls",
    },
    {
        label: "User Directory",
        path: "/tenant/user-directory",
        icon: <Users size={18} />,
        section: "Management Controls",
    },
    {
        label: "Taskboards",
        path: "/tenant/tasks",
        icon: <Kanban size={18} />,
        section: "Management Controls",
    },
];
