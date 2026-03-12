import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { auth } from './auth/resource';
import { createTenantAdminFn } from './functions/create-tenant-admin/resource';
import { deleteTenantFn } from './functions/delete-tenant/resource';
import { inviteMemberToOrgFn } from './functions/invite-member-to-org/resource';
import { sendAssignmentEmail } from './functions/sendAssignmentEmail/resource';
import { replaceTenantAdminFn } from './functions/replace-tenant-admin/resource';
import { submitContactRequestFn } from './functions/submit-contact-request/resource';
import { deleteOrganizationFn } from './functions/delete-organization/resource';
import { getPlatformAnalyticsFn } from './functions/get-platform-analytics/resource';
import { createPilotFn } from './functions/create-pilot/resource';
import { sendDueDateRemindersFn } from './functions/send-due-date-reminders/resource';
import { storage } from './storage/resource';
import { data } from './data/resource';


const backend = defineBackend({
  auth,
  data,
  storage,
  createTenantAdminFn,
  deleteTenantFn,
  inviteMemberToOrgFn,
  sendAssignmentEmail,
  replaceTenantAdminFn,
  submitContactRequestFn,
  deleteOrganizationFn,
  getPlatformAnalyticsFn,
  createPilotFn,
  sendDueDateRemindersFn,
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

// S3 access for agreement PDF
backend.createTenantAdminFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["s3:PutObject", "s3:GetObject"],
    resources: [`${backend.storage.resources.bucket.bucketArn}/*`],
  })
);

// SES access for welcome email
backend.createTenantAdminFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: ["*"],
  })
);

// S3 bucket name env var
backend.createTenantAdminFn.addEnvironment(
  "PILOT_BUCKET_NAME",
  backend.storage.resources.bucket.bucketName
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
backend.submitContactRequestFn.addEnvironment(
  "CONTACT_REQUEST_TO_EMAIL",
  "parveeneswaran@outlook.com"
);
backend.submitContactRequestFn.addEnvironment(
  "CONTACT_REQUEST_FROM_EMAIL",
  "no-reply@tethertasks.com"
);

backend.auth.resources.userPool.grant(
  backend.submitContactRequestFn.resources.lambda,
  "cognito-idp:ListUsersInGroup"
);

backend.submitContactRequestFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: ["*"],
  })
);

// Configure sendAssignmentEmail function — SES permissions
backend.sendAssignmentEmail.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: ["*"],
  })
);

// Configure GA4 analytics function
backend.getPlatformAnalyticsFn.addEnvironment(
  "GA4_PROPERTY_ID",
  process.env.GA4_PROPERTY_ID ?? ""
);
backend.getPlatformAnalyticsFn.addEnvironment(
  "GA_CLIENT_EMAIL",
  process.env.GA_CLIENT_EMAIL ?? ""
);
backend.getPlatformAnalyticsFn.addEnvironment(
  "GA_PRIVATE_KEY",
  process.env.GA_PRIVATE_KEY ?? ""
);

// Configure createPilot function
backend.createPilotFn.addEnvironment(
  "USER_POOL_ID",
  backend.auth.resources.userPool.userPoolId
);

backend.auth.resources.userPool.grant(
  backend.createPilotFn.resources.lambda,
  "cognito-idp:AdminCreateUser",
  "cognito-idp:AdminAddUserToGroup",
  "cognito-idp:AdminUpdateUserAttributes",
  "cognito-idp:AdminGetUser"
);

backend.createPilotFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: ["*"],
  })
);

backend.createPilotFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["s3:PutObject", "s3:GetObject"],
    resources: [`${backend.storage.resources.bucket.bucketArn}/*`],
  })
);

backend.createPilotFn.addEnvironment(
  "PILOT_BUCKET_NAME",
  backend.storage.resources.bucket.bucketName
);

// SES access for due date reminder emails
backend.sendDueDateRemindersFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: ["*"],
  })
);

// EventBridge schedule: run daily at 8:00 AM UTC
const dueDateRule = new Rule(
  backend.sendDueDateRemindersFn.resources.lambda.stack,
  'DueDateReminderSchedule',
  { schedule: Schedule.cron({ minute: '0', hour: '8' }) }
);
dueDateRule.addTarget(
  new LambdaFunction(backend.sendDueDateRemindersFn.resources.lambda)
);
