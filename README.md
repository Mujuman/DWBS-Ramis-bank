# Rammis Bank — Digital Whistleblowing System (DWBS)

> **ሓሚስ ባንከ • Baankii Raammis • Flow to the highest!**

A production-ready, high-security Digital Whistleblowing System built for Rammis Bank on a React + Node.js + MySQL stack.

---

## 🏗️ Project Structure

```
DWBS system/
├── client/          # React frontend (Vite + Tailwind CSS v4)
├── server/          # Node.js + Express API backend
├── database/        # MySQL DDL schema (schema.sql)
└── .env.example     # Environment configuration template
```

---

## 🚀 Quick Start

### 1. Configure Environment
```bash
# Copy and edit the environment file
copy .env.example server\.env
# Fill in DB credentials, AD/LDAP details, SMTP, etc.
```

### 2. Set Up Database
```bash
# Run as MySQL root
mysql -u root -p < database/schema.sql
```

### 3. Start Backend
```bash
cd server
npm run dev
# API runs on http://localhost:5000
```

### 4. Start Frontend
```bash
cd client
npm run dev
# UI runs on http://localhost:5173
```

---

## 🔐 Authentication Modes

| Mode | Method | Token | Expiry |
|---|---|---|---|
| **Anonymous** | CAPTCHA → session token | Random 96-char hex | 30 minutes |
| **Corporate Staff** | LDAP/AD bind → JWT | RS256 signed JWT | 15 min access / 7d refresh |

---

## 👥 Role-Based Access

| Role | Permissions |
|---|---|
| `Employee` | Submit reports, view own submissions |
| `Branch_Manager` | Same as Employee |
| `Investigator` | View/manage assigned cases, add notes |
| `Compliance_Officer` | Full case access, stats,  |
| `CEO` | Executive dashboard, all stats |
| `System_Admin` | Full system access, user management |

---

## 🛡️ Security Features

- **AES-256-CBC** file encryption at rest
- **EXIF metadata stripping** from all images before storage
- **No IP logging** for anonymous sessions (SHA-256 hash only for forensic audit)
- **LDAPS (TLS)** Active Directory authentication
- **SMTP STARTTLS** (port 587) for email notifications
- **Helmet.js** security headers (CSP, HSTS, X-Frame-Options)
- **Rate limiting** on all auth endpoints (10 req / 15 min)
- **DOMPurify XSS** sanitization on all inputs
- **Parameterized SQL** queries only (no string interpolation)
- **INSERT-only DB user** for AuditLogs (immutable records)
- **PII-masked** Morgan logger (no bodies, tokens, or names logged)

---

## 📊 Database Tables

| Table | Purpose |
|---|---|
| `Users` | Corporate staff (auth via AD, no passwords stored) |
| `AnonymousSessions` | 30-min CAPTCHA-verified tokens, no IP |
| `Cases` | Primary case registry with random `reference_id` |
| `EvidenceFiles` | AES-256 encrypted file metadata |
| `InvestigationNotes` | Two-way correspondence (is_internal_only filter) |
| `AuditLogs` | Immutable event log (INSERT-only privilege) |

---

## 📡 API Endpoints

```
POST   /api/auth/anonymous       → Init anonymous session (CAPTCHA)
POST   /api/auth/login           → Staff AD login → JWT
POST   /api/auth/refresh         → Refresh access token
GET    /api/auth/me              → Current user info

GET    /api/cases/track          → Track case by reference_id (public)
GET    /api/cases/stats          → Executive stats (CEO+)
POST   /api/cases                → Submit case (anon or staff)
GET    /api/cases                → List cases (role-filtered)
GET    /api/cases/:id            → Case detail
PATCH  /api/cases/:id/status     → Update status/priority/assignment

POST   /api/cases/:id/evidence   → Upload encrypted evidence
GET    /api/cases/:id/evidence   → List evidence files
GET    /api/cases/:id/evidence/:fileId/download → Decrypt & download

POST   /api/cases/:id/notes      → Add note
GET    /api/cases/:id/notes      → Get correspondence

GET    /api/users                → List users (Admin)
PATCH  /api/users/:id/role       → Change role (System_Admin)
PATCH  /api/users/:id/active     → Activate/deactivate user

GET    /api/audit                → Immutable audit log
```

---

## 📦 Dependencies

### Frontend
- React 18 + Vite + Tailwind CSS v4
- react-router-dom, axios, react-hook-form
- recharts (executive charts), framer-motion
- lucide-react, react-dropzone, react-hot-toast

### Backend
- Express.js, Helmet, CORS, express-rate-limit
- mysql2, jsonwebtoken, ldapjs
- multer, sharp (EXIF strip), isomorphic-dompurify
- nodemailer (STARTTLS SMTP), axios (SMS gateway)
- winston, morgan

---

## ⚙️ Configuration

See [`.env.example`](.env.example) for all required environment variables including:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `AD_URL`, `AD_BASE_DN`, `AD_BIND_DN`, `AD_BIND_PASSWORD`
- `BANK_SMTP_HOST`, `BANK_SMTP_USER`, `BANK_SMTP_PASSWORD`
- `SMS_GATEWAY_URL`, `SMS_GATEWAY_API_KEY`
- `FILE_ENC_KEY` (64-char hex = 32 bytes AES-256 key)
- `HCAPTCHA_SECRET`

---

*Rammis Bank S.C. — Internal Use Only*
