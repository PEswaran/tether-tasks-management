import { BarChart3, Building2, LayoutDashboard, Shield, Users } from "lucide-react";

export const platformNav = [
  {
    label: "Dashboard",
    path: "/super",
    icon: <LayoutDashboard size={18} />
  },
  {
    label: "Companies",
    path: "/super/tenants",
    icon: <Building2 size={18} />
  },
  {
    label: "User Directory",
    path: "/super/user-directory",
    icon: <Users size={18} />
  },
  {
    label: "Audit Logs",
    path: "/super/audit",
    icon: <Shield size={18} />,
    section: "Insights"
  },
  {
    label: "Analytics",
    path: "/super/analytics",
    icon: <BarChart3 size={18} />,
    section: "Insights"
  }
];
