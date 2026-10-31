# CampusConnect SRS: Comprehensive Review and Gap Analysis

**Document Under Review:** `CampusConnect_SRS_Full.pdf`  
**Original Faculty Document:** Al Imtiaz | Department of CSE | Date: 14 October 2026  
**Software Engineering Team:** Md. Shakhawat Hossain (Student ID: 0432320005101009) | Department of Computer Science and Engineering  
**Review Type:** Formal IEEE Std 830-1998 / ISO/IEC/IEEE 29148 Software Engineering Audit  
**Status:** Completed | Recommendation: Restructure and Upgrade to Specification v2.0  

---

## 1. Executive Summary

The provided document (`CampusConnect_SRS_Full.pdf`) is presented as a three-page comparative summary displaying an initial draft ("Before AI") alongside a refined summary ("After AI"). While the "After AI" column introduces meaningful improvements: such as identifying 13 functional requirement identifiers (FR-01 to FR-13), role definitions, and structured acceptance criteria: it remains an executive overview rather than a production-ready Software Requirements Specification (SRS).

To serve as an authoritative contract between university stakeholders, faculty advisors (Al Imtiaz), and the software engineering development team (Md. Shakhawat Hossain, Student ID: 0432320005101009), the SRS requires substantial elevation in technical precision, requirement formality, architectural finality, and edge-case resilience.

---

## 2. Structural and Standards Compliance (IEEE Std 830-1998)

| Evaluation Dimension | Current State in PDF | Target IEEE 830 Standard | Gap Severity |
| :--- | :--- | :--- | :--- |
| **Document Structure** | Split two-column comparison format intended for side-by-side demonstration. | Formal hierarchical specification with numbered subsections, revision history, and glossary. | **High** |
| **Requirement Formality** | High-level declarative one-sentence statements (e.g., "FR-05: students can register..."). | Detailed requirements with preconditions, inputs, triggers, normal flows, exception flows, and postconditions. | **Critical** |
| **Architectural Finality** | Indecisive ("PostgreSQL or MongoDB; select one before implementation"; "JWT or session"). | Definite architectural selections grounded in system characteristics (ACID requirements, relational integrity). | **Critical** |
| **Verifiability (Testability)**| Subjective thresholds ("reasonable time under normal usage", "under 3 seconds"). | Quantified metrics (e.g., "p95 API response time < 250ms under 500 concurrent connections"). | **High** |
| **Traceability** | Implicit linkage between problem statements and functional points. | Bidirectional Traceability Matrix (BTM) mapping business goals -> user stories -> FRs -> database entities -> acceptance tests. | **Medium** |
| **Typography Standards** | Employs forbidden em-dashes and en-dashes in titles, headers, and entity descriptions. | Strict adherence to ASCII hyphens, colons, and pipes without typographical artifacts. | **Medium** |

---

## 3. Deep-Dive Sectional Deficiencies and Recommended Fixes

### 3.1 Section 1 to 4: Scope, Problem Statement, and Boundary Control
- **Deficiency:** The scope defines what is included and excluded at a very high level, but lacks clear boundary conditions for administrative transitions (e.g., what happens when an executive graduates or when an event is cancelled midway through registration).
- **Fix:** Establish explicit state boundaries, lifecycle state machines, and club governance rules (including faculty advisor tenure and role reassignment).

### 3.2 Section 5: Users and Permissions
- **Deficiency:** Roles are defined only descriptively. There is no formal Role-Based Access Control (RBAC) permission matrix defining granular operations (Create, Read, Update, Delete, Approve, Export) across entities.
- **Fix:** Provide a comprehensive RBAC matrix specifying permissions for Student, Club Executive, Faculty Advisor, and System Administrator across all 11 core data entities.

