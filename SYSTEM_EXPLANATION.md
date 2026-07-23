# Rammis Bank — DWBS System File Explanation

> Digital Whistleblowing System — Complete file-by-file reference

---

## Project Overview

The DWBS is a secure, role-based whistleblowing platform for Rammis Bank.
It allows employees and the public to report misconduct (fraud, corruption, bribery, etc.)
anonymously or with identity. Reports go through a structured investigation workflow
managed by the Ethics & Anti-Corruption Office, Investigators, and the CEO.

**Stack:** React + Vite (frontend) · Node.js + Express (backend) · MySQL (database)

---

## Project Root

| File / Folder | Purpose |
|---|---|
| `client/` | React frontend — everything the user sees in the browser |
| `server/` | Node.js API backend — business logic, authentication, database |
| `database/` | MySQL schema SQL files and migration scripts |
| `.env.example` | Template showing all required environment variables |
| `README.md` | Quick-start guide and API endpoint reference |
| `ROLES.md` | Full RBAC (Role-Based Access Control) permission matrix |
| `DWBS_ARCHITECTURE.md` | Mermaid diagrams showing system and case flow |
| `check_hash.ps1` | PowerShell script to verify bcrypt password hashes |
| `run_sql.ps1` | PowerShell script to execute SQL files against the database |
| `fix_sysadmin.sql` | One-time SQL to fix the default sysadmin password hash |


---

## Frontend (`client/`)

### `client/index.html`
The single HTML entry point. Vite injects the compiled React bundle here.
Contains the `<div id="root">` mount point and favicon links.

### `client/vite.config.js`
Vite build configuration. Sets up the React plugin and a proxy so that
`/api` requests from the browser are forwarded to `http://localhost:5000`
during development — avoids CORS issues in dev.

### `client/.env`
Frontend environment variables. Contains `VITE_API_URL` and the
hCaptcha site key. These are embedded into the bundle at build time.

### `client/package.json`
Lists all frontend dependencies:
- `react`, `react-dom` — UI framework
- `react-router-dom` — client-side routing
- `axios` — HTTP client for API calls
- `recharts` — charts on the Executive Dashboard
- `framer-motion` — animations (navbar, notification panel)
- `lucide-react` — icon library
- `react-hot-toast` — toast notifications
- `date-fns` — date formatting
- `tailwindcss` — utility-first CSS framework


---

## Frontend Source (`client/src/`)

### `main.jsx`
React app entry point. Wraps the entire app in:
- `<BrowserRouter>` — enables client-side routing
- `<AuthProvider>` — provides global login state to all components
- `<Toaster>` — mounts the toast notification container

### `App.jsx`
Top-level router. Defines all routes and which component renders at each path.
Applies `<NavBar>` and `<Sidebar>` as persistent layout wrappers.
Protects routes by checking `user.role` from AuthContext.

### `App.css` / `index.css`
Global CSS. Defines CSS custom properties (colors, spacing),
Tailwind base styles, custom badge classes (`badge-new`, `badge-review`, etc.),
spinner animations, card/button/form component classes used across all pages.

---

## Pages (`client/src/pages/`)

### `LandingPage.jsx`
**Seen by:** Everyone (public, no login required)

The home page of the system. Shows the bank logo, a brief description,
and two call-to-action buttons — "Report Anonymously" and "Staff Login".
Also shows the "Track My Case" form for anonymous reporters to check status.

### `RegistrationPage.jsx`
**Seen by:** Anonymous reporters

The anonymous report submission form. Steps:
1. hCaptcha verification → creates an anonymous session
2. Category and description input with rich text
3. Optional evidence file upload
4. On submit → receives a `reference_id` and `verification_token` to track the case


### `TrackCasePage.jsx`
**Seen by:** Anonymous reporters

Lets a reporter check the status and read messages on their case
using the `reference_id` and `verification_token` they received when submitting.
Also allows the reporter to reply to investigator messages.

### `StaffLoginPage.jsx`
**Seen by:** All staff (Employees, Investigators, Ethics, CEO, Admin)

Login form for corporate staff. Sends username + password to `/api/auth/login`.
Backend authenticates via LDAP/Active Directory (or local bcrypt for sysadmin/auditor).
On success receives a JWT access token + refresh token stored in localStorage.

### `DashboardPage.jsx`
**Seen by:** Employee, Branch_Manager, Investigator

