import { BarChart3, Building2, LayoutDashboard, Shield, } from "lucide-react";

export const platformNav = [
  {
    label: "Dashboard",
    path: "/super",
    icon: <LayoutDashboard size={18} />
  },
  {
    label: "Tenants",
    path: "/super/tenants",
    icon: <Building2 size={18} />
  },
  {
    label: "Audit Logs",
    path: "/super/audit",
    icon: <Shield size={18} />
  },
  {
    label: "Analytics",
    path: "/super/analytics",
    icon: <BarChart3 size={18} />
  }
];
