import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/createPilot";
import { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env as any);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});
const ses = new SESClient({});
const s3 = new S3Client({});

function hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

async function generatePdf(data: {
    companyName: string;
    adminName: string;
    adminEmail: string;
    pilotDurationDays: number;
    pilotStartDate: string;
    pilotEndDate: string;
    agreementNotes?: string;
}): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const regular = await doc.embedFont(StandardFonts.Helvetica);

    const navy = hexToRgb("#1e3a5f");
    const gray = hexToRgb("#64748b");
    const dark = hexToRgb("#1e293b");
    const muted = hexToRgb("#475569");
    const lightGray = hexToRgb("#e2e8f0");

    const margin = 60;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const contentWidth = pageWidth - margin * 2;
    const bottomMargin = 60;

    let page = doc.addPage([pageWidth, pageHeight]); // A4
    let y = 780;

    // Helper: check if we need a new page and add one if so
    function ensureSpace(needed: number) {
        if (y - needed < bottomMargin) {
            page = doc.addPage([pageWidth, pageHeight]);
            y = 780;
        }
    }

    // Helper: word-wrap and draw text, handling page breaks
    function drawWrappedText(text: string, font: typeof regular, size: number, color: typeof dark, indent = 0) {
        const maxWidth = contentWidth - indent;
        const words = text.split(/\s+/);
        let line = "";
        const lineHeight = size + 4;
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(test, size) > maxWidth) {
                ensureSpace(lineHeight);
                page.drawText(line, { x: margin + indent, y, font, size, color });
                y -= lineHeight;
                line = word;
            } else {
                line = test;
            }
        }
        if (line) {
            ensureSpace(lineHeight);
            page.drawText(line, { x: margin + indent, y, font, size, color });
            y -= lineHeight;
        }
    }

    // Header
    const titleText = "Tether Tasks";
    const titleWidth = bold.widthOfTextAtSize(titleText, 24);
    page.drawText(titleText, { x: (pageWidth - titleWidth) / 2, y, font: bold, size: 24, color: navy });
    y -= 24;

    const subText = "Pilot Program Agreement";
    const subWidth = regular.widthOfTextAtSize(subText, 16);
    page.drawText(subText, { x: (pageWidth - subWidth) / 2, y, font: regular, size: 16, color: gray });
    y -= 30;

    // Divider
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: lightGray });
    y -= 24;

    // Company Info fields
    const fields = [
        ["Company", data.companyName],
        ["Admin Contact", data.adminName],
        ["Email", data.adminEmail],
        ["Pilot Duration", `${data.pilotDurationDays} days`],
        ["Start Date", fmtDate(data.pilotStartDate)],
        ["End Date", fmtDate(data.pilotEndDate)],
    ];

    for (const [label, value] of fields) {
        ensureSpace(20);
        const labelStr = `${label}: `;
        page.drawText(labelStr, { x: margin, y, font: bold, size: 12, color: dark });
        const labelWidth = bold.widthOfTextAtSize(labelStr, 12);
        page.drawText(value, { x: margin + labelWidth, y, font: regular, size: 12, color: dark });
        y -= 20;
    }
    y -= 12;

    // Plan Features
    ensureSpace(22);
    page.drawText("Pilot Plan Features", { x: margin, y, font: bold, size: 14, color: navy });
    y -= 22;

    const features = [
        "Up to 3 organizations",
        "Up to 5 workspaces",
        "25 team members",
        "Unlimited tasks",
        "Full feature access during pilot period",
    ];
    for (const feature of features) {
        ensureSpace(18);
        page.drawText(`  \u2022  ${feature}`, { x: margin, y, font: regular, size: 11, color: dark });
        y -= 18;
    }
    y -= 12;

    // Agreement Notes
    if (data.agreementNotes) {
        ensureSpace(22);
        page.drawText("Agreement Notes", { x: margin, y, font: bold, size: 14, color: navy });
        y -= 22;

        drawWrappedText(data.agreementNotes, regular, 11, dark);
        y -= 12;
    }

    // Terms & Conditions
    ensureSpace(22);
    page.drawText("Terms & Conditions", { x: margin, y, font: bold, size: 14, color: navy });
    y -= 22;

    const termsClauses: { title: string; body: string }[] = [
        {
            title: "1. Pilot Access",
            body: "Company grants Customer a limited, non-exclusive, non-transferable license to use the TetherTasks platform solely for internal evaluation and feedback.",
        },
        {
            title: "2. Pilot Term",
            body: "The pilot begins on the Start Date and continues until the End Date unless terminated earlier by either party with five (5) days written notice.",
        },
        {
            title: "3. Experimental Nature",
            body: "The pilot environment is pre-release software and may contain bugs, incomplete features, or service interruptions. The service is provided 'AS IS' without warranties.",
        },
        {
            title: "4. Data Use",
            body: "Customer should use test or non-sensitive data whenever possible and only upload data it has permission to share.",
        },
        {
            title: "5. Confidentiality",
            body: "Customer agrees to keep non-public product information confidential including product features, pricing, and roadmap.",
        },
        {
            title: "6. Feedback",
            body: "Customer agrees to provide feedback and grants Company permission to use feedback to improve the product.",
        },
        {
            title: "7. Limitation of Liability",
            body: "Company's liability related to the pilot will not exceed the amount paid for the pilot, if any, and excludes indirect or consequential damages.",
        },
    ];

    for (const clause of termsClauses) {
        ensureSpace(32);
        page.drawText(clause.title, { x: margin, y, font: bold, size: 10, color: dark });
        y -= 14;
        drawWrappedText(clause.body, regular, 10, muted);
        y -= 8;
    }

    y -= 12;

    // Footer divider
    ensureSpace(40);
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: lightGray });
    y -= 18;

    const footerText = `Generated on ${fmtDate(new Date().toISOString())} — Tether Tasks Platform`;
    const footerWidth = regular.widthOfTextAtSize(footerText, 9);
    page.drawText(footerText, { x: (pageWidth - footerWidth) / 2, y, font: regular, size: 9, color: gray });

    return doc.save();
}

