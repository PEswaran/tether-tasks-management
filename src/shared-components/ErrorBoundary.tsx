import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onReset?: () => void;
    level?: "app" | "content";
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("ErrorBoundary caught:", error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        if (this.props.fallback) {
            return this.props.fallback;
        }

        const message = this.state.error?.message || "An unexpected error occurred";
        const truncated = message.length > 200 ? message.slice(0, 200) + "..." : message;
        const isApp = this.props.level === "app";

        const content = (
            <div className="error-fallback">
                <AlertTriangle size={40} className="error-fallback-icon" />
                <h2 className="error-fallback-title">Something went wrong</h2>
                <p className="error-fallback-message">{truncated}</p>
                <div className="error-fallback-actions">
                    <button className="btn" onClick={this.handleReset}>
                        Try Again
                    </button>
                    <a className="btn secondary" href="/" style={{ textDecoration: "none" }}>
                        Go to Dashboard
                    </a>
                </div>
            </div>
        );

        if (isApp) {
            return (
                <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#eef5fb" }}>
                    {content}
                </div>
            );
        }

        return content;
    }
}
