# Business Rules Document (BRD) - Microfrontend Ticket Management System

## Step-by-Step Implementation Guide

**Version:** 2.2.0

**Target Audience:** AI Coding Agents, Software Architects, Full-Stack Engineers

**System Type:** Enterprise Issue Tracking & Support System

## PHASE 1: Data Architecture & Database Setup (Prisma & Postgres)

### Step 1.1: Database Schema Definition

Implement the following Prisma schema (`schema.prisma`):

```prisma
enum Role {
  ADMIN
  AGENT
  USER
}

enum UserStatus {
  PENDING_VERIFICATION
  ACTIVE
  DISABLED
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  PENDING_USER_RESPONSE
  RESOLVED
  CLOSED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum CloseReason {
  RESOLVED
  NO_RESPONSE
  CANCELED
  DUPLICATED
}

enum ReassignmentStatus {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id                    String                @id @default(uuid())
  email                 String                @unique
  passwordHash          String?
  firstName             String
  lastName              String
  role                  Role
  status                UserStatus            @default(PENDING_VERIFICATION)
  verificationToken     String?               @unique
  verificationTokenExpiry DateTime?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt

  submittedTickets      Ticket[]              @relation("TicketReporter")
  assignedTickets       Ticket[]              @relation("TicketAssignee")
  comments              TicketComment[]
  reassignmentRequests  ReassignmentRequest[] @relation("RequestingAgent")
}

model Department {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tickets     Ticket[]
}

model Ticket {
  id                   String                @id @default(uuid())
  ticketNumber         Int                   @unique @default(autoincrement())
  title                String
  description          String
  status               TicketStatus          @default(OPEN)
  priority             TicketPriority        @default(MEDIUM)
  closeReason          CloseReason?
  reporterId           String
  reporter             User                  @relation("TicketReporter", fields: [reporterId], references: [id])
  assigneeId           String?
  assignee             User?                 @relation("TicketAssignee", fields: [assigneeId], references: [id])
  departmentId         String
  department           Department            @relation(fields: [departmentId], references: [id])
  attachments          Attachment[]
  comments             TicketComment[]
  reassignmentRequests ReassignmentRequest[]
  lastActivityAt       DateTime              @default(now())
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt
}

model Attachment {
  id        String   @id @default(uuid())
  filename  String
  fileUrl   String
  mimeType  String
  ticketId  String
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model TicketComment {
  id        String   @id @default(uuid())
  content   String
  ticketId  String
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
}

model ReassignmentRequest {
  id            String             @id @default(uuid())
  ticketId      String
  ticket        Ticket             @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  requesterId   String
  requester     User               @relation("RequestingAgent", fields: [requesterId], references: [id])
  targetAgentId String?
  reason        String
  status        ReassignmentStatus @default(PENDING)
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
}

model SystemConfig {
  key         String   @id
  value       String
  description String?
  updatedAt   DateTime @updatedAt
}
```

## PHASE 2: Backend Architecture & Core Modules (NestJS)

### Step 2.1: Authentication & Onboarding Implementation

#### 1. Setup Status Endpoint (`GET /api/v1/auth/setup-status`)
* Returns `{ isSetupAllowed: boolean }` based on `COUNT(User) === 0`.

#### 2. First-User Bootstrap (`POST /api/v1/auth/setup`)
* **Route Constraint:** The `/setup` endpoint is exposed strictly when `COUNT(User) === 0` in the database.
* **Action:** Allows public registration of a single user via this route.
* **Post-Condition:** Upon successful creation, the user is assigned the role `ADMIN` and marked as `status: ACTIVE`.
* **Permanent Lockout:** Any subsequent request MUST evaluate `COUNT(User) > 0` and return `HTTP 403 Forbidden` with error code `SETUP_ALREADY_COMPLETED`.

#### 3. Login Endpoint (`POST /api/v1/auth/login`)
* Authenticate user, return JWT bearer token.
* **Authentication Guard:** Login attempts by users with status `PENDING_VERIFICATION` MUST fail with `HTTP 401 Unauthorized` and message `"Account verification pending"`.

