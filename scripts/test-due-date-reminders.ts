/**
 * Test script for the sendDueDateReminders Lambda.
 *
 * Seeds a test tenant ("Acme Corp") with 4 users and tasks at various due-date
 * offsets to verify the reminder Lambda sends correct notifications & emails.
 *
 * Test matrix (10 tasks):
 *   - Overdue by 3 days   → TASK_OVERDUE  (owner)
 *   - Overdue by 1 day    → TASK_OVERDUE  (member1)
 *   - Due today            → TASK_OVERDUE  (member2)
 *   - Due tomorrow (+1)    → TASK_DUE_REMINDER "due tomorrow" (owner)
 *   - Due in 2 days        → TASK_DUE_REMINDER "due in 2 days" (member1)
 *   - Due in 3 days        → TASK_DUE_REMINDER "due in 3 days" (member2)
 *   - Due in 5 days        → SKIPPED (out of window)
 *   - DONE + due tomorrow  → SKIPPED (completed task)
 *   - No dueDate           → SKIPPED
 *   - No assignedTo        → SKIPPED
 *
 * Emails (SES-verified):
 *   admin:   iparv8+admin_acme@gmail.com   (TENANT_ADMIN — not assigned tasks)
 *   owner:   iparv8+owner_acme@gmail.com
 *   member1: iparv8+member1_acme@gmail.com
 *   member2: iparv8+member2_acme@gmail.com
 *
 * Usage:
 *   npx tsx scripts/test-due-date-reminders.ts              # seed test data
 *   npx tsx scripts/test-due-date-reminders.ts --invoke      # seed + invoke Lambda
 *   npx tsx scripts/test-due-date-reminders.ts --cleanup     # remove test data
 *
 * Prerequisites:
 *   - AWS credentials configured (profile or env vars)
 *   - amplify_outputs.json present in project root
 */

import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    AdminAddUserToGroupCommand,
    AdminGetUserCommand,
    AdminDeleteUserCommand,
    ListUsersCommand,
    MessageActionType,
} from "@aws-sdk/client-cognito-identity-provider";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
    AppSyncClient,
    ListGraphqlApisCommand,
} from "@aws-sdk/client-appsync";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REGION = "us-east-1";

const outputsPath = join(__dirname, "..", "amplify_outputs.json");
const outputs = JSON.parse(readFileSync(outputsPath, "utf-8"));
const USER_POOL_ID = outputs.auth?.user_pool_id;

if (!USER_POOL_ID) {
    console.error("Could not find user_pool_id in amplify_outputs.json");
    process.exit(1);
}

const APPSYNC_URL: string = outputs.data?.url || "";

async function resolveTableSuffix(): Promise<string> {
    if (process.env.DEMO_TABLE_SUFFIX) return process.env.DEMO_TABLE_SUFFIX;

    if (!APPSYNC_URL) {
        console.error("No AppSync URL found in amplify_outputs.json");
        process.exit(1);
    }

    const appsync = new AppSyncClient({ region: REGION });
    let nextToken: string | undefined;
    do {
        const res = await appsync.send(
            new ListGraphqlApisCommand({ nextToken, maxResults: 25 })
        );
        for (const api of res.graphqlApis || []) {
            const urls = Object.values(api.uris || {});
            if (urls.some((u) => u === APPSYNC_URL)) {
                console.log(`  Resolved API ID: ${api.apiId}`);
                return `${api.apiId}-NONE`;
            }
        }
        nextToken = res.nextToken;
    } while (nextToken);

    console.error("Could not find AppSync API matching URL:", APPSYNC_URL);
    process.exit(1);
}

let TABLE_SUFFIX = "";

function tableName(model: string): string {
    return `${model}-${TABLE_SUFFIX}`;
}

// ---------------------------------------------------------------------------
// AWS clients
// ---------------------------------------------------------------------------

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const ddbClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: REGION }),
    { marshallOptions: { removeUndefinedValues: true } }
);
const lambdaClient = new LambdaClient({ region: REGION });

// ---------------------------------------------------------------------------
// Test data — deterministic IDs (all prefixed "duetest-")
// ---------------------------------------------------------------------------

