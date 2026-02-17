import { generateClient } from "aws-amplify/data";
import { Schema } from "../../data/resource";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const client = generateClient<Schema>();
const ses = new SESClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
    console.log("EVENT:", JSON.stringify(event));

    const task = event.arguments?.task;
    if (!task?.assignedTo) return { ok: true };

    const { tenantId, workspaceId, assignedTo, title, createdBy } = task;

    /* ===============================
       1. CREATE IN-APP NOTIFICATION
    =============================== */
    await client.models.Notification.create({
        tenantId,
        workspaceId,
        recipientId: assignedTo,
        senderId: createdBy,
        type: "TASK_ASSIGNED",
        title: "New task assigned",
        message: `You were assigned: ${title}`,
        isRead: false,
        createdAt: new Date().toISOString(),
    });

    /* ===============================
       2. LOOKUP USER EMAIL
    =============================== */
    const profile = await client.models.UserProfile.get({
        userId: assignedTo
    });

    const email = profile?.data?.email;
    if (!email) return { ok: true };

    /* ===============================
       3. SEND EMAIL
    =============================== */
    await ses.send(new SendEmailCommand({
        Destination: { ToAddresses: [email] },
        Message: {
            Subject: { Data: "New Task Assigned" },
            Body: {
                Html: {
                    Data: `
            <h2>You have a new task</h2>
            <p><b>${title}</b> was assigned to you.</p>
            <p>Login to view it.</p>
          `
                }
            }
        },
        Source: "noreply@tethertasks.cloudling88.com"
    }));

    return { ok: true };
};
