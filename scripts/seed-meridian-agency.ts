/**
 * Seed script for TetherTasks MERIDIAN AGENCY demo environment.
 *
 * Creates 4 Cognito users and ~70 DynamoDB records for an advertising-agency
 * demo tenant ("Meridian Consulting Group") that manages multiple client
 * organizations with contractors working on advertising tasks.
 *
 * The tenant includes agreementNotes and the admin's hasSeenWelcome is false
 * so they go through the Welcome Page → agreement signing flow on first login.
 *
 * Usage:
 *   npx tsx scripts/seed-meridian-agency.ts              # seed demo data
 *   npx tsx scripts/seed-meridian-agency.ts --cleanup    # remove demo data
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
// Demo data — deterministic IDs (all prefixed "meridian-" to avoid collisions)
// ---------------------------------------------------------------------------

const DEMO_PASSWORD = "DemoPass123!";

const DEMO_USERS = [
    {
        email: "meridian.admin@tethertasks.com",
        firstName: "Sarah",
        lastName: "Chen",
        role: "TENANT_ADMIN",
        cognitoGroup: "TENANT_ADMIN" as string | undefined,
        sub: "", // filled at runtime
    },
    {
        email: "meridian.creative@tethertasks.com",
        firstName: "Jake",
        lastName: "Morrison",
        role: "OWNER",
        cognitoGroup: undefined as string | undefined,
        sub: "",
    },
    {
        email: "meridian.media@tethertasks.com",
        firstName: "Priya",
        lastName: "Desai",
        role: "OWNER",
        cognitoGroup: undefined as string | undefined,
        sub: "",
    },
    {
        email: "meridian.strategy@tethertasks.com",
        firstName: "Carlos",
        lastName: "Vega",
        role: "MEMBER",
        cognitoGroup: undefined as string | undefined,
        sub: "",
    },
];

const TENANT_ID = "meridian-tenant-001";

const ORG_IDS = [
    "meridian-org-001", // Brightwell Foods
    "meridian-org-002", // Apex Fitness Co
    "meridian-org-003", // Lumen Home Solar
];

const WS_IDS = [
    // Brightwell Foods (3 workspaces)
    "meridian-ws-001", // Campaign Strategy
    "meridian-ws-002", // Creative Production
    "meridian-ws-003", // Media Buying
    // Apex Fitness Co (3 workspaces)
    "meridian-ws-004", // Growth Marketing
    "meridian-ws-005", // Content & Social
    "meridian-ws-006", // Analytics & Reporting
    // Lumen Home Solar (3 workspaces)
    "meridian-ws-007", // Lead Generation
    "meridian-ws-008", // Brand Awareness
    "meridian-ws-009", // Client Reporting
];

const BOARD_IDS = [
    // Brightwell Foods boards
    "meridian-board-001", // Q2 Product Launch
    "meridian-board-002", // Ad Creatives
    "meridian-board-003", // Paid Social
    // Apex Fitness Co boards
    "meridian-board-004", // Member Acquisition
    "meridian-board-005", // Social Calendar
    "meridian-board-006", // Weekly Dashboards
    // Lumen Home Solar boards
    "meridian-board-007", // Google Ads
    "meridian-board-008", // Community Events
    "meridian-board-009", // Monthly ROI Reports
];

const AGREEMENT_NOTES = `MERIDIAN CONSULTING GROUP — MULTI-CLIENT ADVERTISING SERVICES AGREEMENT

This agreement governs the terms under which contractors and team members access and utilize the Meridian Consulting Group platform for managing advertising campaigns across multiple client organizations.

1. CONFIDENTIALITY: All client campaign data, creative assets, media spend details, and performance metrics accessed through this platform are strictly confidential. Contractors shall not disclose any client information to third parties or to other clients managed through this platform.

2. CLIENT SEPARATION: Each client organization maintains independent workspaces and data. Team members must not share campaign strategies, performance benchmarks, or creative concepts between client accounts without explicit written authorization from the Meridian account director.

3. MEDIA SPEND ACCOUNTABILITY: All media buying activities and budget allocations must be documented within the platform. Contractors are responsible for accurate reporting of spend and performance metrics for each client engagement.

4. INTELLECTUAL PROPERTY: Creative assets, campaign strategies, and proprietary methodologies developed for client engagements remain the property of Meridian Consulting Group and the respective client as outlined in individual client SOWs.

5. PLATFORM USAGE: Access credentials are non-transferable. All platform activity is logged for audit purposes. Team members agree to use the platform in accordance with Meridian's operational guidelines and client service standards.

By signing below, you acknowledge and agree to these terms as a condition of accessing the Meridian Consulting Group platform.`;

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
    console.log("\n🌱 Seeding MERIDIAN AGENCY demo environment...\n");
    console.log(`User Pool: ${USER_POOL_ID}`);
    console.log("Resolving DynamoDB table names...");
    TABLE_SUFFIX = await resolveTableSuffix();
    console.log(`Table suffix: ${TABLE_SUFFIX}\n`);

    // 1. Create Cognito users
    console.log("Creating Cognito users...");
    for (const user of DEMO_USERS) {
        user.sub = await ensureCognitoUser(user.email, user.cognitoGroup);
    }

    const sarahSub = DEMO_USERS[0].sub;  // Sarah Chen — TENANT_ADMIN
    const jakeSub = DEMO_USERS[1].sub;   // Jake Morrison — Creative contractor
    const priyaSub = DEMO_USERS[2].sub;  // Priya Desai — Media contractor
    const carlosSub = DEMO_USERS[3].sub; // Carlos Vega — Strategy contractor

    // 2. Tenant (with agreement notes)
    console.log("\nCreating Tenant...");
    await putItem("Tenant", {
        id: TENANT_ID,
        companyName: "Meridian Consulting Group",
        status: "ACTIVE",
        isActive: true,
        plan: "PROFESSIONAL",
        subscriptionStatus: "active",
        agreementNotes: AGREEMENT_NOTES,
    });
    console.log(`  + Tenant: Meridian Consulting Group`);

    // 3. Organizations (client contracts)
    console.log("\nCreating Organizations...");
    const orgs = [
        { id: ORG_IDS[0], name: "Brightwell Foods", desc: "National food brand — Q2 product launch campaign including TV, digital, and in-store activations." },
        { id: ORG_IDS[1], name: "Apex Fitness Co", desc: "Regional gym chain — Membership growth campaign across social media, local search, and community events." },
        { id: ORG_IDS[2], name: "Lumen Home Solar", desc: "Solar energy company — Lead generation and brand awareness through Google Ads, content marketing, and community outreach." },
    ];
    for (const org of orgs) {
        await putItem("Organization", {
            id: org.id,
            tenantId: TENANT_ID,
            name: org.name,
            description: org.desc,
            createdBy: sarahSub,
            isActive: true,
        });
        console.log(`  + Org: ${org.name}`);
    }

    // 4. Workspaces (3 per org = 9 total)
    console.log("\nCreating Workspaces...");
    const workspaces = [
        // Brightwell Foods
        { id: WS_IDS[0], orgId: ORG_IDS[0], name: "Campaign Strategy", desc: "Strategic planning and campaign briefs for Brightwell Foods.", owner: jakeSub },
        { id: WS_IDS[1], orgId: ORG_IDS[0], name: "Creative Production", desc: "Ad creative development, copywriting, and design assets.", owner: jakeSub },
        { id: WS_IDS[2], orgId: ORG_IDS[0], name: "Media Buying", desc: "Paid media planning, buying, and optimization.", owner: priyaSub },
        // Apex Fitness Co
        { id: WS_IDS[3], orgId: ORG_IDS[1], name: "Growth Marketing", desc: "Member acquisition funnels and conversion optimization.", owner: priyaSub },
        { id: WS_IDS[4], orgId: ORG_IDS[1], name: "Content & Social", desc: "Social media content calendar and community management.", owner: jakeSub },
        { id: WS_IDS[5], orgId: ORG_IDS[1], name: "Analytics & Reporting", desc: "Performance dashboards and weekly client reporting.", owner: carlosSub },
        // Lumen Home Solar
        { id: WS_IDS[6], orgId: ORG_IDS[2], name: "Lead Generation", desc: "Google Ads, landing pages, and lead capture forms.", owner: carlosSub },
        { id: WS_IDS[7], orgId: ORG_IDS[2], name: "Brand Awareness", desc: "Community events, PR, and brand partnership activations.", owner: jakeSub },
        { id: WS_IDS[8], orgId: ORG_IDS[2], name: "Client Reporting", desc: "Monthly ROI reports and client presentation decks.", owner: carlosSub },
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

    // 5. Task Boards (1 per workspace = 9 total)
    console.log("\nCreating Task Boards...");
    const boards = [
        // Brightwell Foods
        { id: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], name: "Q2 Product Launch", desc: "Campaign strategy and launch timeline for Brightwell's new product line.", owner: jakeSub },
        { id: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], name: "Ad Creatives", desc: "Creative asset production — video, display, and social ad units.", owner: jakeSub },
        { id: BOARD_IDS[2], wsId: WS_IDS[2], orgId: ORG_IDS[0], name: "Paid Social", desc: "Facebook, Instagram, and TikTok paid campaign management.", owner: priyaSub },
        // Apex Fitness Co
        { id: BOARD_IDS[3], wsId: WS_IDS[3], orgId: ORG_IDS[1], name: "Member Acquisition", desc: "Lead-to-member conversion funnel and promo campaigns.", owner: priyaSub },
        { id: BOARD_IDS[4], wsId: WS_IDS[4], orgId: ORG_IDS[1], name: "Social Calendar", desc: "Weekly social media content planning and scheduling.", owner: jakeSub },
        { id: BOARD_IDS[5], wsId: WS_IDS[5], orgId: ORG_IDS[1], name: "Weekly Dashboards", desc: "Client-facing performance dashboards updated every Monday.", owner: carlosSub },
        // Lumen Home Solar
        { id: BOARD_IDS[6], wsId: WS_IDS[6], orgId: ORG_IDS[2], name: "Google Ads", desc: "Search and display campaigns for solar lead generation.", owner: carlosSub },
        { id: BOARD_IDS[7], wsId: WS_IDS[7], orgId: ORG_IDS[2], name: "Community Events", desc: "Local community events, sponsorships, and grassroots outreach.", owner: jakeSub },
        { id: BOARD_IDS[8], wsId: WS_IDS[8], orgId: ORG_IDS[2], name: "Monthly ROI Reports", desc: "End-of-month performance analysis and ROI calculation.", owner: carlosSub },
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

    // 6. Tasks (4 per board = 36 total)
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
        // === Brightwell Foods ===

        // Q2 Product Launch (Board 1)
        { id: "meridian-task-001", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Finalize campaign brief with client", status: "DONE", priority: "URGENT", assignedTo: jakeSub, dueDate: inDays(-10) },
        { id: "meridian-task-002", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Develop target audience personas", status: "DONE", priority: "HIGH", assignedTo: carlosSub, dueDate: inDays(-5) },
        { id: "meridian-task-003", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Map out media mix and channel allocation", status: "IN_PROGRESS", priority: "HIGH", assignedTo: priyaSub, dueDate: inDays(-2) },
        { id: "meridian-task-004", boardId: BOARD_IDS[0], wsId: WS_IDS[0], orgId: ORG_IDS[0], title: "Present launch timeline to stakeholders", status: "TODO", priority: "MEDIUM", assignedTo: jakeSub, dueDate: inDays(12) },

        // Ad Creatives (Board 2)
        { id: "meridian-task-005", boardId: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Design hero banner for landing page", status: "DONE", priority: "HIGH", assignedTo: jakeSub, dueDate: inDays(-7) },
        { id: "meridian-task-006", boardId: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Write ad copy variations for A/B testing", status: "IN_PROGRESS", priority: "HIGH", assignedTo: carlosSub, dueDate: inDays(3) },
        { id: "meridian-task-007", boardId: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Produce 15-second video ad for Instagram", status: "TODO", priority: "URGENT", assignedTo: jakeSub, dueDate: inDays(7) },
        { id: "meridian-task-008", boardId: BOARD_IDS[1], wsId: WS_IDS[1], orgId: ORG_IDS[0], title: "Create display ad set in 5 standard sizes", status: "TODO", priority: "MEDIUM", assignedTo: jakeSub, dueDate: inDays(14) },

        // Paid Social (Board 3)
        { id: "meridian-task-009", boardId: BOARD_IDS[2], wsId: WS_IDS[2], orgId: ORG_IDS[0], title: "Set up Facebook campaign structure", status: "DONE", priority: "HIGH", assignedTo: priyaSub, dueDate: inDays(-4) },
        { id: "meridian-task-010", boardId: BOARD_IDS[2], wsId: WS_IDS[2], orgId: ORG_IDS[0], title: "Configure lookalike audiences from CRM data", status: "IN_PROGRESS", priority: "HIGH", assignedTo: priyaSub, dueDate: inDays(2) },
        { id: "meridian-task-011", boardId: BOARD_IDS[2], wsId: WS_IDS[2], orgId: ORG_IDS[0], title: "Launch TikTok awareness campaign", status: "TODO", priority: "MEDIUM", assignedTo: priyaSub, dueDate: inDays(8) },
        { id: "meridian-task-012", boardId: BOARD_IDS[2], wsId: WS_IDS[2], orgId: ORG_IDS[0], title: "Prepare week-1 performance snapshot", status: "TODO", priority: "LOW", assignedTo: carlosSub, dueDate: inDays(15) },

        // === Apex Fitness Co ===

        // Member Acquisition (Board 4)
        { id: "meridian-task-013", boardId: BOARD_IDS[3], wsId: WS_IDS[3], orgId: ORG_IDS[1], title: "Build landing page for summer promo", status: "DONE", priority: "URGENT", assignedTo: priyaSub, dueDate: inDays(-6) },
        { id: "meridian-task-014", boardId: BOARD_IDS[3], wsId: WS_IDS[3], orgId: ORG_IDS[1], title: "Set up email drip sequence for leads", status: "IN_PROGRESS", priority: "HIGH", assignedTo: carlosSub, dueDate: inDays(-1) },
        { id: "meridian-task-015", boardId: BOARD_IDS[3], wsId: WS_IDS[3], orgId: ORG_IDS[1], title: "Create referral program creative assets", status: "TODO", priority: "MEDIUM", assignedTo: jakeSub, dueDate: inDays(10) },
        { id: "meridian-task-016", boardId: BOARD_IDS[3], wsId: WS_IDS[3], orgId: ORG_IDS[1], title: "A/B test pricing page layouts", status: "TODO", priority: "HIGH", assignedTo: priyaSub, dueDate: inDays(9) },

        // Social Calendar (Board 5)
        { id: "meridian-task-017", boardId: BOARD_IDS[4], wsId: WS_IDS[4], orgId: ORG_IDS[1], title: "Draft June social content calendar", status: "DONE", priority: "HIGH", assignedTo: jakeSub, dueDate: inDays(-3) },
        { id: "meridian-task-018", boardId: BOARD_IDS[4], wsId: WS_IDS[4], orgId: ORG_IDS[1], title: "Shoot gym floor photo/video batch", status: "IN_PROGRESS", priority: "MEDIUM", assignedTo: jakeSub, dueDate: inDays(2) },
        { id: "meridian-task-019", boardId: BOARD_IDS[4], wsId: WS_IDS[4], orgId: ORG_IDS[1], title: "Schedule posts for Member Spotlight series", status: "TODO", priority: "MEDIUM", assignedTo: jakeSub, dueDate: inDays(6) },
        { id: "meridian-task-020", boardId: BOARD_IDS[4], wsId: WS_IDS[4], orgId: ORG_IDS[1], title: "Respond to comments and DMs from last week", status: "TODO", priority: "LOW", assignedTo: carlosSub, dueDate: inDays(1) },

        // Weekly Dashboards (Board 6)
        { id: "meridian-task-021", boardId: BOARD_IDS[5], wsId: WS_IDS[5], orgId: ORG_IDS[1], title: "Pull weekly ad spend and conversion data", status: "DONE", priority: "HIGH", assignedTo: carlosSub, dueDate: inDays(-2) },
        { id: "meridian-task-022", boardId: BOARD_IDS[5], wsId: WS_IDS[5], orgId: ORG_IDS[1], title: "Update client dashboard with new KPIs", status: "IN_PROGRESS", priority: "URGENT", assignedTo: carlosSub, dueDate: inDays(0) },
        { id: "meridian-task-023", boardId: BOARD_IDS[5], wsId: WS_IDS[5], orgId: ORG_IDS[1], title: "Analyze cost-per-lead trend over 4 weeks", status: "TODO", priority: "MEDIUM", assignedTo: priyaSub, dueDate: inDays(7) },
        { id: "meridian-task-024", boardId: BOARD_IDS[5], wsId: WS_IDS[5], orgId: ORG_IDS[1], title: "Prepare insights memo for client call", status: "TODO", priority: "HIGH", assignedTo: carlosSub, dueDate: inDays(5) },

        // === Lumen Home Solar ===

        // Google Ads (Board 7)
        { id: "meridian-task-025", boardId: BOARD_IDS[6], wsId: WS_IDS[6], orgId: ORG_IDS[2], title: "Research high-intent solar keywords", status: "DONE", priority: "HIGH", assignedTo: carlosSub, dueDate: inDays(-8) },
        { id: "meridian-task-026", boardId: BOARD_IDS[6], wsId: WS_IDS[6], orgId: ORG_IDS[2], title: "Build search campaign with ad extensions", status: "IN_PROGRESS", priority: "URGENT", assignedTo: priyaSub, dueDate: inDays(3) },
        { id: "meridian-task-027", boardId: BOARD_IDS[6], wsId: WS_IDS[6], orgId: ORG_IDS[2], title: "Design display remarketing banners", status: "TODO", priority: "MEDIUM", assignedTo: jakeSub, dueDate: inDays(9) },
        { id: "meridian-task-028", boardId: BOARD_IDS[6], wsId: WS_IDS[6], orgId: ORG_IDS[2], title: "Set up conversion tracking on lead forms", status: "TODO", priority: "HIGH", assignedTo: carlosSub, dueDate: inDays(5) },

        // Community Events (Board 8)
        { id: "meridian-task-029", boardId: BOARD_IDS[7], wsId: WS_IDS[7], orgId: ORG_IDS[2], title: "Secure booth at Green Living Expo", status: "DONE", priority: "URGENT", assignedTo: jakeSub, dueDate: inDays(-12) },
        { id: "meridian-task-030", boardId: BOARD_IDS[7], wsId: WS_IDS[7], orgId: ORG_IDS[2], title: "Design event booth graphics and handouts", status: "IN_PROGRESS", priority: "HIGH", assignedTo: jakeSub, dueDate: inDays(-3) },
        { id: "meridian-task-031", boardId: BOARD_IDS[7], wsId: WS_IDS[7], orgId: ORG_IDS[2], title: "Coordinate neighborhood solar workshop", status: "TODO", priority: "MEDIUM", assignedTo: carlosSub, dueDate: inDays(14) },
        { id: "meridian-task-032", boardId: BOARD_IDS[7], wsId: WS_IDS[7], orgId: ORG_IDS[2], title: "Partner with local HOAs for co-branded mailer", status: "TODO", priority: "LOW", assignedTo: jakeSub, dueDate: inDays(18) },

        // Monthly ROI Reports (Board 9)
        { id: "meridian-task-033", boardId: BOARD_IDS[8], wsId: WS_IDS[8], orgId: ORG_IDS[2], title: "Compile May lead gen performance data", status: "DONE", priority: "HIGH", assignedTo: carlosSub, dueDate: inDays(-1) },
        { id: "meridian-task-034", boardId: BOARD_IDS[8], wsId: WS_IDS[8], orgId: ORG_IDS[2], title: "Calculate cost-per-acquisition by channel", status: "IN_PROGRESS", priority: "HIGH", assignedTo: carlosSub, dueDate: inDays(3) },
        { id: "meridian-task-035", boardId: BOARD_IDS[8], wsId: WS_IDS[8], orgId: ORG_IDS[2], title: "Build ROI comparison chart vs. Q1", status: "TODO", priority: "MEDIUM", assignedTo: priyaSub, dueDate: inDays(8) },
        { id: "meridian-task-036", boardId: BOARD_IDS[8], wsId: WS_IDS[8], orgId: ORG_IDS[2], title: "Present monthly report to Lumen leadership", status: "TODO", priority: "URGENT", assignedTo: carlosSub, dueDate: inDays(10) },
    ];

    for (const t of tasks) {
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
            ownerUserSub: t.assignedTo || sarahSub,
            createdBy: sarahSub,
            dueDate: t.dueDate,
            isActive: true,
            completedAt: t.status === "DONE" ? new Date().toISOString() : undefined,
        });
        console.log(`  + Task: ${t.title} [${t.status}]`);
    }

    // 7. User Profiles
    // Sarah (admin) gets hasSeenWelcome: false so she goes through Welcome Page
    console.log("\nCreating User Profiles...");
    for (const user of DEMO_USERS) {
        await putItem("UserProfile", {
            userId: user.sub,
            tenantId: TENANT_ID,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            hasSeenWelcome: user.role === "TENANT_ADMIN" ? false : true,
        });
        console.log(`  + Profile: ${user.firstName} ${user.lastName} (${user.role})${user.role === "TENANT_ADMIN" ? " [hasSeenWelcome=false]" : ""}`);
    }

    // 8. Memberships (12 total)
    // Sarah (TENANT_ADMIN) → all 3 orgs
    // Jake (OWNER in Brightwell, MEMBER in Apex & Lumen)
    // Priya (MEMBER in Brightwell, OWNER in Apex, MEMBER in Lumen)
    // Carlos (MEMBER in all 3 orgs)
    console.log("\nCreating Memberships...");
    const memberships = [
        // Sarah — TENANT_ADMIN in all orgs
        { id: "meridian-mem-001", sub: sarahSub, role: "TENANT_ADMIN", orgId: ORG_IDS[0] },
        { id: "meridian-mem-002", sub: sarahSub, role: "TENANT_ADMIN", orgId: ORG_IDS[1] },
        { id: "meridian-mem-003", sub: sarahSub, role: "TENANT_ADMIN", orgId: ORG_IDS[2] },
        // Jake — OWNER in Brightwell, MEMBER in Apex & Lumen
        { id: "meridian-mem-004", sub: jakeSub, role: "OWNER", orgId: ORG_IDS[0] },
        { id: "meridian-mem-005", sub: jakeSub, role: "MEMBER", orgId: ORG_IDS[1] },
        { id: "meridian-mem-006", sub: jakeSub, role: "MEMBER", orgId: ORG_IDS[2] },
        // Priya — MEMBER in Brightwell, OWNER in Apex, MEMBER in Lumen
        { id: "meridian-mem-007", sub: priyaSub, role: "MEMBER", orgId: ORG_IDS[0] },
        { id: "meridian-mem-008", sub: priyaSub, role: "OWNER", orgId: ORG_IDS[1] },
        { id: "meridian-mem-009", sub: priyaSub, role: "MEMBER", orgId: ORG_IDS[2] },
        // Carlos — MEMBER in all orgs
        { id: "meridian-mem-010", sub: carlosSub, role: "MEMBER", orgId: ORG_IDS[0] },
        { id: "meridian-mem-011", sub: carlosSub, role: "MEMBER", orgId: ORG_IDS[1] },
        { id: "meridian-mem-012", sub: carlosSub, role: "MEMBER", orgId: ORG_IDS[2] },
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

    // 9. Audit Logs (~40 entries)
    console.log("\nCreating Audit Logs...");
    const agoMs = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

    const auditLogs = [
        // --- Logins (spread over past 2 weeks) ---
        { id: "meridian-audit-001", userId: sarahSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { email: "meridian.admin@tethertasks.com" } },
        { id: "meridian-audit-002", userId: jakeSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { email: "meridian.creative@tethertasks.com" } },
        { id: "meridian-audit-003", userId: priyaSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { email: "meridian.media@tethertasks.com" } },
        { id: "meridian-audit-004", userId: carlosSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[2], wsId: undefined, result: "SUCCESS", ts: agoMs(12), meta: { email: "meridian.strategy@tethertasks.com" } },

        // --- Org creation ---
        { id: "meridian-audit-005", userId: sarahSub, action: "CREATE", resourceType: "Organization", resourceId: ORG_IDS[0], orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { name: "Brightwell Foods" } },
        { id: "meridian-audit-006", userId: sarahSub, action: "CREATE", resourceType: "Organization", resourceId: ORG_IDS[1], orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { name: "Apex Fitness Co" } },
        { id: "meridian-audit-007", userId: sarahSub, action: "CREATE", resourceType: "Organization", resourceId: ORG_IDS[2], orgId: ORG_IDS[2], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { name: "Lumen Home Solar" } },

        // --- Workspace creation ---
        { id: "meridian-audit-008", userId: jakeSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[0], orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(13), meta: { name: "Campaign Strategy" } },
        { id: "meridian-audit-009", userId: jakeSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[1], orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(13), meta: { name: "Creative Production" } },
        { id: "meridian-audit-010", userId: priyaSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[2], orgId: ORG_IDS[0], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(13), meta: { name: "Media Buying" } },
        { id: "meridian-audit-011", userId: priyaSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[3], orgId: ORG_IDS[1], wsId: WS_IDS[3], result: "SUCCESS", ts: agoMs(12), meta: { name: "Growth Marketing" } },
        { id: "meridian-audit-012", userId: jakeSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[4], orgId: ORG_IDS[1], wsId: WS_IDS[4], result: "SUCCESS", ts: agoMs(12), meta: { name: "Content & Social" } },
        { id: "meridian-audit-013", userId: carlosSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[5], orgId: ORG_IDS[1], wsId: WS_IDS[5], result: "SUCCESS", ts: agoMs(12), meta: { name: "Analytics & Reporting" } },
        { id: "meridian-audit-014", userId: carlosSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[6], orgId: ORG_IDS[2], wsId: WS_IDS[6], result: "SUCCESS", ts: agoMs(11), meta: { name: "Lead Generation" } },
        { id: "meridian-audit-015", userId: jakeSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[7], orgId: ORG_IDS[2], wsId: WS_IDS[7], result: "SUCCESS", ts: agoMs(11), meta: { name: "Brand Awareness" } },
        { id: "meridian-audit-016", userId: carlosSub, action: "CREATE", resourceType: "Workspace", resourceId: WS_IDS[8], orgId: ORG_IDS[2], wsId: WS_IDS[8], result: "SUCCESS", ts: agoMs(11), meta: { name: "Client Reporting" } },

        // --- Board creation ---
        { id: "meridian-audit-017", userId: jakeSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[0], orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(12), meta: { name: "Q2 Product Launch" } },
        { id: "meridian-audit-018", userId: jakeSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[1], orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(12), meta: { name: "Ad Creatives" } },
        { id: "meridian-audit-019", userId: priyaSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[2], orgId: ORG_IDS[0], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(12), meta: { name: "Paid Social" } },
        { id: "meridian-audit-020", userId: priyaSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[3], orgId: ORG_IDS[1], wsId: WS_IDS[3], result: "SUCCESS", ts: agoMs(11), meta: { name: "Member Acquisition" } },
        { id: "meridian-audit-021", userId: jakeSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[4], orgId: ORG_IDS[1], wsId: WS_IDS[4], result: "SUCCESS", ts: agoMs(11), meta: { name: "Social Calendar" } },
        { id: "meridian-audit-022", userId: carlosSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[5], orgId: ORG_IDS[1], wsId: WS_IDS[5], result: "SUCCESS", ts: agoMs(11), meta: { name: "Weekly Dashboards" } },
        { id: "meridian-audit-023", userId: carlosSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[6], orgId: ORG_IDS[2], wsId: WS_IDS[6], result: "SUCCESS", ts: agoMs(10), meta: { name: "Google Ads" } },
        { id: "meridian-audit-024", userId: jakeSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[7], orgId: ORG_IDS[2], wsId: WS_IDS[7], result: "SUCCESS", ts: agoMs(10), meta: { name: "Community Events" } },
        { id: "meridian-audit-025", userId: carlosSub, action: "CREATE", resourceType: "TaskBoard", resourceId: BOARD_IDS[8], orgId: ORG_IDS[2], wsId: WS_IDS[8], result: "SUCCESS", ts: agoMs(10), meta: { name: "Monthly ROI Reports" } },

        // --- Member invitations ---
        { id: "meridian-audit-026", userId: sarahSub, action: "INVITE", resourceType: "Membership", resourceId: "meridian-mem-004", orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { invitedEmail: "meridian.creative@tethertasks.com", role: "OWNER" } },
        { id: "meridian-audit-027", userId: sarahSub, action: "INVITE", resourceType: "Membership", resourceId: "meridian-mem-007", orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { invitedEmail: "meridian.media@tethertasks.com", role: "MEMBER" } },
        { id: "meridian-audit-028", userId: sarahSub, action: "INVITE", resourceType: "Membership", resourceId: "meridian-mem-010", orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(14), meta: { invitedEmail: "meridian.strategy@tethertasks.com", role: "MEMBER" } },
        { id: "meridian-audit-029", userId: sarahSub, action: "INVITE", resourceType: "Membership", resourceId: "meridian-mem-005", orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "meridian.creative@tethertasks.com", role: "MEMBER" } },
        { id: "meridian-audit-030", userId: sarahSub, action: "INVITE", resourceType: "Membership", resourceId: "meridian-mem-008", orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "meridian.media@tethertasks.com", role: "OWNER" } },
        { id: "meridian-audit-031", userId: sarahSub, action: "INVITE", resourceType: "Membership", resourceId: "meridian-mem-011", orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "meridian.strategy@tethertasks.com", role: "MEMBER" } },
        { id: "meridian-audit-032", userId: sarahSub, action: "INVITE", resourceType: "Membership", resourceId: "meridian-mem-006", orgId: ORG_IDS[2], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "meridian.creative@tethertasks.com", role: "MEMBER" } },
        { id: "meridian-audit-033", userId: sarahSub, action: "INVITE", resourceType: "Membership", resourceId: "meridian-mem-009", orgId: ORG_IDS[2], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "meridian.media@tethertasks.com", role: "MEMBER" } },
        { id: "meridian-audit-034", userId: sarahSub, action: "INVITE", resourceType: "Membership", resourceId: "meridian-mem-012", orgId: ORG_IDS[2], wsId: undefined, result: "SUCCESS", ts: agoMs(13), meta: { invitedEmail: "meridian.strategy@tethertasks.com", role: "MEMBER" } },

        // --- Task creation (key tasks) ---
        { id: "meridian-audit-035", userId: jakeSub, action: "CREATE", resourceType: "Task", resourceId: "meridian-task-001", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(10), meta: { title: "Finalize campaign brief with client", board: "Q2 Product Launch" } },
        { id: "meridian-audit-036", userId: priyaSub, action: "CREATE", resourceType: "Task", resourceId: "meridian-task-009", orgId: ORG_IDS[0], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(9), meta: { title: "Set up Facebook campaign structure", board: "Paid Social" } },
        { id: "meridian-audit-037", userId: priyaSub, action: "CREATE", resourceType: "Task", resourceId: "meridian-task-013", orgId: ORG_IDS[1], wsId: WS_IDS[3], result: "SUCCESS", ts: agoMs(9), meta: { title: "Build landing page for summer promo", board: "Member Acquisition" } },
        { id: "meridian-audit-038", userId: carlosSub, action: "CREATE", resourceType: "Task", resourceId: "meridian-task-025", orgId: ORG_IDS[2], wsId: WS_IDS[6], result: "SUCCESS", ts: agoMs(9), meta: { title: "Research high-intent solar keywords", board: "Google Ads" } },

        // --- Task assignments ---
        { id: "meridian-audit-039", userId: jakeSub, action: "ASSIGN", resourceType: "Task", resourceId: "meridian-task-003", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(8), meta: { title: "Map out media mix and channel allocation", assignedTo: "Priya Desai" } },
        { id: "meridian-audit-040", userId: priyaSub, action: "ASSIGN", resourceType: "Task", resourceId: "meridian-task-014", orgId: ORG_IDS[1], wsId: WS_IDS[3], result: "SUCCESS", ts: agoMs(7), meta: { title: "Set up email drip sequence for leads", assignedTo: "Carlos Vega" } },
        { id: "meridian-audit-041", userId: carlosSub, action: "ASSIGN", resourceType: "Task", resourceId: "meridian-task-026", orgId: ORG_IDS[2], wsId: WS_IDS[6], result: "SUCCESS", ts: agoMs(6), meta: { title: "Build search campaign with ad extensions", assignedTo: "Priya Desai" } },

        // --- Task status updates (completions) ---
        { id: "meridian-audit-042", userId: jakeSub, action: "UPDATE", resourceType: "Task", resourceId: "meridian-task-001", orgId: ORG_IDS[0], wsId: WS_IDS[0], result: "SUCCESS", ts: agoMs(10), meta: { title: "Finalize campaign brief with client", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "meridian-audit-043", userId: jakeSub, action: "UPDATE", resourceType: "Task", resourceId: "meridian-task-005", orgId: ORG_IDS[0], wsId: WS_IDS[1], result: "SUCCESS", ts: agoMs(7), meta: { title: "Design hero banner for landing page", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "meridian-audit-044", userId: priyaSub, action: "UPDATE", resourceType: "Task", resourceId: "meridian-task-009", orgId: ORG_IDS[0], wsId: WS_IDS[2], result: "SUCCESS", ts: agoMs(4), meta: { title: "Set up Facebook campaign structure", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "meridian-audit-045", userId: priyaSub, action: "UPDATE", resourceType: "Task", resourceId: "meridian-task-013", orgId: ORG_IDS[1], wsId: WS_IDS[3], result: "SUCCESS", ts: agoMs(6), meta: { title: "Build landing page for summer promo", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "meridian-audit-046", userId: carlosSub, action: "UPDATE", resourceType: "Task", resourceId: "meridian-task-025", orgId: ORG_IDS[2], wsId: WS_IDS[6], result: "SUCCESS", ts: agoMs(8), meta: { title: "Research high-intent solar keywords", field: "status", from: "IN_PROGRESS", to: "DONE" } },
        { id: "meridian-audit-047", userId: jakeSub, action: "UPDATE", resourceType: "Task", resourceId: "meridian-task-029", orgId: ORG_IDS[2], wsId: WS_IDS[7], result: "SUCCESS", ts: agoMs(12), meta: { title: "Secure booth at Green Living Expo", field: "status", from: "IN_PROGRESS", to: "DONE" } },

        // --- Recent logins ---
        { id: "meridian-audit-048", userId: sarahSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(1), meta: { email: "meridian.admin@tethertasks.com" } },
        { id: "meridian-audit-049", userId: jakeSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[0], wsId: undefined, result: "SUCCESS", ts: agoMs(0), meta: { email: "meridian.creative@tethertasks.com" } },
        { id: "meridian-audit-050", userId: priyaSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[1], wsId: undefined, result: "SUCCESS", ts: agoMs(0), meta: { email: "meridian.media@tethertasks.com" } },
        { id: "meridian-audit-051", userId: carlosSub, action: "LOGIN", resourceType: "Session", resourceId: TENANT_ID, orgId: ORG_IDS[2], wsId: undefined, result: "SUCCESS", ts: agoMs(0), meta: { email: "meridian.strategy@tethertasks.com" } },
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

    console.log("\n✅ Meridian Agency demo seeding complete!");
    console.log(`\nDemo login credentials:`);
    console.log(`  Admin (Sarah Chen):     meridian.admin@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Creative (Jake):        meridian.creative@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Media (Priya):          meridian.media@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`  Strategy (Carlos):      meridian.strategy@tethertasks.com / ${DEMO_PASSWORD}`);
    console.log(`\n  Sarah will see the Welcome Page with agreement notes on first login.\n`);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanup() {
    console.log("\n🧹 Cleaning up MERIDIAN AGENCY demo environment...\n");
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
        ...Array.from({ length: 36 }, (_, i) => [
            "Task",
            { id: `meridian-task-${String(i + 1).padStart(3, "0")}` },
        ] as [string, Record<string, any>]),
        ...Array.from({ length: 12 }, (_, i) => [
            "Membership",
            { id: `meridian-mem-${String(i + 1).padStart(3, "0")}` },
        ] as [string, Record<string, any>]),
        ...Array.from({ length: 51 }, (_, i) => [
            "AuditLog",
            { id: `meridian-audit-${String(i + 1).padStart(3, "0")}` },
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

    console.log("\n✅ Meridian Agency demo cleanup complete!\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const isCleanup = process.argv.includes("--cleanup");

(isCleanup ? cleanup() : seed()).catch((err) => {
    console.error("\n❌ Error:", err.message || err);
    process.exit(1);
});