Personal dashboard. Shows cases submitted by (for reporters) or
assigned to (for investigators) the logged-in user.
Includes filters by status, category, and date.

### `CaseListPage.jsx`
**Seen by:** Investigator, Compliance_Officer, CEO, System_Admin

Full case list with search, filter, and sort. Role-filtered server-side:
- Investigators see only their assigned cases
- Ethics/CEO see all cases
- System_Admin sees metadata only (ethical wall)

### `CaseDetailPage.jsx`
**Seen by:** All staff roles with case access

The most complex page. Contains:
- Case header (reference ID, category, priority, status badge)
- Report description with rich text rendering
- **Correspondence & Notes** — chat section where staff send/receive messages.
  Shows edit/delete buttons on own messages. Hides historical messages on page load
  (only shows messages sent during the current session).
- **Evidence Files** — upload, list, and download encrypted evidence
- **Case Actions sidebar** — status dropdown, priority selector, investigator assignment
- All actions are permission-gated by role flags (`isSenior`, `isInvestigator`, `isCEO`)


### `ComplianceDashboard.jsx`
**Seen by:** Compliance_Officer (Ethics & Anti-Corruption Office)

The Ethics Office home page. Shows:
- Case statistics (total, by status, by category)
- Case list with quick-action buttons (review, assign, escalate to CEO)
- Chat panel for Ethics ↔ CEO communication
- Escalation tool to flag critical cases to the CEO

### `ExecutiveDashboard.jsx`
**Seen by:** CEO

Executive overview. Contains:
- 6 KPI cards (total reports, critical cases, in-progress, substantiated, avg resolution, high priority)
- Monthly trend line chart
- Cases by status bar chart
- Cases by category bar chart + distribution list
- **Critical Cases table** — only escalated cases with Assign/Reassign and Chat buttons
- **CEO ↔ Ethics Chat panel** — inline chat with the Ethics Office for a selected case.
  Only shows messages sent during the current session (hides old history).
  CEO can edit and delete their own messages.
- Assign Investigator modal

### `AdminPage.jsx`
**Seen by:** System_Admin

User management dashboard. Lists all staff accounts with role badges,
active/inactive status, and action buttons for role change, activation, and password reset.

### `AdminStaffAccountsPage.jsx`
**Seen by:** System_Admin

Detailed staff account management with filters and inline edit forms.

### `AdminCreateUserPage.jsx`
**Seen by:** System_Admin

Form to create a new staff account. Inputs: username, email, role, department, password.
Sends to `POST /api/users`.

### `AuditDashboard.jsx`
**Seen by:** CEO, System_Admin, Auditor

Read-only view of the immutable audit log. Shows every system event
(case created, status changed, note added, user login, etc.) with
filters by action, case ID, user, and date range.

### `SubmitReportPage.jsx`
**Seen by:** Authenticated staff reporters

Alternative report submission form for logged-in employees.
Similar to RegistrationPage but associates the report with the user's account.


---

## Components (`client/src/components/`)

### `NavBar.jsx`
Fixed top navigation bar present on every page. Contains:
- Hamburger menu toggle for the sidebar
- Rammis Bank logo (links to role-appropriate home page)
- **Notification Bell** — shows unread count badge, opens a dropdown panel
  that lists only unread notifications. Opening the panel marks all as read
  and clears the badge. Each notification links to the relevant case.
- User avatar with display name, role badge, and sign-out button

### `Sidebar.jsx`
Collapsible left sidebar. Navigation links differ by role:
- Employee/Branch Manager: My Reports, Submit Report
- Investigator: Cases, Dashboard
- Compliance_Officer: Compliance Dashboard, Cases, Audit Log
- CEO: Executive Dashboard, Cases, Audit Log
- System_Admin: Admin Panel, Users, Audit Log
- Auditor: Audit Log

---

## Context (`client/src/context/`)

### `AuthContext.jsx`
React Context that provides authentication state to the entire app.
Stores the decoded JWT payload (`user` object with `userId`, `role`, `display_name`, etc.).
Provides:
- `user` — current logged-in user or `null`
- `login(token)` — decodes JWT and stores in state + localStorage
- `logout()` — clears state and localStorage, redirects to landing page
- Auto-refreshes the access token before it expires using the refresh token

---

## Services (`client/src/services/`)

