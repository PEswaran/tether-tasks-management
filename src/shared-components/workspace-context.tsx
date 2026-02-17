import { createContext, useContext, useEffect, useRef, useState } from "react";
import { dataClient } from "../libs/data-client";
import { getTenantId } from "../libs/isTenantAdmin";
import { getMyTenantId } from "../libs/isOwner";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

type Role = "OWNER" | "TENANT_ADMIN" | "MEMBER" | null;

type Workspace = {
    id: string;
    name?: string;
};

type WorkspaceCtx = {
    workspaceId: string | null;
    setWorkspaceId: (id: string | null) => void;
    workspaces: Workspace[];
    memberships: any[];
    refreshWorkspaces: () => Promise<void>;

    // 🔥 global session
    tenantId: string | null;
    tenantName: string | null;
    role: Role;
    userId: string | null;
    email: string | null;

    isOwner: boolean;
    isTenantAdmin: boolean;
    isMember: boolean;
    refreshSession: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceCtx>({
    workspaceId: null,
    setWorkspaceId: () => { },
    workspaces: [],
    memberships: [],
    refreshWorkspaces: async () => { },

    tenantId: null,
    tenantName: null,
    role: null,
    userId: null,
    email: null,

    isOwner: false,
    isTenantAdmin: false,
    isMember: false,

    refreshSession: async () => { }
});

export function WorkspaceProvider({ children }: any) {
    const client = dataClient();

    const [workspaceId, setWorkspaceIdState] = useState<string | null>(() => {
        return localStorage.getItem("activeWorkspace") || null;
    });

    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [memberships, setMemberships] = useState<any[]>([]);
    const membershipsRef = useRef<any[]>([]);

    // 🔥 global session state
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState<string | null>(null);
    const [role, setRole] = useState<Role>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);


    function setWorkspaceId(id: string | null) {
        setWorkspaceIdState(id);
        if (id) {
            localStorage.setItem("activeWorkspace", id);
            // update role to match the new workspace's membership
            const mem = membershipsRef.current.find((m: any) => m.workspaceId === id);
            if (mem) {
                setRole(mem.role as Role);
                setTenantId(mem.tenantId);
            }
        } else {
            localStorage.removeItem("activeWorkspace");
        }
    }

    // 🔥 load full session (user + tenant + role)
    async function refreshSession() {
        try {
            // wait until auth fully ready
            const user = await getCurrentUser();
            setUserId(user.userId);

            const session = await fetchAuthSession({ forceRefresh: true });
            const payload: any = session.tokens?.idToken?.payload;

            if (!payload?.sub) {
                console.warn("No cognito sub yet — skipping membership lookup");
                return;
            }

            setEmail(payload?.email ?? null);

            // tenant id (your existing working helper)
            const tid = await getTenantId();
            if (tid) setTenantId(tid);

            const sub = payload.sub;

            const res: any = await client.models.Membership.listMembershipsByUser({
                userSub: sub
            });

            const mems = res?.data || [];
            membershipsRef.current = mems;
            setMemberships(mems);

            if (!mems.length) {
                console.warn("User has no memberships");
                return;
            }

            // choose active workspace — prefer localStorage, fall back to first
            let active = mems[0];
            const stored = localStorage.getItem("activeWorkspace");

            if (stored) {
                const found = mems.find((m: any) => m.workspaceId === stored);
                if (found) active = found;
            } else if (workspaceId) {
                const found = mems.find((m: any) => m.workspaceId === workspaceId);
                if (found) active = found;
            }

            // set role + tenant from active membership
            setRole(active.role as any);
            setTenantId(active.tenantId);
            setWorkspaceIdState(active.workspaceId);
            localStorage.setItem("activeWorkspace", active.workspaceId);

            // load tenant name
            try {
                const tenantRes: any = await client.models.Tenant.get({
                    id: active.tenantId
                });
                setTenantName(tenantRes?.data?.companyName ?? null);
            } catch { }


        } catch (err) {
            console.error("session load error", err);
        }
    }


    // 🔥 workspaces
    async function refreshWorkspaces() {
        const mems = membershipsRef.current;
        const isTAdmin = mems.some((m: any) => m.role === "TENANT_ADMIN");

        let ws: Workspace[] = [];

        if (isTAdmin) {
            // tenant admins see all workspaces in their tenant
            const tid = await getMyTenantId() || await getTenantId();
            if (!tid) return;
            const res = await client.models.Workspace.workspacesByTenant({ tenantId: tid });
            ws = (res.data || []) as Workspace[];
        } else {
            // owners/members: load only workspaces they have memberships in
            const wsIds = [...new Set(mems.map((m: any) => m.workspaceId).filter(Boolean))];
            const results = await Promise.all(
                wsIds.map(id => client.models.Workspace.get({ id }))
            );
            ws = results.map(r => r.data).filter(Boolean) as Workspace[];
        }

        setWorkspaces(ws);

        if (!workspaceId && ws.length > 0) {
            setWorkspaceId(ws[0].id);
        }
    }

    // 🔥 initial load order
    useEffect(() => {
        refreshSession().then(refreshWorkspaces);
    }, []);

    return (
        <WorkspaceContext.Provider
            value={{
                workspaceId,
                setWorkspaceId,
                workspaces,
                memberships,
                refreshWorkspaces,

                tenantId,
                tenantName,
                role,
                userId,
                email,

                isOwner: role === "OWNER",
                isTenantAdmin: role === "TENANT_ADMIN",
                isMember: role === "MEMBER",

                refreshSession
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    return useContext(WorkspaceContext);
}
