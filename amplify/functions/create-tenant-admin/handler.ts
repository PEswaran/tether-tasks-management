import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    AdminGetUserCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

const PLAN_FEATURES: Record<string, string[]> = {
    STARTER: [
        "1 organization",
        "1 workspace",
        "Unlimited tasks",
        "Basic task management",
    ],
    FREE: [
        "1 organization",
        "1 workspace",
        "Unlimited tasks",
        "Basic task management",
    ],
    PROFESSIONAL: [
        "Up to 3 organizations",
        "Up to 5 workspaces per organization",
        "Unlimited tasks",
        "Full feature access",
    ],
    PREMIUM: [
        "Up to 3 organizations",
        "Up to 5 workspaces per organization",
        "Unlimited tasks",
        "Full feature access",
    ],
    TRIAL: [
        "Up to 3 organizations",
        "Up to 5 workspaces per organization",
        "Unlimited tasks",
        "Full feature access (14-day trial)",
    ],
    ENTERPRISE: [
        "Up to 100 organizations",
        "Up to 100 workspaces per organization",
        "Unlimited tasks",
        "Full feature access",
        "Priority support",
    ],
};

async function generateTermsPdf(data: {
    companyName: string;
    adminName: string;
    adminEmail: string;
    plan: string;
    startDate?: string;
    trialStartDate?: string;
    trialEndDate?: string;
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

    function ensureSpace(needed: number) {
        if (y - needed < bottomMargin) {
            page = doc.addPage([pageWidth, pageHeight]);
            y = 780;
        }
    }

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

    const subText = "Terms & Conditions";
    const subWidth = regular.widthOfTextAtSize(subText, 16);
    page.drawText(subText, { x: (pageWidth - subWidth) / 2, y, font: regular, size: 16, color: gray });
    y -= 30;

    // Divider
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: lightGray });
    y -= 24;

    // Company Info fields
    const fields: [string, string][] = [
        ["Company", data.companyName],
        ["Admin Contact", data.adminName],
        ["Email", data.adminEmail],
        ["Plan", data.plan],
        ["Start Date", fmtDate(data.startDate || new Date().toISOString())],
    ];

    if (data.plan === "TRIAL" && data.trialStartDate && data.trialEndDate) {
        fields.push(
            ["Trial Start", fmtDate(data.trialStartDate)],
            ["Trial End", fmtDate(data.trialEndDate)],
        );
    }

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
    page.drawText("Plan Features", { x: margin, y, font: bold, size: 14, color: navy });
    y -= 22;

    const features = PLAN_FEATURES[data.plan] || PLAN_FEATURES.STARTER;
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

    // Terms of Service
    ensureSpace(22);
    page.drawText("Terms of Service", { x: margin, y, font: bold, size: 14, color: navy });
    y -= 22;

    const termsClauses: { title: string; body: string }[] = [
        {
            title: "1. Platform Usage",
            body: "Your account is for business use by your organization. You are responsible for maintaining the security of your credentials.",
        },
        {
            title: "2. Data Retention",
            body: "All data you create on the platform is retained for the duration of your active subscription. Upon account termination, data will be retained for 30 days before permanent deletion.",
        },
        {
            title: "3. Account Termination",
            body: "Tether Tasks reserves the right to suspend or terminate accounts that violate our usage policies.",
        },
        {
            title: "4. Service Availability",
            body: "We strive for high availability but do not guarantee uninterrupted service. Scheduled maintenance windows will be communicated in advance.",
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

export const handler: Schema["createTenantAdmin"]["functionHandler"] =
    async (event) => {

        const {
            companyName, adminEmail,
            adminFirstName, adminLastName,
            plan, trialStartDate, agreementNotes,
        } = event.arguments;
        const userPoolId = process.env.USER_POOL_ID;
        const bucketName = process.env.PILOT_BUCKET_NAME;

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
            // Build tenant data with optional trial fields
            const selectedPlan = plan || "STARTER";
            const adminName = adminFirstName && adminLastName
                ? `${adminFirstName} ${adminLastName}` : adminEmail;

            let trialStart: string | undefined;
            let trialEnd: string | undefined;
            if (selectedPlan === "TRIAL" && trialStartDate) {
                trialStart = new Date(trialStartDate).toISOString();
                const endDate = new Date(trialStartDate);
                endDate.setDate(endDate.getDate() + 14);
                trialEnd = endDate.toISOString();
            }

            const tenantRes = await client.models.Tenant.create({
                companyName,
                status: "ACTIVE",
                isActive: true,
                plan: selectedPlan,
                subscriptionStatus: selectedPlan === "TRIAL" ? "TRIAL" : "ACTIVE",
                adminName: adminFirstName && adminLastName
                    ? `${adminFirstName} ${adminLastName}` : undefined,
                agreementNotes: agreementNotes || undefined,
                trialStartDate: trialStart,
                trialEndDate: trialEnd,
                createdAt: new Date().toISOString(),
            });

            const tenantId = tenantRes.data?.id;
            if (!tenantId) throw new Error("Tenant creation failed");

            if (!isExistingUser) {
                /* =========================================================
                   CREATE COGNITO USER (new user only)
                ========================================================= */
                const userAttributes = [
                    { Name: "email", Value: adminEmail },
                    { Name: "email_verified", Value: "true" },
                    { Name: "custom:tenantId", Value: tenantId },
                ];
                if (adminFirstName && adminLastName) {
                    userAttributes.push({ Name: "name", Value: `${adminFirstName} ${adminLastName}` });
                }

                // Explicit readable temp password — avoids copy-paste issues
                // with Cognito's auto-generated passwords
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
                    firstName: adminFirstName || "",
                    lastName: adminLastName || "",
                    createdAt: new Date().toISOString(),
                });
            }

            /* =========================================================
               CREATE MEMBERSHIP
            ========================================================= */
            await client.models.Membership.create({
                tenantId,
                userSub,
                role: "TENANT_ADMIN",
                status: "ACTIVE",
                joinedAt: new Date().toISOString(),
            });

            /* =========================================================
               CREATE SUBSCRIPTION (FAKE STRIPE FOR NOW)
            ========================================================= */

            /* =========================================================
               GENERATE PDF TERMS & CONDITIONS
            ========================================================= */
            if (bucketName) {
                try {
                    const pdfBuffer = await generateTermsPdf({
                        companyName,
                        adminName,
                        adminEmail,
                        plan: selectedPlan,
                        startDate: new Date().toISOString(),
                        trialStartDate: trialStart,
                        trialEndDate: trialEnd,
                        agreementNotes: agreementNotes || undefined,
                    });

                    const dateStr = new Date().toISOString().split("T")[0];
                    const s3Key = `pilot-agreements/${tenantId}/terms-v1-${dateStr}.pdf`;

                    await s3.send(new PutObjectCommand({
                        Bucket: bucketName,
                        Key: s3Key,
                        Body: pdfBuffer,
                        ContentType: "application/pdf",
                    }));

                    // Update tenant with S3 key
                    await client.models.Tenant.update({
                        id: tenantId,
                        agreementS3Key: s3Key,
                    });

                    console.log("PDF uploaded:", s3Key);
                } catch (pdfErr) {
                    console.warn("PDF generation failed (non-fatal):", pdfErr);
                }
            }

            /* =========================================================
               SEND WELCOME EMAIL VIA SES
            ========================================================= */
            if (bucketName) {
                const planName = selectedPlan.charAt(0) + selectedPlan.slice(1).toLowerCase();
                const planFeatures = PLAN_FEATURES[selectedPlan] || PLAN_FEATURES.STARTER;

                const emailHtml = `
                    <div style="font-family: Inter, system-ui, -apple-system, sans-serif; max-width: 600px; margin: 40px auto; color: #0f172a; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
                        <div style="background: linear-gradient(135deg,#1e3a5f,#0ea5b8); padding: 18px 16px; text-align: center;">
                            <img src="https://tethertasks-assets.s3.us-east-1.amazonaws.com/tetherTasksv2.PNG" width="88" alt="TetherTasks Logo" style="display: block; margin: 0 auto 8px auto; border: 0;" />
                            <div style="color: #dbeafe; font-size: 12px; margin-bottom: 4px;">Flexible. Connected. Powerful.</div>
                            <h1 style="color: #fff; margin: 0; font-size: 18px; font-weight: 600;">Welcome to TetherTasks</h1>
                            <p style="color: #dbeafe; margin: 6px 0 0; font-size: 13px;">Your ${planName} account is ready</p>
                        </div>
                        <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none;">
                            <p style="font-size: 15px;">Hi ${adminFirstName || "there"},</p>
                            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                                Your <strong>${planName}</strong> account for <strong>${companyName}</strong> has been set up.
                            </p>

                            <div style="background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; padding: 20px; margin: 20px 0;">
                                <div style="font-weight: 600; color: #1e3a5f; margin-bottom: 12px; font-size: 14px;">Plan Features</div>
                                <ul style="font-size: 14px; margin: 0; padding-left: 20px; color: #334155;">
                                    ${planFeatures.map(f => `<li style="padding: 2px 0;">${f}</li>`).join("")}
                                </ul>
                            </div>

                            ${selectedPlan === "TRIAL" && trialStart && trialEnd ? `
                            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px; margin: 16px 0;">
                                <div style="font-weight: 600; color: #92400e; font-size: 13px; margin-bottom: 6px;">Trial Period</div>
                                <div style="font-size: 13px; color: #78350f;">
                                    ${fmtDate(trialStart)} &mdash; ${fmtDate(trialEnd)}
                                </div>
                            </div>
                            ` : ""}

                            ${agreementNotes ? `
                            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px; margin: 16px 0;">
                                <div style="font-weight: 600; color: #92400e; font-size: 13px; margin-bottom: 6px;">Agreement Notes</div>
                                <div style="font-size: 13px; color: #78350f;">${agreementNotes}</div>
                            </div>
                            ` : ""}

                            <p style="font-size: 14px; color: #475569;">
                                You'll receive a separate email with your temporary login credentials.
                                Log in at <strong>www.tethertasks.com</strong> to get started.
                            </p>

                            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
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
                                Subject: { Data: `Welcome to Tether Tasks — Your ${planName} Account` },
                                Body: {
                                    Html: { Data: emailHtml },
                                    Text: { Data: `Welcome to Tether Tasks! Your ${planName} account for ${companyName} is ready. Log in at www.tethertasks.com with the credentials sent to ${adminEmail}.` },
                                },
                            },
                        })
                    );
                    console.log("Welcome email sent to:", adminEmail);
                } catch (emailErr) {
                    console.warn("SES email send failed (non-fatal):", emailErr);
                }
            }

            /* =========================================================
               INVITATION TRACKING RECORD
            ========================================================= */
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + 7);

            await client.models.Invitation.create({
                tenantId,
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