### `api.js`
Pre-configured Axios instance. All API calls go through this.
- Base URL: `/api` (proxied to backend in dev, direct in production)
- Request interceptor: attaches `Authorization: Bearer <token>` header
- Response interceptor: on 401 (token expired), automatically calls
  `POST /api/auth/refresh`, updates the stored token, and retries the original request


---

## Constants (`client/src/constants/`)

### `caseWorkflow.js`
Single source of truth for the case status machine on the frontend.
Mirrors `server/constants/caseWorkflow.js` exactly. Contains:

| Export | Purpose |
|---|---|
| `CASE_STATUSES` | Full list of all valid status strings |
| `TERMINAL_STATUSES` | Statuses that close a case (Substantiated, Dismissed, etc.) |
| `COMPLIANCE_OFFICER_STATUSES` | All statuses EAAC can set (all statuses) |
| `INVESTIGATOR_STATUSES` | Statuses Investigator can set |
| `CEO_STATUSES` | Statuses CEO can set (only `Assigned`) |
| `STATUS_LABELS` | Human-readable label for each status key |
| `STATUS_BADGE` | CSS badge class for each status |
| `getNextStatusesForRole(role, currentStatus)` | Returns valid next statuses for the dropdown |
| `isTerminalStatus(status)` | Returns true if the case is closed |
| `formatStatus(status)` | Converts status key to display label |

---

## Utils (`client/src/utils/`)

### `formatting.js`
Contains `renderRichText(text)`. Converts markdown-like syntax in note bodies
to safe HTML for display. Handles: `**bold**`, `_italic_`, `<u>underline</u>`,
`~~strikethrough~~`, `` `code` ``, ` ```code blocks``` `, `# heading`, `- list items`.
Output is sanitized before rendering via `dangerouslySetInnerHTML`.

---

## Backend (`server/`)

### `server.js`
The Express application entry point. Applies global middleware in order:
1. `helmet()` — sets security headers (CSP, HSTS, X-Frame-Options, etc.)
2. `cors()` — allows requests from the client origin defined in `.env`
3. `compression()` — gzip compresses responses
4. `morgan()` — request logger (PII fields masked)
5. `express.json()` — parses JSON request bodies
6. `rateLimit()` — limits requests per IP to prevent abuse
7. Mounts all routes under `/api`
8. Calls `testConnection()` to verify DB and run auto-migrations


---

## Backend Config (`server/config/`)

### `db.js`
Creates two MySQL connection pools:
- **`pool`** — main app pool (SELECT, INSERT, UPDATE) used by all controllers
- **`auditPool`** — INSERT-only pool for the audit user (cannot UPDATE or DELETE audit logs)

Also runs **auto-migrations** on every server start. Checks for missing columns/tables
and creates them if absent. Current migrations:
- `manager_help_requested` column on `cases`
- `deleted_at` column on `cases` (soft delete)
- `encryption_iv` and `mime_type` on `evidencefiles`
- `anon_session_id` on `cases`
- `is_escalated` on `cases`
- `sender_user_id` on `investigationnotes` (note ownership for edit/delete)
- `updated_at` on `investigationnotes`
- `notifications` table creation
- `notification_reads` table creation + legacy back-fill

### `ldap.js`
LDAP/Active Directory client configuration. Used by `authController.staffLogin`
to bind with staff credentials and verify identity against the bank's AD server.
Falls back to local bcrypt if AD is unavailable (for sysadmin and auditor).

### `smtp.js`
Nodemailer SMTP transporter using STARTTLS on port 587.
Used by `emailService.js` to send notification emails.

### `sms.js`
HTTP client for the bank's internal SMS gateway.
Used to send SMS alerts for critical case escalations.

---

## Backend Controllers (`server/controllers/`)

### `authController.js`
Handles all authentication:

| Function | Route | What it does |
|---|---|---|
| `initAnonymousSession` | `POST /auth/anonymous` | Verifies hCaptcha, creates a session token, stores in `anonymoussessions` |
| `staffLogin` | `POST /auth/login` | Binds to LDAP with credentials, issues JWT access + refresh tokens |
| `refreshToken` | `POST /auth/refresh` | Validates refresh token, issues new access token |
| `getMe` | `GET /auth/me` | Returns decoded user info from the JWT |
| `registerUser` | `POST /users` | System Admin creates a new staff account |
| `resetUserPassword` | `PATCH /users/:id/password` | System Admin resets a user's local password |


### `caseController.js`
The largest controller. Manages the full case lifecycle:

