import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../libs/data-client";

export function useUserRole() {
    const client = dataClient();

    async function getRole() {
        const session = await fetchAuthSession();
        const sub = session.tokens?.accessToken.payload.sub;

        if (!sub) return null;

        const res = await client.models.Membership.list({
            filter: { userSub: { eq: sub }, status: { eq: "ACTIVE" } }
        });

        const roles = res.data.map((m: any) => m.role);

        if (roles.includes("TENANT_ADMIN")) return "TENANT_ADMIN";
        if (roles.includes("OWNER")) return "OWNER";
        return "MEMBER";
    }

    return { getRole };
}
