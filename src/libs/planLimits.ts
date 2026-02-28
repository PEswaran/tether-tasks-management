type PlanLimits = {
    orgs: number;
    workspaces: number;
};

const PLAN_LIMITS: Record<string, PlanLimits> = {
    STARTER: { orgs: 1, workspaces: 1 },
    FREE: { orgs: 1, workspaces: 1 },
    PROFESSIONAL: { orgs: 3, workspaces: 5 },
    PREMIUM: { orgs: 3, workspaces: 5 },
    ENTERPRISE: { orgs: 100, workspaces: 100 },
    UNLIMITED: { orgs: 100, workspaces: 100 },
};

const DEFAULT_PLAN = "STARTER";

export function getPlanLimits(plan?: string): PlanLimits {
    const key = (plan || DEFAULT_PLAN).toUpperCase();
    return PLAN_LIMITS[key] || PLAN_LIMITS[DEFAULT_PLAN];
}

export function formatPlanLimitMessage(plan?: string): string {
    const key = (plan || DEFAULT_PLAN).toUpperCase();
    switch (key) {
        case "STARTER":
        case "FREE":
            return "Starter plan limits: 1 organization and 1 workspace.";
        case "PROFESSIONAL":
        case "PREMIUM":
            return "Professional plan limits: 3 organizations and 5 workspaces.";
        case "ENTERPRISE":
        case "UNLIMITED":
            return "Enterprise plan limits (capped at 100 organizations/workspaces).";
        default:
            return "Consult your plan limits.";
    }
}
