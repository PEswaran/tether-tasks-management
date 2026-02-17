import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { createTenantAdminFn } from '../functions/create-tenant-admin/resource';

import { deleteTenantFn } from '../functions/delete-tenant/resource';
import { inviteMemberToOrgFn } from '../functions/invite-member-to-org/resource';
import { sendAssignmentEmail } from '../functions/sendAssignmentEmail/resource';

/*
 * ============================================================================
 * MULTI-TENANT TASK MANAGEMENT PLATFORM SCHEMA
 * ============================================================================
 * 
 * This schema implements a secure, GDPR and HIPAA-ready multi-tenant SaaS
 * platform with the following features:
 * 
 * - Multi-tenant data isolation via tenantId
 * - Cross-tenant user support (users can belong to multiple tenants)
 * - Role-based access control (PLATFORM_SUPER_ADMIN, TENANT_ADMIN, OWNER, MEMBER)
 * - GDPR compliance (PII encryption, data export, deletion)
 * - HIPAA readiness (comprehensive audit logging, encryption)
 * - Stripe billing integration
 * - 30-day audit log retention with auto-archival
 * 
 * ============================================================================
 */

const schema = a.schema({

  // ============================================================================
  // ENUMS - Define all enumeration types
  // ============================================================================

  MembershipRole: a.enum([
    'PLATFORM_SUPER_ADMIN',
    'TENANT_ADMIN',
    'OWNER',
    'MEMBER'
  ]),

  MembershipStatus: a.enum([
    'ACTIVE',
    'SUSPENDED',
    'REMOVED'
  ]),

  InvitationStatus: a.enum([
    'PENDING',
    'ACCEPTED',
    'REVOKED',
    'EXPIRED'
  ]),

  TaskStatus: a.enum([
    'TODO',
    'IN_PROGRESS',
    'DONE',
    'ARCHIVED'
  ]),

  TaskPriority: a.enum([
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
  ]),

  AuditAction: a.enum([
    'CREATE',
    'UPDATE',
    'DELETE',
    'VIEW',
    'EXPORT',
    'INVITE',
    'REVOKE',
    'LOGIN',
    'LOGOUT',
    'PERMISSION_CHANGE'
  ]),

  AuditResult: a.enum([
    'SUCCESS',
    'FAILURE',
    'PARTIAL'
  ]),

  NotificationType: a.enum([
    'TASK_REASSIGNED',
    'TASK_UPDATED',
    'TASK_DELETE_REQUEST'
  ]),

  // ============================================================================
  // TENANT - Top-level company/customer entity
  // ============================================================================

  Tenant: a
    .model({
      id: a.id().required(),
      companyName: a.string().required(),
      status: a.string(), // PENDING ACCEPTED


      // Company settings and metadata
      settings: a.json(), // { timezone, locale, branding, etc. }
      isActive: a.boolean(),

      // Timestamps
      createdAt: a.datetime(),
      updatedAt: a.datetime(),

      // Relationships
      organizations: a.hasMany('Organization', 'tenantId'),
      memberships: a.hasMany('Membership', 'tenantId'),
      invitations: a.hasMany('Invitation', 'tenantId'),
      taskBoards: a.hasMany('TaskBoard', 'tenantId'),
      tasks: a.hasMany('Task', 'tenantId'),
      auditLogs: a.hasMany('AuditLog', 'tenantId'),
      notifications: a.hasMany('Notification', 'tenantId'),
    })
    .authorization((allow) => [
      // Platform super admins - full access to all tenants
      allow.group('PLATFORM_SUPER_ADMIN'),

      // All authenticated users (tenant scoping handled in application layer)
      allow.authenticated(),
    ]),

  // ============================================================================
  // ORGANIZATION - Sub-units within a tenant (departments, teams, projects)
  // ============================================================================

  Organization: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),

      name: a.string().required(),
      description: a.string(),
      settings: a.json(), // Org-specific configuration

      createdBy: a.string().required(), // Cognito userSub
      isActive: a.boolean(),

      createdAt: a.datetime(),
      updatedAt: a.datetime(),

      // Relationships
      tenant: a.belongsTo('Tenant', 'tenantId'),
      memberships: a.hasMany('Membership', 'workspaceId'),
      invitations: a.hasMany('Invitation', 'workspaceId'),
      taskBoards: a.hasMany('TaskBoard', 'workspaceId'),
      tasks: a.hasMany('Task', 'workspaceId'),
    })
    .secondaryIndexes((index) => [
      index('tenantId')
        .sortKeys(['createdAt'])
        .queryField('listOrganizationsByTenant'),
      index('tenantId')
        .sortKeys(['name'])
        .queryField('listOrganizationsByTenantAndName'),
    ])
    .authorization((allow) => [
      // Platform super admins - full access
      allow.group('PLATFORM_SUPER_ADMIN'),

      // All authenticated users (tenant scoping handled in application layer)
      allow.authenticated(),
    ]),

  // ============================================================================
  // MEMBERSHIP - User-to-Organization relationship
  // Enables multi-tenant user access (users can belong to multiple tenants)
  // ============================================================================

  Membership: a
    .model({
      id: a.id().required(),
      userId: a.string().required(), // Cognito userSub
      tenantId: a.id().required(),
      workspaceId: a.id().required(),
      userSub: a.string().required(), // Redundant but simplifies queries

      role: a.ref('MembershipRole').required(),
      status: a.ref('MembershipStatus'),

      invitedBy: a.string(), // userSub of who invited them
      joinedAt: a.datetime(),

      // Relationships
      tenant: a.belongsTo('Tenant', 'tenantId'),
      organization: a.belongsTo('Organization', 'workspaceId'),
    })
    .secondaryIndexes((index) => [
      index('userId').queryField('listMembershipsByUser'),
      index('tenantId')
        .sortKeys(['userId'])
        .queryField('listMembershipsByTenant'),
      index('workspaceId')
        .sortKeys(['userId'])
        .queryField('listMembershipsByOrganization'),
      index('tenantId')
        .sortKeys(['role'])
        .queryField('listMembershipsByTenantAndRole'),
    ])
    .authorization((allow) => [
      // Platform super admins - full access
      allow.group('PLATFORM_SUPER_ADMIN'),

      // All authenticated users (tenant scoping handled in application layer)
      allow.authenticated(),
    ]),

  // ============================================================================
  // INVITATION - Pending user invitations
  // ============================================================================

  Invitation: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      workspaceId: a.id(),

      email: a.email().required(), // Encrypted at application level
      role: a.ref('MembershipRole').required(),

      invitedBy: a.string().required(), // userSub
      token: a.string().required(), // Unique hashed token

      status: a.ref('InvitationStatus'),

      createdAt: a.datetime().required(),
      expiresAt: a.datetime().required(),
      sentAt: a.datetime(),
      acceptedAt: a.datetime(),

      // Relationships
      tenant: a.belongsTo('Tenant', 'tenantId'),
      organization: a.belongsTo('Organization', 'workspaceId'),
    })
    .secondaryIndexes((index) => [
      index('email').queryField('listInvitationsByEmail'),
      index('tenantId')
        .sortKeys(['status'])
        .queryField('listInvitationsByTenantAndStatus'),
      index('workspaceId')
        .sortKeys(['sentAt'])
        .queryField('listInvitationsByOrganization'),
      index('token').queryField('getInvitationByToken'),
    ])
    .authorization((allow) => [
      // Platform super admins - full access
      allow.group('PLATFORM_SUPER_ADMIN'),

      // All authenticated users (tenant scoping in application layer)
      allow.authenticated(),

      // Public API key access for invitation acceptance
      allow.publicApiKey().to(['read']),
    ]),

  // ============================================================================
  // TASKBOARD - Task boards within organizations
  // ============================================================================

  TaskBoard: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      workspaceId: a.id().required(),

      name: a.string().required(),
      description: a.string(),
      settings: a.json(), // { columns, labels, priorities, etc. }
      ownerUserSub: a.string(),

      createdBy: a.string().required(), // userSub
      isActive: a.boolean(),

      createdAt: a.datetime(),
      updatedAt: a.datetime(),

      // Relationships
      tenant: a.belongsTo('Tenant', 'tenantId'),
      organization: a.belongsTo('Organization', 'workspaceId'),
      tasks: a.hasMany('Task', 'taskBoardId'),
    })
    .secondaryIndexes((index) => [
      index('tenantId')
        .sortKeys(['createdAt'])
        .queryField('listTaskBoardsByTenant'),
      index('workspaceId')
        .sortKeys(['createdAt'])
        .queryField('listTaskBoardsByOrganization'),
      index('tenantId')
        .sortKeys(['name'])
        .queryField('listTaskBoardsByTenantAndName'),
    ])
    .authorization((allow) => [
      // Platform super admins - full access
      allow.group('PLATFORM_SUPER_ADMIN'),

      // All authenticated users (tenant scoping in application layer)
      allow.authenticated(),
    ]),

  // ============================================================================
  // TASK - Individual tasks/work items
  // ============================================================================

  Task: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      workspaceId: a.id().required(),
      taskBoardId: a.id().required(),

      title: a.string().required(),
      description: a.string(), // Encrypted if contains PHI (HIPAA)

      status: a.ref('TaskStatus'),
      priority: a.ref('TaskPriority'),

      assignedTo: a.string(), // userSub
      createdBy: a.string().required(), // userSub

      dueDate: a.datetime(),
      completedAt: a.datetime(),

      tags: a.string().array(),
      attachments: a.json(), // File references, URLs, etc.

      createdAt: a.datetime(),
      updatedAt: a.datetime(),

      // Relationships
      tenant: a.belongsTo('Tenant', 'tenantId'),
      organization: a.belongsTo('Organization', 'workspaceId'),
      taskBoard: a.belongsTo('TaskBoard', 'taskBoardId'),
    })
    .secondaryIndexes((index) => [
      index('tenantId')
        .sortKeys(['createdAt'])
        .queryField('listTasksByTenant'),
      index('assignedTo')
        .sortKeys(['dueDate'])
        .queryField('listTasksByAssigneeAndDueDate'),
      index('taskBoardId')
        .sortKeys(['status'])
        .queryField('listTasksByBoardAndStatus'),
      index('workspaceId')
        .sortKeys(['createdAt'])
        .queryField('listTasksByOrganization'),
      index('tenantId')
        .sortKeys(['status'])
        .queryField('listTasksByTenantAndStatus'),
      index('assignedTo')
        .sortKeys(['status'])
        .queryField('listTasksByAssigneeAndStatus'),
    ])
    .authorization((allow) => [
      // Platform super admins - full access
      allow.group('PLATFORM_SUPER_ADMIN'),

      // All authenticated users (tenant scoping in application layer)
      allow.authenticated(),
    ]),

  // ============================================================================
  // NOTIFICATION - In-app notifications for task events
  // ============================================================================

  Notification: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      workspaceId: a.id(),

      recipientId: a.string().required(), // userSub of notification recipient
      senderId: a.string().required(), // userSub of who triggered the notification

      type: a.ref('NotificationType').required(),
      title: a.string().required(),
      message: a.string(),

      resourceType: a.string(), // e.g. "Task"
      resourceId: a.string(), // ID of the related resource

      isRead: a.boolean(),
      metadata: a.json(), // Additional context (note, etc.)

      createdAt: a.datetime(),

      // Relationships
      tenant: a.belongsTo('Tenant', 'tenantId'),
    })
    .secondaryIndexes((index) => [
      index('recipientId')
        .sortKeys(['createdAt'])
        .queryField('listNotificationsByRecipient'),
      index('tenantId')
        .sortKeys(['createdAt'])
        .queryField('listNotificationsByTenant'),
    ])
    .authorization((allow) => [
      allow.group('PLATFORM_SUPER_ADMIN'),
      allow.authenticated(),
    ]),

  // ============================================================================
  // AUDITLOG - Comprehensive audit trail for GDPR/HIPAA compliance
  // ============================================================================

  AuditLog: a
    .model({
      id: a.id().required(),
      tenantId: a.id(),
      workspaceId: a.id(),

      userId: a.string().required(), // userSub
      action: a.ref('AuditAction').required(),

      resourceType: a.string().required(), // Task, Organization, User, etc.
      resourceId: a.string(),

      beforeState: a.json(), // Encrypted
      afterState: a.json(), // Encrypted

      ipAddress: a.string(), // Hashed for privacy
      userAgent: a.string(),

      timestamp: a.datetime().required(),
      ttl: a.integer(), // Unix timestamp for DynamoDB TTL (30 days)

      result: a.ref('AuditResult').required(),
      metadata: a.json(), // Additional context

      // Relationships
      tenant: a.belongsTo('Tenant', 'tenantId'),
    })
    .secondaryIndexes((index) => [
      index('tenantId')
        .sortKeys(['timestamp'])
        .queryField('listAuditLogsByTenant'),
      index('userId')
        .sortKeys(['timestamp'])
        .queryField('listAuditLogsByUser'),
      index('tenantId')
        .sortKeys(['action'])
        .queryField('listAuditLogsByTenantAndAction'),
      index('resourceType')
        .sortKeys(['timestamp'])
        .queryField('listAuditLogsByResourceType'),
    ])
    .authorization((allow) => [
      // Platform super admins - full read access
      allow.group('PLATFORM_SUPER_ADMIN'),

      // All authenticated users can create and read audit logs
      allow.authenticated().to(['create', 'read']),
    ]),

  // ============================================================================
  // USERPROFILE - GDPR-compliant user profile data
  // ============================================================================

  UserProfile: a
    .model({
      userId: a.id().required(),   // primary key
      tenantId: a.id().required(),
      role: a.enum(["TENANT_ADMIN", "MEMBER", "OWNER"]),

      // PII - encrypted at application level
      email: a.email().required(),
      firstName: a.string(),
      lastName: a.string(),
      phoneNumber: a.phone(),

      avatarUrl: a.url(),
      preferences: a.json(), // Notification settings, theme, language, etc.

      // GDPR consent tracking
      consentGiven: a.boolean(),
      consentDate: a.datetime(),
      dataProcessingAgreement: a.boolean(),

      // Activity tracking
      lastLoginAt: a.datetime(),

      // GDPR request tracking
      gdprExportRequestedAt: a.datetime(),
      deletionRequestedAt: a.datetime(), // 30-day grace period

      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .identifier(['userId'])
    .authorization((allow) => [
      // Platform super admins - full access
      allow.group('PLATFORM_SUPER_ADMIN'),

      // All authenticated users (user can only access their own profile via app logic)
      allow.authenticated(),
    ]),

  // Mutations
  createTenantAdmin: a
    .mutation()
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
    .authorization((allow) => [allow.group("PLATFORM_SUPER_ADMIN")])
    .handler(a.handler.function(createTenantAdminFn)),

  inviteMemberToOrg: a
    .mutation()
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
    .authorization((allow) => [allow.group("TENANT_ADMIN"), allow.group("MEMBER")])
    .handler(a.handler.function(inviteMemberToOrgFn)),

  removeTenantAndData: a
    .mutation()
    .arguments({
      tenantId: a.string().required(),
    })
    .returns(a.customType({
      success: a.boolean(),
      message: a.string(),
    }))
    .authorization((allow) => [allow.group("PLATFORM_SUPER_ADMIN")])
    .handler(a.handler.function(deleteTenantFn)),

  sendAssignmentEmail: a
    .mutation()
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
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(sendAssignmentEmail)),


}).authorization((allow) => [
  allow.resource(createTenantAdminFn),
  allow.resource(deleteTenantFn),
  allow.resource(inviteMemberToOrgFn),
  allow.resource(sendAssignmentEmail)
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    // API key for public invitation acceptance
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

