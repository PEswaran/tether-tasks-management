import {
    LayoutDashboard,
    Users,
    FolderKanban,
    CheckSquare,
    Shield
} from "lucide-react";

export const tenantAdminNav = [
    {
        label: "Dashboard",
        path: "/tenant",
        icon: <LayoutDashboard size={18} />
    },
    {
        label: "Workspaces",
        path: "/tenant/organizations",
        icon: <FolderKanban size={18} />
    },
    {
        label: "Members",
        path: "/tenant/members",
        icon: <Users size={18} />
    },
    {
        label: "Tasks",
        path: "/tenant/tasks",
        icon: <CheckSquare size={18} />
    },
    {
        label: "Audit",
        path: "/tenant/audit",
        icon: <Shield size={18} />
    }
];