| Function | Route | What it does |
|---|---|---|
| `createCase` | `POST /cases` | Submits a new case. Auto-classifies severity by category. Notifies Ethics Office. |
| `listCases` | `GET /cases` | Returns paginated, role-filtered case list. Investigators see only assigned cases. |
| `getCaseById` | `GET /cases/:id` | Returns full case detail. Enforces ethical wall for System_Admin. |
| `editCase` | `PATCH /cases/:id` | Reporter edits their own description/branch. Staff edits status/severity. |
| `deleteCase` | `DELETE /cases/:id` | Soft-deletes a case. Requires justification (10+ chars). |
| `trackCase` | `GET /cases/track` | Public endpoint — returns case status and public notes by reference_id. |
| `getAnonymousCaseDetails` | `GET /cases/anonymous` | Returns full details to anonymous reporter using reference_id + token. |
| `updateCaseStatus` | `PATCH /cases/:id/status` | Updates status, priority, or assigned investigator. Validates transitions. |
| `getCaseStats` | `GET /cases/stats` | Returns aggregate KPIs for the Executive Dashboard. |
| `escalateCase` | `POST /cases/:id/escalate` | Ethics Office flags a case as critical and notifies the CEO. |
| `editCaseAnonymous` | `PATCH /cases/anonymous` | Anonymous reporter updates their report using reference_id + token. |
| `deleteCaseAnonymous` | `DELETE /cases/anonymous` | Anonymous reporter deletes their report. |
| `requestManagerHelp` | `POST /cases/:id/request-manager-help` | Investigator requests Branch Manager assistance. |

### `noteController.js`
Manages the correspondence/chat thread for each case:

| Function | Route | What it does |
|---|---|---|
| `createNote` | `POST /cases/:id/notes` | Adds a message. Determines `sender_type` and `audience_type` from role. Saves `sender_user_id` for ownership. |
| `createAnonNote` | `POST /cases/anonymous/notes` | Anonymous reporter replies using reference_id + token. |
| `getNotes` | `GET /cases/:id/notes` | Returns notes filtered by role visibility rules (each role sees only their relevant thread). |
| `updateNote` | `PATCH /cases/:id/notes/:noteId` | Edits a note body. Only the original sender (`sender_user_id`) may edit. |
| `deleteNote` | `DELETE /cases/:id/notes/:noteId` | Deletes a note. Only the original sender may delete. |

**Visibility rules by role:**
- **Reporter** — sees only notes addressed to `Reporter` or `General`
- **Investigator** — sees public notes + notes in the Investigator thread
- **Compliance_Officer** — sees all notes in their scope (all threads they participate in)
- **CEO** — sees only CEO thread (CEO↔Ethics messages + reporter→CEO messages)


### `evidenceController.js`
Manages evidence file uploads and downloads:

| Function | What it does |
|---|---|
| `uploadEvidence` | Accepts file upload, strips EXIF metadata (images), encrypts content with AES-256-CBC, saves to disk, stores metadata in DB |
| `listEvidence` | Returns file metadata list for a case |
| `downloadEvidence` | Decrypts file from disk, streams to client. Previews images/PDF in browser, downloads others. |
| `deleteEvidence` | Removes file from disk and DB |
| `uploadAnonymousEvidence` / `listAnonymousEvidence` / `downloadAnonymousEvidence` / `deleteAnonymousEvidence` | Same operations for anonymous reporters using session token |

### `notificationController.js`
Manages in-app notifications with per-user read state:

| Function | Route | What it does |
|---|---|---|
| `createNotification` | (internal) | Inserts a notification targeting a specific `user_id` or all users of a `target_role` |
| `getNotifications` | `GET /notifications` | Returns 30 most recent notifications for the user. Uses `notification_reads` JOIN to compute per-user `is_read`. |
| `getUnreadCount` | `GET /notifications/count` | Lightweight poll endpoint — returns total unread + breakdown by type |
| `markAsRead` | `PATCH /notifications/:id/read` | Inserts a row in `notification_reads` for this user (per-user, does not affect other users) |
| `markAllAsRead` | `PATCH /notifications/read-all` | Bulk-inserts read records for all unread notifications for this user |

**Why `notification_reads`?** Role-broadcast notifications (e.g. sent to all `Compliance_Officer` users)
are stored as one DB row with `target_role`. Without `notification_reads`, marking it read would
affect all users of that role. The separate table stores `(notification_id, user_id)` pairs so
each person has independent read state.

