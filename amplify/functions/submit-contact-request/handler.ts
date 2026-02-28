import {
    CognitoIdentityProviderClient,
    ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

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
const ses = new SESClient({});

export const handler: Schema["submitContactRequest"]["functionHandler"] =
    async (event) => {

        const { name, email, companyName, phone, teamSize, numberOfOrgs, businessType, message } = event.arguments;
        const userPoolId = process.env.USER_POOL_ID;
        const destinationEmail = process.env.CONTACT_REQUEST_TO_EMAIL || "parveeneswaran@outlook.com";
        const sourceEmail = process.env.CONTACT_REQUEST_FROM_EMAIL || "no-reply@tethertasks.cloudling88.com";

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

            /* =========================================================
               SEND EMAIL TO CONTACT INBOX
            ========================================================= */
            const subject = `New Contact Request: ${companyName}`;
            const textBody = [
                "New contact request submitted.",
                `Name: ${name}`,
                `Email: ${email}`,
                `Company: ${companyName}`,
                `Phone: ${phone || "—"}`,
                `Team Size: ${teamSize || "—"}`,
                `Number of Orgs: ${numberOfOrgs || "—"}`,
                `Business Type: ${businessType || "—"}`,
                "",
                "Message:",
                message,
            ].join("\n");

            const htmlBody = `
                <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif; color: #0f172a;">
                    <h2 style="margin: 0 0 12px;">New Contact Request</h2>
                    <p style="margin: 0 0 8px;"><strong>Name:</strong> ${name}</p>
                    <p style="margin: 0 0 8px;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 0 0 8px;"><strong>Company:</strong> ${companyName}</p>
                    <p style="margin: 0 0 8px;"><strong>Phone:</strong> ${phone || "—"}</p>
                    <p style="margin: 0 0 8px;"><strong>Team Size:</strong> ${teamSize || "—"}</p>
                    <p style="margin: 0 0 8px;"><strong>Number of Orgs:</strong> ${numberOfOrgs || "—"}</p>
                    <p style="margin: 0 0 8px;"><strong>Business Type:</strong> ${businessType || "—"}</p>
                    <p style="margin: 12px 0 4px;"><strong>Message:</strong></p>
                    <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; white-space: pre-wrap;">${message}</div>
                </div>
            `;

            await ses.send(
                new SendEmailCommand({
                    Source: sourceEmail,
                    Destination: { ToAddresses: [destinationEmail] },
                    Message: {
                        Subject: { Data: subject },
                        Body: {
                            Text: { Data: textBody },
                            Html: { Data: htmlBody },
                        },
                    },
                })
            );

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
