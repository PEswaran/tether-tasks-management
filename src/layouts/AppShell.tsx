import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { LogOut, PanelLeftClose, PanelLeftOpen, ChevronDown } from "lucide-react";
import NotificationBell from "../components/ui/notification-bell";
import { useWorkspace } from "../shared-components/workspace-context";
import { useEffect, useRef, useState } from "react";
import { dataClient } from "../libs/data-client";
import { getCurrentUser } from "aws-amplify/auth";
import GlobalCreateTaskBtn from "../components/ui/global-create-task-btn";

type NavItem = {
    label: string;
    path: string;
    icon?: any;
    parent?: string;
    section?: string;
    badge?: React.ReactNode;
    onClick?: () => void;
};

function resolveSectionName(item: NavItem) {
    return item.section || "Overview";
}

export default function AppShell({
    companyName,
    navItems,
    brandContent,
    hideWorkspaceContext,
}: {
    companyName?: string;
    navItems: NavItem[];
    brandContent?: React.ReactNode;
    hideWorkspaceContext?: boolean;
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
        organizationId,
        organizations,
        workspaces,
        setWorkspaceId,
    } = useWorkspace();

    const displayName = tenantName || companyName || "TetherTasks";

    const currentOrg = organizations.find((o) => o.id === organizationId);
    const currentOrgName = currentOrg?.name || displayName;
    const currentWorkspaceName =
        workspaces.find((w) => w.id === workspaceId)?.name || "Select workspace";

    const [wsSwitcherOpen, setWsSwitcherOpen] = useState(false);
    const wsSwitcherRef = useRef<HTMLDivElement>(null);

    // close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (wsSwitcherRef.current && !wsSwitcherRef.current.contains(e.target as Node)) {
                setWsSwitcherOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

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

        const onGeneralRoute = location.pathname.startsWith("/general");

        if (role === "OWNER" && !onGeneralRoute && !location.pathname.startsWith("/owner")) {
            navigate("/owner");
        }
        if (role === "TENANT_ADMIN" && !location.pathname.startsWith("/tenant")) {
            navigate("/tenant");
        }
        if (role === "MEMBER" && !onGeneralRoute && !location.pathname.startsWith("/member")) {
            navigate("/member");
        }
    }, [role, location.pathname, navigate]);

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

                {/* BRAND — logo + app name (or custom brandContent) */}
                <div className="app-brand">
                    {brandContent && !collapsed ? (
                        brandContent
                    ) : (
                        <>
                            <div className="app-logo-tile" onClick={() => navigate("/")}>
                                <img src="/logo.png" className="app-logo" />
                            </div>
                            {!collapsed && (
                                <div className="brand-text">
                                    <div className="app-company">{displayName}</div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* WORKSPACE CONTEXT — org label + workspace switcher */}
                {!collapsed && !hideWorkspaceContext && workspaces.length > 0 && (
                    <div className="sidebar-context" ref={wsSwitcherRef}>
                        <div className="sidebar-org-label">{currentOrgName}</div>
                        <button
                            className="sidebar-ws-switch"
                            onClick={() => setWsSwitcherOpen((v) => !v)}
                        >
                            <span className="sidebar-ws-name">{currentWorkspaceName}</span>
                            <ChevronDown size={14} className={`sidebar-ws-caret ${wsSwitcherOpen ? "open" : ""}`} />
                        </button>

                        {wsSwitcherOpen && (
                            <div className="sidebar-ws-dropdown">
                                {workspaces.map((ws) => (
                                    <div
                                        key={ws.id}
                                        className={`sidebar-ws-option ${ws.id === workspaceId ? "active" : ""}`}
                                        onClick={() => {
                                            setWorkspaceId(ws.id);
                                            setWsSwitcherOpen(false);
                                        }}
                                    >
                                        {ws.name || ws.id}
                                        {ws.id === workspaceId && <span className="sidebar-ws-check">&#10003;</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <nav className="app-nav">
                    {Array.from(new Set(navItems.map((item) => resolveSectionName(item)))).map((sectionName) => {
                        const sectionItems = navItems.filter((item) => resolveSectionName(item) === sectionName);
                        return (
                            <div key={sectionName}>
                                {!collapsed && <div className="nav-section-label">{sectionName}</div>}
                                {sectionItems.map((n) => (
                                    <Link
                                        key={n.path}
                                        to={n.path}
                                        className={location.pathname === n.path ? "active" : ""}
                                        onClick={n.onClick}
                                    >
                                        {n.icon && <span className="nav-icon">{n.icon}</span>}
                                        {!collapsed && n.label}
                                        {!collapsed && n.badge && (
                                            <div className="nav-badge-inline">{n.badge}</div>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-bottom">
                    {/* USER CARD */}
                    {!collapsed && (
                        <div className="sidebar-user-card">
                            <div className="sidebar-user-avatar">
                                {(userName || userEmail)?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div className="sidebar-user-info">
                                <div className="sidebar-user-name">{userName || userEmail}</div>
                                <div className="sidebar-user-role">
                                    {role?.replaceAll("_", " ") || "User"}
                                </div>
                            </div>
                        </div>
                    )}

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
