import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "../ErrorBoundary";

// A component that throws on render — controlled via prop
function ThrowingChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
    if (shouldThrow) throw new Error("Test explosion");
    return <div>Child rendered safely</div>;
}

// Suppress noisy React/jsdom error output during expected throws
beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

// ─── Rendering children ─────────────────────────────────────────────
describe("ErrorBoundary — happy path", () => {
    it("renders children when no error occurs", () => {
        render(
            <ErrorBoundary>
                <div>Hello World</div>
            </ErrorBoundary>
        );
        expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    it("does not show fallback UI when children are healthy", () => {
        render(
            <ErrorBoundary>
                <div>All good</div>
            </ErrorBoundary>
        );
        expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });
});

// ─── Catching errors ─────────────────────────────────────────────────
describe("ErrorBoundary — error catching", () => {
    it("catches a render error and shows fallback UI", () => {
        render(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        );
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.queryByText("Child rendered safely")).not.toBeInTheDocument();
    });

    it("displays the error message", () => {
        render(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        );
        expect(screen.getByText("Test explosion")).toBeInTheDocument();
    });

    it("shows Try Again and Go to Dashboard actions", () => {
        render(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        );
        expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Go to Dashboard" })).toHaveAttribute("href", "/");
    });

    it("logs the error via componentDidCatch", () => {
        render(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        );
        expect(console.error).toHaveBeenCalledWith(
            "ErrorBoundary caught:",
            expect.any(Error),
            expect.objectContaining({ componentStack: expect.any(String) })
        );
    });
});

// ─── Error message truncation ────────────────────────────────────────
describe("ErrorBoundary — message truncation", () => {
    function LongErrorChild() {
        throw new Error("x".repeat(300));
        return null;
    }

    it("truncates error messages longer than 200 characters", () => {
        render(
            <ErrorBoundary>
                <LongErrorChild />
            </ErrorBoundary>
        );
        const message = screen.getByText(/^x+\.\.\.$/);
        expect(message.textContent!.length).toBe(203); // 200 chars + "..."
    });

    it("shows full message when under 200 characters", () => {
        render(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        );
        expect(screen.getByText("Test explosion")).toBeInTheDocument();
    });
});

// ─── Reset / recovery ────────────────────────────────────────────────
describe("ErrorBoundary — reset behavior", () => {
    it("clears error state when Try Again is clicked and child succeeds", async () => {
        const user = userEvent.setup();
        let shouldThrow = true;

        function ConditionalChild() {
            if (shouldThrow) throw new Error("Boom");
            return <div>Recovered</div>;
        }

        render(
            <ErrorBoundary>
                <ConditionalChild />
            </ErrorBoundary>
        );
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();

        // Fix the child before retrying
        shouldThrow = false;
        await user.click(screen.getByRole("button", { name: "Try Again" }));

        expect(screen.getByText("Recovered")).toBeInTheDocument();
        expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });

    it("calls the onReset callback when Try Again is clicked", async () => {
        const user = userEvent.setup();
        const onReset = vi.fn();
        let shouldThrow = true;

        function ConditionalChild() {
            if (shouldThrow) throw new Error("Boom");
            return <div>OK</div>;
        }

        render(
            <ErrorBoundary onReset={onReset}>
                <ConditionalChild />
            </ErrorBoundary>
        );

        shouldThrow = false;
        await user.click(screen.getByRole("button", { name: "Try Again" }));

        expect(onReset).toHaveBeenCalledTimes(1);
    });
});

// ─── Custom fallback ─────────────────────────────────────────────────
describe("ErrorBoundary — custom fallback", () => {
    it("renders custom fallback instead of default UI", () => {
        render(
            <ErrorBoundary fallback={<div>Custom error page</div>}>
                <ThrowingChild />
            </ErrorBoundary>
        );
        expect(screen.getByText("Custom error page")).toBeInTheDocument();
        expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });
});

// ─── Level prop ──────────────────────────────────────────────────────
describe("ErrorBoundary — level prop", () => {
    it('wraps fallback in full-screen container when level="app"', () => {
        const { container } = render(
            <ErrorBoundary level="app">
                <ThrowingChild />
            </ErrorBoundary>
        );
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.style.minHeight).toBe("100vh");
        expect(wrapper.style.placeItems).toBe("center");
        // The error-fallback div is nested inside the full-screen wrapper
        expect(wrapper.querySelector(".error-fallback")).toBeInTheDocument();
    });

    it('renders inline fallback without full-screen wrapper when level="content"', () => {
        const { container } = render(
            <ErrorBoundary level="content">
                <ThrowingChild />
            </ErrorBoundary>
        );
        const fallback = container.firstElementChild as HTMLElement;
        expect(fallback.className).toBe("error-fallback");
        expect(fallback.style.minHeight).not.toBe("100vh");
    });

    it("defaults to content layout when level is not specified", () => {
        const { container } = render(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        );
        const fallback = container.firstElementChild as HTMLElement;
        expect(fallback.className).toBe("error-fallback");
    });
});
