import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import NotificationBell from "../components/ui/notification-bell";
import { useWorkspace } from "../shared-components/workspace-context";
import { useEffect, useState } from "react";
import { dataClient } from "../libs/data-client";
import { getCurrentUser } from "aws-amplify/auth";
import GlobalCreateTaskBtn from "../components/ui/global-create-task-btn";

type NavItem = {
    label: string;
    path: string;
    icon?: any;
    parent?: string;
    section?: string;
};

export default function AppShell({
    companyName,
    navItems,
}: {
    companyName?: string;
    navItems: NavItem[];
}) {
    const navigate = useNavigate();
    const location = useLocation();

    const {
        role,
        memberships,
        tenantName,
        tenantId,
        workspaceId,
        switchTenant,
    } = useWorkspace();

    const displayName = tenantName || companyName || "TetherTasks";

    const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
    const [companyOpen, setCompanyOpen] = useState(false);

    const client = dataClient();

    /* ---------------- LOAD TENANT NAMES FOR ALL ROLES ---------------- */
    useEffect(() => {
        if (!memberships.length) return;

        const ids = [...new Set(memberships.map((m: any) => m.tenantId).filter(Boolean))];

        Promise.all(ids.map(id => client.models.Tenant.get({ id })))
            .then(results => {
                const map: Record<string, string> = {};
                results.forEach((r: any) => {
                    if (r?.data?.id) {
                        map[r.data.id] = r.data.companyName || r.data.id;
                    }
                });
                setTenantNames(map);
            });

    }, [memberships]);

    /* ---------------- BUILD TENANT LIST ---------------- */
    const tenantIds = [...new Set(memberships.map((m: any) => m.tenantId).filter(Boolean))];

    const tenants = tenantIds.map((tid: string) => {
        const mem = memberships.find((m: any) => m.tenantId === tid);
        return {
            id: tid,
            name: tenantNames[tid] || "Loading...",
            role: mem?.role || "MEMBER"
        };
    });

    /* ---------------- ROLE SHELL PROTECTION ---------------- */
    useEffect(() => {
        if (!role) return;

        if (role === "OWNER" && !location.pathname.startsWith("/owner")) {
            navigate("/owner");
        }
        if (role === "TENANT_ADMIN" && !location.pathname.startsWith("/tenant")) {
            navigate("/tenant");
        }
        if (role === "MEMBER" && !location.pathname.startsWith("/member")) {
            navigate("/member");
        }
    }, [role]);

    /* ---------------- USER PROFILE ---------------- */
    const [userEmail, setUserEmail] = useState("");
    const [userName, setUserName] = useState("");

    useEffect(() => {
        loadUser();
    }, []);

    async function loadUser() {
        try {
            const user = await getCurrentUser();
            const sub = user.userId;

            const prof = await client.models.UserProfile.list({
                filter: { userId: { eq: sub } }
            });

            if (prof.data?.length) {
                setUserEmail(prof.data[0].email || "");
                setUserName(prof.data[0].firstName || prof.data[0].email || "");
                return;
            }

            setUserEmail(user.username);
            setUserName(user.username);
        } catch (err: any) {
            if (err?.name === "UserUnAuthenticatedException") return;
            console.error("notif init error", err);

        }
    }

    /* ---------------- SIDEBAR COLLAPSE ---------------- */
    const [collapsed, setCollapsed] = useState(
        localStorage.getItem("sidebarCollapsed") === "true"
    );

    useEffect(() => {
        localStorage.setItem("sidebarCollapsed", String(collapsed));
    }, [collapsed]);

    const [profileOpen, setProfileOpen] = useState(false);

    /* ---------------- UI ---------------- */
    return (
        <div className="app-shell">

            {/* SIDEBAR */}
            <aside className={`app-sidebar ${collapsed ? "collapsed" : ""}`}>
                <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                </button>

                <div className="app-brand">
                    <div className="app-logo-tile" onClick={() => navigate("/")}>
                        <img src="/logo.png" className="app-logo" />
                    </div>

                    {!collapsed && (
                        <div className="brand-text">
                            <div className="app-company">{displayName}</div>
                            <div className={`role-badge`}>
                                {role?.replaceAll("_", " ") || "User"}
                            </div>
                        </div>
                    )}
                </div>

                <nav className="app-nav">
                    {navItems.map((n) => (
                        <Link
                            key={n.path}
                            to={n.path}
                            className={location.pathname === n.path ? "active" : ""}
                        >
                            {n.icon && <span className="nav-icon">{n.icon}</span>}
                            {!collapsed && n.label}
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <button
                        onClick={async () => {
                            await signOut();
                            navigate("/");
                        }}
                        className="app-signout"
                    >
                        <span className="nav-icon">
                            <LogOut size={16} />
                        </span>
                        {!collapsed && "Sign out"}
                    </button>
                </div>
            </aside>

            {/* MAIN */}
            <main className="app-main">

                {/* TOPBAR */}
                <div className="app-topbar">

                    {/* 🔥 ELITE COMPANY SWITCHER */}
                    <div className="top-left">
                        {tenants.length > 1 && (
                            <div className="company-switch-wrap">

                                <div
                                    className="company-switch"
                                    onClick={() => setCompanyOpen(v => !v)}
                                >
                                    <div className="company-avatar">
                                        {(tenantName || "C")[0]?.toUpperCase()}
                                    </div>

                                    <div className="company-meta">
                                        <div className="company-name">
                                            {tenantName || "Company"}
                                        </div>
                                        <div className="company-role">
                                            {role?.replaceAll("_", " ")}
                                        </div>
                                    </div>

                                    <div className="company-caret">▾</div>
                                </div>

                                {companyOpen && (
                                    <div className="company-dropdown">
                                        {tenants.map((t: any) => {
                                            const active = t.id === tenantId;

                                            return (
                                                <div
                                                    key={t.id}
                                                    className={`company-option ${active ? "active" : ""}`}
                                                    onClick={() => {
                                                        setCompanyOpen(false);
                                                        switchTenant(t.id);
                                                    }}
                                                >
                                                    <div className="company-avatar small">
                                                        {t.name?.[0]?.toUpperCase()}
                                                    </div>

                                                    <div className="company-meta">
                                                        <div className="company-name">{t.name}</div>
                                                        <div className="company-role">
                                                            {t.role?.replaceAll("_", " ")}
                                                        </div>
                                                    </div>

                                                    {active && <div className="company-check">✓</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="top-right">
                        <NotificationBell />

                        <div className="profile-wrap">
                            <div
                                className="app-user clickable"
                                onClick={() => setProfileOpen(!profileOpen)}
                            >
                                {(userName || userEmail)?.[0]?.toUpperCase() || "U"}
                            </div>

                            {profileOpen && (
                                <div className="profile-menu">
                                    <div className="profile-email">{userName || userEmail}</div>
                                    <div className="profile-role">{role}</div>

                                    <div
                                        className="profile-item danger"
                                        onClick={async () => {
                                            await signOut();
                                            navigate("/");
                                        }}
                                    >
                                        Sign out
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="app-content">
                    <Outlet key={`${tenantId || "no-tenant"}:${workspaceId || "no-workspace"}`} />
                </div>

                <GlobalCreateTaskBtn />
            </main>
        </div>
    );
}