---

## Backend Middleware (`server/middleware/`)

### `auth.js`
Authentication and authorization middleware:

| Function | Purpose |
|---|---|
| `authenticateStaff` | Verifies JWT Bearer token. Attaches decoded `req.user` and `req.identity`. |
| `authenticateAnonymous` | Verifies anonymous session token from header. Attaches session to `req.identity`. |
| `authenticateAny` | Accepts either staff JWT or anonymous session. Used for case creation. |
| `requireRole(...roles)` | Returns middleware that blocks the request with 403 if `req.user.role` is not in the allowed list. |

### `sanitize.js`
Input validation and sanitization:

- `sanitizeRequestBody` — runs DOMPurify on every string in `req.body` recursively (strips all HTML/XSS)
- `handleValidationErrors` — reads express-validator results and returns 422 with details if any fail
- Validation chains: `validateLogin`, `validateCreateCase`, `validateStatusUpdate`, `validateCreateNote`, `validateCreateUser`, `validateTrackCase`, and more

### `upload.js`
File upload pipeline using Multer:
1. Accepts file with size limit (10 MB default)
2. `processAndSaveFile` middleware:
   - If image: uses `sharp` to strip all EXIF metadata (removes GPS, camera model, etc.)
   - Generates a random AES-256-CBC IV
   - Encrypts the file content using the `FILE_ENC_KEY` from `.env`
   - Saves the encrypted file to the `uploads/` directory
   - Stores file metadata (original name, encrypted path, IV, MIME type) in `evidencefiles`


---

## Backend Routes (`server/routes/index.js`)

Single file that registers all HTTP endpoints with their middleware chains.
Every route follows the pattern: `auth middleware → role check → validation → controller`.

**Route groups:**

| Group | Base path | Controller |
|---|---|---|
| Authentication | `/auth/*` | `authController` |
| Cases | `/cases/*` | `caseController` |
| Evidence | `/cases/:id/evidence/*` | `evidenceController` |
| Notes / Chat | `/cases/:id/notes/*` | `noteController` |
| Users | `/users/*` | inline + `authController` |
| Audit Log | `/audit` | inline |
| Notifications | `/notifications/*` | `notificationController` |

---

## Backend Constants (`server/constants/`)

### `caseWorkflow.js`
The authoritative case status machine used by the server. All status transition
validation happens here before any DB write.

| Export | Purpose |
|---|---|
| `CASE_STATUSES` | All valid status values stored in the DB |
| `TERMINAL_STATUSES` | Statuses that close a case for non-EAAC roles |
| `COMPLIANCE_OFFICER_STATUSES` | Full list — EAAC can set any status including reopening closed cases |
| `INVESTIGATOR_STATUSES` | Only investigation-phase statuses |
| `CEO_STATUSES` | Only `Assigned` |
| `STATUS_TRANSITIONS` | Map of `currentStatus → role → [allowedNextStatuses]` |
| `validateStatusTransition(role, current, new)` | Returns error string or null. EAAC can always override even terminal statuses. |
| `getNextStatusesForRole(role, current)` | Returns the array of valid next statuses for the dropdown |

**Current transition rules:**

| From | EAAC can go to | Investigator can go to | CEO can go to |
|---|---|---|---|
| New | Any | — | Assigned |
| Under Review | Any | — | Assigned |
| Assigned | Any | Investigating | Assigned |
| Investigating | Any | Pending Evidence, Substantiated, Dismissed | Assigned |
| Pending Evidence | Any | Investigating, Substantiated, Dismissed | Assigned |
| Substantiated *(terminal)* | Any except itself | ❌ Blocked | ❌ Blocked |
| Dismissed *(terminal)* | Any except itself | ❌ Blocked | ❌ Blocked |


---

## Backend Services (`server/services/`)

### `auditService.js`
`writeAuditLog({ userId, caseId, action, performedBy, performedByType, metadata })`
Writes every significant action to the `auditlogs` table using the INSERT-only
`auditPool` connection. This means no application code can ever UPDATE or DELETE
audit records — they are permanently immutable.

### `emailService.js`
Email notification functions sent via SMTP:

| Function | When sent |
|---|---|
| `notifyNewCaseToCompliance(email)` | New case submitted — alerts Ethics Office |
| `notifyAssignment(email)` | Investigator is assigned to a case |
| `notifyCEOEscalation(email, caseInfo)` | Case escalated to Critical — alerts CEO |
| `notifyAARCReferral(email, caseInfo)` | Case referred to A&RC or substantiated |

