import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import {
    ArrowLeft, Download, Calendar, Shield, User, CreditCard, FileText, Eye,
} from "lucide-react";

type Tab = "profile" | "plan" | "agreement" | "security";

export default function SettingsPage() {
    const navigate = useNavigate();
    const { role, tenantId } = useWorkspace();
    const client = dataClient();

    const [activeTab, setActiveTab] = useState<Tab>("profile");

    // Profile state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [profileExists, setProfileExists] = useState(false);
    const [userId, setUserId] = useState("");
    const [profileTenantId, setProfileTenantId] = useState("");

    // Plan state
    const [tenant, setTenant] = useState<any>(null);
    const [tenantLoading, setTenantLoading] = useState(false);

    // Agreement state
    const [signedAgreement, setSignedAgreement] = useState<{ s3Key: string; signedAt: string } | null>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        if (activeTab === "plan" && tenantId && !tenant) {
            loadTenant();
        }
    }, [activeTab, tenantId]);

    async function loadProfile() {
        try {
            const user = await getCurrentUser();
            const sub = user.userId;
            setUserId(sub);

            const res = await client.models.UserProfile.get({ userId: sub });
            if (res.data) {
                setFirstName(res.data.firstName || "");
                setLastName(res.data.lastName || "");
                setEmail(res.data.email || "");
                setProfileTenantId(res.data.tenantId || "");
                setProfileExists(true);
                if (res.data.signedAgreementS3Key && res.data.termsAcceptedAt) {
                    setSignedAgreement({
                        s3Key: res.data.signedAgreementS3Key,
                        signedAt: res.data.termsAcceptedAt,
                    });
                }
            } else {
                setEmail(user.username || "");
            }
        } catch (err) {
            console.error("SettingsPage: load error", err);
        }
        setLoading(false);
    }

    async function loadTenant() {
        if (!tenantId) return;
        setTenantLoading(true);
        try {
            const res = await client.models.Tenant.get({ id: tenantId });
            if (res.data) setTenant(res.data);
        } catch (err) {
            console.error("SettingsPage: tenant load error", err);
        }
        setTenantLoading(false);
    }

    async function handleSave() {
        if (!firstName.trim()) return;
        setSaving(true);
        try {
            if (profileExists) {
                await client.models.UserProfile.update({
                    userId,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                });
            } else {
                await client.models.UserProfile.create({
                    userId,
                    tenantId: profileTenantId,
                    email,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                });
            }
            navigate(-1);
        } catch (err) {
            console.error("SettingsPage: save error", err);
            setSaving(false);
        }
    }

    async function downloadPilotAgreement() {
        if (!tenant?.pilotAgreementS3Key) return;
        try {
            const result = await getUrl({
                path: tenant.pilotAgreementS3Key,
            });
            window.open(result.url.toString(), "_blank");
        } catch (err) {
            console.error("Error getting pilot agreement URL:", err);
        }
    }

    async function downloadTermsAgreement() {
        if (!tenant?.agreementS3Key) return;
        try {
            const result = await getUrl({
                path: tenant.agreementS3Key,
            });
            window.open(result.url.toString(), "_blank");
        } catch (err) {
            console.error("Error getting terms agreement URL:", err);
        }
    }

    if (loading) {
        return <div style={styles.wrapper}><p style={{ color: "#64748b" }}>Loading...</p></div>;
    }

    const tabs: { key: Tab; label: string; icon: any; visible: boolean }[] = [
        { key: "profile", label: "Profile", icon: <User size={15} />, visible: true },
        { key: "plan", label: "Plan & Billing", icon: <CreditCard size={15} />, visible: role === "TENANT_ADMIN" },
        { key: "agreement", label: "My Agreement", icon: <FileText size={15} />, visible: !!signedAgreement },
        { key: "security", label: "Security", icon: <Shield size={15} />, visible: true },
    ];

    return (
        <div style={styles.wrapper}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <button
                        style={styles.backBtn}
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h2 style={styles.heading}>Account Settings</h2>
                </div>

                {/* Tabs */}
                <div className="cc-tab-bar" style={{ marginBottom: 24 }}>
                    {tabs.filter(t => t.visible).map(t => (
                        <button
                            key={t.key}
                            className={`cc-tab ${activeTab === t.key ? "active" : ""}`}
                            onClick={() => setActiveTab(t.key)}
                        >
                            {t.icon}
                            <span style={{ marginLeft: 6 }}>{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === "profile" && (
                    <div style={styles.form}>
                        <label style={styles.label}>Email</label>
                        <input
                            style={{ ...styles.input, ...styles.inputDisabled }}
                            value={email}
                            disabled
                        />

                        <label style={styles.label}>First Name <span style={styles.required}>*</span></label>
                        <input
                            style={styles.input}
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Enter your first name"
                            autoFocus
                        />

                        <label style={styles.label}>Last Name</label>
                        <input
                            style={styles.input}
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Enter your last name"
                        />

                        <button
                            className="btn"
                            style={styles.saveBtn}
                            onClick={handleSave}
                            disabled={saving || !firstName.trim()}
                        >
                            {saving ? "Saving..." : "Save Profile"}
                        </button>
                    </div>
                )}

                {activeTab === "plan" && (
                    <div>
                        {tenantLoading ? (
                            <p style={{ color: "#64748b" }}>Loading plan details...</p>
                        ) : tenant ? (
                            <PlanTab tenant={tenant} onDownloadPilot={downloadPilotAgreement} onDownloadTerms={downloadTermsAgreement} />
                        ) : (
                            <p style={{ color: "#64748b" }}>Unable to load plan information.</p>
                        )}
                    </div>
                )}

                {activeTab === "agreement" && signedAgreement && (
                    <AgreementTab
                        s3Key={signedAgreement.s3Key}
                        signedAt={signedAgreement.signedAt}
                        signedBy={`${firstName} ${lastName}`.trim()}
                    />
                )}

                {activeTab === "security" && (
                    <div style={styles.placeholder}>
                        <Shield size={32} style={{ color: "#94a3b8", marginBottom: 12 }} />
                        <p style={styles.placeholderText}>
                            Password management and two-factor authentication coming soon.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ---------- Plan Tab Component ---------- */

function PlanTab({ tenant, onDownloadPilot, onDownloadTerms }: { tenant: any; onDownloadPilot: () => void; onDownloadTerms: () => void }) {
    const plan = (tenant.plan || "STARTER").toUpperCase();
    const status = tenant.subscriptionStatus || "Active";

    function daysBetween(_start: string, end: string) {
        const e = new Date(end).getTime();
        return Math.max(0, Math.ceil((e - Date.now()) / (1000 * 60 * 60 * 24)));
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Plan overview */}
            <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Company</span>
                <span style={styles.infoValue}>{tenant.companyName}</span>
            </div>
            <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Plan</span>
                <span style={{ ...styles.badge, background: planColor(plan) }}>{plan}</span>
            </div>
            <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Status</span>
                <span style={styles.infoValue}>{status}</span>
            </div>

            {/* Pilot-specific */}
            {plan === "PILOT" && (
                <>
                    <div style={styles.divider} />
                    <div style={styles.sectionLabel}>Pilot Details</div>

                    {tenant.pilotStatus && (
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>Pilot Status</span>
                            <span style={{
                                ...styles.badge,
                                background: tenant.pilotStatus === "ACTIVE" ? "#dcfce7" : "#fef3c7",
                                color: tenant.pilotStatus === "ACTIVE" ? "#166534" : "#92400e",
                            }}>
                                {tenant.pilotStatus}
                            </span>
                        </div>
                    )}

                    {tenant.pilotStartDate && (
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>
                                <Calendar size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                                Start Date
                            </span>
                            <span style={styles.infoValue}>
                                {new Date(tenant.pilotStartDate).toLocaleDateString()}
                            </span>
                        </div>
                    )}

                    {tenant.pilotEndDate && (
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>
                                <Calendar size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                                End Date
                            </span>
                            <span style={styles.infoValue}>
                                {new Date(tenant.pilotEndDate).toLocaleDateString()}
                            </span>
                        </div>
                    )}

                    {tenant.pilotStartDate && tenant.pilotEndDate && (
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>Days Remaining</span>
                            <span style={styles.infoValue}>
                                {daysBetween(tenant.pilotStartDate, tenant.pilotEndDate)} days
                            </span>
                        </div>
                    )}

                    {tenant.pilotDurationDays && (
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>Duration</span>
                            <span style={styles.infoValue}>{tenant.pilotDurationDays} days</span>
                        </div>
                    )}

                    {tenant.pilotAgreementS3Key && (
                        <button
                            className="btn secondary"
                            style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}
                            onClick={onDownloadPilot}
                        >
                            <Download size={15} />
                            Download Pilot Agreement
                        </button>
                    )}
                </>
            )}

            {/* Terms & Conditions agreement (non-pilot plans) */}
            {tenant.agreementS3Key && plan !== "PILOT" && (
                <>
                    <div style={styles.divider} />
                    <button
                        className="btn secondary"
                        style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}
                        onClick={onDownloadTerms}
                    >
                        <Download size={15} />
                        Download Terms & Conditions
                    </button>
                </>
            )}

            {/* Trial-specific */}
            {plan === "TRIAL" && (
                <>
                    <div style={styles.divider} />
                    <div style={styles.sectionLabel}>Trial Details</div>

                    {tenant.trialStartDate && (
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>
                                <Calendar size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                                Start Date
                            </span>
                            <span style={styles.infoValue}>
                                {new Date(tenant.trialStartDate).toLocaleDateString()}
                            </span>
                        </div>
                    )}

                    {tenant.trialEndDate && (
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>
                                <Calendar size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                                End Date
                            </span>
                            <span style={styles.infoValue}>
                                {new Date(tenant.trialEndDate).toLocaleDateString()}
                            </span>
                        </div>
                    )}

                    {tenant.trialStartDate && tenant.trialEndDate && (
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>Days Remaining</span>
                            <span style={styles.infoValue}>
                                {daysBetween(tenant.trialStartDate, tenant.trialEndDate)} days
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ---------- Agreement Tab Component ---------- */

function AgreementTab({ s3Key, signedAt, signedBy }: { s3Key: string; signedAt: string; signedBy: string }) {
    const [viewLoading, setViewLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);

    async function viewAgreement() {
        setViewLoading(true);
        try {
            const result = await getUrl({ path: s3Key });
            window.open(result.url.toString(), "_blank");
        } catch (err) {
            console.error("Error viewing signed agreement:", err);
        }
        setViewLoading(false);
    }

    async function downloadAgreement() {
        setDownloadLoading(true);
        try {
            const result = await getUrl({ path: s3Key });
            const response = await fetch(result.url.toString());
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `signed-agreement-${new Date(signedAt).toISOString().slice(0, 10)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error downloading signed agreement:", err);
        }
        setDownloadLoading(false);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Status badge */}
            <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Status</span>
                <span style={{
                    ...styles.badge,
                    background: "#dcfce7",
                    color: "#166534",
                }}>
                    Signed
                </span>
            </div>

            <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Signed Date</span>
                <span style={styles.infoValue}>
                    {new Date(signedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })}
                </span>
            </div>

            <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Signed By</span>
                <span style={styles.infoValue}>{signedBy}</span>
            </div>

            <div style={styles.divider} />

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12 }}>
                <button
                    className="btn secondary"
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    onClick={viewAgreement}
                    disabled={viewLoading}
                >
                    <Eye size={15} />
                    {viewLoading ? "Opening..." : "View Agreement"}
                </button>
                <button
                    className="btn secondary"
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    onClick={downloadAgreement}
                    disabled={downloadLoading}
                >
                    <Download size={15} />
                    {downloadLoading ? "Downloading..." : "Download"}
                </button>
            </div>
        </div>
    );
}

function planColor(plan: string): string {
    switch (plan) {
        case "PILOT": return "#ede9fe";
        case "TRIAL": return "#fef3c7";
        case "PROFESSIONAL": return "#dbeafe";
        case "PREMIUM": return "#dcfce7";
        case "ENTERPRISE": return "#fce7f3";
        default: return "#f1f5f9";
    }
}

/* ---------- Styles ---------- */

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
    card: {
        background: "white",
        padding: "36px 40px",
        borderRadius: 16,
        width: 560,
        maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
    },
    backBtn: {
        background: "none",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "6px 8px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        color: "#475569",
    },
    heading: {
        fontSize: 22,
        fontWeight: 700,
        color: "#0f172a",
        margin: 0,
    },
    form: {
        display: "flex",
        flexDirection: "column" as const,
    },
    label: {
        fontSize: 13,
        fontWeight: 600,
        color: "#334155",
        marginBottom: 4,
        marginTop: 12,
    },
    required: {
        color: "#ef4444",
    },
    input: {
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
    inputDisabled: {
        background: "#f8fafc",
        color: "#94a3b8",
        cursor: "not-allowed",
    },
    saveBtn: {
        width: "100%",
        marginTop: 24,
    },
    placeholder: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center" as const,
    },
    placeholderText: {
        color: "#64748b",
        fontSize: 14,
        margin: 0,
    },
    infoRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    infoLabel: {
        fontSize: 13,
        color: "#64748b",
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
    },
    infoValue: {
        fontSize: 14,
        color: "#0f172a",
        fontWeight: 600,
    },
    badge: {
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 12,
        color: "#334155",
    },
    divider: {
        height: 1,
        background: "#e2e8f0",
        margin: "4px 0",
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: 700,
        color: "#334155",
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
    },
};