#### 4. Account Activation Endpoint (`POST /api/v1/auth/verify`)
* Validate `verificationToken` exists and is not expired.
* Hash password using bcrypt (min 10 rounds).
* Set `status = ACTIVE`.
* Invalidate `verificationToken`.

### Step 2.2: User Management & RBAC Guard Setup

#### 1. Public Signup Restriction
* Self-registration is strictly forbidden after initial setup. Public registration routes must return `HTTP 403 Forbidden`.

#### 2. Admin User Provisioning (`POST /api/v1/admin/users`)
* **Access:** Only users with `ADMIN` role.
* **Payload:** `email`, `firstName`, `lastName`, `role` (`USER` | `AGENT`).
* **Account State:** Newly created accounts are saved with `status: PENDING_VERIFICATION` and a secure, time-limited `verificationToken` (24-hour expiration).
* **Trigger:** Dispatches activation email via Resend containing URL (`/verify-account?token={token}`).

#### 3. Role Hierarchy & Permissions Matrix Rules

| Action / Route | USER | AGENT | ADMIN |
| :--- | :--- | :--- | :--- |
| Complete Initial System Setup (`/setup`) | ❌ (If users > 0) | ❌ (If users > 0) | ❌ (If users > 0) |
| Create User / Agent | ❌ | ❌ | ✅ |
| Manage Categories / Departments | ❌ | ❌ | ✅ |
| Configure System Settings (e.g., Inactivity N Days) | ❌ | ❌ | ✅ |
| Create Ticket (Triggers Load-Balanced Auto-Assignment) | ✅ | ✅ | ✅ |
| View Ticket Queue | Own Tickets Only | All System Tickets | All System Tickets |
| Assign / Reassign Ticket directly | ❌ | ❌ | ✅ |
| Submit Reassignment Request | ❌ | ✅ | ❌ |
| Approve/Reject Reassignment Request | ❌ | ❌ | ✅ |
| Resolve Ticket directly | ❌ | ✅ | ✅ |
| Close Own Ticket (Requires Close Reason) | ✅ | ❌ | ✅ |
| Reopen Ticket (Strictly from `RESOLVED` status) | ✅ | ❌ | ✅ |
| Add Comment / Reply | Ticket Owner | Assigned / Any Agent | ✅ |

### Step 2.3: Ticket Lifecycle & State Machine Engine

#### 1. State Transitions & Rules

```
              [ Ticket Created ]
                      |
           (Auto Load-Balanced Assign)
                      |
                      v
                   +------+
                   | OPEN | <-------------------+
                   +------+                     |
                      |                         |
             (Agent Starts Work)          (User Reopens
                      |                   from RESOLVED)
                      v                         |
               +-------------+                  |
               | IN_PROGRESS |                  |
               +-------------+                  |
                 |         |                    |
  (Wait User)   |         | (Resolve)          |
                v         v                     |
   +-----------------------+     +----------+   |
   | PENDING_USER_RESPONSE | --> | RESOLVED | --+
   +-----------------------+     +----------+
              |                       |
      (Inactivity Cron)       (Inactivity Cron / User Close)
        [NO_RESPONSE]               [RESOLVED]
              |                       |
              +----------+------------+
                         |
                         v
                    +--------+
                    | CLOSED |  <-- (TERMINAL STATE: CANNOT BE REOPENED)
                    +--------+
```

* **Creation:** Initial state MUST be `OPEN`. Upon creation, trigger the Load-Balanced Auto-Assignment Algorithm.
* **In Progress:** Transitioned when the assigned Agent or Admin begins active work.
* **Pending User Response:** Set by Agent when requesting clarification from the `USER`.
* **Resolved:** Set by `AGENT` or `ADMIN` when issue resolution is complete.
* **Closed:**
  * Can be explicitly performed by `USER` or `ADMIN`. Requires setting a `closeReason`: `RESOLVED`, `NO_RESPONSE`, `CANCELED`, or `DUPLICATED`.
  * System automatically sets status to `CLOSED` when `NOW() - lastActivityAt > N_DAYS`.
    * If auto-closing a ticket with prior status `RESOLVED`, `closeReason` MUST be set to `RESOLVED`.
    * If auto-closing a ticket with prior status `PENDING_USER_RESPONSE`, `closeReason` MUST be set to `NO_RESPONSE`.
