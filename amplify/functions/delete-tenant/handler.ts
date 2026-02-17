import type { Schema } from "../../data/resource";
import {
    CognitoIdentityProviderClient,
    AdminDeleteUserCommand,
    AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/deleteTenant";

const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env as any);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});

/** Helper: list ALL items using nextToken pagination */
async function listAll<T>(
    listFn: (args: any) => Promise<{ data: T[]; nextToken?: string | null }>,
    args: Record<string, any>
): Promise<T[]> {
    const all: T[] = [];
    let nextToken: string | null | undefined = undefined;
    do {
        const res = await listFn({ ...args, nextToken });
        all.push(...res.data);
        nextToken = (res as any).nextToken ?? null;
    } while (nextToken);
    return all;
}

export const handler: Schema["removeTenantAndData"]["functionHandler"] =
    async (event) => {
        const { tenantId } = event.arguments;
        const userPoolId = process.env.USER_POOL_ID;

        if (!userPoolId) throw new Error("Missing USER_POOL_ID");
        if (!tenantId) return { success: false, message: "Missing tenantId" };

        try {
            // Safety guard: check for active non-admin members
            const memberships = await listAll(
                (args) => client.models.Membership.list(args),
                { filter: { tenantId: { eq: tenantId } } }
            );

            const activeNonAdmins = memberships.filter(
                (m: any) => m.role !== "TENANT_ADMIN" && m.status !== "REMOVED"
            );

            if (activeNonAdmins.length > 0) {
                return {
                    success: false,
                    message: "Cannot delete: tenant has active members. Remove all non-admin members first.",
                };
            }

            // 1. Delete all Invitations
            const invitations = await listAll(
                (args) => client.models.Invitation.list(args),
                { filter: { tenantId: { eq: tenantId } } }
            );
            for (const inv of invitations) {
                await client.models.Invitation.delete({ id: (inv as any).id });
            }

            // 2. Delete all Notifications
            try {
                const notifications = await listAll(
                    (args) => client.models.Notification.list(args),
                    { filter: { tenantId: { eq: tenantId } } }
                );
                for (const n of notifications) {
                    await client.models.Notification.delete({ id: (n as any).id });
                }
            } catch {
                // Notification model may not exist yet — safe to skip
            }

            // 3. Delete all Tasks
            const tasks = await listAll(
                (args) => client.models.Task.list(args),
                { filter: { tenantId: { eq: tenantId } } }
            );
            for (const task of tasks) {
                await client.models.Task.delete({ id: (task as any).id });
            }

            // 4. Delete all TaskBoards
            const taskBoards = await listAll(
                (args) => client.models.TaskBoard.list(args),
                { filter: { tenantId: { eq: tenantId } } }
            );
            for (const board of taskBoards) {
                await client.models.TaskBoard.delete({ id: (board as any).id });
            }

            // 5. Delete all AuditLogs
            const auditLogs = await listAll(
                (args) => client.models.AuditLog.list(args),
                { filter: { tenantId: { eq: tenantId } } }
            );
            for (const log of auditLogs) {
                await client.models.AuditLog.delete({ id: (log as any).id });
            }

            // 6. Delete all Organizations
            const orgs = await listAll(
                (args) => client.models.Workspace.list(args),
                { filter: { tenantId: { eq: tenantId } } }
            );
            for (const org of orgs) {
                await client.models.Workspace.delete({ id: (org as any).id });
            }

            // 7. For each Membership: delete Cognito user, UserProfile, then Membership
            for (const mem of memberships) {
                const m = mem as any;

                // Delete Cognito user by looking up via userSub
                if (m.userSub) {
                    try {
                        // Get Cognito username from sub
                        const userInfo = await cognito.send(
                            new AdminGetUserCommand({
                                UserPoolId: userPoolId,
                                Username: m.userSub,
                            })
                        );

                        if (userInfo.Username) {
                            await cognito.send(
                                new AdminDeleteUserCommand({
                                    UserPoolId: userPoolId,
                                    Username: userInfo.Username,
                                })
                            );
                        }
                    } catch (err: any) {
                        // User may already be deleted — skip
                        if (err.name !== "UserNotFoundException") {
                            console.warn(`Failed to delete Cognito user ${m.userSub}:`, err.message);
                        }
                    }
                }

                // Delete UserProfile
                if (m.userId) {
                    try {
                        await client.models.UserProfile.delete({ userId: m.userId });
                    } catch {
                        // Profile may not exist — skip
                    }
                }

                // Delete Membership
                await client.models.Membership.delete({ id: m.id });
            }

            // 8. Delete the Tenant record
            const tenantRecord = await client.models.Tenant.get({ id: tenantId });
            if (tenantRecord.data) {
                await client.models.Tenant.delete({ id: tenantRecord.data.id });
            }

            return {
                success: true,
                message: "Tenant and all associated data deleted successfully.",
            };

        } catch (err: any) {
            console.error("deleteTenant error:", err);
            return { success: false, message: err.message };
        }
    };
