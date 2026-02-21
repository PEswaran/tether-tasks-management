import { useState } from "react";
import { signIn } from "aws-amplify/auth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

type LoginProps = {
    onSignedIn?: () => void;
};

export default function Login({ onSignedIn }: LoginProps) {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSignIn(e: any) {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await signIn({
                username: email.toLowerCase(),
                password,
            });

            onSignedIn?.();
            navigate("/auth-redirect");

        } catch (err: any) {
            setError(err.message || "Unable to sign in");
        }

        setLoading(false);
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

                <form onSubmit={handleSignIn}>
                    <input
                        type="email"
                        placeholder="Email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <div className="auth-password-wrap">
                        <input
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
            </div>
        </div>
    );
}
