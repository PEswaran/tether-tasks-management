import {
    CognitoIdentityProviderClient,
    ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/submitContactRequest";
import { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env as any);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});

export const handler: Schema["submitContactRequest"]["functionHandler"] =
    async (event) => {

        const { name, email, companyName, phone, teamSize, numberOfOrgs, businessType, message } = event.arguments;
        const userPoolId = process.env.USER_POOL_ID;

        if (!userPoolId) throw new Error("Missing USER_POOL_ID");

        try {

            /* =========================================================
               AUDIT LOG
            ========================================================= */
            await client.models.AuditLog.create({
                tenantId: "PLATFORM",
                userId: "anonymous",
                action: "CREATE",
                resourceType: "CONTACT_REQUEST",
                result: "SUCCESS",
                metadata: JSON.stringify({
                    name,
                    email,
                    companyName,
                    phone: phone || "",
                    teamSize: teamSize || "",
                    numberOfOrgs: numberOfOrgs || "",
                    businessType: businessType || "",
                    message,
                }),
                timestamp: new Date().toISOString(),
            });

            /* =========================================================
               FIND ALL PLATFORM_SUPER_ADMIN USERS
            ========================================================= */
            const adminsRes = await cognito.send(
                new ListUsersInGroupCommand({
                    UserPoolId: userPoolId,
                    GroupName: "PLATFORM_SUPER_ADMIN",
                })
            );

            const adminSubs = (adminsRes.Users || [])
                .map(u => u.Attributes?.find(a => a.Name === "sub")?.Value)
                .filter(Boolean) as string[];

            /* =========================================================
               CREATE NOTIFICATION FOR EACH SUPER ADMIN
            ========================================================= */
            for (const adminSub of adminSubs) {
                await client.models.Notification.create({
                    tenantId: "PLATFORM",
                    recipientId: adminSub,
                    type: "CONTACT_REQUEST",
                    title: "New Contact Request",
                    message: `${name} from ${companyName} (${email}) wants to get started.${numberOfOrgs ? ` Orgs: ${numberOfOrgs}.` : ""}${businessType ? ` Type: ${businessType}.` : ""}`,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                });
            }

            console.log("CONTACT REQUEST PROCESSED:", email, "notified", adminSubs.length, "admins");

            return {
                success: true,
                message: "Your request has been submitted. We'll be in touch shortly!",
            };

        } catch (err: any) {
            console.error("CONTACT REQUEST ERROR:", err);
            return { success: false, message: err.message };
        }
    };
