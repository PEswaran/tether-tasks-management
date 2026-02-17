export function canManageMembers(role: string) {
    return role === "TENANT_ADMIN";
}

export function canCreateOrg(role: string) {
    return role === "TENANT_ADMIN" || role === "OWNER";
}

export function canDeleteTask(role: string, isOwner: boolean) {
    if (isOwner) return true;
    return role === "TENANT_ADMIN";
}