---

## Database (`database/`)

### `schema.sql`
The complete database definition. Creates all tables from scratch:

| Table | Columns | Purpose |
|---|---|---|
| `users` | user_id, username, email, password_hash, role, department, is_active | All staff accounts |
| `anonymoussessions` | session_id, session_token, captcha_verified, expires_at | Temporary reporter sessions |
| `cases` | case_id, reference_id, verification_token, reporter_type, user_id, category, branch_or_dept, severity_level, description, status, assigned_investigator, is_escalated, deleted_at, anon_session_id | Every whistleblowing report |
| `investigationnotes` | note_id, case_id, sender_type, audience_type, note_text, is_internal_only, created_at, sender_user_id, updated_at | All chat messages per case |
| `evidencefiles` | file_id, case_id, file_name, file_path, encryption_iv, uploaded_by, mime_type, uploaded_at | Encrypted file metadata |
| `notifications` | notification_id, user_id, target_role, type, title, message, case_id, is_read | In-app notification records |
| `notification_reads` | notification_id, user_id, read_at | Per-user read tracking |
| `auditlogs` | log_id, user_id, action, target_case_id, details, timestamp | Immutable event log |

Also seeds the default `sysadmin` and `auditor` accounts.

### Migration SQL files
Run once to add new columns/tables to an existing database:

| File | Adds |
|---|---|
| `add-note-audience-type.sql` | `audience_type` column to `investigationnotes` |
| `add-auditor-role.sql` | `Auditor` value to the `role` enum in `users` |
| `add-ceo-note-roles.sql` | `CEO` to sender/audience type enums in notes |
| `add-compliance-note-sender.sql` | `Compliance_Officer` as a note sender type |
| `migrate-compliance-workflow.sql` | Updates for the compliance workflow redesign |
| `add-notification-reads.sql` | Creates `notification_reads` table + back-fills from legacy `is_read` column |


---

## Security Architecture

### Authentication Flow

```
Anonymous Reporter:
  Browser → POST /auth/anonymous (captcha_token)
         → Backend verifies hCaptcha
         → Creates session in DB, returns session_token
         → Session token used in X-Session-Token header for all subsequent requests

Staff Member:
  Browser → POST /auth/login (username, password)
         → Backend binds to LDAP/AD with credentials
         → On success: issues JWT access token (15 min) + refresh token (7 days)
         → Access token stored in localStorage, sent as Authorization: Bearer
         → On 401: frontend automatically calls /auth/refresh → gets new access token
```

### File Encryption Flow

```
Upload:
  File → EXIF strip (images only, via sharp)
       → Generate random 16-byte IV
       → AES-256-CBC encrypt with FILE_ENC_KEY
       → Save encrypted bytes to uploads/ directory
       → Store: original_name, encrypted_path, IV, MIME type in DB

Download:
  Request → Read encrypted bytes from disk
          → Decrypt using FILE_ENC_KEY + stored IV
          → Stream decrypted bytes to client
          → Browser previews (image/PDF) or downloads (other)
```

### Note Visibility Rules

```
audience_type determines who can read a note:
  General       → visible to all staff + reporter
  Reporter      → visible to reporter + sending staff member
  Investigator  → visible to Investigator + Compliance_Officer
  Compliance_Officer → visible to Ethics + CEO + Investigator
  CEO           → visible to CEO + Compliance_Officer only

is_internal_only = 1 → completely hidden from reporter regardless of audience_type
```

---

## Role Summary

| Role | Home Page | Key Capabilities |
|---|---|---|
| **Anonymous Reporter** | LandingPage | Submit, track, reply to own case |
| **Employee / Branch_Manager** | DashboardPage | Submit report, view own cases, reply |
| **Investigator** | DashboardPage | View assigned cases, update status, chat, upload evidence |
| **Compliance_Officer (EAAC)** | ComplianceDashboard | Full case control, all status transitions, escalate to CEO, assign investigators |
| **CEO** | ExecutiveDashboard | View KPIs, critical cases, assign investigators on escalated cases, chat with Ethics |
| **System_Admin** | AdminPage | User management only — **cannot view case content (ethical wall)** |
| **Auditor** | AuditDashboard | Read-only audit log access only |

---

*Rammis Bank S.C. — Internal Use Only*
*DWBS Development Team — 2026*
