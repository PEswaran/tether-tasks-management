import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { createTenantAdminFn } from '../functions/create-tenant-admin/resource';
import { deleteTenantFn } from '../functions/delete-tenant/resource';
import { inviteMemberToOrgFn } from '../functions/invite-member-to-org/resource';
import { sendAssignmentEmail } from '../functions/sendAssignmentEmail/resource';
import { notifyTaskAssignment } from '../functions/notifyOnTaskAssignment/resource';
import { replaceTenantAdminFn } from '../functions/replace-tenant-admin/resource';
import { submitContactRequestFn } from '../functions/submit-contact-request/resource';

const schema = a.schema({

    /* =========================================================
     ENUMS
    ========================================================= */

    MembershipRole: a.enum(['PLATFORM_SUPER_ADMIN', 'TENANT_ADMIN', 'OWNER', 'MEMBER']),
    MembershipStatus: a.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']),
    InvitationStatus: a.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']),
    TaskStatus: a.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']),
    TaskPriority: a.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),

    NotificationType: a.enum([
        'TASK_DELETE_REQUEST', 'TASK_ASSIGNED', 'TASK_UPDATED', 'TASK_COMPLETED', 'BOARD_ASSIGNED', 'INVITED_TO_WORKSPACE', 'CONTACT_REQUEST'
    ]),

    AuditAction: a.enum(['CREATE', 'UPDATE', 'DELETE', 'INVITE', 'REMOVE', 'LOGIN', 'LOGOUT', 'ASSIGN']),

    /* =========================================================
     TENANT
    ========================================================= */

    Tenant: a.model({
        id: a.id().required(),
        companyName: a.string().required(),

        status: a.string(),
        isActive: a.boolean(),

        subscriptionStatus: a.string(),
        plan: a.string(),
        stripeCustomerId: a.string(),
        stripeSubscriptionId: a.string(),

        createdAt: a.datetime(),
        updatedAt: a.datetime(),

    })
        .authorization(allow => [
            allow.group('PLATFORM_SUPER_ADMIN'),
            allow.authenticated()
        ]),

    /* =========================================================
     WORKSPACE (ORG)
    ========================================================= */

    Workspace: a.model({
        id: a.id().required(),
        tenantId: a.id().required(),

        name: a.string().required(),
        description: a.string(),

        ownerUserSub: a.string(),
        type: a.string(),

        isActive: a.boolean(),
        isDeleted: a.boolean(),

        createdBy: a.string(),
        createdAt: a.datetime(),
        updatedAt: a.datetime(),
    })
        .secondaryIndexes(index => [
            index("tenantId").queryField("workspacesByTenant"), // rename safer
            index("ownerUserSub").queryField("workspacesByOwner")
        ])


        .authorization(allow => [
            allow.group('PLATFORM_SUPER_ADMIN'),
            allow.authenticated()
        ]),

    /* =========================================================
     MEMBERSHIP
    ========================================================= */

    Membership: a.model({
        id: a.id().required(),

        tenantId: a.id().required(),
        workspaceId: a.id().required(), // workspaceId
        userSub: a.string().required(),

        role: a.ref('MembershipRole').required(),
        status: a.ref('MembershipStatus'),

        invitedBy: a.string(),
        joinedAt: a.datetime(),
        createdAt: a.datetime(),
    })
        .secondaryIndexes(index => [
            index("userSub")
                .sortKeys(["createdAt"])
                .queryField("listMembershipsByUser"),

            index("workspaceId")
                .sortKeys(["createdAt"])
                .queryField("listMembershipsByWorkspace"),

            index("tenantId")
                .sortKeys(["createdAt"])
                .queryField("listMembershipsByTenant")
        ])


        .authorization(allow => [
            allow.ownerDefinedIn('userSub'),

            allow.group('PLATFORM_SUPER_ADMIN'),
            allow.authenticated()
        ]),

    /* =========================================================
     INVITATION
    ========================================================= */

    Invitation: a.model({
        id: a.id().required(),
        tenantId: a.id().required(),
        workspaceId: a.id(),

        email: a.email().required(),
        role: a.ref('MembershipRole').required(),

        invitedBy: a.string(),
        token: a.string(),

        status: a.ref('InvitationStatus'),
        sentAt: a.datetime(),
        expiresAt: a.datetime(),
    })
        .secondaryIndexes(index => [
            index("email")
                .sortKeys(["sentAt"])
                .queryField("listInvitesByEmail"),

            index("workspaceId")
                .sortKeys(["sentAt"])
                .queryField("listInvitesByWorkspace")
        ])


        .authorization(allow => [
            allow.group('PLATFORM_SUPER_ADMIN'),
            allow.authenticated(),
            allow.publicApiKey().to(['read'])
        ]),

    /* =========================================================
     TASK BOARD
    ========================================================= */

    TaskBoard: a.model({
        id: a.id().required(),
        tenantId: a.id().required(),
        workspaceId: a.id().required(),

        name: a.string().required(),
        description: a.string(),

        ownerUserSub: a.string(),
        visibility: a.string(),
        isActive: a.boolean(),

        createdBy: a.string(),
        createdAt: a.datetime(),
        updatedAt: a.datetime(),
    })
        .secondaryIndexes(index => [
            index("tenantId")
                .sortKeys(["createdAt"])
                .queryField("listWorkspacesByTenant"),

            index("ownerUserSub")
                .sortKeys(["createdAt"])
                .queryField("listWorkspacesByOwner")
        ])

        .authorization(allow => [
            allow.group('PLATFORM_SUPER_ADMIN'),
            allow.authenticated()
        ]),

    /* =========================================================
     TASK
    ========================================================= */

    Task: a.model({
        id: a.id().required(),
        tenantId: a.id().required(),
        workspaceId: a.id().required(),
        taskBoardId: a.id().required(),

        title: a.string().required(),
        description: a.string(),

        status: a.ref('TaskStatus'),
        priority: a.ref('TaskPriority'),

        ownerUserSub: a.string(),
        assignedTo: a.string(),
        assignedBy: a.string(),
        createdBy: a.string(),

        dueDate: a.datetime(),
        completedAt: a.datetime(),

        isActive: a.boolean(),
        createdAt: a.datetime(),
        updatedAt: a.datetime(),
    })
        .secondaryIndexes(index => [
            index("ownerUserSub")
                .sortKeys(["createdAt"])
                .queryField("listTasksByOwner"),

            index("assignedTo")
                .sortKeys(["dueDate"])
                .queryField("listTasksByAssignee"),

            index("taskBoardId")
                .sortKeys(["createdAt"])
                .queryField("listTasksByBoard"),

            index("workspaceId")
                .sortKeys(["createdAt"])
                .queryField("listTasksByWorkspace")
        ])


        .authorization(allow => [
            allow.group('PLATFORM_SUPER_ADMIN'),
            allow.authenticated()
        ]),

    /* =========================================================
     NOTIFICATION
    ========================================================= */

    Notification: a.model({
        id: a.id().required(),
        tenantId: a.id().required(),
        workspaceId: a.id(),

        recipientId: a.string().required(),
        senderId: a.string(),

        type: a.ref('NotificationType'),
        title: a.string(),
        message: a.string(),

        link: a.string(),
        emailSent: a.boolean(),

        resourceId: a.string(),
        isRead: a.boolean(),

        createdAt: a.datetime(),
    })
        .secondaryIndexes(index => [
            index("recipientId")
                .sortKeys(["createdAt"])
                .queryField("listNotificationsByUser"),

            index("tenantId")
                .sortKeys(["createdAt"])
                .queryField("listNotificationsByTenant")
        ])


        .authorization(allow => [
            allow.group('PLATFORM_SUPER_ADMIN'),
            allow.authenticated()
        ]),

    /* =========================================================
     AUDIT LOG
    ========================================================= */

    AuditLog: a.model({
        id: a.id().required(),
        tenantId: a.id(),
        workspaceId: a.id(),
        userId: a.string(),

        action: a.ref('AuditAction'),
        resourceType: a.string(),
        resourceId: a.string(),

        result: a.string(),
        metadata: a.json(),

        timestamp: a.datetime(),
    })
        .secondaryIndexes(index => [
            index("tenantId")
                .sortKeys(["timestamp"])
                .queryField("listAuditByTenant"),

            index("userId")
                .sortKeys(["timestamp"])
                .queryField("listAuditByUser")
        ])


        .authorization(allow => [
            allow.group('PLATFORM_SUPER_ADMIN'),
            allow.authenticated().to(['create', 'read'])
        ]),

    /* =========================================================
     USER PROFILE
    ========================================================= */

    UserProfile: a.model({
        userId: a.id().required(),
        tenantId: a.id().required(),

        email: a.email().required(),
        firstName: a.string(),
        lastName: a.string(),
        role: a.string(),

        createdAt: a.datetime(),
    })
        .identifier(['userId'])
        .secondaryIndexes(index => [
            index("tenantId").queryField("listProfilesByTenant")
        ])
        .authorization(allow => [
            allow.group('PLATFORM_SUPER_ADMIN'),
            allow.authenticated()
        ]),

    /* =========================================================
     MUTATIONS
    ========================================================= */

    createTenantAdmin: a.mutation()
        .arguments({
            companyName: a.string().required(),
            adminEmail: a.string().required(),
        })
        .returns(a.customType({
            success: a.boolean(),
            message: a.string(),
            tenantId: a.string(),
            invitationId: a.string(),
        }))
        .authorization(allow => [allow.group("PLATFORM_SUPER_ADMIN")])
        .handler(a.handler.function(createTenantAdminFn)),

    inviteMemberToOrg: a.mutation()
        .arguments({
            email: a.string().required(),
            workspaceId: a.string().required(),
            tenantId: a.string().required(),
            role: a.string().required(),
        })
        .returns(a.customType({
            success: a.boolean(),
            message: a.string(),
            invitationId: a.string(),
        }))
        .authorization(allow => [allow.authenticated()])
        .handler(a.handler.function(inviteMemberToOrgFn)),

    replaceTenantAdmin: a.mutation()
        .arguments({
            tenantId: a.string().required(),
            newAdminEmail: a.string().required(),
            oldMembershipId: a.string().required(),
        })
        .returns(a.customType({
            success: a.boolean(),
            message: a.string(),
        }))
        .authorization(allow => [allow.group("PLATFORM_SUPER_ADMIN")])
        .handler(a.handler.function(replaceTenantAdminFn)),

    removeTenantAndData: a.mutation()
        .arguments({
            tenantId: a.string().required(),
        })
        .returns(a.customType({
            success: a.boolean(),
            message: a.string(),
        }))
        .authorization(allow => [allow.group("PLATFORM_SUPER_ADMIN")])
        .handler(a.handler.function(deleteTenantFn)),

    sendAssignmentEmail: a.mutation()
        .arguments({
            userSub: a.string().required(),
            type: a.string().required(),
            itemName: a.string().required(),
            workspaceId: a.string(),
        })
        .returns(a.customType({
            success: a.boolean(),
            message: a.string(),
        }))
        .authorization(allow => [allow.authenticated()])
        .handler(a.handler.function(sendAssignmentEmail)),

    notifyTaskAssignment: a.mutation()
        .arguments({
            task: a.json().required()
        })
        .returns(a.json())
        .authorization(allow => [allow.authenticated()])
        .handler(a.handler.function(notifyTaskAssignment)),

    submitContactRequest: a.mutation()
        .arguments({
            name: a.string().required(),
            email: a.string().required(),
            companyName: a.string().required(),
            phone: a.string(),
            teamSize: a.string(),
            message: a.string().required(),
        })
        .returns(a.customType({
            success: a.boolean(),
            message: a.string(),
        }))
        .authorization(allow => [allow.publicApiKey()])
        .handler(a.handler.function(submitContactRequestFn)),

})
    .authorization(allow => [
        allow.resource(createTenantAdminFn),
        allow.resource(deleteTenantFn),
        allow.resource(inviteMemberToOrgFn),
        allow.resource(sendAssignmentEmail),
        allow.resource(notifyTaskAssignment),
        allow.resource(replaceTenantAdminFn),
        allow.resource(submitContactRequestFn)
    ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: 'userPool',
        apiKeyAuthorizationMode: { expiresInDays: 30 }
    },
});