const DEMO_PASSWORD = "DemoPass123!";

const DEMO_USERS = [
    {
        email: "iparv8+admin_acme@gmail.com",
        firstName: "Admin",
        lastName: "Acme",
        role: "TENANT_ADMIN",
        cognitoGroup: "TENANT_ADMIN" as string | undefined,
        sub: "",
    },
    {
        email: "iparv8+owner_acme@gmail.com",
        firstName: "Owner",
        lastName: "Acme",
        role: "OWNER",
        cognitoGroup: undefined as string | undefined,
        sub: "",
    },
    {
        email: "iparv8+member1_acme@gmail.com",
        firstName: "MemberOne",
        lastName: "Acme",
        role: "MEMBER",
        cognitoGroup: undefined as string | undefined,
        sub: "",
    },
    {
        email: "iparv8+member2_acme@gmail.com",
        firstName: "MemberTwo",
        lastName: "Acme",
        role: "MEMBER",
        cognitoGroup: undefined as string | undefined,
        sub: "",
    },
];

const TENANT_ID = "duetest-tenant-001";
const ORG_ID = "duetest-org-001";
const WS_ID = "duetest-ws-001";
const BOARD_ID = "duetest-board-001";

// ---------------------------------------------------------------------------
// Cognito helpers
// ---------------------------------------------------------------------------

async function ensureCognitoUser(
    email: string,
    group?: string
): Promise<string> {
    let sub = "";

    try {
        const existing = await cognitoClient.send(
            new AdminGetUserCommand({
                UserPoolId: USER_POOL_ID,
                Username: email,
            })
        );
        sub =
            existing.UserAttributes?.find((a) => a.Name === "sub")?.Value || "";
        console.log(`  ✓ User ${email} already exists (sub: ${sub})`);
    } catch (err: any) {
        if (err.name === "UserNotFoundException") {
            const res = await cognitoClient.send(
                new AdminCreateUserCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: email,
                    UserAttributes: [
                        { Name: "email", Value: email },
                        { Name: "email_verified", Value: "true" },
                    ],
                    MessageAction: MessageActionType.SUPPRESS,
                    TemporaryPassword: DEMO_PASSWORD,
                })
            );
            sub =
                res.User?.Attributes?.find((a) => a.Name === "sub")?.Value ||
                "";
            console.log(`  + Created user ${email} (sub: ${sub})`);
        } else {
            throw err;
        }
    }

    await cognitoClient.send(
        new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            Password: DEMO_PASSWORD,
            Permanent: true,
        })
    );

    if (group) {
        try {
            await cognitoClient.send(
                new AdminAddUserToGroupCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: email,
                    GroupName: group,
                })
            );
            console.log(`  + Added ${email} to group ${group}`);
        } catch (err: any) {
            if (err.name !== "ResourceNotFoundException") throw err;
            console.warn(`  ! Group ${group} does not exist — skipping`);
        }
    }

    return sub;
}

async function deleteCognitoUser(email: string): Promise<void> {
    try {
        await cognitoClient.send(
            new AdminDeleteUserCommand({
                UserPoolId: USER_POOL_ID,
                Username: email,
            })
        );
        console.log(`  - Deleted user ${email}`);
    } catch (err: any) {
        if (err.name === "UserNotFoundException") {
            console.log(`  - User ${email} not found (already deleted)`);
        } else {
            throw err;
        }
    }
}

// ---------------------------------------------------------------------------
// DynamoDB helpers
// ---------------------------------------------------------------------------

async function putItem(model: string, item: Record<string, any>) {
    await ddbClient.send(
        new PutCommand({
            TableName: tableName(model),
            Item: {
                ...item,
                __typename: model,
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: item.updatedAt || new Date().toISOString(),
            },
        })
    );
}

