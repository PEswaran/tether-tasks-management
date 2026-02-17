import type { Schema } from "../../data/resource";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/sendAssignmentEmail";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";


const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env as any);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const ses = new SESClient({});

export const handler: Schema["sendAssignmentEmail"]["functionHandler"] =
    async (event) => {

        // 🎯 person receiving notification
        const { userSub: targetUserSub, type, itemName, workspaceId } = event.arguments;

        // 🧠 who triggered event
        let actorUserSub = "system";

        if (event.identity && "sub" in event.identity) {
            actorUserSub = event.identity.sub;
        }

        try {

            /* =====================================================
               GET TARGET USER PROFILE
            ===================================================== */

            const profRes = await client.models.UserProfile.list({
                filter: { userId: { eq: targetUserSub } }
            });

            const profile = profRes.data?.[0];
            if (!profile) throw new Error("User profile not found");

            const tenantId = profile.tenantId;
            const email = profile.email;

            /* =====================================================
               CREATE IN-APP NOTIFICATION
            ===================================================== */

            await client.models.Notification.create({
                tenantId,
                recipientId: targetUserSub,
                senderId: actorUserSub,

                type: type as any,
                title: buildTitle(type, itemName),
                message: buildMessage(type, itemName),

                isRead: false,
                createdAt: new Date().toISOString(),
            });


            /* =====================================================
               AUDIT LOG
            ===================================================== */

            await client.models.AuditLog.create({
                tenantId,
                workspaceId: workspaceId || null,
                userId: actorUserSub,
                action: "CREATE",
                resourceType: type,
                resourceId: itemName,
                timestamp: new Date().toISOString(),
            });


            /* =====================================================
               EMAIL (SES)
            ===================================================== */

            const subject = buildTitle(type, itemName);
            const body = buildEmailBody(type, itemName);

            await ses.send(new SendEmailCommand({
                Source: "no-reply@tethertasks.cloudling88.com",
                Destination: { ToAddresses: [email] },
                Message: {
                    Subject: { Data: subject },
                    Body: {
                        Html: { Data: body },
                        Text: { Data: buildMessage(type, itemName) },
                    },
                },
            }));

            return {
                success: true,
                message: "Notification + audit created"
            };

        } catch (err: any) {
            console.error("ASSIGNMENT EMAIL ERROR:", err);
            return { success: false, message: err.message };
        }
    };


/* =========================
   HELPERS
========================= */

function buildTitle(type: string, name: string) {
    if (type === "TASK") return `New task assigned: ${name}`;
    if (type === "BOARD") return `You were assigned a board: ${name}`;
    if (type === "INVITE") return `You were invited`;
    return `New update`;
}

function buildMessage(type: string, name: string) {
    if (type === "TASK") return `You have been assigned task "${name}"`;
    if (type === "BOARD") return `You are now owner of board "${name}"`;
    if (type === "INVITE") return `You have been invited to a workspace`;
    return name;
}

function buildEmailBody(type: string, name: string) {
    const title = buildTitle(type, name);
    const message = buildMessage(type, name);

    return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 14px; padding: 36px; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
            <h2 style="margin: 0 0 16px; font-size: 22px; color: #0f172a;">${title}</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${message}. Log in to your account to get started.</p>
            <a href="https://tethertasks.cloudling88.com"
               style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Open TetherTasks
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 28px;">
                TetherTasks &mdash; Task management for teams
            </p>
        </div>
    </div>`;
}
