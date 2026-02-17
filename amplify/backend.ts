import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { createTenantAdminFn } from './functions/create-tenant-admin/resource';
import { deleteTenantFn } from './functions/delete-tenant/resource';
import { inviteMemberToOrgFn } from './functions/invite-member-to-org/resource';
import { sendAssignmentEmail } from './functions/sendAssignmentEmail/resource';
import { data } from './data/resource';


const backend = defineBackend({
  auth,
  data,
  createTenantAdminFn,
  deleteTenantFn,
  inviteMemberToOrgFn,
  sendAssignmentEmail,
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

// Configure sendAssignmentEmail function — SES permissions
backend.sendAssignmentEmail.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: ["*"],
  })
);
