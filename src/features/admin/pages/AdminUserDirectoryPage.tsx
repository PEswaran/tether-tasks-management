import { useEffect, useMemo, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { displayName } from "../../../libs/displayName";
import InviteMemberModal from "../../../components/shared/modals/invite-members-modal";
import { useConfirm } from "../../../shared-components/confirm-context";
import { logAudit } from "../../../libs/audit";

type ScopeMode = "tenant" | "platform";

export default function AdminUserDirectoryPage({ mode }: { mode: ScopeMode }) {
    const client = dataClient();
    const { tenantId, tenantName, role, organizations, memberships: contextMemberships } = useWorkspace();
    const { confirm, alert } = useConfirm();

    const [loading, setLoading] = useState(true);
    const [directoryMemberships, setDirectoryMemberships] = useState<any[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [boards, setBoards] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [inviteOrganizations, setInviteOrganizations] = useState<any[]>([]);
    const [selectedTenantId, setSelectedTenantId] = useState<string>("");
    const [showInvite, setShowInvite] = useState(false);

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

    useEffect(() => {
        if (mode === "platform") {
            loadInviteOrganizationsForPlatform();
            return;
        }
        const activeOwnerOrgIds = new Set(
            (contextMemberships || [])
                .filter((m: any) => m.status === "ACTIVE" && m.role === "OWNER" && m.organizationId)
                .map((m: any) => m.organizationId)
        );
        const scopedOrganizations = role === "OWNER"
            ? (organizations || []).filter((org: any) => activeOwnerOrgIds.has(org.id))
            : organizations || [];
        setInviteOrganizations(scopedOrganizations);
    }, [mode, selectedTenantId, organizations, contextMemberships, role]);

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

            const invitationFilter = effectiveTenantId
                ? { tenantId: { eq: effectiveTenantId } }
                : undefined;

            const [memRes, invRes, wsRes, boardRes, profileRes] = await Promise.all([
                client.models.Membership.list(membershipFilter ? { filter: membershipFilter } : undefined),
                client.models.Invitation.list(invitationFilter ? { filter: invitationFilter } : undefined),
                client.models.Workspace.list(workspaceFilter ? { filter: workspaceFilter } : undefined),
                client.models.TaskBoard.list(boardFilter ? { filter: boardFilter } : undefined),
                client.models.UserProfile.list(profileFilter ? { filter: profileFilter } : undefined),
            ]);

            setDirectoryMemberships(memRes.data || []);
            setInvitations(invRes.data || []);
            setWorkspaces(wsRes.data || []);
            setBoards(boardRes.data || []);
            setProfiles(profileRes.data || []);
        } finally {
            setLoading(false);
        }
    }

    async function loadInviteOrganizationsForPlatform() {
        if (mode !== "platform") return;
        if (!selectedTenantId) {
            setInviteOrganizations([]);
            return;
        }
        const orgRes = await client.models.Organization.list({
            filter: { tenantId: { eq: selectedTenantId } },
        });
        setInviteOrganizations(orgRes.data || []);
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
        directoryMemberships.forEach((m: any) => {
            if (!m?.userSub) return;
            const list = userMap.get(m.userSub) || [];
            list.push(m);
            userMap.set(m.userSub, list);
        });

        const membershipRows = Array.from(userMap.entries()).map(([userSub, userMemberships]) => {
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
                membershipIds: userMemberships.map((m: any) => m.id).filter(Boolean),
                workspaceIds: Array.from(workspaceIds),
                workspaceNames,
                boardNames,
                tenantNames,
                pendingInviteIds: [] as string[],
            };
        });

        const activeMembershipEmails = new Set(
            membershipRows
                .filter((row) => row.statuses.includes("ACTIVE"))
                .map((row) => row.email?.toLowerCase())
                .filter(Boolean)
        );

        const pendingInviteRows = (invitations || [])
            .filter((inv: any) => inv?.status === "PENDING")
            .filter((inv: any) => !activeMembershipEmails.has((inv.email || "").toLowerCase()))
            .map((inv: any) => {
                const invitedWorkspaceIds = new Set<string>();
                if (inv.workspaceId) {
                    invitedWorkspaceIds.add(inv.workspaceId);
                } else if (inv.organizationId) {
                    workspaces
                        .filter((ws: any) => ws.organizationId === inv.organizationId)
                        .forEach((ws: any) => invitedWorkspaceIds.add(ws.id));
                }

                const workspaceNames = Array.from(invitedWorkspaceIds)
                    .map((id) => workspaceById[id]?.name || id)
                    .filter(Boolean);

                const boardNamesSet = new Set<string>();
                Array.from(invitedWorkspaceIds).forEach((wsId) => {
                    const names = boardNamesByWorkspaceId.get(wsId);
                    if (!names) return;
                    names.forEach((name) => boardNamesSet.add(name));
                });

                const tenantLabel = tenants.find((t: any) => t.id === inv.tenantId)?.companyName || inv.tenantId;

                return {
                    userSub: `invite:${inv.id}`,
                    name: displayName(inv.email),
                    email: inv.email,
                    roles: inv.role ? [inv.role] : [],
                    statuses: ["PENDING"],
                    membershipIds: [] as string[],
                    workspaceIds: Array.from(invitedWorkspaceIds),
                    workspaceNames,
                    boardNames: Array.from(boardNamesSet),
                    tenantNames: tenantLabel ? [tenantLabel] : [],
                    pendingInviteIds: [inv.id],
                };
            });

        return [...membershipRows, ...pendingInviteRows];
    }, [directoryMemberships, invitations, workspaces, workspaceById, boardNamesByWorkspaceId, profiles, tenants]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((row) => {
            if (statusFilter !== "ALL") {
                if (statusFilter === "ACTIVE" && !row.statuses.includes("ACTIVE")) return false;
                if (statusFilter === "PENDING" && !row.statuses.includes("PENDING")) return false;
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

    const selectedTenant = tenants.find((tenant: any) => tenant.id === selectedTenantId) || null;
    const inviteTenantId = mode === "platform" ? selectedTenantId : (tenantId || "");
    const inviteTenantName = mode === "platform" ? selectedTenant?.companyName || "" : tenantName || "";
    const canInvite = mode === "platform" || role === "TENANT_ADMIN" || role === "OWNER";
    const inviteDisabled = !inviteTenantId || inviteOrganizations.length === 0;
    const canRemoveFromDirectory = mode === "tenant" && role === "TENANT_ADMIN";

    async function removeDirectoryUser(row: any) {
        if (!effectiveTenantId) return;
        if (row.roles?.includes("TENANT_ADMIN")) {
            await alert({
                title: "Restricted",
                message: "Only a platform super admin can remove a tenant admin.",
                variant: "warning",
            });
            return;
        }
        const ok = await confirm({
            title: "Remove User",
            message: `Remove ${row.name} from this tenant and revoke their pending invites?`,
            confirmLabel: "Remove",
            variant: "danger",
        });
        if (!ok) return;

        try {
            const membershipUpdates = directoryMemberships
                .filter((m: any) =>
                    m.tenantId === effectiveTenantId &&
                    m.status !== "REMOVED" &&
                    ((row.userSub && !String(row.userSub).startsWith("invite:") && m.userSub === row.userSub) ||
                        (row.email && row.email.toLowerCase() && row.email.toLowerCase() === (profiles.find((p: any) => p.userId === m.userSub)?.email || "").toLowerCase()))
                )
                .map((m: any) => client.models.Membership.update({ id: m.id, status: "REMOVED" }));

            const invitationUpdates = invitations
                .filter((inv: any) =>
                    inv.tenantId === effectiveTenantId &&
                    inv.status === "PENDING" &&
                    (inv.email || "").toLowerCase() === (row.email || "").toLowerCase()
                )
                .map((inv: any) => client.models.Invitation.update({ id: inv.id, status: "REVOKED" }));

            await Promise.all([...membershipUpdates, ...invitationUpdates]);
            await logAudit({
                tenantId: effectiveTenantId,
                action: "REMOVE",
                resourceType: "Membership",
                resourceId: row.userSub || row.email,
                metadata: { email: row.email, removedFrom: "user-directory" },
            });
            await loadDirectory();
            await alert({
                title: "Removed",
                message: `${row.name} was removed from this tenant.`,
                variant: "success",
            });
        } catch (err) {
            console.error("Failed to remove directory user", err);
            await alert({
                title: "Error",
                message: "Failed to remove user from this tenant.",
                variant: "danger",
            });
        }
    }

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
                {canInvite && (
                    <button
                        className="workspace-page-btn workspace-page-btn-primary"
                        onClick={() => setShowInvite(true)}
                        disabled={inviteDisabled}
                    >
                        + Invite User
                    </button>
                )}
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
                    <option value="PENDING">Status: Pending</option>
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
                        {canRemoveFromDirectory && <th>Actions</th>}
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
                                <span className={`badge ${row.statuses.includes("ACTIVE") ? "green" : row.statuses.includes("PENDING") ? "amber" : "gray"}`}>
                                    {row.statuses.includes("ACTIVE")
                                        ? "Active"
                                        : row.statuses.includes("PENDING")
                                            ? "Pending"
                                            : row.statuses.join(", ") || "—"}
                                </span>
                            </td>
                            {canRemoveFromDirectory && (
                                <td>
                                    {!row.roles.includes("TENANT_ADMIN") && (
                                        <button
                                            className="btn secondary"
                                            onClick={() => { void removeDirectoryUser(row); }}
                                            disabled={!row.email}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                    {filteredRows.length === 0 && (
                        <tr>
                            <td colSpan={mode === "platform" ? 6 : canRemoveFromDirectory ? 6 : 5} style={{ textAlign: "center", color: "#94a3b8" }}>
                                No users match your filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {showInvite && canInvite && inviteTenantId && (
                <InviteMemberModal
                    tenantId={inviteTenantId}
                    tenantName={inviteTenantName}
                    organizations={inviteOrganizations}
                    currentOrganizationId={inviteOrganizations[0]?.id}
                    onClose={() => {
                        setShowInvite(false);
                        loadDirectory();
                    }}
                    onInvited={() => {
                        loadDirectory();
                    }}
                />
            )}
        </div>
    );
}
