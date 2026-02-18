import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { createTenantAdminFn } from './functions/create-tenant-admin/resource';
import { deleteTenantFn } from './functions/delete-tenant/resource';
import { inviteMemberToOrgFn } from './functions/invite-member-to-org/resource';
import { sendAssignmentEmail } from './functions/sendAssignmentEmail/resource';
import { replaceTenantAdminFn } from './functions/replace-tenant-admin/resource';
import { submitContactRequestFn } from './functions/submit-contact-request/resource';
import { data } from './data/resource';


const backend = defineBackend({
  auth,
  data,
  createTenantAdminFn,
  deleteTenantFn,
  inviteMemberToOrgFn,
  sendAssignmentEmail,
  replaceTenantAdminFn,
  submitContactRequestFn,
});

// Configure createTenantAdmin function
backend.createTenantAdminFn.addEnvironment(
  "USER_POOL_ID",
  backend.auth.resources.userPool.userPoolId
);

backend.auth.resources.userPool.grant(
  backend.createTenantAdminFn.resources.lambda,
  "cognito-idp:AdminCreateUser",
  "cognito-idp:AdminAddUserToGroup",
  "cognito-idp:AdminUpdateUserAttributes",
  "cognito-idp:AdminGetUser"
);

// Configure deleteTenant function
backend.deleteTenantFn.addEnvironment(
  "USER_POOL_ID",
  backend.auth.resources.userPool.userPoolId
);

backend.auth.resources.userPool.grant(
  backend.deleteTenantFn.resources.lambda,
  "cognito-idp:AdminDeleteUser",
  "cognito-idp:AdminGetUser"
);

// Configure inviteMemberToOrg function
backend.inviteMemberToOrgFn.addEnvironment(
  "USER_POOL_ID",
  backend.auth.resources.userPool.userPoolId
);

backend.auth.resources.userPool.grant(
  backend.inviteMemberToOrgFn.resources.lambda,
  "cognito-idp:AdminCreateUser",
  "cognito-idp:AdminAddUserToGroup",
  "cognito-idp:AdminGetUser"
);

// Configure replaceTenantAdmin function
backend.replaceTenantAdminFn.addEnvironment(
  "USER_POOL_ID",
  backend.auth.resources.userPool.userPoolId
);

backend.auth.resources.userPool.grant(
  backend.replaceTenantAdminFn.resources.lambda,
  "cognito-idp:AdminGetUser",
  "cognito-idp:AdminCreateUser",
  "cognito-idp:AdminAddUserToGroup",
  "cognito-idp:AdminDisableUser",
  "cognito-idp:AdminRemoveUserFromGroup"
);

// Configure submitContactRequest function
backend.submitContactRequestFn.addEnvironment(
  "USER_POOL_ID",
  backend.auth.resources.userPool.userPoolId
);

backend.auth.resources.userPool.grant(
  backend.submitContactRequestFn.resources.lambda,
  "cognito-idp:ListUsersInGroup"
);

// Configure sendAssignmentEmail function — SES permissions
backend.sendAssignmentEmail.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: ["*"],
  })
);
