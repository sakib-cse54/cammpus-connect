# CampusConnect: Institutional Project Memory & Engineering History

**Specification Standard:** IEEE Std 830-1998 / ISO/IEC/IEEE 29148  
**Course:** Software Project Design and Development (Course Code: 416)  
**Last Updated:** October 31, 2026  

**Project Team & Academic Governance:**
- **Course Teacher & Academic Supervisor:** Al Imtiaz (Department of Computer Science and Engineering)
- **Team Leader & Software Engineering Lead:** Md. Shakhawat Hossain (Student ID: `0432320005101009`, Batch 54, Dept of CSE)
- **Software Engineer & Core Team Member:** Fahim Hossain (Student ID: `0432320005101007`, Dept of CSE, `fahim@university.edu`)
- **Faculty Advisor & Reviewer:** Jobair Ahammed (`jobair@university.edu`, Role: `FACULTY_ADVISOR`)
- **Platform Administrator:** Central IT Governance (`admin@university.edu`, Role: `ADMIN`)

---

## 1. Project Overview & Architecture
CampusConnect is an institutional, full-stack university club, event, and activity management platform. It replaces informal social media groups and paper forms with:
1. **Relational Core (11 Tables):** Strictly normalized entities (`users`, `student_profiles`, `clubs`, `club_memberships`, `events`, `registrations`, `attendance_records`, `certificates`, `announcements`, `notifications`, `feedback`, `audit_logs`).
2. **ACID Concurrency Seat Booking:** Guarantees capacity limits under simultaneous registration bursts with automated FIFO waitlist promotion upon cancellation.
3. **Anti-Proxy Dynamic Rotating QR Attendance:** 20-second rolling HMAC-SHA256 window preventing screenshot sharing.
4. **Cryptographically Signed Certificates:** Tamper-proof PDF generation with embedded SHA-256 fingerprint and public non-authenticated validation portal (`/verify/:serialNumber`).
5. **Role-Based Portals:** Tailored workflows for Students, Club Executives, Faculty Advisors, and System Administrators.

---

## 2. Chronological Record of Changes (Start to End)

### Phase 1: Team Member Integration Across Specifications
- **IEEE SRS Specification (`docs/CampusConnect_SRS_v2.md`):** Updated Section 1.1 purpose and Section 1.6 Project Engineering Team table to formally introduce Fahim Hossain as Lead Software Engineer alongside Advisor Jobair Ahammed.
- **SRS Review Document (`docs/CampusConnect_SRS_Review.md`):** Added executive summary metadata and verified alignment with IEEE Std 830-1998.
- **Automated Generator Script (`scripts/generate_srs_docs.py`):** Enhanced python-docx styling (soft gray table headers `#F1F5F9`, bold black text, Times New Roman body text) and regenerated `docs/CampusConnect_SRS_v2.docx` and `docs/CampusConnect_SRS_v2.pdf`.
- **Project Root Index (`README.md`):** Documented project directory tree, engineering team roles, and quick start guides.

### Phase 2: Relational Backend Service Implementation (`server/`)
- **Monorepo Setup:** Configured root `package.json` with npm workspaces (`server`, `client`) and `docker-compose.yml` for PostgreSQL 16 and Redis 7.
- **Data Layer (`server/src/db/`):**
  - Created schema DDL (`schema.sql`) for all 11 relational tables with foreign keys and check constraints.
  - Implemented hybrid database client (`db/index.ts`) supporting PostgreSQL with automatic SQLite fallback.
  - Implemented seed database script (`seed.ts`) pre-populating Fahim Hossain, Jobair Ahammed, Admin, clubs, events, registrations, attendance, feedback, and audit records.
- **Core Business Logic Services (`server/src/services/`):**
  - `qrService.ts`: HMAC-SHA256 sliding window generator and validator (+/- 20s skew tolerance).
  - `certificateService.ts`: PDFKit vector generator producing certificates with embedded verification QR code and SHA-256 binary hash.
- **Security & Middleware (`server/src/middleware/`):**
  - `auth.ts`: JWT authentication with 4-tier RBAC guard.
  - `audit.ts`: Immutable security audit trail recorder.
  - `rateLimiter.ts`: In-memory IP rate limiter protecting auth endpoints.
- **Controllers & API Endpoints (`server/src/controllers/`):**
  - Implemented controllers for authentication, clubs, events, registrations, attendance, certificates, feedback, announcements, and administrative metrics.
- **Automated Test Suites (`server/test/`):**
  - Auth suite (`auth.test.ts`): 5 tests passing.
  - Concurrency suite (`concurrency.test.ts`): 3 tests passing.
  - QR suite (`qr.test.ts`): 5 tests passing.
  - Certificate suite (`certificate.test.ts`): 3 tests passing.
  - **Result: 16/16 tests passing.**

