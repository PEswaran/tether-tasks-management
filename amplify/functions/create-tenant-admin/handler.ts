import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    AdminGetUserCommand
} from "@aws-sdk/client-cognito-identity-provider";

import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/createTenantAdmin";
import { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env as any);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});

export const handler: Schema["createTenantAdmin"]["functionHandler"] =
    async (event) => {

        const { companyName, adminEmail } = event.arguments;
        const userPoolId = process.env.USER_POOL_ID;

        if (!userPoolId) throw new Error("Missing USER_POOL_ID");

        try {

            /* =========================================================
               CHECK IF USER ALREADY EXISTS IN COGNITO
            ========================================================= */
            let userSub: string;
            let isExistingUser = false;

            try {
                const existingUser = await cognito.send(new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: adminEmail,
                }));

                // User exists — extract their sub
                userSub = existingUser.UserAttributes?.find(
                    a => a.Name === "sub"
                )?.Value!;

                if (!userSub) throw new Error("Existing user has no sub");
                isExistingUser = true;

            } catch (err: any) {
                if (err.name !== "UserNotFoundException") throw err;

                // User does NOT exist — will create below after tenant
                userSub = ""; // placeholder, set after Cognito creation
            }

            /* =========================================================
               CREATE TENANT
            ========================================================= */
            const tenantRes = await client.models.Tenant.create({
                companyName,
                status: "ACTIVE",
                isActive: true,
                createdAt: new Date().toISOString()
            });

            const tenantId = tenantRes.data?.id;
            if (!tenantId) throw new Error("Tenant creation failed");

            /* =========================================================
               CREATE DEFAULT WORKSPACE
            ========================================================= */
            const workspaceRes = await client.models.Workspace.create({
                tenantId,
                name: "General",
                description: "Default workspace",
                ownerUserSub: "pending",
                createdBy: "system",
                isActive: true,
                isDeleted: false,
                createdAt: new Date().toISOString(),
            });

            const workspaceId = workspaceRes.data?.id;
            if (!workspaceId) throw new Error("Workspace failed");

            if (!isExistingUser) {
                /* =========================================================
                   CREATE COGNITO USER (new user only)
                ========================================================= */
                const createUser = await cognito.send(
                    new AdminCreateUserCommand({
                        UserPoolId: userPoolId,
                        Username: adminEmail,
                        UserAttributes: [
                            { Name: "email", Value: adminEmail },
                            { Name: "email_verified", Value: "true" },
                            { Name: "custom:tenantId", Value: tenantId }
                        ],
                        DesiredDeliveryMediums: ["EMAIL"],
                    })
                );

                userSub = createUser.User?.Attributes?.find(
                    a => a.Name === "sub"
                )?.Value!;

                if (!userSub) throw new Error("No Cognito sub returned");

                /* =========================================================
                   ADD TO TENANT ADMIN GROUP (new user only)
                ========================================================= */
                await cognito.send(
                    new AdminAddUserToGroupCommand({
                        UserPoolId: userPoolId,
                        Username: adminEmail,
                        GroupName: "TENANT_ADMIN",
                    })
                );

                /* =========================================================
                   CREATE USER PROFILE (new user only)
                ========================================================= */
                await client.models.UserProfile.create({
                    userId: userSub,
                    tenantId,
                    email: adminEmail,
                    role: "TENANT_ADMIN",
                    firstName: "",
                    lastName: "",
                    createdAt: new Date().toISOString(),
                });
            }

            /* =========================================================
               CREATE MEMBERSHIP
            ========================================================= */
            await client.models.Membership.create({
                tenantId,
                workspaceId,
                userSub,
                role: "TENANT_ADMIN",
                status: "ACTIVE",
                joinedAt: new Date().toISOString(),
            });

            /* =========================================================
               CREATE SUBSCRIPTION (FAKE STRIPE FOR NOW)
            ========================================================= */

            /* =========================================================
               INVITATION TRACKING RECORD
            ========================================================= */
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + 7);

            await client.models.Invitation.create({
                tenantId,
                workspaceId,
                email: adminEmail,
                role: "TENANT_ADMIN",
                status: "PENDING",
                invitedBy: "platform",
                token: crypto.randomUUID(),
                sentAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
            });

            /* =========================================================
               AUDIT LOG
            ========================================================= */
            await client.models.AuditLog.create({
                tenantId,
                workspaceId,
                userId: "platform_admin",
                action: "CREATE",
                resourceType: "TENANT",
                resourceId: tenantId,
                result: "SUCCESS",
                timestamp: new Date().toISOString(),
            });

            console.log("TENANT CREATED:", tenantId);

            return {
                success: true,
                tenantId,
                message: "Tenant + admin created successfully"
            };

        } catch (err: any) {
            console.error("TENANT CREATE ERROR:", err);
            return { success: false, message: err.message };
        }
    };