export const handler: Schema["createPilot"]["functionHandler"] =
    async (event) => {

        const {
            companyName, adminEmail,
            adminFirstName, adminLastName,
            pilotDurationDays: durationArg,
            pilotStartDate: startDateArg,
            pilotNotes, agreementNotes,
            orgName, workspaceName, boardName,
        } = event.arguments;

        const userPoolId = process.env.USER_POOL_ID;
        const bucketName = process.env.PILOT_BUCKET_NAME;

        if (!userPoolId) throw new Error("Missing USER_POOL_ID");
        if (!bucketName) throw new Error("Missing PILOT_BUCKET_NAME");

        try {
            const pilotDurationDays = durationArg || 30;
            const pilotStartDate = startDateArg
                ? new Date(startDateArg).toISOString()
                : new Date().toISOString();
            const endDate = new Date(pilotStartDate);
            endDate.setDate(endDate.getDate() + pilotDurationDays);
            const pilotEndDate = endDate.toISOString();
            const adminName = adminFirstName && adminLastName
                ? `${adminFirstName} ${adminLastName}` : adminEmail;

            /* =========================================================
               1. CHECK IF USER EXISTS IN COGNITO
            ========================================================= */
            let userSub: string;
            let isExistingUser = false;

            try {
                const existingUser = await cognito.send(new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: adminEmail,
                }));
                userSub = existingUser.UserAttributes?.find(
                    a => a.Name === "sub"
                )?.Value!;
                if (!userSub) throw new Error("Existing user has no sub");
                isExistingUser = true;
            } catch (err: any) {
                if (err.name !== "UserNotFoundException") throw err;
                userSub = "";
            }

            /* =========================================================
               2. CREATE TENANT (plan=PILOT)
            ========================================================= */
            const tenantRes = await client.models.Tenant.create({
                companyName,
                status: "ACTIVE",
                isActive: true,
                plan: "PILOT",
                subscriptionStatus: "PILOT",
                adminName,
                agreementNotes: agreementNotes || undefined,
                pilotStatus: "ACTIVE",
                pilotStartDate,
                pilotEndDate,
                pilotDurationDays,
                pilotNotes: pilotNotes || undefined,
                pilotContactName: adminName,
                pilotContactEmail: adminEmail,
                createdAt: new Date().toISOString(),
            });

            const tenantId = tenantRes.data?.id;
            if (!tenantId) throw new Error("Tenant creation failed");

            /* =========================================================
               3. CREATE COGNITO USER (if new)
            ========================================================= */
            if (!isExistingUser) {
                const userAttributes = [
                    { Name: "email", Value: adminEmail },
                    { Name: "email_verified", Value: "true" },
                    { Name: "custom:tenantId", Value: tenantId },
                ];
                if (adminFirstName && adminLastName) {
                    userAttributes.push({ Name: "name", Value: adminName });
                }

                const tempPassword = `Tether${crypto.randomUUID().slice(0, 6)}!`;

                const createUser = await cognito.send(
                    new AdminCreateUserCommand({
                        UserPoolId: userPoolId,
                        Username: adminEmail,
                        TemporaryPassword: tempPassword,
                        UserAttributes: userAttributes,
                        DesiredDeliveryMediums: ["EMAIL"],
                    })
                );

                userSub = createUser.User?.Attributes?.find(
                    a => a.Name === "sub"
                )?.Value!;
                if (!userSub) throw new Error("No Cognito sub returned");

                // Add to TENANT_ADMIN group
                await cognito.send(
                    new AdminAddUserToGroupCommand({
                        UserPoolId: userPoolId,
                        Username: adminEmail,
                        GroupName: "TENANT_ADMIN",
                    })
                );

                // Create UserProfile
                await client.models.UserProfile.create({
                    userId: userSub,
                    tenantId,
                    email: adminEmail,
                    role: "TENANT_ADMIN",
                    firstName: adminFirstName || "",
                    lastName: adminLastName || "",
                    createdAt: new Date().toISOString(),
                });
            }

            /* =========================================================
               4. CREATE MEMBERSHIP
            ========================================================= */
            await client.models.Membership.create({
                tenantId,
                userSub,
                role: "TENANT_ADMIN",
                status: "ACTIVE",
                joinedAt: new Date().toISOString(),
            });

            /* =========================================================
               5. CREATE ORGANIZATION
            ========================================================= */
            const resolvedOrgName = orgName || companyName;
            const orgRes = await client.models.Organization.create({
                tenantId,
                name: resolvedOrgName,
                description: `Default organization for ${companyName} pilot`,
                createdBy: userSub,
                isActive: true,
                createdAt: new Date().toISOString(),
            });
            const organizationId = orgRes.data?.id;

            // Update membership with organizationId
            if (organizationId) {
                const membershipRes = await client.models.Membership.list({
                    filter: { tenantId: { eq: tenantId }, userSub: { eq: userSub } },
                });
                if (membershipRes.data?.[0]) {
                    await client.models.Membership.update({
                        id: membershipRes.data[0].id,
                        organizationId,
                    });
                }
            }

            /* =========================================================
               6. CREATE WORKSPACE
            ========================================================= */
            const resolvedWorkspaceName = workspaceName || "Main Workspace";
            const wsRes = await client.models.Workspace.create({
                tenantId,
                organizationId: organizationId || undefined,
                name: resolvedWorkspaceName,
                description: `Pre-provisioned workspace for ${companyName} pilot`,
                ownerUserSub: userSub,
                type: "DEFAULT",
                isActive: true,
                isDeleted: false,
                createdBy: userSub,
                createdAt: new Date().toISOString(),
            });
            const workspaceId = wsRes.data?.id;

            /* =========================================================
               7. CREATE TASK BOARD
            ========================================================= */
            const resolvedBoardName = boardName || "Task Board";
            if (workspaceId) {
                await client.models.TaskBoard.create({
                    tenantId,
                    organizationId: organizationId || undefined,
                    workspaceId,
                    name: resolvedBoardName,
                    description: `Default board for ${companyName} pilot`,
                    ownerUserSub: userSub,
                    visibility: "TEAM",
                    isActive: true,
                    createdBy: userSub,
                    createdAt: new Date().toISOString(),
                    boardType: "KANBAN",
                    isTemplate: false,
                });
            }

            /* =========================================================
               8. GENERATE PDF AGREEMENT
            ========================================================= */
            const pdfBuffer = await generatePdf({
                companyName,
                adminName,
                adminEmail,
                pilotDurationDays,
                pilotStartDate,
                pilotEndDate,
                agreementNotes: agreementNotes || undefined,
            });

            const dateStr = new Date().toISOString().split("T")[0];
            const s3Key = `pilot-agreements/${tenantId}/agreement-v1-${dateStr}.pdf`;

            await s3.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
                Body: pdfBuffer,
                ContentType: "application/pdf",
            }));

            // Update tenant with S3 key
            await client.models.Tenant.update({
                id: tenantId,
                pilotAgreementS3Key: s3Key,
            });

            /* =========================================================
               9. CREATE PILOT AGREEMENT RECORD
            ========================================================= */
            await client.models.PilotAgreement.create({
                tenantId,
                s3Key,
                fileName: `agreement-v1-${dateStr}.pdf`,
                generatedAt: new Date().toISOString(),
                generatedBy: "platform_admin",
                version: 1,
                companyName,
                adminName,
                adminEmail,
                pilotDurationDays,
                pilotStartDate,
                pilotEndDate,
                agreementNotes: agreementNotes || undefined,
                createdAt: new Date().toISOString(),
            });

            /* =========================================================
               10. SEND CONFIRMATION EMAIL VIA SES
            ========================================================= */
            const startFormatted = new Date(pilotStartDate).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
            });
            const endFormatted = new Date(pilotEndDate).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
            });

            const emailHtml = `
                <div style="font-family: Inter, system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
                    <div style="background: #1e3a5f; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
                        <h1 style="color: #fff; margin: 0; font-size: 24px;">Welcome to Tether Tasks</h1>
                        <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">Your pilot program is ready</p>
                    </div>
                    <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                        <p style="font-size: 15px;">Hi ${adminFirstName || "there"},</p>
                        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                            Your <strong>${pilotDurationDays}-day pilot</strong> for <strong>${companyName}</strong> has been set up.
                            We've pre-provisioned your workspace so you can get started right away.
                        </p>

                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0;">
                            <div style="font-weight: 600; color: #1e3a5f; margin-bottom: 12px; font-size: 14px;">Pilot Details</div>
                            <table style="font-size: 14px; width: 100%; border-collapse: collapse;">
                                <tr><td style="padding: 4px 0; color: #64748b;">Organization</td><td style="padding: 4px 0; font-weight: 500;">${resolvedOrgName}</td></tr>
                                <tr><td style="padding: 4px 0; color: #64748b;">Workspace</td><td style="padding: 4px 0; font-weight: 500;">${resolvedWorkspaceName}</td></tr>
                                <tr><td style="padding: 4px 0; color: #64748b;">Duration</td><td style="padding: 4px 0; font-weight: 500;">${pilotDurationDays} days</td></tr>
                                <tr><td style="padding: 4px 0; color: #64748b;">Start Date</td><td style="padding: 4px 0; font-weight: 500;">${startFormatted}</td></tr>
                                <tr><td style="padding: 4px 0; color: #64748b;">End Date</td><td style="padding: 4px 0; font-weight: 500;">${endFormatted}</td></tr>
                            </table>
                        </div>

                        <p style="font-size: 14px; color: #475569;">
                            You'll receive a separate email with your login credentials.
                            Log in at <strong>www.tethertasks.com</strong> to access your workspace.
                        </p>

                        ${agreementNotes ? `
                        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
                            <div style="font-weight: 600; color: #92400e; font-size: 13px; margin-bottom: 6px;">Agreement Notes</div>
                            <div style="font-size: 13px; color: #78350f;">${agreementNotes}</div>
                        </div>
                        ` : ""}

                        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
                            <p style="font-size: 12px; color: #94a3b8; margin: 0;">Tether Tasks — Task management made simple</p>
                        </div>
                    </div>
                </div>
            `;

            try {
                await ses.send(
                    new SendEmailCommand({
                        Source: "no-reply@tethertasks.com",
                        Destination: { ToAddresses: [adminEmail] },
                        Message: {
                            Subject: { Data: `Welcome to Tether Tasks — Your ${pilotDurationDays}-Day Pilot` },
                            Body: {
                                Html: { Data: emailHtml },
                                Text: { Data: `Welcome to Tether Tasks! Your ${pilotDurationDays}-day pilot for ${companyName} is ready. Log in at app.tethertasks.com with the credentials sent to ${adminEmail}.` },
                            },
                        },
                    })
                );

                await client.models.Tenant.update({
                    id: tenantId,
                    pilotConfirmationSentAt: new Date().toISOString(),
                });
            } catch (emailErr) {
                console.warn("SES email send failed (non-fatal):", emailErr);
            }

            /* =========================================================
               11. INVITATION + AUDIT LOG
            ========================================================= */
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + 7);

            await client.models.Invitation.create({
                tenantId,
                organizationId: organizationId || undefined,
                email: adminEmail,
                role: "TENANT_ADMIN",
                status: "PENDING",
                invitedBy: "platform",
                token: crypto.randomUUID(),
                sentAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
            });

            await client.models.AuditLog.create({
                tenantId,
                userId: "platform_admin",
                action: "CREATE",
                resourceType: "PILOT",
                resourceId: tenantId,
                result: "SUCCESS",
                metadata: JSON.stringify({
                    companyName,
                    adminEmail,
                    pilotDurationDays,
                    pilotStartDate,
                    pilotEndDate,
                    s3Key,
                }),
                timestamp: new Date().toISOString(),
            });

            console.log("PILOT CREATED:", tenantId, "S3:", s3Key);

            return {
                success: true,
                tenantId,
                agreementS3Key: s3Key,
                message: "Pilot created — workspace provisioned and agreement emailed",
            };

        } catch (err: any) {
            console.error("PILOT CREATE ERROR:", err);
            return { success: false, message: err.message };
        }
    };
