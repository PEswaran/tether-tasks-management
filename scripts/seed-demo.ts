/**
 * Seed script for TetherTasks demo environment.
 *
 * Creates 3 Cognito users and ~35 DynamoDB records for a realistic demo tenant.
 * Uses AWS SDK directly (bypasses AppSync auth rules).
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts              # seed demo data
 *   npx tsx scripts/seed-demo.ts --cleanup    # remove demo data
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

// Read amplify_outputs.json to get User Pool ID
const outputsPath = join(__dirname, "..", "amplify_outputs.json");
const outputs = JSON.parse(readFileSync(outputsPath, "utf-8"));
const USER_POOL_ID = outputs.auth?.user_pool_id;

if (!USER_POOL_ID) {
    console.error("Could not find user_pool_id in amplify_outputs.json");
    process.exit(1);
}

const APPSYNC_URL: string = outputs.data?.url || "";

// Discover the DynamoDB table suffix by matching the AppSync URL to an API ID.
// Amplify Gen 2 tables are named: {ModelName}-{apiId}-NONE
async function resolveTableSuffix(): Promise<string> {
    // Allow env override
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

// ---------------------------------------------------------------------------
// Demo data — deterministic IDs
// ---------------------------------------------------------------------------

const DEMO_PASSWORD = "DemoPass123!";

const DEMO_USERS = [
    {
        email: "demo@tethertasks.com",
        firstName: "Alex",
        lastName: "Demo",
        role: "TENANT_ADMIN",
        cognitoGroup: "TENANT_ADMIN",
        sub: "", // filled at runtime
    },
    {
        email: "owner.demo@tethertasks.com",
        firstName: "Jordan",
        lastName: "Owner",
        role: "OWNER",
        cognitoGroup: undefined,
        sub: "",
    },
    {
        email: "member.demo@tethertasks.com",
        firstName: "Sam",
        lastName: "Member",
        role: "MEMBER",
        cognitoGroup: undefined,
        sub: "",
    },
];

const TENANT_ID = "demo-tenant-001";
const ORG_IDS = ["demo-org-001", "demo-org-002"];
const WS_IDS = ["demo-ws-001", "demo-ws-002", "demo-ws-003"];
const BOARD_IDS = [
    "demo-board-001",
    "demo-board-002",
    "demo-board-003",
    "demo-board-004",
    "demo-board-005",
];

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

    // Set permanent password
    await cognitoClient.send(
        new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            Password: DEMO_PASSWORD,
            Permanent: true,
        })
    );

    // Add to group if specified
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
            console.warn(
                `  ! Group ${group} does not exist — skipping`
            );
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
    console.log("\n🌱 Seeding demo environment...\n");
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
    const memberSub = DEMO_USERS[2].sub;

    // 2. Tenant
    console.log("\nCreating Tenant...");
    await putItem("Tenant", {
        id: TENANT_ID,
        companyName: "Acme Holdings (Demo)",
        status: "ACTIVE",
        isActive: true,
        plan: "PROFESSIONAL",
        subscriptionStatus: "active",
    });
    console.log(`  + Tenant: Acme Holdings (Demo)`);

    // 3. Organizations
    console.log("\nCreating Organizations...");
    const orgs = [
        { id: ORG_IDS[0], name: "West Coast Operations", desc: "Marketing, engineering, and product teams for the West Coast division." },
        { id: ORG_IDS[1], name: "East Coast Operations", desc: "Sales, onboarding, and client success for the East Coast division." },
    ];
    for (const org of orgs) {
        await putItem("Organization", {
            id: org.id,
            tenantId: TENANT_ID,
            name: org.name,
            description: org.desc,
            createdBy: adminSub,
            isActive: true,
        });
        console.log(`  + Org: ${org.name}`);
    }

    // 4. Workspaces
    // Org1 workspaces owned by Jordan (OWNER), org2 workspaces owned by Sam (OWNER)
    console.log("\nCreating Workspaces...");
    const workspaces = [
        { id: WS_IDS[0], orgId: ORG_IDS[0], name: "Marketing", desc: "Brand campaigns, social media, and content strategy.", owner: ownerSub },
        { id: WS_IDS[1], orgId: ORG_IDS[0], name: "Engineering", desc: "Product development, sprints, and technical roadmap.", owner: ownerSub },
        { id: WS_IDS[2], orgId: ORG_IDS[1], name: "Sales", desc: "Pipeline management, outreach, and deal tracking.", owner: memberSub },
    ];
    for (const ws of workspaces) {
        await putItem("Workspace", {
            id: ws.id,
            tenantId: TENANT_ID,
            organizationId: ws.orgId,
            name: ws.name,
            description: ws.desc,
            ownerUserSub: ws.owner,
            isActive: true,
        });
        console.log(`  + Workspace: ${ws.name}`);
    }

    // 5. Task Boards
    // Org1 boards owned by Jordan, org2 boards owned by Sam
    console.log("\nCreating Task Boards...");
    const boards = [
        { id: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], name: "Q1 Campaign", desc: "Spring marketing campaign planning and execution.", owner: ownerSub },
        { id: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], name: "Product Roadmap", desc: "Feature planning and delivery timeline.", owner: ownerSub },
        { id: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], name: "Sprint Board", desc: "Current sprint tasks and bug fixes.", owner: ownerSub },
        { id: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], name: "Sales Pipeline", desc: "Lead tracking and deal stages.", owner: memberSub },
        { id: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], name: "Client Onboarding", desc: "New client onboarding checklist and tasks.", owner: memberSub },
    ];
    for (const board of boards) {
        await putItem("TaskBoard", {
            id: board.id,
            tenantId: TENANT_ID,
            organizationId: board.orgId,
            workspaceId: board.wsId,
            name: board.name,
            description: board.desc,
            ownerUserSub: board.owner,
            isActive: true,
        });
        console.log(`  + Board: ${board.name}`);
    }

    // 6. Tasks
    console.log("\nCreating Tasks...");
    const now = new Date();
    const inDays = (d: number) =>
        new Date(now.getTime() + d * 86400000).toISOString();

    const tasks: Array<{
        id: string;
        boardId: string;
        wsId: string;
        orgId: string;
        title: string;
        status: string;
        priority: string;
        assignedTo?: string;
        dueDate?: string;
    }> = [
        // Q1 Campaign board
        { id: "demo-task-001", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Draft social media calendar", status: "DONE", priority: "HIGH", assignedTo: memberSub, dueDate: inDays(-3) },
        { id: "demo-task-002", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Design email newsletter template", status: "IN_PROGRESS", priority: "MEDIUM", assignedTo: memberSub, dueDate: inDays(5) },
        { id: "demo-task-003", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Write blog post: Industry Trends", status: "TODO", priority: "LOW", dueDate: inDays(10) },
        { id: "demo-task-004", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Launch paid ad campaign", status: "TODO", priority: "URGENT", assignedTo: ownerSub, dueDate: inDays(7) },

        // Product Roadmap board
        { id: "demo-task-005", boardId: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Design new dashboard wireframes", status: "DONE", priority: "HIGH", assignedTo: ownerSub, dueDate: inDays(-5) },
        { id: "demo-task-006", boardId: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Implement user onboarding flow", status: "IN_PROGRESS", priority: "HIGH", assignedTo: memberSub, dueDate: inDays(14) },
        { id: "demo-task-007", boardId: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "API rate limiting research", status: "TODO", priority: "MEDIUM", dueDate: inDays(21) },
        { id: "demo-task-008", boardId: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Mobile responsive audit", status: "TODO", priority: "LOW" },

        // Sprint Board
        { id: "demo-task-009", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Fix login redirect on expired session", status: "DONE", priority: "URGENT", assignedTo: ownerSub, dueDate: inDays(-1) },
        { id: "demo-task-010", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Add pagination to member list", status: "IN_PROGRESS", priority: "MEDIUM", assignedTo: memberSub, dueDate: inDays(3) },
        { id: "demo-task-011", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Write unit tests for auth module", status: "TODO", priority: "HIGH", assignedTo: ownerSub, dueDate: inDays(5) },
        { id: "demo-task-012", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Update dependency versions", status: "TODO", priority: "LOW" },

        // Sales Pipeline board  (org2: Sam=OWNER, Jordan=MEMBER)
        { id: "demo-task-013", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Follow up with Acme Corp lead", status: "IN_PROGRESS", priority: "HIGH", assignedTo: ownerSub, dueDate: inDays(2) },
        { id: "demo-task-014", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Prepare Q2 sales forecast", status: "TODO", priority: "MEDIUM", dueDate: inDays(15) },
        { id: "demo-task-015", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Update CRM integration docs", status: "DONE", priority: "LOW", assignedTo: ownerSub, dueDate: inDays(-7) },
        { id: "demo-task-016", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Demo call with GlobalTech", status: "TODO", priority: "URGENT", assignedTo: ownerSub, dueDate: inDays(1) },

        // Client Onboarding board  (org2: Sam=OWNER, Jordan=MEMBER)
        { id: "demo-task-017", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Send welcome packet to new client", status: "DONE", priority: "HIGH", assignedTo: ownerSub, dueDate: inDays(-10) },
        { id: "demo-task-018", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Schedule kickoff meeting", status: "IN_PROGRESS", priority: "HIGH", assignedTo: memberSub, dueDate: inDays(3) },
        { id: "demo-task-019", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Create project timeline", status: "TODO", priority: "MEDIUM", assignedTo: ownerSub, dueDate: inDays(7) },
        { id: "demo-task-020", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Set up shared workspace access", status: "TODO", priority: "LOW" },
    ];

    for (const t of tasks) {
        // Org1 tasks owned by Jordan (OWNER), org2 tasks owned by Sam (OWNER)
        const taskOwner = t.orgId === ORG_IDS[0] ? ownerSub : memberSub;
        await putItem("Task", {
            id: t.id,
            tenantId: TENANT_ID,
            organizationId: t.orgId,
            workspaceId: t.wsId,
            taskBoardId: t.boardId,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignedTo: t.assignedTo,
            ownerUserSub: taskOwner,
            createdBy: adminSub,
            dueDate: t.dueDate,
            isActive: true,
            completedAt: t.status === "DONE" ? new Date().toISOString() : undefined,
        });
        console.log(`  + Task: ${t.title} [${t.status}]`);
    }

    // 7. User Profiles
    console.log("\nCreating User Profiles...");
    for (const user of DEMO_USERS) {
        await putItem("UserProfile", {
            userId: user.sub,
            tenantId: TENANT_ID,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
        });
        console.log(`  + Profile: ${user.firstName} ${user.lastName} (${user.role})`);
    }

    // 8. Memberships
    // Jordan: OWNER in org1, MEMBER in org2
    // Sam:    MEMBER in org1, OWNER in org2
    console.log("\nCreating Memberships...");
    const memberships = [
        { id: "demo-mem-001", sub: adminSub, role: "TENANT_ADMIN", orgId: ORG_IDS[0] },
        { id: "demo-mem-002", sub: ownerSub, role: "OWNER", orgId: ORG_IDS[0] },
        { id: "demo-mem-003", sub: memberSub, role: "MEMBER", orgId: ORG_IDS[0] },
        { id: "demo-mem-004", sub: ownerSub, role: "MEMBER", orgId: ORG_IDS[1] },
        { id: "demo-mem-005", sub: memberSub, role: "OWNER", orgId: ORG_IDS[1] },
    ];

    for (const m of memberships) {
        await putItem("Membership", {
            id: m.id,
            tenantId: TENANT_ID,
            organizationId: m.orgId,
            userSub: m.sub,
            role: m.role,
            status: "ACTIVE",
            joinedAt: new Date().toISOString(),
        });
        console.log(`  + Membership: ${m.role} → org ${m.orgId}`);
    }

    console.log("\n✅ Demo seeding complete!");
    console.log(`\nDemo login credentials:`);
    console.log(`  Admin:  demo@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Owner:  owner.demo@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Member: member.demo@tethertasks.com / ${DEMO_PASSWORD}\n`);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanup() {
    console.log("\n🧹 Cleaning up demo environment...\n");
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
        ...ORG_IDS.map((id) => ["Organization", { id }] as [string, Record<string, any>]),
        ...WS_IDS.map((id) => ["Workspace", { id }] as [string, Record<string, any>]),
        ...BOARD_IDS.map((id) => ["TaskBoard", { id }] as [string, Record<string, any>]),
        ...Array.from({ length: 20 }, (_, i) => [
            "Task",
            { id: `demo-task-${String(i + 1).padStart(3, "0")}` },
        ] as [string, Record<string, any>]),
        ...["demo-mem-001", "demo-mem-002", "demo-mem-003", "demo-mem-004", "demo-mem-005"].map(
            (id) => ["Membership", { id }] as [string, Record<string, any>]
        ),
    ];

    for (const [model, key] of deletions) {
        await deleteItem(model, key);
        console.log(`  - ${model}: ${JSON.stringify(key)}`);
    }

    // UserProfile uses userId as partition key, but we don't know subs at cleanup time.
    // Look up users by email first to get subs.
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

    console.log("\n✅ Demo cleanup complete!\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const isCleanup = process.argv.includes("--cleanup");

(isCleanup ? cleanup() : seed()).catch((err) => {
    console.error("\n❌ Error:", err.message || err);
    process.exit(1);
});