* **Reopening Rules:**
  * **From `RESOLVED`:** Reopening is permitted strictly for ticket owner (`USER`) or `ADMIN` if ticket is in `RESOLVED` status and has not yet transitioned to `CLOSED`. Reopening transitions state back to `OPEN` and resets `closeReason` to `null`.
  * **From `CLOSED`:** `CLOSED` is a **terminal state**. Once a ticket is in `CLOSED` status, it **CANNOT** be reopened by any user role (`USER`, `AGENT`, or `ADMIN`) under any circumstances. Users MUST submit a new ticket.

#### 2. Load-Balanced Auto-Assignment Algorithm Logic (`POST /api/v1/tickets`)

1. **Scope:** Query all active agents (`role = AGENT` and `status = ACTIVE`).
2. **Active Workload Calculation:** For each active agent, calculate current active ticket count ($W$), where active ticket status $\in [\text{'OPEN'}, \text{'IN\_PROGRESS'}, \text{'PENDING\_USER\_RESPONSE'}]$.
3. **Selection Rule:** Select agent with lowest active workload ($W$).
   * **Tie-Breaking Rule:** Select agent least recently assigned a ticket (or fallback to deterministic tie-breaker like minimum `createdAt` / `id`).
4. **Assignment Execution:**
   * Set `ticket.assigneeId = selectedAgent.id`.
   * Dispatch Resend email notification to `selectedAgent.email`.
5. **Fallback Strategy (No Available Agents & Admin Alert):**
   * If no active agents exist, `ticket.assigneeId` is set to `null` (unassigned).
   * Ticket remains in `OPEN` status.
   * **Admin Alert:** Dispatch urgent Resend email alert to **ALL `ADMIN` users** (`Action Required: Unassigned Ticket Created [#{ticketNumber}]`).

#### 3. Agent Reassignment Workflow

* **Direct Admin Assignment:** `PATCH /api/v1/tickets/:id/assign` requiring `assigneeId` payload (`ADMIN` only).
* **Agent Reassignment Request:** `POST /api/v1/tickets/:id/reassignment-request` with `targetAgentId` (optional) and `reason` (required string). Generates `ReassignmentRequest` record with status `PENDING` and alerts `ADMIN` users via Resend.
* **Admin Resolution:** `PATCH /api/v1/admin/reassignment-requests/:requestId`
  * `APPROVE`: Sets `ReassignmentRequest.status = APPROVED`, updates `Ticket.assigneeId`, notifies newly assigned agent.
  * `REJECT`: Sets `ReassignmentRequest.status = REJECTED`.

### Step 2.4: Automatic Inactivity Scheduler (Cron Worker)

* **Configurable Property:** System key `INACTIVITY_DAYS_BEFORE_CLOSE` stored in `SystemConfig` table (default: `7`).
* **Execution Schedule:** NestJS `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` task.
* **Execution Logic:**
  * **Rule A (Resolved Tickets):** For tickets with `status = 'RESOLVED'` and `NOW() - lastActivityAt > N_DAYS`:
    * Set `status = 'CLOSED'`
    * Set `closeReason = 'RESOLVED'`
  * **Rule B (Pending User Response Tickets):** For tickets with `status = 'PENDING_USER_RESPONSE'` and `NOW() - lastActivityAt > N_DAYS`:
    * Set `status = 'CLOSED'`
    * Set `closeReason = 'NO_RESPONSE'`
* **Action Details:** Update matching records, set `lastActivityAt = NOW()`, and generate a system log comment on each ticket recording the automatic closure.

### Step 2.5: Resend Email Notification Event Matrix

Implement transactional email triggers for the following events:

