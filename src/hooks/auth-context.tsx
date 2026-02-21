import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { dataClient } from "../libs/data-client";

const client = dataClient();

type Role = "OWNER" | "TENANT_ADMIN" | "MEMBER" | null;

type AuthContextType = {
    userId: string | null;
    email: string | null;
    role: Role;
    tenantId: string | null;
    tenantName: string | null;
    loading: boolean;

    isOwner: boolean;
    isTenantAdmin: boolean;
    isMember: boolean;

    refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [role, setRole] = useState<Role>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    async function loadAuth() {
        try {
            setLoading(true);

            // get cognito user
            const user = await getCurrentUser();
            setUserId(user.userId);

            // session
            const session = await fetchAuthSession();
            const payload = session.tokens?.idToken?.payload as any;

            setEmail(payload?.email ?? null);

            // global super admin / owner (if using cognito groups)
            const groups: string[] = payload["cognito:groups"] || [];
            if (groups.includes("OWNER")) {
                setRole("OWNER");
            }

            // get tenant membership from API
            const res: any = await client.graphql({
                query: `
          query MyMembership {
            myMembership {
              tenantId
              role
              tenant {
                name
              }
            }
          }
        `,
            });

            const membership = res.data?.myMembership;

            if (membership) {
                setTenantId(membership.tenantId);
                setRole(membership.role);
                setTenantName(membership.tenant?.name ?? null);
            }

        } catch (err: any) {
            if (err?.name === "UserUnAuthenticatedException") return;
            console.error("notif init error", err);

        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAuth();
    }, []);

    const value: AuthContextType = {
        userId,
        email,
        role,
        tenantId,
        tenantName,
        loading,

        isOwner: role === "OWNER",
        isTenantAdmin: role === "TENANT_ADMIN",
        isMember: role === "MEMBER",

        refreshAuth: loadAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
