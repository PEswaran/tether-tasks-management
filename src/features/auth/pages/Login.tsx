import { useState } from "react";
import { confirmSignIn, signIn } from "aws-amplify/auth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

type LoginProps = {
    onSignedIn?: () => void;
};

export default function Login({ onSignedIn }: LoginProps) {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [step, setStep] = useState<"signIn" | "newPassword">("signIn");

    function clearPostLoginCache() {
        // Clear stale tenant/workspace UI scope from previous sessions.
        localStorage.removeItem("activeWorkspace");
        localStorage.removeItem("activeOrganization");
    }

    async function handleSignIn(e: any) {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await signIn({
                username: email.toLowerCase(),
                password,
            });

            if (res.isSignedIn) {
                onSignedIn?.();
                clearPostLoginCache();
                window.location.replace("/auth-redirect");
                return;
            }

            const signInStep = res.nextStep?.signInStep;
            if (signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
                setStep("newPassword");
                return;
            }

            setError("Additional sign-in steps are required. Please contact support.");

        } catch (err: any) {
            setError(err.message || "Unable to sign in");
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirmNewPassword(e: any) {
        e.preventDefault();
        setError("");

        if (newPassword.length < 8) {
            setError("New password must be at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("New password and confirmation do not match.");
            return;
        }

        setLoading(true);
        try {
            const res = await confirmSignIn({ challengeResponse: newPassword });
            if (res.isSignedIn) {
                onSignedIn?.();
                clearPostLoginCache();
                window.location.replace("/auth-redirect");
                return;
            }

            setError("Additional sign-in steps are required. Please contact support.");
        } catch (err: any) {
            setError(err.message || "Unable to set a new password");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo-header">
                    <div className="auth-logo-glow" />
                    <button
                        type="button"
                        className="auth-logo-btn"
                        onClick={() => navigate("/")}
                        aria-label="Back to landing page"
                    >
                        <img src="/logo.png" alt="TetherTasks logo" className="auth-logo" />
                    </button>
                </div>
                <h2>Welcome to TetherTasks</h2>

                {step === "signIn" && (
                    <form onSubmit={handleSignIn}>
                    <input
                        id="login-email"
                        name="email"
                        type="email"
                        placeholder="Email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        />

                        <div className="auth-password-wrap">
                        <input
                            id="login-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowPassword((prev) => !prev)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        {error && <div className="auth-error">{error}</div>}

                        <button className="auth-submit-btn" disabled={loading}>
                            {loading ? "Signing in..." : "Sign in"}
                        </button>
                    </form>
                )}

                {step === "newPassword" && (
                    <form onSubmit={handleConfirmNewPassword}>
                        <p className="auth-hint">
                            A temporary password was used. Please set a new password to continue.
                        </p>

                        <div className="auth-password-wrap">
                            <input
                                id="login-new-password"
                                name="new_password"
                                type={showNewPassword ? "text" : "password"}
                                placeholder="New password"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowNewPassword((prev) => !prev)}
                                aria-label={showNewPassword ? "Hide password" : "Show password"}
                            >
                                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        <input
                            id="login-confirm-password"
                            name="confirm_password"
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />

                        {error && <div className="auth-error">{error}</div>}

                        <button className="auth-submit-btn" disabled={loading}>
                            {loading ? "Updating..." : "Update password"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