### Phase 3: Client Application Frontend Implementation (`client/`)
- **Stack:** Scaffolding with Vite 6, React 19, TypeScript, Lucide icons, and Tailwind CSS.
- **State & Communication (`client/src/`):**
  - `types.ts`: TypeScript data contracts for all backend entities.
  - `services/api.ts`: Centralized fetch wrapper with JWT bearer attachment.
  - `context/AuthContext.tsx`: Persistent user and profile session manager.
- **Components & Layouts (`client/src/components/`):**
  - `Navbar.tsx`: Responsive navigation with role-specific badge and dashboard link.
  - `DynamicQrModal.tsx`: Real-time rotating QR projection modal with 20s countdown ring.
  - `EventCard.tsx`: Event catalog display card with capacity progress indicators.
- **Pages & Portals (`client/src/pages/`):**
  - `Home.tsx`: Filterable event catalog with search, category tabs, and platform hero.
  - `Clubs.tsx`: Directory of chartered university clubs with membership application triggers.
  - `Login.tsx`: Single sign-on card with 1-click test credentials for Fahim, Jobair, and Admin.
  - `Register.tsx`: Student registration form with real-time field validation.
  - `EventDetails.tsx`: Complete event breakdown, seat booking, ticket display, token check-in, and feedback forms.
  - `StudentDashboard.tsx`: Tabbed portal for active tickets, earned certificates, and notifications.
  - `ExecutiveDashboard.tsx`: Management desk for club proposals, dynamic QR launch, roster CSV export, and membership approvals.
  - `AdvisorDashboard.tsx`: Proposal review queue with Approve and Reject (with mandatory remarks) actions.
  - `AdminDashboard.tsx`: Institutional KPI cards, user RBAC role elevation, club provisioning, and live audit log table.
  - `PublicVerify.tsx`: Non-authenticated certificate verification portal with SHA-256 fingerprint match.
- **Routing & Entrypoint (`client/src/App.tsx`, `main.tsx`):**
  - Protected route wrappers, role filtering, and IEEE-styled institutional footer.
- **Production Build:** `npm run build` compiled with 0 errors to `client/dist`.

### Phase 4: Production Integration & Single-Port Serving
- Enhanced `server/src/index.ts` to statically host `client/dist/` assets with SPA fallback routing.
- Verified live server execution on port 5000 and development hot-reload on port 5173.

---

## 3. Key Technical Learnings & Traps Resolved

1. **Parameter Substitution vs BCrypt Hash Collisions:**
   - *Trap:* When string-interpolating or using global regex replacement `/\$(\d+)/g` on raw SQL statements, BCrypt hashes containing `$12$` or `$2a$` can be corrupted by parameter replacement logic.
   - *Fix:* Always keep SQL statements parameterized using standard array parameters `[$1, $2, ...]` rather than manual regex string substitution.

2. **Async Transactions in better-sqlite3:**
   - *Trap:* `better-sqlite3`'s default `db.transaction()` wrapper is strictly synchronous. Invoking asynchronous `await` calls inside this wrapper causes premature returns or unhandled transaction state.
   - *Fix:* Implemented explicit transaction management with `BEGIN`, `COMMIT`, and `ROLLBACK` queries inside an async callback wrapper.

3. **ESM `__dirname` Resolution in Node.js v22:**
   - *Trap:* Setting `"type": "module"` in `package.json` disables the CommonJS global `__dirname`, causing runtime `ReferenceError: __dirname is not defined`.
   - *Fix:* Explicitly define `__filename = fileURLToPath(import.meta.url)` and `__dirname = path.dirname(__filename)` in all modules needing filesystem path resolution.

4. **Rate Limiting During Parallel Automated Testing:**
   - *Trap:* Vitest runs test suites in parallel worker threads, which triggered HTTP 429 Too Many Requests from the brute-force protection middleware.
   - *Fix:* Added an explicit bypass `if (process.env.NODE_ENV === 'test') return next();` to allow rapid automated test execution.

5. **Strict Typography Compliance (Zero Long Hyphens):**
   - *Standard:* Absolutely zero em-dashes (`U+2014`), en-dashes (`U+2013`), or horizontal bars (`U+2015`). Standard ASCII short hyphens (`-`), colons (`:`), or pipes (`|`) must be used exclusively across all code, strings, documentation, and user interfaces.

---

## 4. Standard Document Header & Metadata Block Specification (Mandatory for All Future Documents)

Every technical document, specification, manual, report, or formal artifact generated for the CampusConnect platform MUST begin with this exact standardized header and metadata table block.

### Visual Layout & Hierarchy

1. **Document Title:**
   - Text: Uppercase document title (e.g., `SOFTWARE REQUIREMENTS SPECIFICATION`, `SOFTWARE DESIGN DESCRIPTION`, `SOFTWARE TEST PLAN`, `API SPECIFICATION`, `DEPLOYMENT & OPERATIONAL RUNBOOK`, `USER MANUAL`, `SOFTWARE TEST REPORT`, `PROJECT BOOK`, `FINAL PROJECT REPORT`).
   - Typography: Times New Roman, 18pt, bold, pure black `#000000`.
   - Spacing: 0pt before, 2pt after.

