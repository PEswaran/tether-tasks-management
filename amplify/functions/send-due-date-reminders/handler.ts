import type { Schema } from "../../data/resource";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/sendDueDateReminders";

const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env as any);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const ses = new SESClient({ region: process.env.AWS_REGION });

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

function startOfDayUTC(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getUrgencyLabel(diffDays: number): { label: string; color: string } {
    if (diffDays <= 0) return { label: "OVERDUE", color: "#dc2626" };
    if (diffDays === 1) return { label: "Due Tomorrow", color: "#ea580c" };
    if (diffDays === 2) return { label: "Due in 2 Days", color: "#ca8a04" };
    return { label: "Due in 3 Days", color: "#ca8a04" };
}

function buildEmailHtml(taskTitle: string, dueDate: string, urgency: { label: string; color: string }): string {
    const formattedDate = new Date(dueDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a5f;">Task Due Date Reminder</h2>
            <div style="background-color: ${urgency.color}; color: white; display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-bottom: 16px;">
                ${urgency.label}
            </div>
            <p style="font-size: 16px; color: #1e293b;">
                <strong>${taskTitle}</strong>
            </p>
            <p style="font-size: 14px; color: #475569;">
                Due date: <strong>${formattedDate}</strong>
            </p>
            <p style="font-size: 14px; color: #475569;">
                Log in to <a href="https://www.tethertasks.com" style="color: #2563eb;">Tether Tasks</a> to view and update this task.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
            <p style="font-size: 12px; color: #94a3b8;">
                This is an automated reminder from Tether Tasks.
            </p>
        </div>
    `;
}

export const handler = async (event: any) => {
    console.log("sendDueDateReminders invoked", JSON.stringify(event));

    const todayStart = startOfDayUTC(new Date());

    try {
        const tasks = await listAll(
            (args: any) => client.models.Task.list(args),
            {
                filter: {
                    status: { ne: "DONE" },
                },
            }
        );

        const qualifyingTasks = tasks.filter((t: any) => {
            if (!t.dueDate || !t.assignedTo) return false;
            if (t.status === "DONE" || t.status === "ARCHIVED") return false;

            const dueDateStart = startOfDayUTC(new Date(t.dueDate));
            const diffDays = Math.floor(
                (dueDateStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
            );
            return diffDays <= 3;
        });

        console.log(`Found ${qualifyingTasks.length} tasks needing reminders out of ${tasks.length} total`);

        const emailCache = new Map<string, string | null>();
        let notificationCount = 0;
        let emailCount = 0;

        for (const task of qualifyingTasks) {
            const t = task as any;
            const dueDateStart = startOfDayUTC(new Date(t.dueDate));
            const diffDays = Math.floor(
                (dueDateStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
            );
            const urgency = getUrgencyLabel(diffDays);
            const notificationType = diffDays <= 0 ? "TASK_OVERDUE" : "TASK_DUE_REMINDER";

            // Create in-app notification
            await client.models.Notification.create({
                tenantId: t.tenantId,
                organizationId: t.organizationId || undefined,
                workspaceId: t.workspaceId || undefined,
                recipientId: t.assignedTo,
                senderId: "system",
                type: notificationType,
                title: urgency.label,
                message: `"${t.title}" is ${diffDays <= 0 ? "overdue" : `due ${diffDays === 1 ? "tomorrow" : `in ${diffDays} days`}`}`,
                resourceId: t.id,
                isRead: false,
                emailSent: false,
                createdAt: new Date().toISOString(),
            });
            notificationCount++;

            // Look up assignee email (cached)
            let email: string | null;
            if (emailCache.has(t.assignedTo)) {
                email = emailCache.get(t.assignedTo)!;
            } else {
                const profile = await client.models.UserProfile.get({
                    userId: t.assignedTo,
                });
                email = profile?.data?.email ?? null;
                emailCache.set(t.assignedTo, email);
            }

            if (!email) continue;

            // Send email
            try {
                await ses.send(
                    new SendEmailCommand({
                        Destination: { ToAddresses: [email] },
                        Message: {
                            Subject: {
                                Data: `${urgency.label}: ${t.title}`,
                            },
                            Body: {
                                Html: {
                                    Data: buildEmailHtml(t.title, t.dueDate, urgency),
                                },
                            },
                        },
                        Source: "noreply@tethertasks.com",
                    })
                );
                emailCount++;
            } catch (emailErr: any) {
                console.error(`Failed to send email to ${email}:`, emailErr.message);
            }
        }

        console.log(`Due date reminders complete: ${notificationCount} notifications, ${emailCount} emails sent`);
        return { success: true, notificationCount, emailCount };
    } catch (err: any) {
        console.error("sendDueDateReminders error:", err);
        return { success: false, message: err.message };
    }
};
