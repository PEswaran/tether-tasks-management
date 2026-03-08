import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCurrentUser } from "aws-amplify/auth";
import { dataClient } from "../../../libs/data-client";
import { getPlanLimits } from "../../../libs/planLimits";

type TenantData = {
    companyName: string;
    plan: string;
    trialStartDate: string | null;
    trialEndDate: string | null;
    agreementNotes: string | null;
    adminName: string | null;
};

type ProfileData = {
    firstName: string;
    lastName: string;
    email: string;
};

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

    useEffect(() => {
        loadData();
    }, []);

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
                    });
                }
            }
        } catch (err) {
            console.error("WelcomePage: load error", err);
        }
        setLoading(false);
    }

    async function handleContinue() {
        setSaving(true);
        try {
            await client.models.UserProfile.update({
                userId,
                hasSeenWelcome: true,
            });
            navigate(redirect);
        } catch (err) {
            console.error("WelcomePage: save error", err);
            setSaving(false);
        }
    }

    function downloadAgreement() {
        if (!tenant || !profile) return;

        const isTrial = tenant.plan === "TRIAL";
        const limits = getPlanLimits(tenant.plan);

        const lines: string[] = [
            "═══════════════════════════════════════════",
            "          TETHERTASKS AGREEMENT",
            "═══════════════════════════════════════════",
            "",
            `Company:        ${tenant.companyName}`,
            `Plan:           ${tenant.plan}`,
            `Admin:          ${profile.firstName} ${profile.lastName}`.trim(),
            `Email:          ${profile.email}`,
            "",
            "── Plan Features ──────────────────────────",
            `Organizations:  Up to ${limits.orgs}`,
            `Workspaces:     Up to ${limits.workspaces} per organization`,
        ];

        if (isTrial) {
            lines.push(
                "",
                "── Trial Period ───────────────────────────",
                `Start Date:     ${tenant.trialStartDate ? new Date(tenant.trialStartDate).toLocaleDateString() : "N/A"}`,
                `End Date:       ${tenant.trialEndDate ? new Date(tenant.trialEndDate).toLocaleDateString() : "N/A"}`,
            );
        }

        if (tenant.agreementNotes) {
            lines.push(
                "",
                "── Agreement Notes ────────────────────────",
                tenant.agreementNotes,
            );
        }

        lines.push(
            "",
            "───────────────────────────────────────────",
            `Generated: ${new Date().toLocaleString()}`,
        );

        const content = lines.join("\n");
        const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `agreement-${tenant.companyName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
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
        PROFESSIONAL: { bg: "#eff6ff", color: "#2563eb" },
        PREMIUM: { bg: "#eff6ff", color: "#2563eb" },
        TRIAL: { bg: "#fffbeb", color: "#d97706" },
        ENTERPRISE: { bg: "#f0fdf4", color: "#16a34a" },
        UNLIMITED: { bg: "#f0fdf4", color: "#16a34a" },
    };

    const badge = planColors[tenant.plan] || planColors.STARTER;

    return (
        <div style={styles.wrapper}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.iconCircle}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

                {/* Download Agreement */}
                <button
                    style={styles.downloadBtn}
                    onClick={downloadAgreement}
                >
                    Download Agreement
                </button>

                {/* Continue Button */}
                <button
                    className="btn"
                    style={styles.continueBtn}
                    onClick={handleContinue}
                    disabled={saving}
                >
                    {saving ? "Setting up..." : "Continue to Dashboard →"}
                </button>
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
        width: 520,
        maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "#eef2ff",
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
    downloadBtn: {
        width: "100%",
        padding: "10px 0",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        background: "white",
        color: "#475569",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        marginBottom: 12,
        fontFamily: "Inter, system-ui, Arial",
    },
    continueBtn: {
        width: "100%",
        marginTop: 0,
    },
};
