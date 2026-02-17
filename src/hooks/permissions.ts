export type UserRole =
    | "PLATFORM_SUPER_ADMIN"
    | "TENANT_ADMIN"
    | "OWNER"
    | "MEMBER";

export type Permission =
    | "invite:members"
    | "edit:members"
    | "remove:members"
    | "create:workspace"
    | "delete:workspace"
    | "create:task"
    | "assign:task"
    | "view:audit"
    | "manage:billing";

const rolePermissions: Record<UserRole, Permission[]> = {
    PLATFORM_SUPER_ADMIN: [
        "invite:members",
        "edit:members",
        "remove:members",
        "create:workspace",
        "delete:workspace",
        "create:task",
        "assign:task",
        "view:audit",
        "manage:billing",
    ],

    TENANT_ADMIN: [
        "invite:members",
        "edit:members",
        "remove:members",
        "create:workspace",
        "delete:workspace",
        "create:task",
        "assign:task",
        "view:audit",
    ],

    OWNER: [
        "invite:members",
        "edit:members",
        "create:task",
        "assign:task",
    ],

    MEMBER: [
        "create:task",
    ],
};

/* ========================================
   MAIN PERMISSION CHECK
======================================== */

export function hasPermission(
    role: UserRole | null | undefined,
    permission: Permission
) {
    if (!role) return false;
    return rolePermissions[role]?.includes(permission) ?? false;
}
