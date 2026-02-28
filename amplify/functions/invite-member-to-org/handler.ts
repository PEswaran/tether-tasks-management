import type { Schema } from "../../data/resource";
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/inviteMemberToOrg";

const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env as any);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});

export const handler: Schema["inviteMemberToOrg"]["functionHandler"] =
    async (event) => {

        const { email, organizationId, tenantId, role } = event.arguments as any;
        const userPoolId = process.env.USER_POOL_ID;

        if (!userPoolId) throw new Error("Missing USER_POOL_ID");

        const invitedBy =
            event.identity && "sub" in event.identity
                ? event.identity.sub
                : "system";

        try {

            /* =========================================================
               🔒 BULLETPROOF ROLE PROTECTION
            ========================================================= */

            if (!organizationId) {
                return { success: false, message: "Organization is required", invitationId: null };
            }

            if (!role) {
                return { success: false, message: "Role is required", invitationId: null };
            }

            // 🚨 NEVER allow tenant admin creation via workspace invite
            if (role === "TENANT_ADMIN" || role === "PLATFORM_SUPER_ADMIN") {
                return {
                    success: false,
                    message: "Tenant admins can only be created by platform admin.",
                    invitationId: null,
                };
            }

            /* =========================================================
               🔒 PERMISSION CHECK
            ========================================================= */

            if (invitedBy !== "system") {
                const callerMemberships =
                    await client.models.Membership.listMembershipsByUser(
                        { userSub: invitedBy }
                    );

                const isTenantAdmin = callerMemberships.data.some(
                    (m: any) => m.tenantId === tenantId && m.role === "TENANT_ADMIN"
                );

                const isOrgOwner = callerMemberships.data.some(
                    (m: any) =>
                        m.organizationId === organizationId &&
                        m.role === "OWNER" &&
                        m.status === "ACTIVE"
                );

                if (!isTenantAdmin && !isOrgOwner) {
                    return {
                        success: false,
                        message: "You do not have permission to invite members.",
                        invitationId: null,
                    };
                }
            }

            /* =========================================================
               🛑 SINGLE OWNER CHECK
            ========================================================= */

            if (role === "OWNER") {
                const existingOwner =
                    await client.models.Membership.listMembershipsByOrganization(
                        { organizationId }
                    );

                const hasActiveOwner = existingOwner.data.some(
                    (m: any) => m.role === "OWNER" && m.status === "ACTIVE"
                );

                if (hasActiveOwner) {
                    return {
                        success: false,
                        message: "Workspace already has an owner.",
                        invitationId: null,
                    };
                }

                const existingInvites =
                    await client.models.Invitation.listInvitesByOrganization(
                        { organizationId }
                    );

                const hasPendingOwner = existingInvites.data.some(
                    (inv: any) => inv.role === "OWNER" && inv.status === "PENDING"
                );

                if (hasPendingOwner) {
                    return {
                        success: false,
                        message: "There is already a pending owner invitation.",
                        invitationId: null,
                    };
                }
            }

            /* =========================================================
               👤 CREATE OR FIND COGNITO USER
            ========================================================= */

            let userSub: string;
            let isNewUser = false;

            try {
                const existingUser = await cognito.send(
                    new AdminGetUserCommand({
                        UserPoolId: userPoolId,
                        Username: email,
                    })
                );

                userSub =
                    existingUser.UserAttributes?.find((a) => a.Name === "sub")?.Value || "";

                if (!userSub) throw new Error("Existing user missing sub");

            } catch (err: any) {
                if (err.name === "UserNotFoundException") {
                    isNewUser = true;

                    const createUser = await cognito.send(
                        new AdminCreateUserCommand({
                            UserPoolId: userPoolId,
                            Username: email,
                            UserAttributes: [
                                { Name: "email", Value: email },
                                { Name: "email_verified", Value: "true" },
                                { Name: "custom:tenantId", Value: tenantId },
                            ],
                            DesiredDeliveryMediums: ["EMAIL"],
                        })
                    );

                    userSub =
                        createUser.User?.Attributes?.find((a) => a.Name === "sub")?.Value || "";

                    if (!userSub) throw new Error("No sub returned");

                    // default cognito group
                    await cognito.send(
                        new AdminAddUserToGroupCommand({
                            UserPoolId: userPoolId,
                            Username: email,
                            GroupName: "MEMBER",
                        })
                    );

                } else {
                    throw err;
                }
            }

            /* =========================================================
               👤 USER PROFILE (safe create)
            ========================================================= */

            try {
                await client.models.UserProfile.create({
                    userId: userSub,
                    tenantId,
                    email,
                    role: role as any,
                    createdAt: new Date().toISOString(),
                });
            } catch {
                // already exists → ok
            }

            /* =========================================================
               🔔 NOTIFICATION
            ========================================================= */

            await client.models.Notification.create({
                tenantId,
                organizationId,
                recipientId: userSub,
                senderId: invitedBy,
                type: "INVITED_TO_WORKSPACE",
                title: "You've been invited to an organization",
                message: `You've been invited as ${role}`,
                link: "/app",
                isRead: false,
                emailSent: false,
                createdAt: new Date().toISOString(),
            });

            /* =========================================================
               ✉️ SEND EMAIL (non-blocking)
               New users get Cognito temp password email automatically.
               Existing users get the invite email via SES.
            ========================================================= */

            if (!isNewUser) {
                try {
                    await client.mutations.sendAssignmentEmail({
                        userSub,
                        type: "INVITE",
                        itemName: "Organization",
                        workspaceId: organizationId,
                    });
                } catch (emailErr) {
                    console.warn("sendAssignmentEmail failed (non-critical):", emailErr);
                }
            }

            /* =========================================================
               ✉️ INVITATION RECORD
            ========================================================= */

            const token = crypto.randomUUID();
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + 7);

            const invitation = await client.models.Invitation.create({
                tenantId,
                organizationId,
                email,
                role: role as any,
                status: "PENDING",
                token,
                invitedBy,
                expiresAt: expiresAt.toISOString(),
                sentAt: now.toISOString(),
            });

            return {
                success: true,
                message: "Member invited successfully",
                invitationId: invitation.data?.id ?? null,
            };

        } catch (err: any) {
            console.error(err);
            return { success: false, message: err.message, invitationId: null };
        }
    };
