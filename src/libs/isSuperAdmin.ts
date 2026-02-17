import { post } from "aws-amplify/api";
import { fetchAuthSession } from "aws-amplify/auth";

export async function isSuperAdmin(): Promise<boolean> {
    const session = await fetchAuthSession();

    const rawGroups =
        session.tokens?.accessToken.payload["cognito:groups"];

    // safely cast
    const groups: string[] = Array.isArray(rawGroups)
        ? rawGroups as string[]
        : [];

    return groups.includes("PLATFORM_SUPER_ADMIN");
}


export async function createTenant({ companyName, adminEmail }: any) {
    await post({
        apiName: "saasApi",
        path: "/super/create-tenant",
        options: {
            body: { companyName, adminEmail }
        }
    });
}
