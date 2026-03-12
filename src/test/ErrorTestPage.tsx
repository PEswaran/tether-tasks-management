import { useState } from "react";
import ErrorBoundary from "../shared-components/ErrorBoundary";

/**
 * Dev-only page for Playwright E2E testing of ErrorBoundary.
 * Stripped from production builds via `import.meta.env.DEV` guard in App.tsx.
 */

function BombComponent() {
    const [shouldThrow, setShouldThrow] = useState(false);
    if (shouldThrow) throw new Error("Test error triggered by Playwright");
    return (
        <div>
            <p data-testid="healthy-content">Content is healthy</p>
            <button onClick={() => setShouldThrow(true)} data-testid="trigger-error">
                Trigger Error
            </button>
        </div>
    );
}

export default function ErrorTestPage() {
    const [resetKey, setResetKey] = useState(0);

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            <nav data-testid="test-sidebar" style={{ width: 200, background: "#f0f0f0", padding: 20 }}>
                <p style={{ fontWeight: 700, marginBottom: 16 }}>Test Sidebar</p>
                <button
                    data-testid="sidebar-reset"
                    onClick={() => setResetKey((k) => k + 1)}
                    style={{ cursor: "pointer" }}
                >
                    Navigate Away
                </button>
            </nav>
            <main style={{ flex: 1, padding: 20 }}>
                <h1>Error Boundary Test Page</h1>
                <ErrorBoundary level="content" key={resetKey}>
                    <BombComponent />
                </ErrorBoundary>
            </main>
        </div>
    );
}