async function deleteItem(model: string, key: Record<string, any>) {
    try {
        await ddbClient.send(
            new DeleteCommand({
                TableName: tableName(model),
                Key: key,
            })
        );
    } catch {
        // ignore
    }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
    console.log("\n🧪 Seeding due-date-reminders test data...\n");
    console.log(`User Pool: ${USER_POOL_ID}`);
    console.log("Resolving DynamoDB table names...");
    TABLE_SUFFIX = await resolveTableSuffix();
    console.log(`Table suffix: ${TABLE_SUFFIX}\n`);

    // 1. Create Cognito users
    console.log("Creating Cognito users...");
    for (const user of DEMO_USERS) {
        user.sub = await ensureCognitoUser(user.email, user.cognitoGroup);
    }

    const adminSub = DEMO_USERS[0].sub;
    const ownerSub = DEMO_USERS[1].sub;
    const member1Sub = DEMO_USERS[2].sub;
    const member2Sub = DEMO_USERS[3].sub;

    // 2. Tenant
    console.log("\nCreating Tenant...");
    await putItem("Tenant", {
        id: TENANT_ID,
        companyName: "Acme Corp (Due Date Test)",
        status: "ACTIVE",
        isActive: true,
        plan: "PROFESSIONAL",
        subscriptionStatus: "active",
    });

    // 3. Organization
    console.log("Creating Organization...");
    await putItem("Organization", {
        id: ORG_ID,
        tenantId: TENANT_ID,
        name: "Acme Org",
        description: "Test org for due date reminders",
        createdBy: adminSub,
        isActive: true,
    });

    // 4. Workspace
    console.log("Creating Workspace...");
    await putItem("Workspace", {
        id: WS_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        name: "Test Workspace",
        description: "Workspace for due date reminder testing",
        ownerUserSub: ownerSub,
        isActive: true,
    });

    // 5. Task Board
    console.log("Creating Task Board...");
    await putItem("TaskBoard", {
        id: BOARD_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        workspaceId: WS_ID,
        name: "Due Date Test Board",
        description: "Board for testing due date reminders",
        ownerUserSub: ownerSub,
        isActive: true,
    });

    // 6. User Profiles (so Lambda can look up emails)
    console.log("Creating User Profiles...");
    for (const user of DEMO_USERS) {
        await putItem("UserProfile", {
            userId: user.sub,
            tenantId: TENANT_ID,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            hasSeenWelcome: true,
        });
        console.log(`  + Profile: ${user.firstName} ${user.lastName} (${user.email})`);
    }

    // 7. Memberships
    console.log("\nCreating Memberships...");
    const memberships = [
        { id: "duetest-mem-001", sub: adminSub, role: "TENANT_ADMIN" },
        { id: "duetest-mem-002", sub: ownerSub, role: "OWNER" },
        { id: "duetest-mem-003", sub: member1Sub, role: "MEMBER" },
        { id: "duetest-mem-004", sub: member2Sub, role: "MEMBER" },
    ];
    for (const m of memberships) {
        await putItem("Membership", {
            id: m.id,
            tenantId: TENANT_ID,
            organizationId: ORG_ID,
            userSub: m.sub,
            role: m.role,
            status: "ACTIVE",
            joinedAt: new Date().toISOString(),
        });
        console.log(`  + Membership: ${m.role} (${m.id})`);
    }

    // 8. Tasks with various due-date offsets
    console.log("\nCreating Tasks...");
    const now = new Date();
    const inDays = (d: number) =>
        new Date(now.getTime() + d * 86400000).toISOString();

    const tasks = [
        // === Should trigger reminders (6 tasks) ===
        {
            id: "duetest-task-001",
            title: "Overdue by 3 days (owner)",
            status: "IN_PROGRESS",
            priority: "URGENT",
            assignedTo: ownerSub,
            dueDate: inDays(-3),
            expected: "TASK_OVERDUE → iparv8+owner_acme@gmail.com",
        },
        {
            id: "duetest-task-002",
            title: "Overdue by 1 day (member1)",
            status: "TODO",
            priority: "HIGH",
            assignedTo: member1Sub,
            dueDate: inDays(-1),
            expected: "TASK_OVERDUE → iparv8+member1_acme@gmail.com",
        },
        {
            id: "duetest-task-003",
            title: "Due today (member2)",
            status: "IN_PROGRESS",
            priority: "HIGH",
            assignedTo: member2Sub,
            dueDate: inDays(0),
            expected: "TASK_OVERDUE → iparv8+member2_acme@gmail.com",
        },
        {
            id: "duetest-task-004",
            title: "Due tomorrow (owner)",
            status: "TODO",
            priority: "HIGH",
            assignedTo: ownerSub,
            dueDate: inDays(1),
            expected: "TASK_DUE_REMINDER 'due tomorrow' → iparv8+owner_acme@gmail.com",
        },
        {
            id: "duetest-task-005",
            title: "Due in 2 days (member1)",
            status: "IN_PROGRESS",
            priority: "MEDIUM",
            assignedTo: member1Sub,
            dueDate: inDays(2),
            expected: "TASK_DUE_REMINDER 'due in 2 days' → iparv8+member1_acme@gmail.com",
        },
        {
            id: "duetest-task-006",
            title: "Due in 3 days (member2)",
            status: "TODO",
            priority: "LOW",
            assignedTo: member2Sub,
            dueDate: inDays(3),
            expected: "TASK_DUE_REMINDER 'due in 3 days' → iparv8+member2_acme@gmail.com",
        },

        // === Should be SKIPPED (4 tasks) ===
        {
            id: "duetest-task-007",
            title: "Due in 5 days — outside window (owner)",
            status: "TODO",
            priority: "LOW",
            assignedTo: ownerSub,
            dueDate: inDays(5),
            expected: "SKIPPED (outside 3-day window)",
        },
        {
            id: "duetest-task-008",
            title: "DONE task due tomorrow (member1)",
            status: "DONE",
            priority: "HIGH",
            assignedTo: member1Sub,
            dueDate: inDays(1),
            expected: "SKIPPED (status=DONE)",
        },
        {
            id: "duetest-task-009",
            title: "No due date (member2)",
            status: "TODO",
            priority: "MEDIUM",
            assignedTo: member2Sub,
            dueDate: undefined,
            expected: "SKIPPED (no dueDate)",
        },
        {
            id: "duetest-task-010",
            title: "No assignee — due tomorrow",
            status: "TODO",
            priority: "HIGH",
            assignedTo: undefined,
            dueDate: inDays(1),
            expected: "SKIPPED (no assignedTo)",
        },
    ];

    for (const t of tasks) {
        await putItem("Task", {
            id: t.id,
            tenantId: TENANT_ID,
            organizationId: ORG_ID,
            workspaceId: WS_ID,
            taskBoardId: BOARD_ID,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignedTo: t.assignedTo,
            ownerUserSub: t.assignedTo || adminSub,
            createdBy: adminSub,
            dueDate: t.dueDate,
            isActive: true,
            completedAt: t.status === "DONE" ? new Date().toISOString() : undefined,
        });
        console.log(`  + Task: "${t.title}"`);
        console.log(`         Expected: ${t.expected}`);
    }

    console.log("\n✅ Test data seeded successfully!");
    console.log("\nExpected results when Lambda runs:");
    console.log("  6 notifications created (tasks 001-006)");
    console.log("  6 emails sent:");
    console.log("    - 2 emails to iparv8+owner_acme@gmail.com  (overdue + due tomorrow)");
    console.log("    - 2 emails to iparv8+member1_acme@gmail.com (overdue + due in 2 days)");
    console.log("    - 2 emails to iparv8+member2_acme@gmail.com (overdue/today + due in 3 days)");
    console.log("  4 tasks skipped (007-010)");
}

