import { dataClient } from "./data-client";
import { fetchAuthSession } from "aws-amplify/auth";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "INVITE" | "REMOVE" | "LOGIN" | "LOGOUT" | "ASSIGN";

export async function logAudit(params: {
    tenantId?: string | null;
    organizationId?: string | null;
    workspaceId?: string | null;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    result?: string;
    metadata?: Record<string, any>;
    userId?: string;
}) {
    try {
        let userId = params.userId;
        if (!userId) {
            const session = await fetchAuthSession();
            userId = session.tokens?.accessToken?.payload?.sub as string;
        }
        const client = dataClient();
        await (client.models as any).AuditLog.create({
            tenantId: params.tenantId || undefined,
            organizationId: params.organizationId || undefined,
            workspaceId: params.workspaceId || undefined,
            userId,
            action: params.action,
            resourceType: params.resourceType,
            resourceId: params.resourceId,
            result: params.result || "SUCCESS",
            metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.warn("Audit log failed:", err);
    }
}
