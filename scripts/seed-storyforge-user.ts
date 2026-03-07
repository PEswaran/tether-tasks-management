/**
 * Seed script for TetherTasks STORYFORGE demo environment.
 *
 * Creates 5 Cognito users and ~60 DynamoDB records for a creative agency demo tenant.
 * Uses AWS SDK directly (bypasses AppSync auth rules).
 *
 * Usage:
 *   npx tsx scripts/seed-storyforge-user.ts              # seed demo data
 *   npx tsx scripts/seed-storyforge-user.ts --cleanup    # remove demo data
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
// Demo data — deterministic IDs (all prefixed "sf-" to avoid collisions)
// ---------------------------------------------------------------------------

const DEMO_PASSWORD = "StoryForge123!";

const DEMO_USERS = [
    {
        handle: "olivia",
        email: "storyforge.olivia@tethertasks.com",
        firstName: "Olivia",
        lastName: "Hart",
        role: "TENANT_ADMIN",
        cognitoGroup: "TENANT_ADMIN" as string | undefined,
        sub: "", // filled at runtime
    },
    {
        handle: "jamila",
        email: "storyforge.jamila@tethertasks.com",
        firstName: "Jamila",
        lastName: "Price",
        role: "OWNER",
        cognitoGroup: undefined,
        sub: "",
    },
    {
        handle: "tate",
        email: "storyforge.tate@tethertasks.com",
        firstName: "Tate",
        lastName: "Mendez",
        role: "MEMBER",
        cognitoGroup: undefined,
        sub: "",
    },
    {
        handle: "rene",
        email: "storyforge.rene@tethertasks.com",
        firstName: "Rene",
        lastName: "Patel",
        role: "MEMBER",
        cognitoGroup: undefined,
        sub: "",
    },
    {
        handle: "mina",
        email: "storyforge.mina@tethertasks.com",
        firstName: "Mina",
        lastName: "Adler",
        role: "MEMBER",
        cognitoGroup: undefined,
        sub: "",
    },
];

const TENANT_ID = "sf-tenant-001";
const ORG_IDS = ["sf-org-001", "sf-org-002"];
const WS_IDS = ["sf-ws-001", "sf-ws-002", "sf-ws-003"];
const BOARD_IDS = [
    "sf-board-001",
    "sf-board-002",
    "sf-board-003",
    "sf-board-004",
    "sf-board-005",
];

// ---------------------------------------------------------------------------
// Cognito helpers
// ---------------------------------------------------------------------------

async function ensureCognitoUser(
    email: string,
    firstName: string,
    lastName: string,
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
                        { Name: "name", Value: `${firstName} ${lastName}` },
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
    console.log("  • Password set as permanent demo credential");

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
    console.log("\n🌱 Seeding STORYFORGE demo environment...\n");
    console.log(`User Pool: ${USER_POOL_ID}`);
    console.log("Resolving DynamoDB table names...");
    TABLE_SUFFIX = await resolveTableSuffix();
    console.log(`Table suffix: ${TABLE_SUFFIX}\n`);

    // 1. Create Cognito users
    console.log("Creating Cognito users...");
    for (const user of DEMO_USERS) {
        user.sub = await ensureCognitoUser(
            user.email,
            user.firstName,
            user.lastName,
            user.cognitoGroup
        );
    }

    const oliviaSub = DEMO_USERS[0].sub; // Olivia — TENANT_ADMIN
    const jamilaSub = DEMO_USERS[1].sub; // Jamila — OWNER org1, MEMBER org2
    const tateSub = DEMO_USERS[2].sub;   // Tate   — MEMBER org1, OWNER org2
    const reneSub = DEMO_USERS[3].sub;   // Rene   — MEMBER org1 only
    const minaSub = DEMO_USERS[4].sub;   // Mina   — MEMBER org2 only

    // 2. Tenant
    console.log("\nCreating Tenant...");
    await putItem("Tenant", {
        id: TENANT_ID,
        companyName: "StoryForge Creative (Demo)",
        status: "ACTIVE",
        isActive: true,
        plan: "PROFESSIONAL",
        subscriptionStatus: "active",
    });
    console.log(`  + Tenant: StoryForge Creative (Demo)`);

    // 3. Organizations
    console.log("\nCreating Organizations...");
    const orgs = [
        { id: ORG_IDS[0], name: "Brand & Content", desc: "Brand storytelling, content creation, and editorial calendars." },
        { id: ORG_IDS[1], name: "Campaign & Media", desc: "Campaign strategy, media production, and social content." },
    ];
    for (const org of orgs) {
        await putItem("Organization", {
            id: org.id,
            tenantId: TENANT_ID,
            name: org.name,
            description: org.desc,
            createdBy: oliviaSub,
            isActive: true,
        });
        console.log(`  + Org: ${org.name}`);
    }

    // 4. Workspaces
    console.log("\nCreating Workspaces...");
    const workspaces = [
        { id: WS_IDS[0], orgId: ORG_IDS[0], name: "Editorial Production", desc: "Content production and editorial workflow.", owner: jamilaSub },
        { id: WS_IDS[1], orgId: ORG_IDS[0], name: "Client Brands", desc: "Client brand identity and storytelling projects.", owner: jamilaSub },
        { id: WS_IDS[2], orgId: ORG_IDS[1], name: "Campaign Studio", desc: "Campaign development and media production.", owner: tateSub },
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
        { id: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], name: "Autumn Lookbook — Crestview Fashion", desc: "Seasonal lookbook shoot and editorial content for Crestview Fashion.", owner: jamilaSub },
        { id: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], name: "Blog Redesign — Verdant Health", desc: "Blog content strategy and redesign for Verdant Health.", owner: jamilaSub },
        { id: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], name: "Brand Identity — Nova Fintech", desc: "Full brand identity package for Nova Fintech launch.", owner: jamilaSub },
        { id: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], name: "Holiday Campaign — Solara Cosmetics", desc: "Holiday season campaign strategy and creative for Solara Cosmetics.", owner: tateSub },
        { id: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], name: "Social Media Launch — PulseWear", desc: "Social media launch campaign for PulseWear activewear brand.", owner: tateSub },
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

    // 6. Tasks (4 per board = 20 total)
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
        // Board 1: Autumn Lookbook — Crestview Fashion (org1, ws1)
        { id: "sf-task-001", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Scout and book shoot locations", status: "DONE", priority: "HIGH", assignedTo: reneSub, dueDate: inDays(-6) },
        { id: "sf-task-002", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Coordinate model casting for lookbook", status: "IN_PROGRESS", priority: "HIGH", assignedTo: tateSub, dueDate: inDays(3) },
        { id: "sf-task-003", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Draft shot list and creative brief", status: "TODO", priority: "MEDIUM", assignedTo: jamilaSub, dueDate: inDays(5) },
        { id: "sf-task-004", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Design lookbook layout template", status: "TODO", priority: "URGENT", assignedTo: reneSub, dueDate: inDays(7) },

        // Board 2: Blog Redesign — Verdant Health (org1, ws1)
        { id: "sf-task-005", boardId: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Audit existing blog content and SEO", status: "DONE", priority: "HIGH", assignedTo: tateSub, dueDate: inDays(-4) },
        { id: "sf-task-006", boardId: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Create content calendar for Q4", status: "IN_PROGRESS", priority: "MEDIUM", assignedTo: reneSub, dueDate: inDays(6) },
        { id: "sf-task-007", boardId: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Write three pillar blog articles", status: "TODO", priority: "HIGH", assignedTo: tateSub, dueDate: inDays(12) },
        { id: "sf-task-008", boardId: BOARD_IDS[1], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Design new blog page wireframes", status: "TODO", priority: "LOW", dueDate: inDays(14) },

        // Board 3: Brand Identity — Nova Fintech (org1, ws2)
        { id: "sf-task-009", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Finalize brand color palette and typography", status: "DONE", priority: "URGENT", assignedTo: jamilaSub, dueDate: inDays(-8) },
        { id: "sf-task-010", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Design logo concepts and variations", status: "IN_PROGRESS", priority: "HIGH", assignedTo: reneSub, dueDate: inDays(4) },
        { id: "sf-task-011", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Build brand guidelines document", status: "TODO", priority: "MEDIUM", assignedTo: jamilaSub, dueDate: inDays(10) },
        { id: "sf-task-012", boardId: BOARD_IDS[2], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Create social media asset templates", status: "TODO", priority: "LOW", assignedTo: tateSub, dueDate: inDays(15) },

        // Board 4: Holiday Campaign — Solara Cosmetics (org2, ws3)
        { id: "sf-task-013", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Develop campaign concept and tagline", status: "DONE", priority: "URGENT", assignedTo: tateSub, dueDate: inDays(-10) },
        { id: "sf-task-014", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Produce hero video for holiday launch", status: "IN_PROGRESS", priority: "HIGH", assignedTo: minaSub, dueDate: inDays(8) },
        { id: "sf-task-015", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Design email campaign sequence", status: "TODO", priority: "HIGH", assignedTo: jamilaSub, dueDate: inDays(6) },
        { id: "sf-task-016", boardId: BOARD_IDS[3], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Plan influencer partnership outreach", status: "TODO", priority: "MEDIUM", assignedTo: minaSub, dueDate: inDays(9) },

        // Board 5: Social Media Launch — PulseWear (org2, ws3)
        { id: "sf-task-017", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Define brand voice and content pillars", status: "DONE", priority: "HIGH", assignedTo: minaSub, dueDate: inDays(-12) },
        { id: "sf-task-018", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Create first 30 days content calendar", status: "IN_PROGRESS", priority: "HIGH", assignedTo: jamilaSub, dueDate: inDays(5) },
        { id: "sf-task-019", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Shoot product photography for Instagram", status: "TODO", priority: "MEDIUM", assignedTo: tateSub, dueDate: inDays(10) },
        { id: "sf-task-020", boardId: BOARD_IDS[4], wsId: WS_IDS[2], orgId: ORG_IDS[1], title: "Set up analytics and tracking dashboards", status: "TODO", priority: "URGENT", assignedTo: minaSub, dueDate: inDays(3) },
    ];

    for (const t of tasks) {
        // Org1 tasks owned by Jamila (OWNER), org2 tasks owned by Tate (OWNER)
        const taskOwner = t.orgId === ORG_IDS[0] ? jamilaSub : tateSub;
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
            createdBy: oliviaSub,
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
    // Olivia: TENANT_ADMIN in org1 only
    // Jamila: OWNER in org1, MEMBER in org2
    // Tate:   MEMBER in org1, OWNER in org2
    // Rene:   MEMBER in org1 only
    // Mina:   MEMBER in org2 only
    console.log("\nCreating Memberships...");
    const memberships = [
        { id: "sf-mem-001", sub: oliviaSub, role: "TENANT_ADMIN", orgId: ORG_IDS[0] },
        { id: "sf-mem-002", sub: jamilaSub, role: "OWNER", orgId: ORG_IDS[0] },
        { id: "sf-mem-003", sub: tateSub, role: "MEMBER", orgId: ORG_IDS[0] },
        { id: "sf-mem-004", sub: reneSub, role: "MEMBER", orgId: ORG_IDS[0] },
        { id: "sf-mem-005", sub: jamilaSub, role: "MEMBER", orgId: ORG_IDS[1] },
        { id: "sf-mem-006", sub: tateSub, role: "OWNER", orgId: ORG_IDS[1] },
        { id: "sf-mem-007", sub: minaSub, role: "MEMBER", orgId: ORG_IDS[1] },
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
        { id: "sf-audit-001", userId: oliviaSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { email: "storyforge.olivia@tethertasks.com" } },
        { id: "sf-audit-002", userId: jamilaSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { email: "storyforge.jamila@tethertasks.com" } },
        { id: "sf-audit-003", userId: tateSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { email: "storyforge.tate@tethertasks.com" } },
        { id: "sf-audit-004", userId: reneSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(12), meta: { email: "storyforge.rene@tethertasks.com" } },
        { id: "sf-audit-005", userId: minaSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(12), meta: { email: "storyforge.mina@tethertasks.com" } },

        // Org creation
        { id: "sf-audit-006", userId: oliviaSub, action: "CREATE", resourceType: "Organization", resourceId: ORG_IDS[0], orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { name: "Brand & Content" } },
        { id: "sf-audit-007", userId: oliviaSub, action: "CREATE", resourceType: "Organization", resourceId: ORG_IDS[1], orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { name: "Campaign & Media" } },

        // Workspace creation
        { id: "sf-audit-008", userId: jamilaSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[0], orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(13), meta: { name: "Editorial Production" } },
        { id: "sf-audit-009", userId: jamilaSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[1], orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(13), meta: { name: "Client Brands" } },
        { id: "sf-audit-010", userId: tateSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[2], orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(12), meta: { name: "Campaign Studio" } },

        // Board creation
        { id: "sf-audit-011", userId: jamilaSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[0], orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(12), meta: { name: "Autumn Lookbook — Crestview Fashion" } },
        { id: "sf-audit-012", userId: jamilaSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[1], orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(12), meta: { name: "Blog Redesign — Verdant Health" } },
        { id: "sf-audit-013", userId: jamilaSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[2], orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(11), meta: { name: "Brand Identity — Nova Fintech" } },
        { id: "sf-audit-014", userId: tateSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[3], orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(11), meta: { name: "Holiday Campaign — Solara Cosmetics" } },
        { id: "sf-audit-015", userId: tateSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[4], orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(11), meta: { name: "Social Media Launch — PulseWear" } },

        // Member invitations
        { id: "sf-audit-016", userId: oliviaSub, action: "INVITE", resourceType: "Membership", resourceId: "sf-mem-002", orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { invitedEmail: "storyforge.jamila@tethertasks.com", role: "OWNER" } },
        { id: "sf-audit-017", userId: oliviaSub, action: "INVITE", resourceType: "Membership", resourceId: "sf-mem-003", orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { invitedEmail: "storyforge.tate@tethertasks.com", role: "MEMBER" } },
        { id: "sf-audit-018", userId: oliviaSub, action: "INVITE", resourceType: "Membership", resourceId: "sf-mem-004", orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { invitedEmail: "storyforge.rene@tethertasks.com", role: "MEMBER" } },
        { id: "sf-audit-019", userId: oliviaSub, action: "INVITE", resourceType: "Membership", resourceId: "sf-mem-005", orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "storyforge.jamila@tethertasks.com", role: "MEMBER" } },
        { id: "sf-audit-020", userId: oliviaSub, action: "INVITE", resourceType: "Membership", resourceId: "sf-mem-006", orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "storyforge.tate@tethertasks.com", role: "OWNER" } },
        { id: "sf-audit-021", userId: oliviaSub, action: "INVITE", resourceType: "Membership", resourceId: "sf-mem-007", orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "storyforge.mina@tethertasks.com", role: "MEMBER" } },

        // Task creation (key tasks — one per board)
        { id: "sf-audit-022", userId: jamilaSub, action: "CREATE", resourceType: "Task", resourceId: "sf-task-001", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(10), meta: { title: "Scout and book shoot locations", board: "Autumn Lookbook — Crestview Fashion" } },
        { id: "sf-audit-023", userId: jamilaSub, action: "CREATE", resourceType: "Task", resourceId: "sf-task-005", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(10), meta: { title: "Audit existing blog content and SEO", board: "Blog Redesign — Verdant Health" } },
        { id: "sf-audit-024", userId: jamilaSub, action: "CREATE", resourceType: "Task", resourceId: "sf-task-009", orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(9), meta: { title: "Finalize brand color palette and typography", board: "Brand Identity — Nova Fintech" } },
        { id: "sf-audit-025", userId: tateSub, action: "CREATE", resourceType: "Task", resourceId: "sf-task-013", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(9), meta: { title: "Develop campaign concept and tagline", board: "Holiday Campaign — Solara Cosmetics" } },
        { id: "sf-audit-026", userId: tateSub, action: "CREATE", resourceType: "Task", resourceId: "sf-task-017", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(9), meta: { title: "Define brand voice and content pillars", board: "Social Media Launch — PulseWear" } },

        // Task assignments
        { id: "sf-audit-027", userId: jamilaSub, action: "ASSIGN", resourceType: "Task", resourceId: "sf-task-001", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(10), meta: { title: "Scout and book shoot locations", assignedTo: "Rene Patel" } },
        { id: "sf-audit-028", userId: jamilaSub, action: "ASSIGN", resourceType: "Task", resourceId: "sf-task-010", orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(7), meta: { title: "Design logo concepts and variations", assignedTo: "Rene Patel" } },
        { id: "sf-audit-029", userId: tateSub, action: "ASSIGN", resourceType: "Task", resourceId: "sf-task-014", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(6), meta: { title: "Produce hero video for holiday launch", assignedTo: "Mina Adler" } },
        { id: "sf-audit-030", userId: tateSub, action: "ASSIGN", resourceType: "Task", resourceId: "sf-task-018", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(5), meta: { title: "Create first 30 days content calendar", assignedTo: "Jamila Price" } },

        // Task status updates (completions)
        { id: "sf-audit-031", userId: reneSub, action: "UPDATE", resourceType: "Task", resourceId: "sf-task-001", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(6), meta: { title: "Scout and book shoot locations", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "sf-audit-032", userId: tateSub, action: "UPDATE", resourceType: "Task", resourceId: "sf-task-005", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(4), meta: { title: "Audit existing blog content and SEO", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "sf-audit-033", userId: jamilaSub, action: "UPDATE", resourceType: "Task", resourceId: "sf-task-009", orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(8), meta: { title: "Finalize brand color palette and typography", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "sf-audit-034", userId: tateSub, action: "UPDATE", resourceType: "Task", resourceId: "sf-task-013", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(10), meta: { title: "Develop campaign concept and tagline", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "sf-audit-035", userId: minaSub, action: "UPDATE", resourceType: "Task", resourceId: "sf-task-017", orgId: ORG_IDS[1], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(12), meta: { title: "Define brand voice and content pillars", field: "status", from: "IN_PROGRESS", to: "DONE" } },

        // Recent logins
        { id: "sf-audit-036", userId: oliviaSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(1), meta: { email: "storyforge.olivia@tethertasks.com" } },
        { id: "sf-audit-037", userId: jamilaSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(0), meta: { email: "storyforge.jamila@tethertasks.com" } },
        { id: "sf-audit-038", userId: tateSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(0), meta: { email: "storyforge.tate@tethertasks.com" } },
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

    console.log("\n✅ StoryForge demo seeding complete!");
    console.log(`\nDemo login credentials:`);
    console.log(`  Creative Director: storyforge.olivia@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Brand Lead:        storyforge.jamila@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Content Lead:      storyforge.tate@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Designer:          storyforge.rene@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Media Specialist:  storyforge.mina@tethertasks.com / ${DEMO_PASSWORD}\n`);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanup() {
    console.log("\n🧹 Cleaning up STORYFORGE demo environment...\n");
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
            { id: `sf-task-${String(i + 1).padStart(3, "0")}` },
        ] as [string, Record<string, any>]),
        ...["sf-mem-001", "sf-mem-002", "sf-mem-003", "sf-mem-004", "sf-mem-005", "sf-mem-006", "sf-mem-007"].map(
            (id) => ["Membership", { id }] as [string, Record<string, any>]
        ),
        ...Array.from({ length: 38 }, (_, i) => [
            "AuditLog",
            { id: `sf-audit-${String(i + 1).padStart(3, "0")}` },
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

    console.log("\n✅ StoryForge demo cleanup complete!\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const isCleanup = process.argv.includes("--cleanup");

(isCleanup ? cleanup() : seed()).catch((err) => {
    console.error("\n❌ Error:", err.message || err);
    process.exit(1);
});
