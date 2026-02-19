import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import NotificationBell from "../shared-components/notification-bell";
import { useWorkspace } from "../shared-components/workspace-context";
import GlobalCreateTaskBtn from "../pages/shared/GlobalCreateTaskBtn";
import { useEffect, useState } from "react";
import { dataClient } from "../libs/data-client";
import { getCurrentUser } from "aws-amplify/auth";



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

    const { role, workspaceId, setWorkspaceId, workspaces, memberships, tenantName } = useWorkspace();
    const displayName = tenantName || companyName || "TetherTasks";

    // Build tenantId → companyName map for multi-tenant disambiguation
    const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
    const isMultiTenant = (() => {
        const tenantIds = new Set(
            memberships.filter((m: any) => m.role === "TENANT_ADMIN").map((m: any) => m.tenantId)
        );
        return tenantIds.size > 1;
    })();

    useEffect(() => {
        if (!isMultiTenant) return;
        const tenantIds = [...new Set(
            memberships.filter((m: any) => m.role === "TENANT_ADMIN").map((m: any) => m.tenantId)
        )];
        const clientRef = dataClient();
        Promise.all(tenantIds.map(tid => clientRef.models.Tenant.get({ id: tid }))).then(results => {
            const map: Record<string, string> = {};
            results.forEach((r: any) => {
                if (r?.data?.id && r?.data?.companyName) {
                    map[r.data.id] = r.data.companyName;
                }
            });
            setTenantNames(map);
        });
    }, [memberships, isMultiTenant]);

    /* ROLE COLOR */
    function roleColor() {
        if (!role) return "role-gray";
        if (role.includes("SUPER")) return "role-purple";
        if (role.includes("ADMIN")) return "role-blue";
        if (role === "OWNER") return "role-gold";
        return "role-gray";
    }
    const client = dataClient();
    const [userEmail, setUserEmail] = useState<string>("");
    const [userName, setUserName] = useState<string>("");

    useEffect(() => {
        loadUser();
    }, []);

    async function loadUser() {
        try {
            const user = await getCurrentUser();
            const sub = user.userId;

            // try profile table first (best)
            const prof = await client.models.UserProfile.list({
                filter: { userId: { eq: sub } }
            });

            if (prof.data?.length) {
                setUserEmail(prof.data[0].email || "");
                setUserName(prof.data[0].firstName || prof.data[0].email || "");
                return;
            }

            // fallback to cognito username
            setUserEmail(user.username);
            setUserName(user.username);

        } catch (err) {
            console.error("user load error", err);
        }
    }


    /* SIDEBAR COLLAPSE */
    const [collapsed, setCollapsed] = useState(
        localStorage.getItem("sidebarCollapsed") === "true"
    );

    useEffect(() => {
        localStorage.setItem("sidebarCollapsed", String(collapsed));
    }, [collapsed]);

    /* COMMAND PALETTE */
    const [cmdOpen, setCmdOpen] = useState(false);

    useEffect(() => {
        function handler(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setCmdOpen(v => !v);
            }
        }
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    /* PROFILE */
    const [profileOpen, setProfileOpen] = useState(false);
    return (
        <div className="app-shell">

            {/* SIDEBAR */}
            <aside className={`app-sidebar ${collapsed ? "collapsed" : ""}`}>

                {/* COLLAPSE TOGGLE */}
                <button
                    className="collapse-btn"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                </button>

                {/* BRAND */}
                <div className="app-brand">
                    <div className="app-logo-tile" onClick={() => navigate("/")}>
                        <img src="/logo.png" className="app-logo" />
                    </div>

                    {!collapsed && (
                        <div className="brand-text">
                            <div className="app-company">{displayName}</div>
                            <div className={`role-badge ${roleColor()}`}>
                                {role?.replaceAll("_", " ") || "User"}
                            </div>
                        </div>
                    )}
                </div>

                {/* NAV */}
                <nav className="app-nav">
                    {navItems.map((n, i) => {
                        const prevSection = i > 0 ? navItems[i - 1].section : undefined;
                        const showSection = n.section && n.section !== prevSection;
                        return (
                            <div key={n.path}>
                                {showSection && !collapsed && (
                                    <div className="nav-section-label">{n.section}</div>
                                )}
                                {showSection && collapsed && (
                                    <div className="nav-section-divider" />
                                )}
                                <Link
                                    to={n.path}
                                    data-label={n.label}
                                    className={location.pathname === n.path ? "active" : ""}
                                >
                                    {n.icon && <span className="nav-icon">{n.icon}</span>}
                                    {!collapsed && n.label}
                                </Link>
                            </div>
                        );
                    })}
                </nav>

                {/* SIGN OUT */}
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

                    <div className="top-left">
                        {workspaces?.length > 1 && (
                            <select
                                className="workspace-switch"
                                value={workspaceId ?? ""}
                                onChange={(e) => {
                                    const newId = e.target.value;
                                    const mem = memberships.find((m: any) => m.workspaceId === newId);
                                    const newRole = mem?.role;
                                    setWorkspaceId(newId);
                                    // navigate to correct shell if role changed
                                    if (newRole && newRole !== role) {
                                        if (newRole === "OWNER") navigate("/owner");
                                        else if (newRole === "MEMBER") navigate("/member");
                                        else if (newRole === "TENANT_ADMIN") navigate("/tenant");
                                    }
                                }}
                            >
                                {workspaces.map((w: any) => {
                                    const mem = memberships.find((m: any) => m.workspaceId === w.id);
                                    const tag = mem?.role === "OWNER" ? " (Owner)" : mem?.role === "MEMBER" ? " (Member)" : "";
                                    const tenantSuffix = isMultiTenant && w.tenantId && tenantNames[w.tenantId]
                                        ? ` — ${tenantNames[w.tenantId]}`
                                        : "";
                                    return <option key={w.id} value={w.id}>{w.name}{tag}{tenantSuffix}</option>;
                                })}
                            </select>
                        )}

                        <div className="search-box" onClick={() => setCmdOpen(true)}>
                            ⌘K Search
                        </div>
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
                                    <div className="profile-email">
                                        {userName || userEmail}
                                    </div>

                                    <div className="profile-role">
                                        {role?.replaceAll("_", " ")}
                                    </div>

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
                    {(() => {
                        const home = navItems[0];
                        const current = navItems.find(n => n.path !== home.path && location.pathname === n.path);
                        if (!current) return null;
                        // Walk parent chain to build crumbs between home and current
                        const chain: NavItem[] = [];
                        let cursor: NavItem | undefined = current;
                        while (cursor && cursor.path !== home.path) {
                            chain.unshift(cursor);
                            cursor = cursor.parent ? navItems.find(n => n.path === cursor!.parent) : undefined;
                        }
                        return (
                            <div className="breadcrumb">
                                <button className="breadcrumb-link" onClick={() => navigate(home.path)}>
                                    {home.label}
                                </button>
                                {chain.map((item, i) => (
                                    <span key={item.path}>
                                        <span className="breadcrumb-sep">/</span>
                                        {i < chain.length - 1
                                            ? <button className="breadcrumb-link" onClick={() => navigate(item.path)}>{item.label}</button>
                                            : <span className="breadcrumb-current">{item.label}</span>
                                        }
                                    </span>
                                ))}
                            </div>
                        );
                    })()}
                    <Outlet />
                </div>
                <GlobalCreateTaskBtn />

            </main>

            {/* COMMAND PALETTE */}
            {cmdOpen && (
                <div className="cmd-overlay" onClick={() => setCmdOpen(false)}>
                    <div className="cmd" onClick={e => e.stopPropagation()}>
                        <input autoFocus placeholder="Search or jump to..." />

                        <div className="cmd-results">
                            {navItems.map(n => (
                                <div
                                    key={n.path}
                                    className="cmd-item"
                                    onClick={() => {
                                        navigate(n.path);
                                        setCmdOpen(false);
                                    }}
                                >
                                    {n.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
