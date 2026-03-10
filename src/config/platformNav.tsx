import { BarChart3, Bell, Building2, FlaskConical, LayoutDashboard, Shield, Users } from "lucide-react";

export const platformNav = [
  {
    label: "My Dashboard",
    path: "/super",
    icon: <LayoutDashboard size={18} />
  },
  {
    label: "Notifications",
    path: "/super/notifications",
    icon: <Bell size={18} />
  },
  {
    label: "Companies",
    path: "/super/tenants",
    icon: <Building2 size={18} />
  },
  {
    label: "Pilots",
    path: "/super/pilots",
    icon: <FlaskConical size={18} />
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
