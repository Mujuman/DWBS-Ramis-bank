# DWBS Role-Based Access Control (RBAC) Matrix

## Overview
The Digital Whistleblowing System (DWBS) implements a hierarchical role-based access control system with 7 distinct roles, each with specific permissions aligned with their organizational responsibilities.

---

## 1. Anonymous Reporter (Whistleblower)

**Database Role:** N/A (No account required)  
**Authentication:** Session token after hCAPTCHA verification

### Description
Anyone (staff, customer, supplier, or public) who wants to report misconduct without revealing their identity.

### Key Features
- Complete anonymity with IP address protection
- No login or personal information required
- Secure session-based access

### Permissions
| Action | Access | Notes |
|--------|--------|-------|
| Submit whistleblowing report | ✅ Yes | After CAPTCHA verification |
| Upload evidence files | ✅ Yes | Photos, documents, etc. |
| Track case progress | ✅ Yes | Using secret Reference ID & Token |
| Add notes/messages to own case | ✅ Yes | Communicate with investigators |
| View own case details | ✅ Yes | Status, updates, investigator responses |
| View other cases | ❌ No | Strict isolation |
| Access staff portal | ❌ No | |

### Technical Details
- **Session Duration:** 30 minutes
- **IP Logging:** Completely blocked
- **Authentication Method:** Anonymous session token
- **API Endpoints:** `/api/auth/anonymous`, `/api/cases` (POST), `/api/cases/track`

---

## 2. Employee (Staff Reporter)

**Database Role:** `Employee`  
**Authentication:** Active Directory (LDAP) or local password

### Description
Official Rammis Bank employees who choose to report issues using their authenticated account.

### Key Features
- Can report with full identity or request anonymity
- Personal case history dashboard
- Two-way communication with investigators

### Permissions
| Action | Access | Notes |
|--------|--------|-------|
| Submit authenticated reports | ✅ Yes | Name visible to investigators (unless flagged anonymous) |
| View own submitted cases | ✅ Yes | Personal dashboard |
| Upload evidence to own cases | ✅ Yes | |
| Add notes to own cases | ✅ Yes | |
| View all cases | ❌ No | Only own submissions |
| Access case management | ❌ No | |
| Access executive dashboard | ❌ No | |
| Manage users | ❌ No | |

### Technical Details
- **Default Landing Page:** `/dashboard`
- **Authentication Method:** LDAP or local password
- **Case Visibility:** Own cases only

---

## 3. Branch Manager

**Database Role:** `Branch_Manager`  
**Authentication:** Active Directory (LDAP) or local password

### Description
Managers responsible for specific bank branches or office departments.

### Key Features
- Receives alerts for cases involving their branch
- View-only access to branch-specific cases
- Can provide context and supporting documents

### Permissions
| Action | Access | Notes |
|--------|--------|-------|
| View branch-specific cases | ✅ Yes | Only cases assigned to their branch |
| Add notes to branch cases | ✅ Yes | Provide context |
| Upload supporting documents | ✅ Yes | |
| Modify case status | ❌ No | Read-only access |
| View other branches' cases | ❌ No | Strict branch isolation |
| Assign investigators | ❌ No | |
| Access audit logs | ❌ No | |

### Technical Details
- **Case Filter:** `branch_or_dept` matches manager's department
- **Access Level:** View-only (restricted medium)
- **Notifications:** Automatic alert when case involves their branch

---

## 4. Investigator (Compliance Team)

**Database Role:** `Investigator`  
**Authentication:** Active Directory (LDAP) or local password

### Description
Official compliance team members assigned to investigate and resolve reported cases.

### Key Features
- Full read/write access to assigned cases
- Can change case status and severity
- Two-way communication with reporters
- Evidence management

### Permissions
| Action | Access | Notes |
|--------|--------|-------|
| View all assigned cases | ✅ Yes | |
| View case evidence files | ✅ Yes | Download and review |
| Download evidence | ✅ Yes | |
| Update case status | ✅ Yes | New → Under Review → Investigating → Resolved → Closed |
| Change severity level | ✅ Yes | Low, Medium, High, Critical |
| Add internal investigation notes | ✅ Yes | Marked as internal-only |
| Message reporters | ✅ Yes | Request additional information |
| Assign cases to self | ✅ Yes | |
| Delete cases | ❌ No | Immutable audit trail |
| View unassigned cases | ✅ Yes | To pick up new work |
| Modify audit logs | ❌ No | Read-only audit trail |

### Technical Details
- **Default Landing Page:** `/dashboard`
- **Case Visibility:** All cases (role-filtered in backend)
- **API Routes:** Full access to `/api/cases`, `/api/evidence`, `/api/notes`

---

## 5. Compliance Officer

