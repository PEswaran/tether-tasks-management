import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../../../libs/data-client";
import { getPlanLimits } from "../../../libs/planLimits";

type TenantData = {
    companyName: string;
    plan: string;
    trialStartDate: string | null;
    trialEndDate: string | null;
    agreementNotes: string | null;
    adminName: string | null;
    agreementS3Key: string | null;
    pilotAgreementS3Key: string | null;
};

type ProfileData = {
    firstName: string;
    lastName: string;
    email: string;
};

type Step = "details" | "sign";

export default function WelcomePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirect = searchParams.get("redirect") || "/tenant";

    const client = dataClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tenant, setTenant] = useState<TenantData | null>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [userId, setUserId] = useState("");

    // Two-step flow
    const [step, setStep] = useState<Step>("details");
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const [pdfLoadError, setPdfLoadError] = useState(false);
    const [signatureName, setSignatureName] = useState("");

    useEffect(() => {
        loadData();
        return () => {
            // Clean up blob URL on unmount
            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        };
    }, []);

    function getAgreementS3Key(t: TenantData): string | null {
        if (t.plan === "PILOT" && t.pilotAgreementS3Key) return t.pilotAgreementS3Key;
        return t.agreementS3Key || null;
    }

    async function loadData() {
        try {
            const user = await getCurrentUser();
            const sub = user.userId;
            setUserId(sub);

            const profileRes = await client.models.UserProfile.get({ userId: sub });
            if (!profileRes.data) {
                navigate("/auth-redirect");
                return;
            }

            setProfile({
                firstName: profileRes.data.firstName || "",
                lastName: profileRes.data.lastName || "",
                email: profileRes.data.email || "",
            });

            const tenantId = profileRes.data.tenantId;
            if (tenantId) {
                const tenantRes = await client.models.Tenant.get({ id: tenantId });
                if (tenantRes.data) {
                    setTenant({
                        companyName: tenantRes.data.companyName || "",
                        plan: String(tenantRes.data.plan || "STARTER").toUpperCase(),
                        trialStartDate: tenantRes.data.trialStartDate || null,
                        trialEndDate: tenantRes.data.trialEndDate || null,
                        agreementNotes: tenantRes.data.agreementNotes || null,
                        adminName: tenantRes.data.adminName || null,
                        agreementS3Key: tenantRes.data.agreementS3Key || null,
                        pilotAgreementS3Key: tenantRes.data.pilotAgreementS3Key || null,
                    });
                }
            }
        } catch (err) {
            console.error("WelcomePage: load error", err);
        }
        setLoading(false);
    }

    async function loadPdfForViewing() {
        if (!tenant) return;
        const s3Key = getAgreementS3Key(tenant);
        if (!s3Key) {
            setPdfLoadError(true);
            setStep("sign");
            return;
        }
        try {
            const { getUrl } = await import("aws-amplify/storage");
            const result = await getUrl({ path: s3Key });
            const response = await fetch(result.url.toString());
            if (!response.ok) throw new Error("Failed to fetch PDF");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setPdfBlobUrl(url);
            setPdfLoadError(false);
        } catch (err) {
            console.error("WelcomePage: PDF load error", err);
            setPdfLoadError(true);
        }
        setStep("sign");
    }

    function isSignatureValid(): boolean {
        if (!profile) return false;
        const expected = `${profile.firstName} ${profile.lastName}`.trim().toLowerCase();
        return signatureName.trim().toLowerCase() === expected && expected.length > 0;
    }

    async function signAndUpload() {
        if (!tenant || !profile || !isSignatureValid()) return;
        setSaving(true);

        try {
            const [{ getUrl, uploadData }, pdfLib] = await Promise.all([
                import("aws-amplify/storage"),
                import("pdf-lib"),
            ]);
            const { PDFDocument, StandardFonts, rgb } = pdfLib;
            const s3Key = getAgreementS3Key(tenant);
            let doc: any;

            if (s3Key) {
                // Load existing PDF
                try {
                    const result = await getUrl({ path: s3Key });
                    const response = await fetch(result.url.toString());
                    const arrayBuffer = await response.arrayBuffer();
                    doc = await PDFDocument.load(arrayBuffer);
                } catch {
                    // If loading fails, create a minimal PDF
                    doc = await PDFDocument.create();
                    const page = doc.addPage([595.28, 841.89]);
                    const font = await doc.embedFont(StandardFonts.Helvetica);
                    page.drawText("TetherTasks Agreement", { x: 60, y: 780, font, size: 18, color: rgb(0.12, 0.23, 0.37) });
                    page.drawText(`Company: ${tenant.companyName}`, { x: 60, y: 740, font, size: 12, color: rgb(0.07, 0.09, 0.16) });
                    page.drawText(`Plan: ${tenant.plan}`, { x: 60, y: 720, font, size: 12, color: rgb(0.07, 0.09, 0.16) });
                }
            } else {
                // No agreement PDF — create a minimal one
                doc = await PDFDocument.create();
                const page = doc.addPage([595.28, 841.89]);
                const font = await doc.embedFont(StandardFonts.Helvetica);
                page.drawText("TetherTasks Agreement", { x: 60, y: 780, font, size: 18, color: rgb(0.12, 0.23, 0.37) });
                page.drawText(`Company: ${tenant.companyName}`, { x: 60, y: 740, font, size: 12, color: rgb(0.07, 0.09, 0.16) });
                page.drawText(`Plan: ${tenant.plan}`, { x: 60, y: 720, font, size: 12, color: rgb(0.07, 0.09, 0.16) });
            }

            // Add signature page — condensed to fit on one page
            const bold = await doc.embedFont(StandardFonts.HelveticaBold);
            const regular = await doc.embedFont(StandardFonts.Helvetica);

            const navy = rgb(0.12, 0.23, 0.37);
            const dark = rgb(0.07, 0.09, 0.16);
            const gray = rgb(0.39, 0.45, 0.55);
            const muted = rgb(0.28, 0.33, 0.41);
            const lightGray = rgb(0.89, 0.91, 0.94);

            const sigPage = doc.addPage([595.28, 841.89]);
            const margin = 50;
            const pageWidth = 595.28;
            const contentWidth = pageWidth - margin * 2;
            let y = 790;

            // Word-wrap helper
            function drawWrapped(text: string, font: typeof regular, size: number, color: typeof dark, indent = 0) {
                const maxW = contentWidth - indent;
                const words = text.split(/\s+/);
                let line = "";
                const lh = size + 3;
                for (const word of words) {
                    const test = line ? `${line} ${word}` : word;
                    if (font.widthOfTextAtSize(test, size) > maxW) {
                        sigPage.drawText(line, { x: margin + indent, y, font, size, color });
                        y -= lh;
                        line = word;
                    } else {
                        line = test;
                    }
                }
                if (line) {
                    sigPage.drawText(line, { x: margin + indent, y, font, size, color });
                    y -= lh;
                }
            }

            // Title
            const title = "Acceptance & Electronic Signature";
            const titleWidth = bold.widthOfTextAtSize(title, 16);
            sigPage.drawText(title, { x: (pageWidth - titleWidth) / 2, y, font: bold, size: 16, color: navy });
            y -= 22;

            // Divider
            sigPage.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: lightGray });
            y -= 16;

            // Signer details — compact two-column layout
            const now = new Date();
            const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
            const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

            const leftFields: [string, string][] = [
                ["Name", `${profile.firstName} ${profile.lastName}`],
                ["Email", profile.email],
                ["Company", tenant.companyName],
            ];
            const rightFields: [string, string][] = [
                ["Plan", tenant.plan],
                ["Date", dateStr],
                ["Time", timeStr],
            ];

            const colX = pageWidth / 2 + 10;
            for (let i = 0; i < 3; i++) {
                const [lLabel, lValue] = leftFields[i];
                sigPage.drawText(`${lLabel}:`, { x: margin, y, font: bold, size: 9, color: gray });
                sigPage.drawText(lValue, { x: margin + 55, y, font: regular, size: 9, color: dark });
                const [rLabel, rValue] = rightFields[i];
                sigPage.drawText(`${rLabel}:`, { x: colX, y, font: bold, size: 9, color: gray });
                sigPage.drawText(rValue, { x: colX + 40, y, font: regular, size: 9, color: dark });
                y -= 14;
            }
            y -= 8;

            // Terms — use pilot T&C for PILOT plans, tenant T&C for others
            sigPage.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lightGray });
            y -= 14;

            const isPilotPlan = tenant.plan === "PILOT";

            sigPage.drawText(isPilotPlan ? "Terms & Conditions" : "Terms of Service", {
                x: margin, y, font: bold, size: 11, color: navy,
            });
            y -= 16;

            const pilotClauses: { title: string; body: string }[] = [
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

            const tenantClauses: { title: string; body: string }[] = [
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

            const termsClauses = isPilotPlan ? pilotClauses : tenantClauses;

            for (const clause of termsClauses) {
                sigPage.drawText(clause.title, { x: margin, y, font: bold, size: 8, color: dark });
                y -= 11;
                drawWrapped(clause.body, regular, 8, muted);
                y -= 4;
            }

            // Agreement Notes
            if (tenant.agreementNotes) {
                y -= 4;
                sigPage.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lightGray });
                y -= 14;
                sigPage.drawText("Agreement Notes", { x: margin, y, font: bold, size: 11, color: navy });
                y -= 16;
                drawWrapped(tenant.agreementNotes, regular, 9, dark);
            }

            // Signature block
            y -= 10;
            sigPage.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lightGray });
            y -= 18;

            sigPage.drawLine({ start: { x: margin, y }, end: { x: margin + 260, y }, thickness: 1, color: lightGray });
            y -= 14;
            sigPage.drawText(`Electronically signed by: ${signatureName.trim()}`, {
                x: margin, y, font: bold, size: 10, color: dark,
            });
            y -= 16;
            sigPage.drawText(`Signed on: ${dateStr} at ${timeStr}`, {
                x: margin, y, font: regular, size: 9, color: gray,
            });

            // Save PDF
            const pdfBytes = await doc.save();

            // Upload to S3
            const session = await fetchAuthSession();
            const identityId = session.identityId;
            const dateSlug = now.toISOString().slice(0, 10);
            const s3Path = `signed-agreements/${identityId}/signed-agreement-${dateSlug}.pdf`;
            const pdfUploadBytes = pdfBytes.slice();

            await uploadData({
                path: s3Path,
                data: new Blob([pdfUploadBytes], { type: "application/pdf" }),
            }).result;

            // Update user profile
            await client.models.UserProfile.update({
                userId,
                signedAgreementS3Key: s3Path,
                termsAcceptedAt: now.toISOString(),
                hasSeenWelcome: true,
            });

            navigate(redirect);
        } catch (err) {
            console.error("WelcomePage: sign error", err);
            setSaving(false);
        }
    }

    if (loading) {
        return <div style={styles.wrapper}><p style={{ color: "#64748b" }}>Loading...</p></div>;
    }

    if (!tenant || !profile) {
        return <div style={styles.wrapper}><p style={{ color: "#64748b" }}>Unable to load account details.</p></div>;
    }

    const isTrial = tenant.plan === "TRIAL";
    const limits = getPlanLimits(tenant.plan);

    const daysRemaining = isTrial && tenant.trialEndDate
        ? Math.max(0, Math.ceil((new Date(tenant.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    const planColors: Record<string, { bg: string; color: string }> = {
        STARTER: { bg: "#f1f5f9", color: "#475569" },
        FREE: { bg: "#f1f5f9", color: "#475569" },
        PROFESSIONAL: { bg: "#e8f0fa", color: "#1e3a5f" },
        PREMIUM: { bg: "#e8f0fa", color: "#1e3a5f" },
        TRIAL: { bg: "#fffbeb", color: "#d97706" },
        ENTERPRISE: { bg: "#f0fdf4", color: "#16a34a" },
        UNLIMITED: { bg: "#f0fdf4", color: "#16a34a" },
        PILOT: { bg: "#ede9fe", color: "#6d28d9" },
    };

    const badge = planColors[tenant.plan] || planColors.STARTER;

    return (
        <div style={styles.wrapper}>
            <div style={{ ...styles.container, width: step === "sign" ? 700 : 520 }}>
                {step === "details" && (
                    <>
                        {/* Header */}
                        <div style={styles.iconCircle}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </div>

                        <h1 style={styles.heading}>Welcome to TetherTasks, {profile.firstName}!</h1>
                        <p style={styles.subtext}>Your account is ready. Here are your plan details.</p>

                        {/* Plan Details Card */}
                        <div style={styles.card}>
                            <div style={styles.cardRow}>
                                <span style={styles.cardLabel}>Company</span>
                                <span style={styles.cardValue}>{tenant.companyName}</span>
                            </div>

                            <div style={styles.cardRow}>
                                <span style={styles.cardLabel}>Plan</span>
                                <span style={{
                                    ...styles.planBadge,
                                    background: badge.bg,
                                    color: badge.color,
                                }}>
                                    {tenant.plan}
                                </span>
                            </div>

                            <div style={styles.cardRow}>
                                <span style={styles.cardLabel}>Organizations</span>
                                <span style={styles.cardValue}>Up to {limits.orgs}</span>
                            </div>

                            <div style={styles.cardRow}>
                                <span style={styles.cardLabel}>Workspaces</span>
                                <span style={styles.cardValue}>Up to {limits.workspaces} per org</span>
                            </div>
                        </div>

                        {/* Trial Info */}
                        {isTrial && (
                            <div style={styles.trialBox}>
                                <div style={styles.trialTitle}>Trial Period</div>
                                <div style={styles.trialDates}>
                                    {tenant.trialStartDate
                                        ? new Date(tenant.trialStartDate).toLocaleDateString()
                                        : "N/A"
                                    }
                                    {" "}
                                    &rarr;
                                    {" "}
                                    {tenant.trialEndDate
                                        ? new Date(tenant.trialEndDate).toLocaleDateString()
                                        : "N/A"
                                    }
                                </div>
                                {daysRemaining !== null && (
                                    <div style={styles.trialRemaining}>
                                        {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Agreement Notes */}
                        {tenant.agreementNotes && (
                            <div style={styles.agreementSection}>
                                <div style={styles.agreementTitle}>Agreement Notes</div>
                                <div style={styles.agreementBox}>
                                    {tenant.agreementNotes}
                                </div>
                            </div>
                        )}

                        {/* Review & Sign Agreement */}
                        <button
                            className="btn"
                            style={styles.continueBtn}
                            onClick={loadPdfForViewing}
                        >
                            Review & Sign Agreement
                        </button>
                    </>
                )}

                {step === "sign" && (
                    <>
                        <button
                            style={styles.backLink}
                            onClick={() => {
                                setStep("details");
                                setSignatureName("");
                            }}
                        >
                            &larr; Back to details
                        </button>

                        <h1 style={{ ...styles.heading, marginTop: 8 }}>Review & Sign Agreement</h1>
                        <p style={styles.subtext}>
                            Please review the agreement below, then type your full name to sign electronically.
                        </p>

                        {/* PDF Viewer */}
                        {pdfBlobUrl && !pdfLoadError ? (
                            <div style={styles.pdfContainer}>
                                <iframe
                                    src={pdfBlobUrl}
                                    style={styles.pdfIframe}
                                    title="Agreement PDF"
                                />
                            </div>
                        ) : (
                            <div style={styles.noPdfBox}>
                                <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
                                    {pdfLoadError
                                        ? "Unable to load the agreement PDF. You may still sign below to accept the terms."
                                        : "No agreement PDF available. You may still sign below to accept the terms."
                                    }
                                </p>
                            </div>
                        )}

                        {/* Signature Section */}
                        <div style={styles.signatureSection}>
                            <div style={styles.signatureTitle}>Electronic Signature</div>

                            <div style={styles.expectedName}>
                                <span style={{ color: "#64748b", fontSize: 13 }}>Expected name:</span>
                                <span style={{ color: "#0f172a", fontSize: 14, fontWeight: 600, marginLeft: 8 }}>
                                    {profile.firstName} {profile.lastName}
                                </span>
                            </div>

                            <label style={styles.signatureLabel}>Type your full name to sign</label>
                            <input
                                style={{
                                    ...styles.signatureInput,
                                    borderColor: signatureName.trim() && !isSignatureValid() ? "#ef4444" : "#e2e8f0",
                                }}
                                value={signatureName}
                                onChange={(e) => setSignatureName(e.target.value)}
                                placeholder={`${profile.firstName} ${profile.lastName}`}
                                autoFocus
                            />
                            {signatureName.trim() && !isSignatureValid() && (
                                <p style={styles.errorText}>Name must match exactly: {profile.firstName} {profile.lastName}</p>
                            )}
                        </div>

                        {/* Sign & Continue */}
                        <button
                            className="btn"
                            style={{
                                ...styles.continueBtn,
                                ...((!isSignatureValid() || saving) ? styles.continueBtnDisabled : {}),
                            }}
                            onClick={signAndUpload}
                            disabled={!isSignatureValid() || saving}
                        >
                            {saving ? "Signing & uploading..." : "Sign & Continue"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f7f8fb",
        fontFamily: "Inter, system-ui, Arial",
        padding: 20,
    },
    container: {
        background: "white",
        padding: "40px 44px",
        borderRadius: 16,
        maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
        transition: "width 0.2s ease",
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "#e8f0fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 20px",
    },
    heading: {
        fontSize: 24,
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: 6,
        textAlign: "center" as const,
    },
    subtext: {
        fontSize: 14,
        color: "#64748b",
        textAlign: "center" as const,
        marginBottom: 28,
    },
    card: {
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 16,
    },
    cardRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #f1f5f9",
    },
    cardLabel: {
        fontSize: 13,
        fontWeight: 600,
        color: "#64748b",
    },
    cardValue: {
        fontSize: 14,
        fontWeight: 600,
        color: "#0f172a",
    },
    planBadge: {
        fontSize: 12,
        fontWeight: 700,
        padding: "4px 12px",
        borderRadius: 20,
        letterSpacing: "0.5px",
    },
    trialBox: {
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 16,
        textAlign: "center" as const,
    },
    trialTitle: {
        fontSize: 13,
        fontWeight: 700,
        color: "#92400e",
        marginBottom: 6,
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
    },
    trialDates: {
        fontSize: 15,
        fontWeight: 600,
        color: "#78350f",
        marginBottom: 4,
    },
    trialRemaining: {
        fontSize: 13,
        fontWeight: 600,
        color: "#d97706",
    },
    agreementSection: {
        marginBottom: 16,
    },
    agreementTitle: {
        fontSize: 13,
        fontWeight: 700,
        color: "#334155",
        marginBottom: 8,
    },
    agreementBox: {
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "14px 18px",
        fontSize: 13,
        color: "#475569",
        lineHeight: 1.6,
        whiteSpace: "pre-wrap" as const,
        maxHeight: 160,
        overflowY: "auto" as const,
    },
    continueBtn: {
        width: "100%",
        marginTop: 0,
    },
    continueBtnDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    backLink: {
        background: "none",
        border: "none",
        color: "#64748b",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        padding: 0,
        fontFamily: "Inter, system-ui, Arial",
    },
    pdfContainer: {
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 24,
    },
    pdfIframe: {
        width: "100%",
        height: 500,
        border: "none",
    },
    noPdfBox: {
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "32px 24px",
        textAlign: "center" as const,
        marginBottom: 24,
    },
    signatureSection: {
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 20,
    },
    signatureTitle: {
        fontSize: 15,
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: 16,
    },
    expectedName: {
        display: "flex",
        alignItems: "center",
        marginBottom: 12,
    },
    signatureLabel: {
        fontSize: 13,
        fontWeight: 600,
        color: "#334155",
        marginBottom: 6,
        display: "block",
    },
    signatureInput: {
        width: "100%",
        padding: "10px 12px",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        fontSize: 14,
        fontFamily: "Inter, system-ui, Arial",
        color: "#0f172a",
        boxSizing: "border-box" as const,
        outline: "none",
    },
    errorText: {
        color: "#ef4444",
        fontSize: 12,
        marginTop: 4,
        marginBottom: 0,
    },
};
