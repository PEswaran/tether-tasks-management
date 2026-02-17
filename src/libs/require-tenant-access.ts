import { dataClient } from "./data-client";


export async function requireTenantAccess(userSub: string, tenantId: string) {
    const res = await dataClient().models.Membership.list({
        filter: {
            userSub: { eq: userSub },
            tenantId: { eq: tenantId },
            status: { eq: "ACTIVE" }
        }
    });

    if (!res.data.length) {
        throw new Error("Tenant access denied");
    }

    return res.data[0];
}
