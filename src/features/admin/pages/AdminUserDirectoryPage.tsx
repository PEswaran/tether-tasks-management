import { useEffect, useMemo, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { displayName } from "../../../libs/displayName";

type ScopeMode = "tenant" | "platform";

export default function AdminUserDirectoryPage({ mode }: { mode: ScopeMode }) {
    const client = dataClient();
    const { tenantId } = useWorkspace();

    const [loading, setLoading] = useState(true);
    const [memberships, setMemberships] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [boards, setBoards] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [selectedTenantId, setSelectedTenantId] = useState<string>("");

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [workspaceFilter, setWorkspaceFilter] = useState("ALL");
    const [boardFilter, setBoardFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ACTIVE");

    const effectiveTenantId = mode === "tenant" ? (tenantId || "") : selectedTenantId;

    useEffect(() => {
        if (mode !== "platform") return;
        loadTenants();
    }, [mode]);

    useEffect(() => {
        if (mode === "tenant" && !tenantId) return;
        loadDirectory();
    }, [mode, tenantId, selectedTenantId]);

    async function loadTenants() {
        const tenantRes = await client.models.Tenant.list();
        const list = tenantRes.data || [];
        setTenants(list);
        if (!selectedTenantId && list.length > 0) {
            setSelectedTenantId(list[0].id);
        }
    }

    async function loadDirectory() {
        setLoading(true);
        try {
            const membershipFilter = effectiveTenantId
                ? { tenantId: { eq: effectiveTenantId } }
                : undefined;
            const workspaceFilter = effectiveTenantId
                ? { tenantId: { eq: effectiveTenantId } }
                : undefined;
            const boardFilter = effectiveTenantId
                ? { tenantId: { eq: effectiveTenantId } }
                : undefined;
            const profileFilter = effectiveTenantId
                ? { tenantId: { eq: effectiveTenantId } }
                : undefined;

            const [memRes, wsRes, boardRes, profileRes] = await Promise.all([
                client.models.Membership.list(membershipFilter ? { filter: membershipFilter } : undefined),
                client.models.Workspace.list(workspaceFilter ? { filter: workspaceFilter } : undefined),
                client.models.TaskBoard.list(boardFilter ? { filter: boardFilter } : undefined),
                client.models.UserProfile.list(profileFilter ? { filter: profileFilter } : undefined),
            ]);

            setMemberships(memRes.data || []);
            setWorkspaces(wsRes.data || []);
            setBoards(boardRes.data || []);
            setProfiles(profileRes.data || []);
        } finally {
            setLoading(false);
        }
    }

    const workspaceById = useMemo(
        () => Object.fromEntries((workspaces || []).map((ws: any) => [ws.id, ws])),
        [workspaces]
    );

    const boardNamesByWorkspaceId = useMemo(() => {
        const map = new Map<string, Set<string>>();
        (boards || []).forEach((b: any) => {
            if (!b.workspaceId) return;
            if (!map.has(b.workspaceId)) map.set(b.workspaceId, new Set<string>());
            map.get(b.workspaceId)!.add(b.name || b.id);
        });
        return map;
    }, [boards]);

    const allWorkspaceOptions = useMemo(
        () => (workspaces || []).map((ws: any) => ({ id: ws.id, name: ws.name || ws.id })),
        [workspaces]
    );

    const allBoardOptions = useMemo(
        () => (boards || []).map((b: any) => ({ id: b.id, name: b.name || b.id })),
        [boards]
    );

    const rows = useMemo(() => {
        const userMap = new Map<string, any[]>();
        memberships.forEach((m: any) => {
            if (!m?.userSub) return;
            const list = userMap.get(m.userSub) || [];
            list.push(m);
            userMap.set(m.userSub, list);
        });

        return Array.from(userMap.entries()).map(([userSub, userMemberships]) => {
            const statuses = Array.from(new Set(userMemberships.map((m: any) => m.status).filter(Boolean)));
            const activeMemberships = userMemberships.filter((m: any) => m.status === "ACTIVE");
            const roles = Array.from(new Set(activeMemberships.map((m: any) => m.role).filter(Boolean)));

            const workspaceIds = new Set<string>();
            activeMemberships.forEach((m: any) => {
                if (m.workspaceId) {
                    workspaceIds.add(m.workspaceId);
                    return;
                }
                if (m.organizationId) {
                    workspaces
                        .filter((ws: any) => ws.organizationId === m.organizationId)
                        .forEach((ws: any) => workspaceIds.add(ws.id));
                    return;
                }
                if (m.tenantId) {
                    workspaces
                        .filter((ws: any) => ws.tenantId === m.tenantId)
                        .forEach((ws: any) => workspaceIds.add(ws.id));
                }
            });

            const workspaceNames = Array.from(workspaceIds)
                .map((id) => workspaceById[id]?.name || id)
                .filter(Boolean);

            const boardNamesSet = new Set<string>();
            Array.from(workspaceIds).forEach((wsId) => {
                const names = boardNamesByWorkspaceId.get(wsId);
                if (!names) return;
                names.forEach((name) => boardNamesSet.add(name));
            });
            const boardNames = Array.from(boardNamesSet);

            const profile = profiles.find((p: any) => p.userId === userSub);
            const email = profile?.email || userSub;
            const tenantNames = Array.from(
                new Set(
                    userMemberships
                        .map((m: any) => m.tenantId)
                        .filter(Boolean)
                        .map((id: string) => tenants.find((t: any) => t.id === id)?.companyName || id)
                )
            );

            return {
                userSub,
                name: displayName(email),
                email,
                roles,
                statuses,
                workspaceIds: Array.from(workspaceIds),
                workspaceNames,
                boardNames,
                tenantNames,
            };
        });
    }, [memberships, workspaces, workspaceById, boardNamesByWorkspaceId, profiles, tenants]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((row) => {
            if (statusFilter !== "ALL") {
                if (statusFilter === "ACTIVE" && !row.statuses.includes("ACTIVE")) return false;
                if (statusFilter === "REMOVED" && !row.statuses.includes("REMOVED")) return false;
            }
            if (roleFilter !== "ALL" && !row.roles.includes(roleFilter)) return false;
            if (workspaceFilter !== "ALL" && !row.workspaceIds.includes(workspaceFilter)) return false;
            if (boardFilter !== "ALL" && !row.boardNames.includes(boards.find((b: any) => b.id === boardFilter)?.name || boardFilter)) return false;
            if (!q) return true;

            const haystack = [
                row.name,
                row.email,
                row.roles.join(" "),
                row.workspaceNames.join(" "),
                row.boardNames.join(" "),
                row.tenantNames.join(" "),
            ]
                .join(" ")
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [rows, search, roleFilter, workspaceFilter, boardFilter, statusFilter, boards]);

    if (loading) {
        return <div className="page"><h2>Loading user directory...</h2></div>;
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">User Directory</h1>
                    <div className="page-sub">
                        Filterable admin directory of users, roles, workspaces, and board access.
                    </div>
                </div>
            </div>

            <div className="workspace-page-controls admin-user-filters" style={{ marginBottom: 14 }}>
                {mode === "platform" && (
                    <select
                        id="admin-user-directory-tenant-select"
                        name="admin_user_directory_tenant_select"
                        className="workspace-page-org-select admin-user-filter-control"
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                    >
                        <option value="">All tenants</option>
                        {tenants.map((tenant: any) => (
                            <option key={tenant.id} value={tenant.id}>{tenant.companyName || tenant.id}</option>
                        ))}
                    </select>
                )}

                <input
                    id="admin-user-directory-search"
                    name="admin_user_directory_search"
                    className="workspace-page-org-select admin-user-filter-control admin-user-filter-search"
                    placeholder="Search user, email, role, workspace, board"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                <select
                    id="admin-user-directory-role-filter"
                    name="admin_user_directory_role_filter"
                    className="workspace-page-org-select admin-user-filter-control"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                >
                    <option value="ALL">Role: All</option>
                    <option value="TENANT_ADMIN">Tenant Admin</option>
                    <option value="OWNER">Owner</option>
                    <option value="MEMBER">Member</option>
                </select>

                <select
                    id="admin-user-directory-status-filter"
                    name="admin_user_directory_status_filter"
                    className="workspace-page-org-select admin-user-filter-control"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="ACTIVE">Status: Active</option>
                    <option value="ALL">Status: All</option>
                    <option value="REMOVED">Status: Removed</option>
                </select>

                <select
                    id="admin-user-directory-workspace-filter"
                    name="admin_user_directory_workspace_filter"
                    className="workspace-page-org-select admin-user-filter-control"
                    value={workspaceFilter}
                    onChange={(e) => setWorkspaceFilter(e.target.value)}
                >
                    <option value="ALL">Workspace: All</option>
                    {allWorkspaceOptions.map((ws: any) => (
                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                </select>

                <select
                    id="admin-user-directory-board-filter"
                    name="admin_user_directory_board_filter"
                    className="workspace-page-org-select admin-user-filter-control"
                    value={boardFilter}
                    onChange={(e) => setBoardFilter(e.target.value)}
                >
                    <option value="ALL">Board: All</option>
                    {allBoardOptions.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>

            <table className="table">
                <thead>
                    <tr>
                        <th>User</th>
                        {mode === "platform" && <th>Tenant</th>}
                        <th>Role(s)</th>
                        <th>Workspace(s)</th>
                        <th>Board(s)</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredRows.map((row) => (
                        <tr key={row.userSub}>
                            <td>
                                <div style={{ fontWeight: 600 }}>{row.name}</div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>{row.email}</div>
                            </td>
                            {mode === "platform" && (
                                <td style={{ fontSize: 13 }}>{row.tenantNames.join(", ") || "—"}</td>
                            )}
                            <td style={{ fontSize: 13 }}>{row.roles.join(", ") || "—"}</td>
                            <td style={{ fontSize: 13 }}>{row.workspaceNames.slice(0, 6).join(", ") || "—"}</td>
                            <td style={{ fontSize: 13 }}>{row.boardNames.slice(0, 8).join(", ") || "—"}</td>
                            <td>
                                <span className={`badge ${row.statuses.includes("ACTIVE") ? "green" : "gray"}`}>
                                    {row.statuses.includes("ACTIVE") ? "Active" : row.statuses.join(", ") || "—"}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {filteredRows.length === 0 && (
                        <tr>
                            <td colSpan={mode === "platform" ? 6 : 5} style={{ textAlign: "center", color: "#94a3b8" }}>
                                No users match your filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