2. **Document Subtitle:**
   - Text: `CampusConnect: University Club, Event & Activity Management Platform`
   - Typography: Times New Roman, 13pt, italic, pure black `#000000`.
   - Spacing: 0pt before, 6pt after.

3. **Standard Metadata Table Block:**

| Attribute | Specification Detail |
| :--- | :--- |
| **Document Identifier** | `CC-[DOC_TYPE]-2026-V[VER] ([APPLICABLE_IEEE_STANDARDS])` |
| **Engineering Version** | `Version 2.0 (Formal Baseline)` or relevant release tier |
| **Software Engineering Team** | `Md. Shakhawat Hossain (Student ID: 0432320005101009) \| Fahim Hossain (Student ID: 0432320005101007) \| Department of CSE` |
| **Course Advisor & Supervisor** | `Al Imtiaz \| Department of Computer Science and Engineering` |
| **Reviewing Body** | `Faculty Academic Review Board \| Division of Computing and Systems` |
| **Release Date & Status** | `October 2026 \| Approved for Engineering Implementation` |

### Standard Document Identifiers

- **Software Requirements Specification (SRS):** `CC-SRS-2026-V2.0 (IEEE Std 830-1998 / ISO/IEC/IEEE 29148 Standard)`
- **Software Design Description (SDD):** `CC-SDD-2026-V1.0 (IEEE Std 1016-2009 Standard)`
- **Software Test Plan (STP):** `CC-STP-2026-V1.0 (ISO/IEC/IEEE 29119-3:2013 Standard)`
- **Software Test Report (STR):** `CC-STR-2026-V1.0 (IEEE Std 829-2008 Standard)`
- **API Specification (API):** `CC-API-2026-V1.0 (IEEE Std 830-1998 / RFC 7807 Standard)`
- **Deployment & Operational Runbook (OPS):** `CC-OPS-2026-V1.0 (IEEE Std 828-2012 Standard)`
- **Stakeholder User Manual (USR):** `CC-USR-2026-V1.0 (IEEE Std 26514-2018 Standard)`
- **Project Book & Architecture Compendium (PB):** `CC-PB-2026-V1.0 (IEEE Publication Standards)`
- **Final Project Report (PR):** `CC-PR-2026-V2.0 (UITS CSE0613316 Standard)`

### Implementation in Python-DOCX Generator Scripts

```python
# --- DOCUMENT COVER / HEADER TITLE ---
p_title = doc.add_paragraph()
p_title.paragraph_format.space_before = Pt(0)
p_title.paragraph_format.space_after = Pt(2)
r_title = p_title.add_run("SOFTWARE REQUIREMENTS SPECIFICATION")
r_title.font.name = 'Times New Roman'
r_title.font.size = Pt(18)
r_title.font.color.rgb = RGBColor(0, 0, 0)
r_title.bold = True

p_sub = doc.add_paragraph()
p_sub.paragraph_format.space_before = Pt(0)
p_sub.paragraph_format.space_after = Pt(6)
r_sub = p_sub.add_run("CampusConnect: University Club, Event & Activity Management Platform")
r_sub.font.name = 'Times New Roman'
r_sub.font.size = Pt(13)
r_sub.font.color.rgb = RGBColor(0, 0, 0)
r_sub.italic = True

# Metadata Block Table
meta_headers = ["Attribute", "Specification Detail"]
meta_data = [
    ["Document Identifier", "CC-SRS-2026-V2.0 (IEEE Std 830-1998 / ISO/IEC/IEEE 29148 Standard)"],
    ["Engineering Version", "Version 2.0 (Formal Baseline)"],
    ["Software Engineering Team", "Md. Shakhawat Hossain (Student ID: 0432320005101009) | Fahim Hossain (Student ID: 0432320005101007) | Department of CSE"],
    ["Course Advisor & Supervisor", "Al Imtiaz | Department of Computer Science and Engineering"],
    ["Reviewing Body", "Faculty Academic Review Board | Division of Computing and Systems"],
    ["Release Date & Status", "October 2026 | Approved for Engineering Implementation"]
]
add_styled_table(doc, meta_headers, meta_data, [2.2, 4.3])
```

### Mandatory Rules for All Agents & Generators

1. **Both Engineers Must Be Listed:** Always include both Md. Shakhawat Hossain (`0432320005101009`) and Fahim Hossain (`0432320005101007`). Never omit Fahim Hossain from the Software Engineering Team.
2. **Supervisor Name:** Always list `Al Imtiaz | Department of Computer Science and Engineering`.
3. **Table Styling:** Always use soft ash header `#F1F5F9`, bold black text `#000000`, column widths `[2.2, 4.3]` inches, and Times New Roman font.
4. **Punctuation Standard:** Strictly zero em-dashes and en-dashes; use standard ASCII hyphens (`-`), colons (`:`), or pipes (`|`).

