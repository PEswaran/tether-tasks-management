import { createContext, useContext, useEffect, useRef, useState } from "react";
import { dataClient } from "../libs/data-client";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

type Role = "OWNER" | "TENANT_ADMIN" | "MEMBER" | null;

type Workspace = {
    id: string;
    name?: string;
    tenantId?: string;
};

type WorkspaceCtx = {
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
    refreshWorkspaces: () => Promise<void>;
    switchTenant: (tenantId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceCtx>({
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
    refreshWorkspaces: async () => { },
    switchTenant: () => { }
});

export function WorkspaceProvider({ children }: any) {
    const client = dataClient();

    const [workspaceId, setWorkspaceIdState] = useState<string | null>(
        localStorage.getItem("activeWorkspace")
    );

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
                setWorkspaceIdState(m.workspaceId);
                localStorage.setItem("activeWorkspace", m.workspaceId);

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

        const wsIds = activeMemberships.map((m: any) => m.workspaceId);

        const results = await Promise.all(
            wsIds.map((id: string) => client.models.Workspace.get({ id }))
        );

        const ws = results.map(r => r.data).filter(Boolean) as Workspace[];

        setWorkspaces(ws);
    }

    useEffect(() => {
        if (!tenantId || memberships.length === 0) return;

        loadWorkspaces(tenantId, memberships);

    }, [tenantId, memberships]);

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
        setWorkspaces([]);

        if (mem?.workspaceId) {
            setWorkspaceIdState(mem.workspaceId);
            setRole(mem.role);
            localStorage.setItem("activeWorkspace", mem.workspaceId);
        } else {
            setWorkspaceIdState(null);
            setRole(null);
            localStorage.removeItem("activeWorkspace");
        }

        client.models.Tenant.get({ id: newTenantId }).then((res: any) => {
            setTenantName(res?.data?.companyName ?? null);
        });

        loadWorkspaces(newTenantId, membershipsRef.current);
    }

    /* ===============================
       SWITCH WORKSPACE
    =============================== */

    function setWorkspaceId(id: string | null) {
        if (!id) return;

        setWorkspaceIdState(id);
        localStorage.setItem("activeWorkspace", id);

        const mem = membershipsRef.current.find(
            (m: any) =>
                m.workspaceId === id &&
                m.status === "ACTIVE"
        );

        if (mem) {
            setRole(mem.role);
            setTenantId(mem.tenantId);
        }
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