// ---------------------------------------------------------------------------
// Invoke Lambda
// ---------------------------------------------------------------------------

async function invokeLambda() {
    console.log("\n🚀 Invoking sendDueDateReminders Lambda...\n");

    // Discover the function name from amplify_outputs or by convention
    // Amplify Gen 2 names functions: amplify-<appId>-<branch>-<fnName>
    // We search for the function containing "sendDueDateReminders"
    const functionName = await discoverFunctionName("sendDueDateReminders");

    console.log(`Function name: ${functionName}`);
    console.log("Invoking...\n");

    const res = await lambdaClient.send(
        new InvokeCommand({
            FunctionName: functionName,
            InvocationType: "RequestResponse",
            Payload: Buffer.from(JSON.stringify({ source: "test-script" })),
        })
    );

    const payload = res.Payload
        ? JSON.parse(Buffer.from(res.Payload).toString())
        : null;

    console.log(`Status code: ${res.StatusCode}`);
    if (res.FunctionError) {
        console.error(`Function error: ${res.FunctionError}`);
    }
    console.log("Response:", JSON.stringify(payload, null, 2));

    if (res.LogResult) {
        console.log("\nLogs (last 4KB):");
        console.log(Buffer.from(res.LogResult, "base64").toString());
    }
}

async function discoverFunctionName(namePart: string): Promise<string> {
    // Try reading from amplify_outputs.json custom section or fall back to listing
    const { LambdaClient: LC, ListFunctionsCommand } = await import(
        "@aws-sdk/client-lambda"
    );

    const client = new LC({ region: REGION });
    let marker: string | undefined;
    do {
        const res = await client.send(
            new ListFunctionsCommand({ Marker: marker, MaxItems: 50 })
        );
        for (const fn of res.Functions || []) {
            if (fn.FunctionName?.includes(namePart)) {
                return fn.FunctionName;
            }
        }
        marker = res.NextMarker;
    } while (marker);

    throw new Error(
        `Could not find Lambda function containing "${namePart}". ` +
        `Make sure the function is deployed. You can also set LAMBDA_FUNCTION_NAME env var.`
    );
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanup() {
    console.log("\n🧹 Cleaning up due-date-reminders test data...\n");
    console.log("Resolving DynamoDB table names...");
    TABLE_SUFFIX = await resolveTableSuffix();

    // Delete Cognito users
    console.log("Deleting Cognito users...");
    for (const user of DEMO_USERS) {
        await deleteCognitoUser(user.email);
    }

    // Delete DynamoDB records
    console.log("\nDeleting DynamoDB records...");

    const deletions: Array<[string, Record<string, any>]> = [
        ["Tenant", { id: TENANT_ID }],
        ["Organization", { id: ORG_ID }],
        ["Workspace", { id: WS_ID }],
        ["TaskBoard", { id: BOARD_ID }],
        ...Array.from({ length: 10 }, (_, i) => [
            "Task",
            { id: `duetest-task-${String(i + 1).padStart(3, "0")}` },
        ] as [string, Record<string, any>]),
        ...Array.from({ length: 4 }, (_, i) => [
            "Membership",
            { id: `duetest-mem-${String(i + 1).padStart(3, "0")}` },
        ] as [string, Record<string, any>]),
    ];

    for (const [model, key] of deletions) {
        await deleteItem(model, key);
        console.log(`  - ${model}: ${JSON.stringify(key)}`);
    }

    // UserProfile uses userId as partition key
    console.log("\nCleaning up UserProfiles...");
    for (const user of DEMO_USERS) {
        try {
            const res = await cognitoClient.send(
                new ListUsersCommand({
                    UserPoolId: USER_POOL_ID,
                    Filter: `email = "${user.email}"`,
                    Limit: 1,
                })
            );
            const sub = res.Users?.[0]?.Attributes?.find(
                (a) => a.Name === "sub"
            )?.Value;
            if (sub) {
                await deleteItem("UserProfile", { userId: sub });
                console.log(`  - UserProfile: ${user.email} (${sub})`);
            }
        } catch {
            console.log(
                `  - UserProfile: could not look up ${user.email} (user may already be deleted)`
            );
        }
    }

    // Clean up any notifications created by the Lambda
    console.log("\nNote: Any Notification records created by the Lambda must be cleaned up manually or via the app.");

    console.log("\n✅ Due date reminders test cleanup complete!\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isCleanup = args.includes("--cleanup");
const shouldInvoke = args.includes("--invoke");

async function main() {
    if (isCleanup) {
        await cleanup();
    } else {
        await seed();
        if (shouldInvoke) {
            await invokeLambda();
        } else {
            console.log("\nTo invoke the Lambda now, re-run with --invoke:");
            console.log("  npx tsx scripts/test-due-date-reminders.ts --invoke");
            console.log("\nOr invoke manually via AWS Console / CLI:");
            console.log('  aws lambda invoke --function-name <fn-name> --payload \'{"source":"test"}\' /dev/stdout');
        }
    }
}

main().catch((err) => {
    console.error("\n❌ Error:", err.message || err);
    process.exit(1);
});
