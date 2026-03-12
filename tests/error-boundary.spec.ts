import { test, expect } from "@playwright/test";

const TEST_URL = "/test/error-boundary";

test.describe("ErrorBoundary — E2E", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(TEST_URL);
    });

    // ─── Page loads correctly ────────────────────────────────────────
    test("test page renders healthy content", async ({ page }) => {
        await expect(page.getByTestId("healthy-content")).toBeVisible();
        await expect(page.getByTestId("trigger-error")).toBeVisible();
        await expect(page.getByText("Something went wrong")).not.toBeVisible();
    });

    test("sidebar is visible alongside content", async ({ page }) => {
        await expect(page.getByTestId("test-sidebar")).toBeVisible();
        await expect(page.getByTestId("healthy-content")).toBeVisible();
    });

    // ─── Error is caught ─────────────────────────────────────────────
    test("clicking Trigger Error shows the error boundary fallback", async ({ page }) => {
        await page.getByTestId("trigger-error").click();

        await expect(page.getByText("Something went wrong")).toBeVisible();
        await expect(page.getByText("Test error triggered by Playwright")).toBeVisible();
        await expect(page.getByTestId("healthy-content")).not.toBeVisible();
    });

    test("sidebar remains visible after an error", async ({ page }) => {
        await page.getByTestId("trigger-error").click();

        await expect(page.getByText("Something went wrong")).toBeVisible();
        await expect(page.getByTestId("test-sidebar")).toBeVisible();
    });

    test("fallback shows Try Again button and Go to Dashboard link", async ({ page }) => {
        await page.getByTestId("trigger-error").click();

        await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
        const dashLink = page.getByRole("link", { name: "Go to Dashboard" });
        await expect(dashLink).toBeVisible();
        await expect(dashLink).toHaveAttribute("href", "/");
    });

    // ─── Recovery: Try Again ─────────────────────────────────────────
    test("Try Again clears error and re-renders healthy content", async ({ page }) => {
        await page.getByTestId("trigger-error").click();
        await expect(page.getByText("Something went wrong")).toBeVisible();

        await page.getByRole("button", { name: "Try Again" }).click();

        await expect(page.getByTestId("healthy-content")).toBeVisible();
        await expect(page.getByText("Something went wrong")).not.toBeVisible();
    });

    // ─── Recovery: Navigate away ─────────────────────────────────────
    test("navigating away via sidebar resets the error boundary", async ({ page }) => {
        await page.getByTestId("trigger-error").click();
        await expect(page.getByText("Something went wrong")).toBeVisible();

        await page.getByTestId("sidebar-reset").click();

        await expect(page.getByTestId("healthy-content")).toBeVisible();
        await expect(page.getByText("Something went wrong")).not.toBeVisible();
    });

    // ─── Error can be triggered again after recovery ─────────────────
    test("error can be triggered again after recovery", async ({ page }) => {
        // First error
        await page.getByTestId("trigger-error").click();
        await expect(page.getByText("Something went wrong")).toBeVisible();

        // Recover
        await page.getByRole("button", { name: "Try Again" }).click();
        await expect(page.getByTestId("healthy-content")).toBeVisible();

        // Second error
        await page.getByTestId("trigger-error").click();
        await expect(page.getByText("Something went wrong")).toBeVisible();
    });
});
