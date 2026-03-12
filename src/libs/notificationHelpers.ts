/* Map role → route prefix for the current user */
export function getRolePrefix(role: string | null, pathname: string): string {
    if (pathname.startsWith("/general")) return "/general";
    switch (role) {
        case "PLATFORM_SUPER_ADMIN": return "/super";
        case "TENANT_ADMIN": return "/tenant";
        case "OWNER": return "/owner";
        case "MEMBER": return "/member";
        default: return "/general";
    }
}

/* Resolve where a notification should navigate to */
export function resolveDestination(
    n: any,
    role: string | null,
    pathname: string
): { type: "task"; id: string } | { type: "navigate"; path: string } | null {
    const prefix = getRolePrefix(role, pathname);
    const notifType: string = n.type || "";

    // Task-related → open in modal
    if (
        notifType === "TASK_ASSIGNED" ||
        notifType === "TASK_UPDATED" ||
        notifType === "TASK_COMPLETED" ||
        notifType === "TASK_DELETE_REQUEST"
    ) {
        const taskId = n.resourceId || (n.link?.startsWith("/tasks/") ? n.link.split("/tasks/")[1] : null);
        if (taskId) return { type: "task", id: taskId };
        return { type: "navigate", path: `${prefix}/tasks` };
    }

    // Board assigned → go to tasks/boards page
    if (notifType === "BOARD_ASSIGNED") {
        return { type: "navigate", path: `${prefix}/tasks` };
    }

    // Invited to workspace/org → go to workspaces or dashboard
    if (notifType === "INVITED_TO_WORKSPACE") {
        if (prefix === "/tenant") return { type: "navigate", path: `${prefix}/workspaces` };
        if (prefix === "/owner") return { type: "navigate", path: `${prefix}/workspaces` };
        if (prefix === "/general") return { type: "navigate", path: `${prefix}/workspaces` };
        return { type: "navigate", path: prefix };
    }

    // Contact request → platform admin dashboard
    if (notifType === "CONTACT_REQUEST") {
        return { type: "navigate", path: "/super" };
    }

    return null;
}