| Triggering Event | Recipient | Email Subject / Template Target | Included Data |
| :--- | :--- | :--- | :--- |
| **Account Invitation** | New User / Agent | `Account Invitation - Verify Your Email` | Activation Link, Token Expiry |
| **Ticket Created** | Ticket Creator (`USER`) | `Ticket Received: [#{ticketNumber}] {title}` | Ticket ID, Summary, Status |
| **Ticket Auto-Assigned** | Assigned `AGENT` | `Ticket Assigned to You: [#{ticketNumber}]` | Ticket ID, Reporter Name, Priority |
| **Ticket Could Not Be Auto-Assigned** | All `ADMIN` Users | `Action Required: Unassigned Ticket Created [#{ticketNumber}]` | Ticket ID, Reporter Name, Department, Direct Assign Link |
| **New Comment by Agent** | Ticket Reporter (`USER`) | `New Response on Ticket [#{ticketNumber}]` | Comment Snippet, Link to Ticket |
| **New Comment by User** | Assigned `AGENT` | `User Replied to Ticket [#{ticketNumber}]` | Comment Snippet, Link to Ticket |
| **Ticket Resolved** | Ticket Reporter (`USER`) | `Ticket Resolved: [#{ticketNumber}]` | Resolution Details, Reopen Link |
| **Ticket Closed** | Ticket Reporter (`USER`) | `Ticket Closed: [#{ticketNumber}] ({closeReason})` | Final Ticket Status & Close Reason |
| **Reassignment Requested** | All `ADMIN` Users | `Action Required: Reassignment Request` | Ticket ID, Requester, Reason |

*Note: Admins DO NOT receive notifications on general ticket creation when auto-assignment succeeds. Admins ONLY receive a ticket creation email when auto-assignment fails (unassigned ticket) so they can manually assign it.*

### Step 2.6: REST API Endpoint Catalog

#### Auth & Setup
* `GET /api/v1/auth/setup-status`
* `POST /api/v1/auth/setup`
* `POST /api/v1/auth/login`
* `POST /api/v1/auth/verify`

#### Admin Operations (`Roles: ADMIN`)
* `POST /api/v1/admin/users`
* `GET /api/v1/admin/reassignment-requests`
* `PATCH /api/v1/admin/reassignment-requests/:id`
* `GET /POST /PUT /DELETE /api/v1/admin/departments`
* `GET /PATCH /api/v1/admin/config`

#### Tickets Management (`Roles: USER, AGENT, ADMIN`)
* `POST /api/v1/tickets`
* `GET /api/v1/tickets`
* `GET /api/v1/tickets/:id`
* `PATCH /api/v1/tickets/:id/status`
* `PATCH /api/v1/tickets/:id/assign`
* `POST /api/v1/tickets/:id/reassignment-request`
* `POST /api/v1/tickets/:id/comments`

## PHASE 3: Frontend Architecture, Microfrontend & UI Setup

### Step 3.1: Styling Engine, Responsive Design & Shadcn UI Integration

#### 1. Responsive Design Mandate
* All user interfaces (Shell, Agent Remote, and Admin Remote) MUST be strictly responsive, adapting seamlessly across mobile, tablet, and desktop breakpoints (`sm:`, `md:`, `lg:`, `xl:`).
* Tables and data grids must support collapsible/scrollable views on smaller mobile screens.

#### 2. Tailwind CSS v4 Installation & CSS Configuration
* Install `@tailwindcss/vite` and `tailwindcss` (v4.0+).
* Configure global CSS stylesheet (`src/index.css`) across Shell and Remotes:

```css
@import "tailwindcss";

@variant dark (&:where(.dark, .dark *));

@theme {
  --color-primary-50: #f0f9ff;
  --color-primary-500: #0284c7;
  --color-primary-600: #0369a1;
  --color-primary-700: #075985;
}
```

