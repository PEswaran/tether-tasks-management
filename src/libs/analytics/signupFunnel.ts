declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
        dataLayer?: any[];
    }
}

// Feature: Signup Funnel Analytics
const FEATURE_NAME = "signup_funnel_analytics";

function emitAnalyticsEvent(eventName: string, params: Record<string, unknown> = {}) {
    const payload = { feature: FEATURE_NAME, ...params };

    // Prefer GA4 gtag if present.
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", eventName, payload);
        return;
    }

    // Fallback to dataLayer so GTM setups can still capture funnel events.
    if (typeof window !== "undefined" && Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: eventName, ...payload });
    }
}

export function trackLandingView() {
    emitAnalyticsEvent("landing_view", { page_path: "/", page_name: "landing" });
}

export function trackLandingEngagement(secondsOnPage: number) {
    emitAnalyticsEvent("landing_engagement", {
        page_name: "landing",
        engagement_seconds: Math.max(0, Math.round(secondsOnPage)),
    });
}

export function trackSignupStart(source: string) {
    emitAnalyticsEvent("sign_up_start", { source });
}

export function trackSignupPageView() {
    emitAnalyticsEvent("sign_up_page_view", { page_path: "/contact", page_name: "contact_signup" });
}

export function trackSignupSubmitAttempt(config: {
    teamSize?: string;
    numberOfOrgs?: string;
    businessType?: string;
}) {
    emitAnalyticsEvent("sign_up_submit", {
        team_size: config.teamSize || "unknown",
        org_count: config.numberOfOrgs || "unknown",
        business_type: config.businessType || "unknown",
    });
}

export function trackSignupSubmitSuccess(config: {
    teamSize?: string;
    numberOfOrgs?: string;
    businessType?: string;
}) {
    emitAnalyticsEvent("sign_up_success", {
        method: "contact_form",
        team_size: config.teamSize || "unknown",
        org_count: config.numberOfOrgs || "unknown",
        business_type: config.businessType || "unknown",
    });
}

export function trackSignupSubmitError(reason: string) {
    emitAnalyticsEvent("sign_up_error", { reason });
}

