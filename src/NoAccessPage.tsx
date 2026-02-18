import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { dataClient } from "./libs/data-client";
import { useConfirm } from "./shared-components/confirm-context";
import "./platform-super-admin/styles/platform-admin.css";

export default function NoAccessPage() {
    const client = dataClient();
    const navigate = useNavigate();
    const { alert } = useConfirm();

    const [email, setEmail] = useState("");
    const [invitation, setInvitation] = useState<any>(null);
    const [tenantName, setTenantName] = useState("");
    const [orgName, setOrgName] = useState("");
    const [inviterEmail, setInviterEmail] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadContext(); }, []);

    async function loadContext() {
        try {
            const session = await fetchAuthSession();
            const userEmail = session.tokens?.idToken?.payload?.email as string;
            if (userEmail) setEmail(userEmail);

            // Look for any invitation (even expired/revoked) for context
            if (userEmail) {
                const invRes = await client.models.Invitation.list({
                    filter: { email: { eq: userEmail } },
                });
                if (invRes.data.length) {
                    const sorted = [...invRes.data].sort(
                        (a: any, b: any) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime()
                    );
                    const inv = sorted[0];
                    setInvitation(inv);

                    // Load tenant name
                    if (inv.tenantId) {
                        const tRes = await client.models.Tenant.get({ id: inv.tenantId });
                        if (tRes.data?.companyName) setTenantName(tRes.data.companyName);
                    }

                    // Load org name
                    if (inv.workspaceId) {
                        const oRes = await client.models.Workspace.get({ id: inv.workspaceId });
                        if (oRes.data?.name) setOrgName(oRes.data.name);
                    }

                    // Load inviter email from UserProfile
                    if (inv.invitedBy) {
                        const profileRes = await client.models.UserProfile.list({
                            filter: { userId: { eq: inv.invitedBy } },
                        });
                        if (profileRes.data.length) {
                            setInviterEmail(profileRes.data[0].email || "");
                        }
                    }
                }
            }
        } catch (err) {
            console.error("NoAccessPage: loadContext error", err);
        }
        setLoading(false);
    }

    async function sendMessage() {
        if (!message.trim()) return;
        setSending(true);
        try {
            const session = await fetchAuthSession();
            const sub = session.tokens?.accessToken?.payload?.sub as string;

            await client.models.AuditLog.create({
                tenantId: invitation?.tenantId || undefined,
                workspaceId: invitation?.workspaceId || undefined,
                userId: sub || "unknown",
                action: "CREATE",
                resourceType: "ACCESS_REQUEST",
                result: "SUCCESS",
                timestamp: new Date().toISOString(),
                metadata: JSON.stringify({
                    message: message.trim(),
                    email: email,
                    invitationId: invitation?.id || null,
                    invitationStatus: invitation?.status || null,
                }),
            });

            setSent(true);
            setMessage("");
        } catch (err) {
            console.error("NoAccessPage: sendMessage error", err);
            await alert({ title: "Error", message: "Failed to send message. Please try again.", variant: "danger" });
        }
        setSending(false);
    }

    async function handleSignInAgain() {
        try {
            await signOut();
        } catch (_) {
            // ignore sign-out errors
        }
        localStorage.removeItem("darkMode");

        navigate("/");
    }

    if (loading) {
        return <div style={styles.wrapper}><p style={{ color: "#64748b" }}>Loading...</p></div>;
    }

    const statusLabel = invitation?.status === "EXPIRED"
        ? "expired"
        : invitation?.status === "REVOKED"
            ? "revoked"
            : null;

    return (
        <div style={styles.wrapper}>
            <div style={styles.card}>
                {/* Icon */}
                <div style={styles.iconCircle}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>

                <h2 style={styles.heading}>Access Not Available</h2>

                {/* Contextual message based on invitation state */}
                {invitation && statusLabel ? (
                    <div style={styles.contextBox}>
                        <p style={styles.contextText}>
                            Your invitation
                            {tenantName ? <> to <strong>{tenantName}</strong></> : ""}
                            {orgName ? <> ({orgName})</> : ""}
                            {" "}has <span style={styles.statusHighlight(statusLabel)}>{statusLabel}</span>.
                        </p>
                        {invitation.status === "EXPIRED" && (
                            <p style={styles.contextHint}>
                                The invitation expired on{" "}
                                {new Date(invitation.expiresAt).toLocaleDateString()}.
                                Please ask your administrator to send a new invitation.
                            </p>
                        )}
                        {invitation.status === "REVOKED" && (
                            <p style={styles.contextHint}>
                                This invitation was revoked by the administrator.
                                Contact them if you believe this was a mistake.
                            </p>
                        )}
                    </div>
                ) : (
                    <p style={styles.detail}>
                        No active membership was found for your account
                        {email ? <> (<strong>{email}</strong>)</> : ""}.
                        If you were recently invited, your invitation may not have been processed yet.
                    </p>
                )}

                {/* Divider */}
                <div style={styles.divider} />

                {/* Contact Admin Form */}
                {!sent ? (
                    <div style={styles.formSection}>
                        <h3 style={styles.subHeading}>Send a Message to Admin</h3>
                        <p style={styles.formHint}>
                            Describe your access request and the admin will be notified.
                            {inviterEmail && (
                                <> Your invitation was sent by <strong>{inviterEmail}</strong>.</>
                            )}
                        </p>
                        <textarea
                            style={styles.textarea}
                            rows={4}
                            placeholder="Hi, I need access to... (explain your request)"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                        <button
                            className="btn"
                            style={{ width: "100%", marginTop: 8 }}
                            onClick={sendMessage}
                            disabled={sending || !message.trim()}
                        >
                            {sending ? "Sending..." : "Send Message"}
                        </button>
                    </div>
                ) : (
                    <div style={styles.successBox}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <div>
                            <p style={{ margin: 0, fontWeight: 600, color: "#065f46" }}>Message Sent</p>
                            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#047857" }}>
                                Your request has been sent to the administrator. You'll be contacted at <strong>{email}</strong>.
                            </p>
                        </div>
                    </div>
                )}

                {/* Divider */}
                <div style={styles.divider} />

                {/* Actions */}
                <div style={styles.actions}>
                    <button
                        className="btn"
                        style={styles.signInBtn}
                        onClick={handleSignInAgain}
                    >
                        Sign In with a Different Account
                    </button>

                    {sent && (
                        <button
                            className="btn secondary"
                            style={{ marginTop: 10, width: "100%" }}
                            onClick={() => setSent(false)}
                        >
                            Send Another Message
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, any> = {
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
        width: 480,
        maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "#fef2f2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 16px",
    },
    heading: {
        fontSize: 22,
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: 12,
        textAlign: "center" as const,
    },
    detail: {
        fontSize: 14,
        color: "#475569",
        lineHeight: 1.7,
        textAlign: "center" as const,
        marginBottom: 0,
    },
    contextBox: {
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 0,
    },
    contextText: {
        fontSize: 14,
        color: "#92400e",
        margin: 0,
        lineHeight: 1.6,
    },
    contextHint: {
        fontSize: 13,
        color: "#a16207",
        marginTop: 6,
        marginBottom: 0,
        lineHeight: 1.5,
    },
    statusHighlight: (status: string) => ({
        fontWeight: 600,
        color: status === "expired" ? "#dc2626" : "#991b1b",
    }),
    divider: {
        borderTop: "1px solid #e2e8f0",
        margin: "22px 0",
    },
    formSection: {
        textAlign: "left" as const,
    },
    subHeading: {
        fontSize: 15,
        fontWeight: 600,
        color: "#0f172a",
        margin: "0 0 6px",
    },
    formHint: {
        fontSize: 13,
        color: "#64748b",
        margin: "0 0 12px",
        lineHeight: 1.5,
    },
    textarea: {
        width: "100%",
        padding: 12,
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        fontSize: 14,
        fontFamily: "Inter, system-ui, Arial",
        resize: "vertical" as const,
        lineHeight: 1.5,
        color: "#0f172a",
        boxSizing: "border-box" as const,
    },
    successBox: {
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        background: "#ecfdf5",
        border: "1px solid #a7f3d0",
        borderRadius: 10,
        padding: "14px 16px",
    },
    actions: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
    },
    signInBtn: {
        width: "100%",
        background: "#475569",
    },
};
