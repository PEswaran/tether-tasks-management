import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "./data-client";

/**
 * Returns all memberships for the current user.
 */
export async function getMyMemberships(): Promise<any[]> {
    const session = await fetchAuthSession();
    const sub = session.tokens?.accessToken.payload.sub as string | undefined;
    if (!sub) return [];

    const client = dataClient();
    const res = await client.models.Membership.listMembershipsByUser({
        userSub: sub,
    });
    return res.data;
}

/**
 * Returns true if the user has at least one OWNER membership.
 */
export async function isOwner(): Promise<boolean> {
    const memberships = await getMyMemberships();
    return memberships.some((m: any) => m.role === "OWNER" && m.status !== "REMOVED");
}

/**
 * Returns org IDs where the user is OWNER.
 */
export async function getOwnerOrgIds(): Promise<string[]> {
    const memberships = await getMyMemberships();
    return memberships
        .filter((m: any) => m.role === "OWNER" && m.status !== "REMOVED")
        .map((m: any) => m.workspaceId);
}

/**
 * Returns the tenantId from the user's first membership.
 */
export async function getMyTenantId(): Promise<string | null> {
    const memberships = await getMyMemberships();
    return memberships[0]?.tenantId ?? null;
}

/**
 * Checks for any pending org invitation (OWNER or MEMBER role) for this user.
 */
export async function getPendingOrgInvitation(): Promise<any | null> {
    const session = await fetchAuthSession();
    const email = session.tokens?.idToken?.payload?.email as string;
    if (!email) return null;

    const client = dataClient();
    const res = await client.models.Invitation.list({
        filter: { email: { eq: email }, status: { eq: "PENDING" } },
    });

    // find an invitation with role OWNER or MEMBER (not TENANT_ADMIN)
    const inv = res.data.find(
        (i: any) => i.role === "OWNER" || i.role === "MEMBER"
    );
    return inv ?? null;
}
