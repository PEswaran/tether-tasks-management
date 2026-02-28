import { createContext, useContext, useEffect, useRef, useState } from "react";
import { dataClient } from "../libs/data-client";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

type Role = "OWNER" | "TENANT_ADMIN" | "MEMBER" | null;

type Workspace = {
    id: string;
    name?: string | null;
    tenantId?: string | null;
    organizationId?: string | null;
    description?: string | null;
    ownerUserSub?: string | null;
    type?: string | null;
    isActive?: boolean | null;
    isDeleted?: boolean | null;
    createdBy?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

type Organization = {
    id: string;
    name?: string | null;
    tenantId?: string | null;
    description?: string | null;
    isActive?: boolean | null;
    createdBy?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

type WorkspaceCtx = {
    organizationId: string | null;
    setOrganizationId: (id: string | null) => void;
    organizations: Organization[];

    workspaceId: string | null;
    setWorkspaceId: (id: string | null) => void;
    workspaces: Workspace[];
    memberships: any[];

    tenantId: string | null;
    tenantName: string | null;
    role: Role;
    userId: string | null;
    email: string | null;

    isOwner: boolean;
    isTenantAdmin: boolean;
    isMember: boolean;

    refreshSession: () => Promise<string | null>;
    refreshOrganizations: () => Promise<void>;
    refreshWorkspaces: () => Promise<void>;
    switchTenant: (tenantId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceCtx>({
    organizationId: null,
    setOrganizationId: () => { },
    organizations: [],

    workspaceId: null,
    setWorkspaceId: () => { },
    workspaces: [],
    memberships: [],

    tenantId: null,
    tenantName: null,
    role: null,
    userId: null,
    email: null,

    isOwner: false,
    isTenantAdmin: false,
    isMember: false,

    refreshSession: async () => null,
    refreshOrganizations: async () => { },
    refreshWorkspaces: async () => { },
    switchTenant: () => { }
});

export function WorkspaceProvider({ children }: any) {
    const client = dataClient();

    const [workspaceId, setWorkspaceIdState] = useState<string | null>(
        localStorage.getItem("activeWorkspace")
    );
    const [organizationId, setOrganizationIdState] = useState<string | null>(
        localStorage.getItem("activeOrganization")
    );

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [memberships, setMemberships] = useState<any[]>([]);
    const membershipsRef = useRef<any[]>([]);

    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState<string | null>(null);
    const [role, setRole] = useState<Role>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);

    /* ===============================
       LOAD SESSION STATE ONLY
    =============================== */

    async function refreshSession(): Promise<string | null> {
        try {
            let user;
            try {
                user = await getCurrentUser();
            } catch (err: any) {
                if (err?.name === "UserUnAuthenticatedException") {
                    console.log("Auth not ready yet — skipping session load");
                    return null;
                }
                throw err;
            }

            const sub = user.userId;
            setUserId(sub);

            const session = await fetchAuthSession();
            const payload: any = session.tokens?.idToken?.payload;
            if (!payload?.email) return null;

            setEmail(payload.email);

            const groups: string[] = payload["cognito:groups"] || [];
            const normalizedGroups = groups.map((g) => g.toUpperCase());
            if (normalizedGroups.includes("PLATFORM_SUPER_ADMIN")) {
                setMemberships([]);
                setRole(null);
                setTenantId(null);
                setTenantName(null);
                return null;
            }

            const res: any = await client.models.Membership.listMembershipsByUser({
                userSub: sub
            });

            const mems = res?.data || [];
            membershipsRef.current = mems;
            setMemberships(mems);

            const active = mems.filter((m: any) => m.status === "ACTIVE");

            if (active.length) {
                const m = active[0];

                setRole(m.role);
                setTenantId(m.tenantId);
                if (m.workspaceId && m.role !== "TENANT_ADMIN") {
                    setWorkspaceIdState(m.workspaceId);
                    localStorage.setItem("activeWorkspace", m.workspaceId);
                }

                if (m.role === "TENANT_ADMIN") {
                    // Tenant admins should land on Control Center scoped to all organizations.
                    setOrganizationIdState(null);
                    localStorage.removeItem("activeOrganization");
                } else if (m.organizationId) {
                    setOrganizationIdState(m.organizationId);
                    localStorage.setItem("activeOrganization", m.organizationId);
                } else if (m.workspaceId) {
                    try {
                        const wsRes = await client.models.Workspace.get({ id: m.workspaceId });
                        const orgId = wsRes?.data?.organizationId;
                        if (orgId) {
                            setOrganizationIdState(orgId);
                            localStorage.setItem("activeOrganization", orgId);
                        }
                    } catch {
                        // ignore
                    }
                }

                const tenant = await client.models.Tenant.get({ id: m.tenantId });
                setTenantName(tenant?.data?.companyName || "");

                return m.tenantId; // 🔥 RETURN TENANT
            }

            // check pending invite
            const invRes: any = await client.models.Invitation.listInvitesByEmail({
                email: payload.email
            });

            const pendingInvite = invRes?.data?.find((i: any) => i.status === "PENDING");
            if (pendingInvite) {
                console.log("Pending invite exists — allow session");
                return null;
            }

            console.warn("User has no active memberships — redirecting to no-access");
            if (window.location.pathname !== "/no-access") {
                window.location.href = "/no-access";
            }
            return null;

        } catch (err) {
            console.error("refreshSession error:", err);
            return null;
        }
    }

    /* ===============================
       LOAD ORGANIZATIONS
    =============================== */

    async function loadOrganizations(currentTenantId: string) {
        const res = await client.models.Organization.list({
            filter: { tenantId: { eq: currentTenantId } },
        });
        setOrganizations(res.data || []);
    }

    useEffect(() => {
        if (!tenantId) return;
        loadOrganizations(tenantId);
    }, [tenantId]);

    async function refreshOrganizations() {
        if (!tenantId) return;
        await loadOrganizations(tenantId);
    }

    /* ===============================
       LOAD WORKSPACES
    =============================== */

    async function loadWorkspaces(currentTenantId: string, source?: any[]) {
        const list =
            source && source.length ? source :
                membershipsRef.current.length ? membershipsRef.current : memberships;

        const activeMemberships = list.filter(
            (m: any) =>
                m.tenantId === currentTenantId &&
                m.status === "ACTIVE"
        );

        // Derive tenant-admin mode from active memberships (not React state timing).
        const isTenantAdminForTenant = activeMemberships.some(
            (m: any) => m.role === "TENANT_ADMIN"
        );

        // Tenant admins can have org-level or tenant-level memberships with no workspaceId.
        // Load all tenant workspaces by default, or organization-scoped list when an org is selected.
        if (isTenantAdminForTenant) {
            if (organizationId) {
                const orgWsRes = await client.models.Workspace.list({
                    filter: { organizationId: { eq: organizationId } },
                });
                setWorkspaces(orgWsRes.data || []);
            } else {
                const tenantWsRes = await client.models.Workspace.list({
                    filter: { tenantId: { eq: currentTenantId } },
                });
                setWorkspaces(tenantWsRes.data || []);
            }
            return;
        }

        if (organizationId) {
            const res = await client.models.Workspace.list({
                filter: { organizationId: { eq: organizationId } },
            });
            setWorkspaces(res.data || []);
            return;
        }

        const wsIds = activeMemberships.map((m: any) => m.workspaceId).filter(Boolean);
        if (!wsIds.length) {
            setWorkspaces([]);
            return;
        }

        const results = await Promise.all(
            wsIds.map((id: string) => client.models.Workspace.get({ id }))
        );

        const ws = results.map(r => r.data).filter(Boolean) as Workspace[];

        setWorkspaces(ws);
    }

    useEffect(() => {
        if (!tenantId || memberships.length === 0) return;

        loadWorkspaces(tenantId, memberships);

    }, [tenantId, memberships, organizationId, role]);

    useEffect(() => {
        if (workspaceId || workspaces.length === 0) return;
        // TENANT_ADMIN lands on workspace grid — don't auto-select
        if (role === "TENANT_ADMIN") return;
        const first = workspaces[0]?.id;
        if (first) {
            setWorkspaceIdState(first);
            localStorage.setItem("activeWorkspace", first);
        }
    }, [workspaces, workspaceId, role]);

    async function refreshWorkspaces() {
        if (!tenantId) return;
        await loadWorkspaces(tenantId, membershipsRef.current);
    }

    /* ===============================
       SWITCH TENANT
    =============================== */

    function switchTenant(newTenantId: string) {
        const list = membershipsRef.current.length ? membershipsRef.current : memberships;
        let mem = list.find(
            (m: any) =>
                m.tenantId === newTenantId &&
                m.status === "ACTIVE"
        );

        if (!mem) {
            mem = list.find(
                (m: any) =>
                    m.tenantId === newTenantId &&
                    m.status !== "REMOVED"
            );
        }

        setTenantId(newTenantId);
        setOrganizationIdState(null);
        setWorkspaces([]);
        setOrganizations([]);

        // Always set role from membership (memberships are org-level, workspaceId is usually null)
        setRole(mem?.role || null);

        if (mem?.workspaceId) {
            setWorkspaceIdState(mem.workspaceId);
            localStorage.setItem("activeWorkspace", mem.workspaceId);
        } else {
            setWorkspaceIdState(null);
            localStorage.removeItem("activeWorkspace");
        }

        if (mem?.role === "TENANT_ADMIN") {
            setOrganizationIdState(null);
            localStorage.removeItem("activeOrganization");
        } else if (mem?.organizationId) {
            setOrganizationIdState(mem.organizationId);
            localStorage.setItem("activeOrganization", mem.organizationId);
        } else {
            setOrganizationIdState(null);
            localStorage.removeItem("activeOrganization");
        }

        client.models.Tenant.get({ id: newTenantId }).then((res: any) => {
            setTenantName(res?.data?.companyName ?? null);
        });

        loadOrganizations(newTenantId);
        loadWorkspaces(newTenantId, membershipsRef.current);
    }

    /* ===============================
       SWITCH WORKSPACE
    =============================== */

    function setWorkspaceId(id: string | null) {
        if (id === null) {
            setWorkspaceIdState(null);
            localStorage.removeItem("activeWorkspace");
            return;
        }

        setWorkspaceIdState(id);
        localStorage.setItem("activeWorkspace", id);

        // Try workspace-level membership first
        const memByWs = membershipsRef.current.find(
            (m: any) =>
                m.workspaceId === id &&
                m.status === "ACTIVE"
        );

        if (memByWs) {
            setRole(memByWs.role);
            setTenantId(memByWs.tenantId);
            return;
        }

        // Memberships are org-level — look up the workspace's org, then find the org membership
        client.models.Workspace.get({ id }).then((res: any) => {
            const orgId = res?.data?.organizationId;
            if (orgId) {
                setOrganizationIdState(orgId);
                localStorage.setItem("activeOrganization", orgId);

                const orgMem = membershipsRef.current.find(
                    (m: any) =>
                        m.organizationId === orgId &&
                        m.status === "ACTIVE"
                );
                if (orgMem) {
                    setRole(orgMem.role);
                    setTenantId(orgMem.tenantId);
                }
            }
        }).catch(() => { });
    }

    function setOrganizationId(id: string | null) {
        if (!id) {
            setOrganizationIdState(null);
            localStorage.removeItem("activeOrganization");
            setWorkspaces([]);
            setWorkspaceIdState(null);
            localStorage.removeItem("activeWorkspace");
            return;
        }
        setOrganizationIdState(id);
        localStorage.setItem("activeOrganization", id);
        setWorkspaces([]);
        setWorkspaceIdState(null);
        localStorage.removeItem("activeWorkspace");
    }

    /* =============================== */

    useEffect(() => {
        async function init() {
            try {
                const s = await fetchAuthSession();
                if (!s.tokens?.accessToken) {
                    console.log("Auth not ready yet — skipping");
                    return;
                }

                const tid = await refreshSession();

                if (tid) {
                    await loadOrganizations(tid);
                    await loadWorkspaces(tid, membershipsRef.current); // 🔥 DIRECT LOAD
                }

            } catch {
                console.log("Not authenticated");
            }
        }

        init();
    }, []);

    return (
        <WorkspaceContext.Provider
            value={{
                organizationId,
                setOrganizationId,
                organizations,

                workspaceId,
                setWorkspaceId,
                workspaces,
                memberships,

                tenantId,
                tenantName,
                role,
                userId,
                email,

                isOwner: role === "OWNER",
                isTenantAdmin: role === "TENANT_ADMIN",
                isMember: role === "MEMBER",

                refreshSession,
                refreshOrganizations,
                refreshWorkspaces,
                switchTenant
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    return useContext(WorkspaceContext);
}