### 3.3 Section 6: Functional Requirements (FR-01 to FR-13)
The current functional requirements lack essential operational logic:
1. **FR-05 (Registration & Capacity):** Lacks concurrency protection. If an event has 1 remaining slot and 5 students click register at the same millisecond, race conditions will cause over-registration unless atomic row-level locking (`SELECT ... FOR UPDATE`) or transactional isolation is mandated.
2. **Missing Waitlist Mechanism:** No provision for automated waitlist management. When a registered user cancels, the slot should automatically be offered to the first student on the waitlist with a time-limited confirmation window.
3. **FR-09 (Attendance & QR Tokens):** States that "QR tokens must be event-specific and validated server-side". Static QR codes can be easily screenshotted and shared among absent students, undermining attendance validity. The specification must mandate dynamic, short-lived rotating tokens (TOTP / cryptographic HMAC with a 15 to 30 second validity window) or organizer-side scanning of individual student identity passes.
4. **FR-10 (Certificates):** Mentions PDF generation for eligible participants, but fails to define cryptographic tamper-proofing, unique credential identifiers (UUIDv4 / SHA-256 hash), or a public verification endpoint (`/verify/{certificate_id}`) allowing external verification without account credentials.
5. **FR-07 (Event Lifecycle & Moderation):** Does not detail advisor rejection loops (e.g., mandatory rejection remarks, resubmission states, and audit trails).

### 3.4 Section 7: Non-Functional Requirements (NFRs)
- **Performance:** Stating that "read operations should target a response time under 3 seconds" is unacceptable for modern campus web applications. A 3-second latency indicates server bottlenecks or unindexed queries. Production target must be:
  - Read endpoints (Event discovery, club directory): p95 < 250ms, p99 < 500ms.
  - Write endpoints (Registration, attendance scan): p95 < 400ms.
  - Asynchronous background jobs (Certificate rendering, email broadcasting): Completed within 60 seconds without blocking main application worker threads.
- **Security:** "Hash passwords using a suitable algorithm" must be finalized to **Argon2id** (recommended) or **bcrypt (cost factor >= 12)**. Additionally, the system must mandate:
  - Rate limiting on authentication routes (maximum 5 failed attempts per IP / username per 15-minute window).
  - Secure session handling via HTTP-only, SameSite=Strict cookies with JWT access tokens (15-minute lifetime) and rotating refresh tokens stored in the database.
  - Input validation via schemas (e.g., Zod) and parameterized SQL queries to eliminate SQL injection and XSS.
- **Availability:** Explicit availability target (99.5% uptime during academic terms) and automated database backup strategy (daily pg_dump snapshots with Point-In-Time Recovery WAL archiving).

### 3.5 Section 8: Main Data Entities and Architecture Selection
- **The Database Dilemma:** The draft leaves the database engine open ("PostgreSQL or MongoDB"). 
  - *Resolution:* CampusConnect is fundamentally relational: users belong to clubs, clubs own events, events have registrations, registrations produce attendance, and attendance earns certificates. ACID transactions with foreign keys, cascading constraints, and atomic row-locking are strictly required for capacity management. **PostgreSQL 16** is the mandated relational database management system.
- **Missing Data Fields & Schema:** The draft only names entity titles. A production SRS must specify exact relational tables, column data types, nullability, unique keys, foreign key constraints, indexes, and an `audit_logs` table for compliance.

### 3.6 Section 10: Acceptance Criteria
- Acceptance criteria (AC-01 to AC-08) must be expanded from high-level summaries into concrete, executable Gherkin-style test scenarios (Given / When / Then) that can be directly mapped to automated integration and unit test suites.

---

## 4. Summary of Improvements in SRS Version 2.0

1. **Standardized Structure:** Full IEEE Std 830-1998 section alignment with complete subsections.
2. **Definitive Tech Stack:** PostgreSQL 16, Node.js / Express.js (TypeScript), React 18 (TypeScript), Tailwind CSS, Redis (caching and token blacklisting), and BullMQ (asynchronous job queuing).
3. **Comprehensive Functional Specifications:** Detailed inputs, preconditions, triggers, main success flows, alternative/exception flows, and postconditions for 9 core feature modules.
4. **Resilient Attendance Architecture:** Dynamic, time-based rotating QR tokens and scanner-mediated fallback to prevent proxy attendance.
5. **Verifiable Certificates:** Cryptographically signed PDF generation with unique verification hashes and public validation endpoints.
6. **Complete Normalized Relational Schema:** 12 tables with PostgreSQL DDL definitions, primary keys, foreign keys, constraints, and composite indexes.
7. **Strict Security and RBAC Matrix:** Formal permissions grid covering all 4 user classes across all system resources.