#### 3. Light / Dark Theme Mode Mechanics
* **Theme State:** Managed via `useThemeStore` in Zustand (`'light' | 'dark' | 'system'`).
* **DOM Syncing:** The Shell application injects or removes the `.dark` class on `document.documentElement` (`<html>` element) whenever the theme state changes.
* **Persistence:** Theme selection is saved in `localStorage.getItem('theme-mode')`.
* **Remote Compatibility:** Remote components inherit theme styling natively through standard Tailwind v4 `dark:` variant classes applied relative to the parent `.dark` root container.

#### 4. Shadcn UI Component Tooling
* `shadcn` CLI is added as a **development dependency** (`devDependencies`) to quickly generate accessible component primitives (Dialogs, Dropdowns, Buttons, Form Controls, Tables, Badges) built on Radix UI primitives into the workspace.

### Step 3.2: Shared UI Package (`@shared/ui`) & Module Federation Setup

#### 1. Internal Shared UI Package (`packages/shared-ui` or `@shared/ui`)
* To avoid duplication and ensure visual consistency across the Shell and Remote applications, all reusable UI primitives generated via `shadcn` and standard layout elements are housed in a shared workspace package (`@shared/ui`).
* **Package Contents:**
  * UI Primitives: `Button`, `Input`, `Select`, `Dialog`, `Badge`, `DropdownMenu`, `Card`, `Table`, `Toast`.
  * Common Layout Components: Navbar Shell Header, Theme Toggle Switch, Page Wrapper.
  * Utility Functions: `cn()` class merge utility (`clsx` + `tailwind-merge`).

#### 2. Module Federation Shared Dependencies Configuration
Configure Vite Module Federation (`@originjs/vite-plugin-federation`) across Shell and Remotes with shared singletons:

```javascript
// Shared dependencies in vite.config.js
shared: {
  react: { singleton: true, eager: true },
  'react-dom': { singleton: true, eager: true },
  'react-router': { singleton: true, eager: true },
  zustand: { singleton: true, eager: true },
  '@tanstack/react-query': { singleton: true, eager: true },
  '@shared/ui': { singleton: true, eager: true }
}
```

### Step 3.3: Shell Application Implementation

#### 1. Shared Zustand Stores (Singletons)
* **`useAuthStore`:** Handles JWT storage (`localStorage`/`sessionStorage`), token decode, user profile state, `login()`, `logout()`, and `checkAuth()` actions.
* **`useToastStore`:** Manages toast messages, alert queues, and UI notification events.
* **`useThemeStore`:** Controls light/dark theme toggling (`theme: 'light' | 'dark' | 'system'`, `setTheme()`).

#### 2. Shell Navigation & Routing (`react-router`)
* Mobile-responsive Header / Navbar includes Theme Switcher Toggle (Light / Dark mode button) and responsive hamburger drawer navigation for mobile screens.
* `/setup` -> Setup view (Guarded by DB user count flag).
* `/login` -> Authentication view.
* `/verify-account` -> Password entry & activation view.
* `/tickets/new` & `/tickets/my` -> User issue report & track views.
* `/agent/*` -> Lazy-loads `agent-dashboard` remote container.
* `/admin/*` -> Lazy-loads `admin-dashboard` remote container.

### Step 3.4: Agent Dashboard Remote Implementation

* **Remote Manifest:** `http://localhost:5001/assets/remoteEntry.js`
* **Exposed Module:** `./AgentApp`
* **Features & Views (Responsive Tailwind v4 & Shadcn Dark/Light Styled):**
  * All Tickets Queue View (Responsive data table with filtering, search, and status badges).
  * Ticket Detail & Resolution View (Threaded comments, priority indicators, and status action buttons).
  * Reassignment Request Modal Component.

### Step 3.5: Admin Dashboard Remote Implementation

* **Remote Manifest:** `http://localhost:5002/assets/remoteEntry.js`
* **Exposed Module:** `./AdminApp`
* **Features & Views (Responsive Tailwind v4 & Shadcn Dark/Light Styled):**
  * User/Agent Provisioning Interface.
  * Assignment Requests Manager (Approve/Reject).
  * Department/Category CRUD Manager.
  * System Configuration Screen (`INACTIVITY_DAYS_BEFORE_CLOSE` setting).