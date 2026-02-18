import { useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import "./platform-super-admin/styles/platform-admin.css";

export default function SuspendedPage() {
    const navigate = useNavigate();

    async function handleSignOut() {
        try {
            await signOut();
        } catch (_) {
            // ignore
        }
        localStorage.removeItem("darkMode");
        navigate("/");
    }

    return (
        <div style={styles.wrapper}>
            <div style={styles.card}>
                <div style={styles.iconCircle}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>

                <h2 style={styles.heading}>Account Suspended</h2>

                <p style={styles.detail}>
                    Your company's account has been suspended by a platform administrator.
                    Please contact support if you believe this is an error.
                </p>

                <div style={styles.divider} />

                <button
                    className="btn"
                    style={{ width: "100%", background: "#475569" }}
                    onClick={handleSignOut}
                >
                    Sign In with a Different Account
                </button>
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
        background: "#fffbeb",
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
    divider: {
        borderTop: "1px solid #e2e8f0",
        margin: "22px 0",
    },
};