**Database Role:** `Compliance_Officer`  
**Authentication:** Active Directory (LDAP) or local password

### Description
Senior compliance role with oversight of all investigations and access to executive reporting.

### Key Features
- Full access to all cases (assigned and unassigned)
- Executive dashboard access
- User management oversight
- Audit log access

### Permissions
| Action | Access | Notes |
|--------|--------|-------|
| View all cases | ✅ Yes | System-wide visibility |
| Manage all cases | ✅ Yes | Status, assignments, severity |
| View executive statistics | ✅ Yes | Charts, trends, KPIs |
| View audit logs | ✅ Yes | Full audit trail access |
| Download evidence | ✅ Yes | All cases |
| View user list | ✅ Yes | For compliance oversight |
| Modify user roles | ❌ No | Only System Admin |
| Delete cases | ❌ No | Immutable records |
| Clear audit logs | ❌ No | Permanent audit trail |

### Technical Details
- **Default Landing Page:** `/executive` or `/dashboard`
- **Access Level:** High (full oversight)
- **Routes:** `/cases`, `/executive`, `/audit`, `/users` (read-only)

---

## 6. CEO (Chief Executive Officer)

**Database Role:** `CEO`  
**Authentication:** Active Directory (LDAP) or local password

### Description
Highest executive with read-only access to all statistics and critical cases.

### Key Features
- Executive dashboard with charts and KPIs
- Automatic alerts for Critical cases
- Read-only access to protect investigation integrity
- Audit log visibility

### Permissions
| Action | Access | Notes |
|--------|--------|-------|
| View executive dashboard | ✅ Yes | Charts, statistics, trends |
| View all case statistics | ✅ Yes | Aggregated data |
| View critical cases | ✅ Yes | Auto-notified for Critical severity |
| View audit logs | ✅ Yes | Oversight and accountability |
| View case details | ✅ Yes | Read-only |
| Modify cases | ❌ No | Read-only to prevent interference |
| Assign investigators | ❌ No | |
| Manage users | ❌ No | |
| Delete data | ❌ No | |

### Technical Details
- **Default Landing Page:** `/executive`
- **Access Level:** High (read-only dashboard)
- **Notifications:** Automatic for `severity_level = 'Critical'`
- **Routes:** `/executive`, `/cases` (read-only), `/audit`

---

## 7. System Administrator

**Database Role:** `System_Admin`  
**Authentication:** Local password (not LDAP)

### Description
IT professional responsible for system maintenance and user management.

### Key Features
- Full user account management
- System configuration access
- **Cannot** access case content (ethical wall)
- **Cannot** modify audit logs

### Permissions
| Action | Access | Notes |
|--------|--------|-------|
| Create user accounts | ✅ Yes | |
| Deactivate user accounts | ✅ Yes | When staff leave |
| Change user roles | ✅ Yes | All 7 roles |
| Reset passwords | ✅ Yes | Local accounts only |
| View user list | ✅ Yes | |
| Access admin panel | ✅ Yes | `/admin` route |
| View audit logs | ✅ Yes | System oversight |
| View case content | ❌ No | **Ethical wall** - cannot read investigation details |
| Modify audit logs | ❌ No | Immutable audit trail |
| Delete cases | ❌ No | |

### Technical Details
- **Default Landing Page:** `/admin`
- **Access Level:** Technical admin (user management)
- **Authentication:** Local password (not LDAP) for emergency access
- **Blocked Routes:** Case detail content (can see metadata only)
- **Routes:** `/admin`, `/users`, `/audit`

---

## 8. Auditor

**Database Role:** `Auditor`  
**Authentication:** Local password

### Description
Independent internal or external auditor responsible for compliance oversight.

### Key Features
- Read-only access to all audit logs
- Advanced filtering and export capabilities
- No access to live case management
- Complete independence from operations

### Permissions
| Action | Access | Notes |
|--------|--------|-------|
| View all audit logs | ✅ Yes | Complete audit trail |
| Filter audit logs | ✅ Yes | By action, user, date, case |
| Export audit logs (CSV) | ✅ Yes | For compliance reports |
| View case metadata | ✅ Yes | For audit purposes (via logs) |
| View user activity | ✅ Yes | Investigator actions logged |
| Modify audit logs | ❌ No | Immutable records |
| Access case management | ❌ No | Pure audit oversight |
| Manage users | ❌ No | |
| Modify cases | ❌ No | |

### Technical Details
- **Default Landing Page:** `/audit`
- **Access Level:** Audit read-only
- **Authentication:** Local password (independent from AD)
- **Routes:** `/audit` only
- **Export:** CSV format with all log fields

---

## Role Hierarchy & Comparison

