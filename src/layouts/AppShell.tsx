import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { LogOut } from "lucide-react";

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

                {/* BRAND */}
                <div className="app-brand">
                    <button
                        className="collapse-btn"
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        {collapsed ? "»" : "«"}
                    </button>

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
                    {navItems.map(n => (
                        <Link
                            key={n.path}
                            to={n.path}
                            data-label={n.label}
                            className={location.pathname === n.path ? "active" : ""}
                        >
                            {n.icon && <span className="nav-icon">{n.icon}</span>}
                            {!collapsed && n.label}
                        </Link>
                    ))}
                </nav>

                {/* BOTTOM */}
                <button
                    onClick={async () => {
                        await signOut();
                        navigate("/");
                    }}
                    className="app-signout"
                >
                    <span className="nav-icon">
                        <LogOut size={18} />
                    </span>

                    {!collapsed && "Sign out"}
                </button>

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
                                    return <option key={w.id} value={w.id}>{w.name}{tag}</option>;
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
