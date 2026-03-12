# TetherTasks

**Multi-tenant task management platform for operators who run multiple companies.**

TetherTasks lets consultants, agencies, franchise operators, and serial entrepreneurs manage organizations, workspaces, task boards, and team execution from a single login. Built on AWS with role-based access control, data isolation, and tiered capacity planning.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features by Role](#features-by-role)
- [Data Model](#data-model)
- [Authentication & Authorization](#authentication--authorization)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Subscription Plans](#subscription-plans)
- [Key Patterns](#key-patterns)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19, TypeScript 5.9, Vite 7 |
| **Routing** | React Router DOM 7 |
| **State** | React Context (WorkspaceContext), Zustand |
| **UI** | Custom CSS design system, Lucide icons, Framer Motion |
| **Charts** | Recharts (Pie, Bar, responsive containers) |
| **Notifications** | Sonner (toast), custom NotificationBell |
| **Backend** | AWS Amplify Gen 2 (GraphQL + DynamoDB) |
| **Auth** | Amazon Cognito (groups + membership-based RBAC) |
| **Email** | AWS SES (invitations, task assignments, contact form) |
| **Functions** | 8 AWS Lambda functions for mutations |
| **Infrastructure** | AWS CDK via Amplify backend.ts |
| **Testing** | Playwright (E2E) |

---

## Architecture

```
Tenant
 └── Organization(s)
      └── Workspace(s)
           └── TaskBoard(s)
                └── Task(s)
```

**Hierarchy:** Platform > Tenant > Organization > Workspace > TaskBoard > Task

Each level provides data isolation. Memberships are scoped at the **organization level**, not workspace level. Users with memberships across multiple organizations can switch between them from one dashboard.

### Layered Frontend Architecture

```
┌──────────────────────────────────────────┐
│  Page Components (features/**)           │  Role-specific pages
├──────────────────────────────────────────┤
│  Modals & Shared Components             │  Self-contained CRUD modals
├──────────────────────────────────────────┤
│  Shell Layouts (layouts/*Shell.tsx)      │  Role-based sidebar + nav
├──────────────────────────────────────────┤
│  Context & Hooks                        │  WorkspaceContext, useTasks
├──────────────────────────────────────────┤
│  Libs & Utilities                       │  Auth, permissions, display
├──────────────────────────────────────────┤
│  AWS Amplify Data Client                │  GraphQL/DynamoDB via GSIs
└──────────────────────────────────────────┘
```

---

## Features by Role

### Platform Super Admin (`/super`)
- Tenant management (create, view, delete, audit)
- Global user directory across all tenants
- Replace tenant admin users
- Platform-wide audit logs and statistics
- Subscription management (Stripe integration)

### Tenant Admin (`/tenant`)
- **Control Center** dashboard with workspace/board/member stats
- Organization CRUD (create, edit, delete)
- Workspace management (scoped to organizations)
- Member invitations and role management
- User directory (tenant-wide)
- Task board overview (read-only kanban view)
- Audit trail for all tenant-level actions
- Plan usage monitoring with capacity limits

### Owner (`/owner`)
- Workspace-specific dashboard with KPI cards and charts
- Task board management (create, edit, delete boards)
- Full task lifecycle (create, assign, update status/priority, delete)
- Member invitations within organization
- Kanban board view with drag-and-drop columns

### Member (`/member`)
- Personal task dashboard
- Update task status (move through workflow)
- View workspace member directory
- View assigned task details

### General Member (`/general`)
- Multi-workspace overview for users with cross-org memberships
- Unified task view across workspaces
- Dynamic role resolution (inherits highest role)

---

## Data Model

### Core Entities

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **Tenant** | Top-level company account | `companyName`, `plan`, `status`, `stripeCustomerId` |
| **Organization** | Group within a tenant | `tenantId`, `name`, `description` |
| **Workspace** | Container for task boards | `organizationId`, `tenantId`, `ownerUserSub` |
| **Membership** | User-to-org role binding | `organizationId`, `userSub`, `role`, `status` |
| **Invitation** | Onboarding workflow | `email`, `organizationId`, `role`, `token`, `status` |
| **TaskBoard** | Kanban board | `workspaceId`, `organizationId`, `name` |
| **Task** | Individual work item | `taskBoardId`, `status`, `priority`, `assignedTo`, `dueDate` |
| **Notification** | In-app alerts | `recipientId`, `type`, `isRead` |
| **AuditLog** | Action tracking | `action`, `resourceType`, `userId`, `timestamp` |
| **UserProfile** | Display info | `userId`, `email`, `firstName`, `lastName` |

### Key Relationships

- Memberships are **organization-scoped** (`organizationId` is the key field, `workspaceId` is usually null)
- `Membership.role` is the **authoritative role source** (not `UserProfile.role`)
- Tasks belong to a TaskBoard, which belongs to a Workspace, which belongs to an Organization
- All entities carry `tenantId` for top-level isolation

### Global Secondary Indexes (GSIs)

Data access uses GSI-backed query methods for performance:
- `listMembershipsByUser` / `listMembershipsByOrganization` / `listMembershipsByWorkspace`
- `listTasksByOrganization` / `listTasksByWorkspace`
- `listTaskBoardsByOrganization`
- `listInvitesByEmail` / `listInvitesByOrganization`
- `listAuditLogsByTenant` / `listAuditLogsByUser`
- `listNotificationsByRecipient`

Avoid `Model.list({ filter })` for production queries — it does a DynamoDB Scan which is unreliable for large tables.

---

## Authentication & Authorization

### Login Flow

1. User signs in via custom login form (Cognito username/password)
2. `auth-redirect.tsx` checks Cognito groups and queries memberships
3. Routes to the correct shell based on role:
   - `PLATFORM_SUPER_ADMIN` group &rarr; `/super`
   - `TENANT_ADMIN` membership &rarr; `/tenant`
   - `OWNER` membership &rarr; `/owner`
   - `MEMBER` membership &rarr; `/member`
   - Multiple workspace roles &rarr; `/general`
4. Pending invitations redirect to acceptance pages
5. No memberships &rarr; `/no-access`

### Role Hierarchy

| Role | Scope | Can Assign Tasks | Can Create Tasks | Can Delete Tasks |
|------|-------|:---:|:---:|:---:|
| `PLATFORM_SUPER_ADMIN` | Platform | - | - | - |
| `TENANT_ADMIN` | Tenant | **No** | Yes | Yes |
| `OWNER` | Organization/Workspace | Yes | Yes | Yes |
| `MEMBER` | Workspace | No | No | No (update only) |

**Critical rule:** `TENANT_ADMIN` cannot be assigned tasks and is filtered from all assignment dropdowns.

### Authorization Layers

1. **Cognito Groups** — Platform admin detection only
2. **Membership table** — Role-based access for all other users
3. **DynamoDB auth rules** — Owner-based read/write/delete on Workspace, Task models
4. **UI permissions** — `tasksPermissions.ts` controls which buttons/actions are visible per role

---

## Project Structure

```
src/
├── App.tsx                              # Route definitions (all roles)
├── auth-redirect.tsx                    # Post-login smart router
├── config/
│   ├── tenantAdminNav.tsx               # Tenant admin sidebar nav
│   ├── ownerNav.tsx                     # Owner sidebar nav
│   ├── memberNav.tsx                    # Member sidebar nav
│   ├── generalMemberNav.tsx             # General member sidebar nav
│   ├── platformNav.tsx                  # Platform admin sidebar nav
│   ├── tasksPermissions.ts              # Role-based UI permissions
│   ├── industryTemplates.ts             # Pre-built board templates
│   └── ...
├── features/
│   ├── auth/pages/                      # Login, LandingPage, NoAccess, Suspended
│   ├── platform-admin/pages/            # Super admin pages
│   ├── tenant-admin/pages/              # Tenant admin pages
│   ├── owners/pages/                    # Owner pages
│   ├── members/pages/                   # Member pages
│   ├── tasks/pages/                     # Shared kanban board
│   ├── admin/pages/                     # User directory
│   └── general/pages/                   # Multi-workspace views
├── components/
│   ├── shared/modals/                   # 8 self-contained CRUD modals
│   └── ui/                              # NotificationBell, GlobalCreateTaskBtn
├── hooks/
│   ├── useTasks.ts                      # Load tasks/boards/members by scope
│   └── useGlobalNotifications.ts        # Notification polling
├── layouts/
│   ├── AppShell.tsx                     # Shared shell (sidebar, topbar, outlet)
│   ├── TenantAdminShell.tsx             # Tenant admin variant
│   ├── OwnerShell.tsx                   # Owner variant
│   ├── MemberShell.tsx                  # Member variant
│   └── GeneralMemberShell.tsx           # General member variant
├── libs/
│   ├── data-client.ts                   # Amplify GraphQL client
│   ├── planLimits.ts                    # Subscription tier capacity
│   ├── isOwner.ts / isMember.ts         # Role detection utilities
│   └── displayName.ts                   # User display helpers
├── shared-components/
│   └── workspace-context.tsx            # Central multi-tenant state provider
└── styles/
    ├── tokens.css                       # Design system tokens
    ├── layout.css                       # Shell/sidebar/topbar styles
    ├── pages.css                        # Dashboard, kanban, cards
    ├── components.css                   # Shared component styles
    ├── landing.css                      # Landing page styles
    ├── auth.css                         # Login/auth page styles
    ├── modal.css                        # Modal overlay styles
    └── notification.css                 # Notification bell/dropdown

amplify/
├── backend.ts                           # Infrastructure definition (CDK)
├── auth/resource.ts                     # Cognito configuration
├── data/resource.ts                     # GraphQL data model + GSIs
└── functions/
    ├── create-tenant-admin/             # Create Cognito user + admin group
    ├── invite-member-to-org/            # Invitation + Cognito user creation
    ├── delete-tenant/                   # Cascade delete tenant + Cognito user
    ├── replace-tenant-admin/            # Migrate admin group membership
    ├── send-assignment-email/           # Task assignment email via SES
    ├── notify-task-assignment/          # Async task notification
    ├── submit-contact-request/          # Contact form to admin email
    └── send-invite-email/              # Invitation email via SES
```

---

## Getting Started

### Prerequisites

- Node.js >= 20.20.0
- npm >= 10.8.0
- AWS Amplify CLI (for backend)
- AWS account with Cognito, DynamoDB, SES configured

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173` with hot module replacement.

### Build

```bash
npm run build
```

Runs TypeScript compilation (`tsc -b`) followed by Vite production build. Output goes to `dist/`.

---

## Environment Variables

Backend configuration is generated by Amplify into `amplify_outputs.json` (git-ignored). Lambda functions receive:

- `USER_POOL_ID` — Cognito user pool ID (injected via CDK in `backend.ts`)

No `.env` file is required for the frontend; all configuration comes from the Amplify outputs file.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

---

## Deployment

Deployed via **AWS Amplify Hosting** (Gen 2).

**CI/CD Pipeline:**
1. Push to GitHub triggers Amplify build
2. `npm install` &rarr; `tsc -b && vite build`
3. `dist/` directory deployed to Amplify hosting
4. Backend resources (Lambda, DynamoDB, Cognito) managed by Amplify

**Build configuration:** See `amplify.yml` in project root.

---

## Subscription Plans

| Plan | Organizations | Workspaces/Org | Members | Price |
|------|:---:|:---:|:---:|:---:|
| **Starter** | 1 | 1 | 5 | Free |
| **Professional** | 3 | 5 | 50 | $29/mo |
| **Enterprise** | 100 | 100 | Unlimited | $99/mo |

Limits are enforced at creation time in the UI. Plan data stored on the `Tenant` model with Stripe integration for billing (`stripeCustomerId`, `stripeSubscriptionId`).

---

## Key Patterns

### Membership Structure
- Memberships are created at the **organization** level, not workspace level
- `Membership.workspaceId` is usually null; `Membership.organizationId` is the key field
- When querying members, use `listMembershipsByOrganization({ organizationId })` from the board/task's `organizationId`

### Modal Architecture
- `CreateTaskModal` and `EditTaskModal` are self-contained
- They load their own workspace members internally
- Parents (TasksPage, GlobalCreateTaskButton) do NOT pass `members` as a prop

### Data Access
- Always use GSI-backed query methods instead of `Model.list({ filter })`
- DynamoDB Scans are unreliable at scale due to 1MB pagination limit before filters apply
- Schema secondary indexes are defined in `amplify/data/resource.ts`

### Workspace Context
- `WorkspaceProvider` wraps the entire app
- Manages tenant/organization/workspace selection with localStorage persistence
- `TENANT_ADMIN` role does not auto-select a workspace (lands on workspace grid)
- `refreshSession()` loads memberships and determines role on app mount

---

## License

Proprietary. All rights reserved.