```
┌─────────────────────────────────────────────────────────────┐
│                    Access Level Pyramid                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                          CEO (Read-Only)                     │
│                    ┌──────────────────┐                     │
│                    │  System Admin    │                     │
│            ┌───────┴──────────────────┴───────┐             │
│            │   Compliance Officer              │             │
│        ┌───┴──────────────────┬────────────────┴───┐        │
│        │    Investigator       │     Auditor        │        │
│    ┌───┴──────────┬────────────┴────────┬───────────┴───┐   │
│    │ Branch Mgr   │      Employee       │   Anonymous   │   │
│    └──────────────┴─────────────────────┴───────────────┘   │
│         (Restricted)     (Limited)         (Public)          │
└─────────────────────────────────────────────────────────────┘
```

## Quick Permission Matrix

| Permission | Anon | Employee | Branch Mgr | Investigator | Compliance | CEO | Admin | Auditor |
|------------|------|----------|------------|--------------|------------|-----|-------|---------|
| Submit case | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View own cases | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View all cases | ❌ | ❌ | ⚠️* | ✅ | ✅ | ✅† | ❌ | ❌ |
| Modify case status | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign investigators | ❌ | ❌ | ❌ | ⚠️‡ | ✅ | ❌ | ❌ | ❌ |
| Download evidence | ✅§ | ✅§ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View statistics | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| View audit logs | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ⚠️** | ❌ | ✅ | ❌ |
| Export audit CSV | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Legend:**
- ✅ Full access
- ❌ No access
- ⚠️* Branch-specific cases only
- ⚠️‡ Can self-assign
- ✅§ Own case only
- ✅† Read-only
- ⚠️** View-only

---

## Authentication Methods

| Role | LDAP/AD | Local Password | Session Token |
|------|---------|----------------|---------------|
| Anonymous | ❌ | ❌ | ✅ (CAPTCHA) |
| Employee | ✅ | ⚠️* | ❌ |
| Branch_Manager | ✅ | ⚠️* | ❌ |
| Investigator | ✅ | ⚠️* | ❌ |
| Compliance_Officer | ✅ | ⚠️* | ❌ |
| CEO | ✅ | ⚠️* | ❌ |
| System_Admin | ❌ | ✅ | ❌ |
| Auditor | ❌ | ✅ | ❌ |

**⚠️* Local password** available for dev/testing or when LDAP unavailable

---

## Default Credentials (Testing)

| Username | Password | Role |
|----------|----------|------|
| `sysadmin` | `Admin@Rammis2025!` | System_Admin |
| `auditor` | `Admin@Rammis2025!` | Auditor |

**⚠️ SECURITY WARNING:** Change all default passwords immediately after first login in production!

---

## API Route Protection Summary

### Public Routes (No Auth)
- `POST /api/auth/anonymous` - Create anonymous session
- `GET /api/cases/track` - Track case with reference ID

### Authenticated Routes (Any Staff)
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/cases` - List cases (role-filtered)
- `GET /api/cases/:id` - View case details

### Role-Restricted Routes
- **Investigator+**: Update case status, view evidence
- **Compliance Officer+**: View executive stats, user list, audit logs
- **CEO**: Executive dashboard (read-only)
- **System Admin**: User management, role assignment
- **Auditor**: Audit logs (read-only with filters)

---

## Security Features

### 1. IP Address Protection (Anonymous)
- No IP addresses stored in database
- Network layer anonymization
- Session tokens cryptographically secure

### 2. Immutable Audit Trail
- All actions logged automatically
- Logs cannot be modified or deleted (even by admins)
- Timestamp and user tracking for accountability

### 3. Role-Based Middleware
- `requireRole(...roles)` enforces permissions
- JWT token validation
- Session expiry management

### 4. Ethical Walls
- System Admin cannot read case investigation details
- Auditors cannot modify operational data
- CEO has read-only access to prevent interference

### 5. Encryption
- LDAPS (LDAP over TLS) on port 636
- JWT tokens with strong secrets
- Password hashing with bcrypt (12 rounds)

---

## Best Practices

### For Development
1. Use the registration page (`/register`) to create test accounts
2. Test with multiple roles to verify permission boundaries
3. Check audit logs after each action

### For Production
1. Disable the `/register` endpoint (dev-only)
2. Change all default passwords immediately
3. Use Active Directory for all staff accounts except System Admin and Auditor
4. Regularly review audit logs for suspicious activity
5. Implement LDAPS with valid TLS certificates
6. Set up automated alerts for Critical cases
7. Configure proper database backups

---

## Support & Contact

For questions about roles and permissions:
- **Technical Issues:** Contact System Administrator
- **Access Requests:** Contact Compliance Officer or System Administrator
- **Audit Inquiries:** Contact Internal Audit Department

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-07  
**Maintained By:** DWBS Development Team  
**System:** Rammis Bank Digital Whistleblowing System (DWBS)
