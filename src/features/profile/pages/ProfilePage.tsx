import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCurrentUser } from "aws-amplify/auth";
import { dataClient } from "../../../libs/data-client";

export default function ProfilePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirect = searchParams.get("redirect");

    const client = dataClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [profileExists, setProfileExists] = useState(false);
    const [userId, setUserId] = useState("");
    const [tenantId, setTenantId] = useState("");

    useEffect(() => {
        loadProfile();
    }, []);

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
                setTenantId(res.data.tenantId || "");
                setProfileExists(true);
            } else {
                setEmail(user.username || "");
            }
        } catch (err) {
            console.error("ProfilePage: load error", err);
        }
        setLoading(false);
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
                    tenantId,
                    email,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                });
            }

            if (redirect) {
                navigate(redirect);
            } else {
                navigate(-1);
            }
        } catch (err) {
            console.error("ProfilePage: save error", err);
            setSaving(false);
        }
    }

    if (loading) {
        return <div style={styles.wrapper}><p style={{ color: "#64748b" }}>Loading...</p></div>;
    }

    const isPostInvite = !!redirect;
    const heading = isPostInvite ? "Complete Your Profile" : "Edit Profile";
    const subtext = isPostInvite
        ? "Please enter your name to get started."
        : "Update your profile information.";

    return (
        <div style={styles.wrapper}>
            <div style={styles.card}>
                <div style={styles.iconCircle}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                </div>

                <h2 style={styles.heading}>{heading}</h2>
                <p style={styles.subtext}>{subtext}</p>

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

                    {!isPostInvite && (
                        <button
                            className="btn secondary"
                            style={styles.cancelBtn}
                            onClick={() => navigate(-1)}
                        >
                            Cancel
                        </button>
                    )}
                </div>
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
    card: {
        background: "white",
        padding: "36px 40px",
        borderRadius: 16,
        width: 440,
        maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "#eef2ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 16px",
    },
    heading: {
        fontSize: 22,
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: 6,
        textAlign: "center" as const,
    },
    subtext: {
        fontSize: 14,
        color: "#64748b",
        textAlign: "center" as const,
        marginBottom: 24,
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
    cancelBtn: {
        width: "100%",
        marginTop: 10,
    },
};
