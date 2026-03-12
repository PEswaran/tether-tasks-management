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
 * Returns true if the user has at least one MEMBER role and NO OWNER role.
 * (Owners use the OwnerShell instead.)
 */
export async function isMember(): Promise<boolean> {
    const memberships = await getMyMemberships();
    const hasOwner = memberships.some((m: any) => m.role === "OWNER" && m.status !== "REMOVED");
    if (hasOwner) return false;
    return memberships.some((m: any) => m.role === "MEMBER" && m.status !== "REMOVED");
}

/**
 * Returns org IDs where the user is MEMBER (and not REMOVED).
 */
export async function getMemberOrgIds(): Promise<string[]> {
    const memberships = await getMyMemberships();
    return memberships
        .filter((m: any) => m.role === "MEMBER" && m.status !== "REMOVED")
        .map((m: any) => m.organizationId || m.workspaceId)
        .filter(Boolean);
}

/**
 * Returns the tenantId from the user's first membership.
 */
export async function getMyTenantId(): Promise<string | null> {
    const memberships = await getMyMemberships();
    return memberships[0]?.tenantId ?? null;
}

/**
 * Returns the current user's Cognito sub.
 */
export async function getMySub(): Promise<string | null> {
    const session = await fetchAuthSession();
    return (session.tokens?.accessToken.payload.sub as string) ?? null;
}
