import { useState } from "react";
import { signIn } from "aws-amplify/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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

            // ✅ Go to redirect router
            navigate("/auth-redirect");

        } catch (err: any) {
            setError(err.message || "Unable to sign in");
        }

        setLoading(false);
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
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

                    <input
                        type="password"
                        placeholder="Password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {error && <div className="auth-error">{error}</div>}

                    <button disabled={loading}>
                        {loading ? "Signing in..." : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}