export type TaskRole = "OWNER" | "MEMBER" | "TENANT_ADMIN";

export const taskPermissions = {
    OWNER: {
        canCreateBoard: true,
        canDeleteBoard: true,
        canDeleteAnyTask: true,
        canEditAnyTask: true,
        kanbanView: true,
    },
    TENANT_ADMIN: {
        canCreateBoard: true,
        canDeleteBoard: true,
        canDeleteAnyTask: true,
        canEditAnyTask: true,
        kanbanView: false,
    },
    MEMBER: {
        canCreateBoard: false,
        canDeleteBoard: false,
        canDeleteAnyTask: false,
        canEditAnyTask: false,
        kanbanView: false,
    },
};