import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    'custom:tenantId': {
      dataType: 'String',
      mutable: false,
    },
  },

  /*   Architecture Overview
  Three User Types:
  Super Admin - Your company's admins who can see across ALL tenants - 
  Tenant Admin/Owner - Company admins who manage their tenant
  Member - Regular users within a tenant
  Key Principle: One Cognito User Pool, but data is isolated by tenantId
   */

  groups: ["PLATFORM_SUPER_ADMIN", "TENANT_ADMIN", "MEMBER"],
});