import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "./data-client";

export async function isTenantAdmin(): Promise<boolean> {
    const session = await fetchAuthSession();
    const sub = session.tokens?.accessToken?.payload?.sub as string | undefined;
    if (!sub) return false;

    const client = dataClient();
    const res = await client.models.Membership.list({
        filter: { userSub: { eq: sub } }
    });

    return res.data.some((m: any) => m.role === "TENANT_ADMIN");
}

export async function getTenantId(): Promise<string | null> {
    const session = await fetchAuthSession();
    const sub = session.tokens?.accessToken.payload.sub;
    if (!sub) return null;

    const client = dataClient();
    const res = await client.models.Membership.list({
        filter: { userSub: { eq: sub } }
    });

    const membership = res.data.find((m: any) => m.role === "TENANT_ADMIN");
    return membership?.tenantId ?? null;
}



export async function getPendingInvitation() {
    const client = dataClient();

    try {
        const session = await fetchAuthSession();
        const email = session.tokens?.idToken?.payload?.email as string | undefined;

        if (!email) return null;

        const res = await client.models.Invitation.list({
            filter: {
                email: { eq: email },
                status: { eq: "PENDING" }
            }
        });

        const invite = res.data?.[0];

        console.log("Pending invite check:", invite);

        return invite || null;

    } catch (err) {
        console.error("Pending invite error", err);
        return null;
    }
}

