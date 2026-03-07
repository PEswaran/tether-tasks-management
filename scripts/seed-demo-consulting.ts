/**
 * Seed script for TetherTasks CONSULTING demo environment.
 *
 * Creates 3 Cognito users and ~35 DynamoDB records for a consulting-firm demo tenant.
 * Uses AWS SDK directly (bypasses AppSync auth rules).
 *
 * Usage:
 *   npx tsx scripts/seed-demo-consulting.ts              # seed demo data
 *   npx tsx scripts/seed-demo-consulting.ts --cleanup    # remove demo data
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
// Demo data — deterministic IDs (all prefixed "consult-" to avoid collisions)
// ---------------------------------------------------------------------------

const DEMO_PASSWORD = "DemoPass123!";

const DEMO_USERS = [
    {
        email: "consulting.demo@tethertasks.com",
        firstName: "Morgan",
        lastName: "Chen",
        role: "TENANT_ADMIN",
        cognitoGroup: "TENANT_ADMIN",
        sub: "", // filled at runtime
    },
    {
        email: "consultant.owner@tethertasks.com",
        firstName: "Riley",
        lastName: "Patel",
        role: "OWNER",
        cognitoGroup: undefined,
        sub: "",
    },
    {
        email: "consultant.member@tethertasks.com",
        firstName: "Casey",
        lastName: "Brooks",
        role: "MEMBER",
        cognitoGroup: undefined,
        sub: "",
    },
];

const TENANT_ID = "consult-tenant-001";
const ORG_IDS = ["consult-org-001", "consult-org-002"];
const WS_IDS = ["consult-ws-001", "consult-ws-002", "consult-ws-003"];
const BOARD_IDS = [
    "consult-board-001",
    "consult-board-002",
    "consult-board-003",
    "consult-board-004",
    "consult-board-005",
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
    console.log("\n🌱 Seeding CONSULTING demo environment...\n");
    console.log(`User Pool: ${USER_POOL_ID}`);
    console.log("Resolving DynamoDB table names...");
    TABLE_SUFFIX = await resolveTableSuffix();
    console.log(`Table suffix: ${TABLE_SUFFIX}\n`);

    // 1. Create Cognito users
    console.log("Creating Cognito users...");
    for (const user of DEMO_USERS) {
        user.sub = await ensureCognitoUser(user.email, user.cognitoGroup);
    }

    const adminSub = DEMO_USERS[0].sub; // Morgan — Managing Partner
    const ownerSub = DEMO_USERS[1].sub; // Riley  — Engagement Lead
    const memberSub = DEMO_USERS[2].sub; // Casey  — Analyst

    // 2. Tenant
    console.log("\nCreating Tenant...");
    await putItem("Tenant", {
        id: TENANT_ID,
        companyName: "Meridian Consulting Group (Demo)",
        status: "ACTIVE",
        isActive: true,
        plan: "PROFESSIONAL",
        subscriptionStatus: "active",
    });
    console.log(`  + Tenant: Meridian Consulting Group (Demo)`);

    // 3. Organizations (practice areas)
    console.log("\nCreating Organizations...");
    const orgs = [
        { id: ORG_IDS[0], name: "Strategy & Advisory", desc: "Strategic planning, market analysis, and executive advisory engagements." },
        { id: ORG_IDS[1], name: "Digital Transformation", desc: "Technology modernization, process automation, and change management." },
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
    // Org1 workspaces owned by Riley (OWNER), org2 workspace owned by Casey (OWNER)
    console.log("\nCreating Workspaces...");
    const workspaces = [
        { id: WS_IDS[0], orgId: ORG_IDS[0], name: "Client Engagements", desc: "Active client projects and deliverable tracking.", owner: ownerSub },
        { id: WS_IDS[1], orgId: ORG_IDS[0], name: "Business Development", desc: "Pipeline, proposals, and pursuit tracking.", owner: ownerSub },
        { id: WS_IDS[2], orgId: ORG_IDS[1], name: "Modernization Programs", desc: "Digital transformation project execution.", owner: memberSub },
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
    console.log("\nCreating Task Boards...");
    const boards = [
        { id: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], name: "NovaTech Strategy Engagement", desc: "12-week growth strategy for NovaTech Inc.", owner: ownerSub },
        { id: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], name: "Apex Partners M&A Due Diligence", desc: "Financial and operational due diligence for Apex acquisition.", owner: ownerSub },
        { id: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], name: "Active Proposals", desc: "SOWs, RFP responses, and prospect follow-ups.", owner: ownerSub },
        { id: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], name: "CloudFirst Migration", desc: "Enterprise cloud migration for CloudFirst Industries.", owner: memberSub },
        { id: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], name: "Process Automation — Luma Health", desc: "Workflow automation and EHR integration for Luma Health.", owner: memberSub },
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
            // NovaTech Strategy Engagement
            { id: "consult-task-001", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Conduct stakeholder interviews", status: "DONE", priority: "HIGH", assignedTo: memberSub, dueDate: inDays(-5) },
            { id: "consult-task-002", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Complete market sizing analysis", status: "IN_PROGRESS", priority: "HIGH", assignedTo: memberSub, dueDate: inDays(4) },
            { id: "consult-task-003", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Draft competitive landscape report", status: "TODO", priority: "MEDIUM", dueDate: inDays(10) },
            { id: "consult-task-004", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Prepare interim findings presentation", status: "TODO", priority: "URGENT", assignedTo: ownerSub, dueDate: inDays(6) },

            // Apex Partners M&A Due Diligence
            { id: "consult-task-005", boardId: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Review target company financials", status: "DONE", priority: "URGENT", assignedTo: ownerSub, dueDate: inDays(-3) },
            { id: "consult-task-006", boardId: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Assess operational synergies", status: "IN_PROGRESS", priority: "HIGH", assignedTo: memberSub, dueDate: inDays(7) },
            { id: "consult-task-007", boardId: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Interview target management team", status: "TODO", priority: "HIGH", assignedTo: ownerSub, dueDate: inDays(5) },
            { id: "consult-task-008", boardId: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Compile due diligence summary memo", status: "TODO", priority: "MEDIUM", dueDate: inDays(14) },

            // Active Proposals
            { id: "consult-task-009", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Finalize SOW for Beacon Industries", status: "DONE", priority: "HIGH", assignedTo: ownerSub, dueDate: inDays(-7) },
            { id: "consult-task-010", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Submit RFP response — Metro Health", status: "IN_PROGRESS", priority: "URGENT", assignedTo: memberSub, dueDate: inDays(2) },
            { id: "consult-task-011", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Schedule discovery call with Orion Labs", status: "TODO", priority: "MEDIUM", assignedTo: ownerSub, dueDate: inDays(3) },
            { id: "consult-task-012", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Update proposal template with Q2 rates", status: "TODO", priority: "LOW" },

            // CloudFirst Migration (org2: Casey=OWNER, Riley=MEMBER)
            { id: "consult-task-013", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Complete infrastructure assessment", status: "DONE", priority: "HIGH", assignedTo: memberSub, dueDate: inDays(-8) },
            { id: "consult-task-014", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Design target cloud architecture", status: "IN_PROGRESS", priority: "HIGH", assignedTo: ownerSub, dueDate: inDays(10) },
            { id: "consult-task-015", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Define data migration runbook", status: "TODO", priority: "MEDIUM", assignedTo: memberSub, dueDate: inDays(14) },
            { id: "consult-task-016", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Plan stakeholder change management workshop", status: "TODO", priority: "URGENT", assignedTo: ownerSub, dueDate: inDays(3) },

            // Process Automation — Luma Health (org2: Casey=OWNER, Riley=MEMBER)
            { id: "consult-task-017", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Map current-state workflows", status: "DONE", priority: "HIGH", assignedTo: memberSub, dueDate: inDays(-12) },
            { id: "consult-task-018", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Identify automation candidates", status: "IN_PROGRESS", priority: "MEDIUM", assignedTo: ownerSub, dueDate: inDays(5) },
            { id: "consult-task-019", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Build proof-of-concept integration", status: "TODO", priority: "HIGH", assignedTo: memberSub, dueDate: inDays(12) },
            { id: "consult-task-020", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Present ROI analysis to client steering committee", status: "TODO", priority: "URGENT", dueDate: inDays(8) },
        ];

    for (const t of tasks) {
        // Org1 tasks owned by Riley (OWNER), org2 tasks owned by Casey (OWNER)
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
    // Riley: OWNER in org1, MEMBER in org2
    // Casey: MEMBER in org1, OWNER in org2
    console.log("\nCreating Memberships...");
    const memberships = [
        { id: "consult-mem-001", sub: adminSub, role: "TENANT_ADMIN", orgId: ORG_IDS[0] },
        { id: "consult-mem-002", sub: ownerSub, role: "OWNER", orgId: ORG_IDS[0] },
        { id: "consult-mem-003", sub: memberSub, role: "MEMBER", orgId: ORG_IDS[0] },
        { id: "consult-mem-004", sub: ownerSub, role: "MEMBER", orgId: ORG_IDS[1] },
        { id: "consult-mem-005", sub: memberSub, role: "OWNER", orgId: ORG_IDS[1] },
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

    // 9. Audit Logs
    console.log("\nCreating Audit Logs...");
    const agoMs = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

    const auditLogs = [
        // Logins (spread over past 2 weeks)
        { id: "consult-audit-001", userId: adminSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { email: "consulting.demo@tethertasks.com" } },
        { id: "consult-audit-002", userId: ownerSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { email: "consultant.owner@tethertasks.com" } },
        { id: "consult-audit-003", userId: memberSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { email: "consultant.member@tethertasks.com" } },

        // Org creation
        { id: "consult-audit-004", userId: adminSub, action: "CREATE", resourceType: "Organization", resourceId: ORG_IDS[0], orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { name: "Strategy & Advisory" } },
        { id: "consult-audit-005", userId: adminSub, action: "CREATE", resourceType: "Organization", resourceId: ORG_IDS[1], orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { name: "Digital Transformation" } },

        // Workspace creation
        { id: "consult-audit-006", userId: ownerSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[0], orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(13), meta: { name: "Client Engagements" } },
        { id: "consult-audit-007", userId: ownerSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[1], orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(13), meta: { name: "Business Development" } },
        { id: "consult-audit-008", userId: memberSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[2], orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(12), meta: { name: "Modernization Programs" } },

        // Board creation
        { id: "consult-audit-009", userId: ownerSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[0], orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(12), meta: { name: "NovaTech Strategy Engagement" } },
        { id: "consult-audit-010", userId: ownerSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[1], orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(12), meta: { name: "Apex Partners M&A Due Diligence" } },
        { id: "consult-audit-011", userId: ownerSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[2], orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(11), meta: { name: "Active Proposals" } },
        { id: "consult-audit-012", userId: memberSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[3], orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(11), meta: { name: "CloudFirst Migration" } },
        { id: "consult-audit-013", userId: memberSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[4], orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(11), meta: { name: "Process Automation — Luma Health" } },

        // Member invitations
        { id: "consult-audit-014", userId: adminSub, action: "INVITE", resourceType: "Membership", resourceId: "consult-mem-002", orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { invitedEmail: "consultant.owner@tethertasks.com", role: "OWNER" } },
        { id: "consult-audit-015", userId: adminSub, action: "INVITE", resourceType: "Membership", resourceId: "consult-mem-003", orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { invitedEmail: "consultant.member@tethertasks.com", role: "MEMBER" } },
        { id: "consult-audit-016", userId: adminSub, action: "INVITE", resourceType: "Membership", resourceId: "consult-mem-004", orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "consultant.owner@tethertasks.com", role: "MEMBER" } },
        { id: "consult-audit-017", userId: adminSub, action: "INVITE", resourceType: "Membership", resourceId: "consult-mem-005", orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "consultant.member@tethertasks.com", role: "OWNER" } },

        // Task creation (key tasks only — not all 20)
        { id: "consult-audit-018", userId: ownerSub, action: "CREATE", resourceType: "Task", resourceId: "consult-task-001", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(10), meta: { title: "Conduct stakeholder interviews", board: "NovaTech Strategy Engagement" } },
        { id: "consult-audit-019", userId: ownerSub, action: "CREATE", resourceType: "Task", resourceId: "consult-task-005", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(10), meta: { title: "Review target company financials", board: "Apex Partners M&A Due Diligence" } },
        { id: "consult-audit-020", userId: ownerSub, action: "CREATE", resourceType: "Task", resourceId: "consult-task-009", orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(9), meta: { title: "Finalize SOW for Beacon Industries", board: "Active Proposals" } },
        { id: "consult-audit-021", userId: memberSub, action: "CREATE", resourceType: "Task", resourceId: "consult-task-013", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(9), meta: { title: "Complete infrastructure assessment", board: "CloudFirst Migration" } },
        { id: "consult-audit-022", userId: memberSub, action: "CREATE", resourceType: "Task", resourceId: "consult-task-017", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(9), meta: { title: "Map current-state workflows", board: "Process Automation — Luma Health" } },

        // Task assignments
        { id: "consult-audit-023", userId: ownerSub, action: "ASSIGN", resourceType: "Task", resourceId: "consult-task-001", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(10), meta: { title: "Conduct stakeholder interviews", assignedTo: "Casey Brooks" } },
        { id: "consult-audit-024", userId: ownerSub, action: "ASSIGN", resourceType: "Task", resourceId: "consult-task-005", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(10), meta: { title: "Review target company financials", assignedTo: "Riley Patel" } },
        { id: "consult-audit-025", userId: ownerSub, action: "ASSIGN", resourceType: "Task", resourceId: "consult-task-010", orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(7), meta: { title: "Submit RFP response — Metro Health", assignedTo: "Casey Brooks" } },
        { id: "consult-audit-026", userId: memberSub, action: "ASSIGN", resourceType: "Task", resourceId: "consult-task-014", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(6), meta: { title: "Design target cloud architecture", assignedTo: "Riley Patel" } },

        // Task status updates (completions)
        { id: "consult-audit-027", userId: memberSub, action: "UPDATE", resourceType: "Task", resourceId: "consult-task-001", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(5), meta: { title: "Conduct stakeholder interviews", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "consult-audit-028", userId: ownerSub, action: "UPDATE", resourceType: "Task", resourceId: "consult-task-005", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(3), meta: { title: "Review target company financials", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "consult-audit-029", userId: ownerSub, action: "UPDATE", resourceType: "Task", resourceId: "consult-task-009", orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(7), meta: { title: "Finalize SOW for Beacon Industries", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "consult-audit-030", userId: memberSub, action: "UPDATE", resourceType: "Task", resourceId: "consult-task-013", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(8), meta: { title: "Complete infrastructure assessment", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "consult-audit-031", userId: memberSub, action: "UPDATE", resourceType: "Task", resourceId: "consult-task-017", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(12), meta: { title: "Map current-state workflows", field: "status", from: "IN_PROGRESS", to: "DONE" } },

        // Recent logins
        { id: "consult-audit-032", userId: adminSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(1), meta: { email: "consulting.demo@tethertasks.com" } },
        { id: "consult-audit-033", userId: ownerSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(0), meta: { email: "consultant.owner@tethertasks.com" } },
        { id: "consult-audit-034", userId: memberSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(0), meta: { email: "consultant.member@tethertasks.com" } },
    ];

    for (const log of auditLogs) {
        await putItem("AuditLog", {
            id: log.id,
            tenantId: TENANT_ID,
            organizationId: log.orgId,
            workspaceId: log.wsId,
            userId: log.userId,
            action: log.action,
            resourceType: log.resourceType,
            resourceId: log.resourceId,
            result: log.result,
            metadata: JSON.stringify(log.meta),
            timestamp: log.ts,
        });
        console.log(`  + Audit: ${log.action} ${log.resourceType} (${log.id})`);
    }

    console.log("\n✅ Consulting demo seeding complete!");
    console.log(`\nDemo login credentials:`);
    console.log(`  Managing Partner: consulting.demo@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Engagement Lead:  consultant.owner@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Analyst:          consultant.member@tethertasks.com / ${DEMO_PASSWORD}\n`);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanup() {
    console.log("\n🧹 Cleaning up CONSULTING demo environment...\n");
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
            { id: `consult-task-${String(i + 1).padStart(3, "0")}` },
        ] as [string, Record<string, any>]),
        ...["consult-mem-001", "consult-mem-002", "consult-mem-003", "consult-mem-004", "consult-mem-005"].map(
            (id) => ["Membership", { id }] as [string, Record<string, any>]
        ),
        ...Array.from({ length: 34 }, (_, i) => [
            "AuditLog",
            { id: `consult-audit-${String(i + 1).padStart(3, "0")}` },
        ] as [string, Record<string, any>]),
    ];

    for (const [model, key] of deletions) {
        await deleteItem(model, key);
        console.log(`  - ${model}: ${JSON.stringify(key)}`);
    }

    // UserProfile uses userId as partition key — look up subs by email first.
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

    console.log("\n✅ Consulting demo cleanup complete!\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const isCleanup = process.argv.includes("--cleanup");

(isCleanup ? cleanup() : seed()).catch((err) => {
    console.error("\n❌ Error:", err.message || err);
    process.exit(1);
});
