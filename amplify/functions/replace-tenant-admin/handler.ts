import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    AdminGetUserCommand,
    AdminDisableUserCommand,
    AdminRemoveUserFromGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/replaceTenantAdmin";
import { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env as any);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});

export const handler: Schema["replaceTenantAdmin"]["functionHandler"] =
    async (event) => {

        const { tenantId, newAdminEmail, oldMembershipId } = event.arguments;
        const userPoolId = process.env.USER_POOL_ID;

        if (!userPoolId) throw new Error("Missing USER_POOL_ID");
        if (!tenantId || !newAdminEmail || !oldMembershipId) {
            return { success: false, message: "Missing required arguments" };
        }

        try {

            /* =========================================================
               FETCH OLD MEMBERSHIP
            ========================================================= */
            const oldMembership = await client.models.Membership.get({ id: oldMembershipId });
            if (!oldMembership.data) {
                return { success: false, message: "Old membership not found" };
            }

            const oldUserSub = oldMembership.data.userSub;

            // Look up the old admin's email for Cognito commands
            const oldProfile = await client.models.UserProfile.get({ userId: oldUserSub });
            const oldAdminEmail = oldProfile.data?.email;
            if (!oldAdminEmail) {
                return { success: false, message: "Could not find old admin's email" };
            }

            /* =========================================================
               DISABLE OLD ADMIN IN COGNITO
            ========================================================= */
            await cognito.send(new AdminDisableUserCommand({
                UserPoolId: userPoolId,
                Username: oldAdminEmail,
            }));

            /* =========================================================
               REMOVE OLD ADMIN FROM TENANT_ADMIN GROUP
            ========================================================= */
            await cognito.send(new AdminRemoveUserFromGroupCommand({
                UserPoolId: userPoolId,
                Username: oldAdminEmail,
                GroupName: "TENANT_ADMIN",
            }));

            /* =========================================================
               MARK OLD MEMBERSHIP AS REMOVED
            ========================================================= */
            await client.models.Membership.update({
                id: oldMembershipId,
                status: "REMOVED",
            });

            /* =========================================================
               CREATE OR FIND NEW COGNITO USER
            ========================================================= */
            let newUserSub: string | undefined;

            try {
                const existing = await cognito.send(new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: newAdminEmail,
                }));
                newUserSub = existing.UserAttributes?.find(
                    a => a.Name === "sub"
                )?.Value;
            } catch (err: any) {
                if (err.name !== "UserNotFoundException") throw err;

                // Create new Cognito user
                const created = await cognito.send(
                    new AdminCreateUserCommand({
                        UserPoolId: userPoolId,
                        Username: newAdminEmail,
                        UserAttributes: [
                            { Name: "email", Value: newAdminEmail },
                            { Name: "email_verified", Value: "true" },
                            { Name: "custom:tenantId", Value: tenantId },
                        ],
                        DesiredDeliveryMediums: ["EMAIL"],
                    })
                );
                newUserSub = created.User?.Attributes?.find(
                    a => a.Name === "sub"
                )?.Value;
            }

            if (!newUserSub) {
                return { success: false, message: "Failed to get new admin's Cognito sub" };
            }

            /* =========================================================
               ADD NEW USER TO TENANT_ADMIN GROUP
            ========================================================= */
            await cognito.send(new AdminAddUserToGroupCommand({
                UserPoolId: userPoolId,
                Username: newAdminEmail,
                GroupName: "TENANT_ADMIN",
            }));

            /* =========================================================
               CREATE USER PROFILE (safe — catch if exists)
            ========================================================= */
            try {
                await client.models.UserProfile.create({
                    userId: newUserSub,
                    tenantId,
                    email: newAdminEmail,
                    role: "TENANT_ADMIN",
                    firstName: "",
                    lastName: "",
                    createdAt: new Date().toISOString(),
                });
            } catch {
                // Profile may already exist — that's fine
            }

            /* =========================================================
               FIND WORKSPACE FOR MEMBERSHIP
            ========================================================= */
            const workspaces = await client.models.Workspace.workspacesByTenant({ tenantId });

            const workspaceId = workspaces.data?.[0]?.id;
            if (!workspaceId) {
                return { success: false, message: "No workspace found for this tenant" };
            }

            /* =========================================================
               CREATE MEMBERSHIP FOR NEW ADMIN
            ========================================================= */
            await client.models.Membership.create({
                tenantId,
                workspaceId,
                userSub: newUserSub,
                role: "TENANT_ADMIN",
                status: "ACTIVE",
                joinedAt: new Date().toISOString(),
            });

            /* =========================================================
               AUDIT LOG
            ========================================================= */
            await client.models.AuditLog.create({
                tenantId,
                workspaceId,
                userId: "platform_admin",
                action: "UPDATE",
                resourceType: "TENANT",
                resourceId: tenantId,
                result: "SUCCESS",
                metadata: JSON.stringify({
                    type: "REPLACE_ADMIN",
                    oldAdminEmail,
                    newAdminEmail,
                }),
                timestamp: new Date().toISOString(),
            });

            return {
                success: true,
                message: `Admin replaced: ${oldAdminEmail} → ${newAdminEmail}`,
            };

        } catch (err: any) {
            console.error("REPLACE TENANT ADMIN ERROR:", err);
            return { success: false, message: err.message };
        }
    };
