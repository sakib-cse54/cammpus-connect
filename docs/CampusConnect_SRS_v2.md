# Software Requirements Specification (SRS)
## CampusConnect: University Club, Event & Activity Management Platform

**Document Identifier:** CC-SRS-2026-V2.0  
**Version:** 2.0 (Engineering Baseline)  
**Date:** October 2026  
**Software Engineering Team:** Md. Shakhawat Hossain (Student ID: 0432320005101009) | Fahim Hossain (Student ID: 0432320005101007) | Department of Computer Science and Engineering  
**Academic Supervisor & Course Advisor:** Al Imtiaz | Department of Computer Science and Engineering  
**Approved by:** Faculty Academic Review Board | Division of Computing & Systems  
**Status:** Approved for Implementation  

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) establishes the complete functional, non-functional, data, and interface requirements for **CampusConnect**, a centralized web platform designed for university extracurricular management. This document serves as the formal baseline contract between university stakeholders, student organizations, faculty advisors (Al Imtiaz), and the software engineering implementation team led by Md. Shakhawat Hossain (Student ID: 0432320005101009) and Fahim Hossain (Student ID: 0432320005101007).

### 1.2 Document Conventions
- **Requirement Identifiers:** Functional requirements are denoted as `FR-XX`, non-functional requirements as `NFR-XX`, and acceptance criteria as `AC-XX`.
- **Priority Levels:** Each requirement is classified as **High** (mandatory for core release), **Medium** (secondary operational feature), or **Low** (value-add enhancement).
- **Punctuation Standard:** Strictly utilizes ASCII standard hyphens (-), colons (:), and pipes (|). No typographic em-dashes or en-dashes are permitted.
- **RFC 2119 Keywords:** The keywords "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", and "MAY" in this document are to be interpreted as described in RFC 2119.

### 1.3 Intended Audience and Reading Suggestions
- **Software Developers & Architects:** Focus on Sections 3 (System Features), 4 (External Interfaces), 5 (Non-Functional Requirements), and 6 (Data Architecture).
- **Faculty Advisors & University Administrators:** Focus on Sections 1.4 (Scope), 2 (Overall Description), 3.3 (Event Governance), and 7 (Role-Based Access Control).
- **Quality Assurance & Testers:** Focus on Sections 3 (Workflow Exceptions), 5 (Performance Benchmarks), and 8 (Traceability & Acceptance Criteria).

### 1.4 Project Scope
CampusConnect replaces fragmented communication channels (social media groups, physical flyers, disparate messaging threads) and manual tracking spreadsheets with a single, auditable, and automated web ecosystem.

- **In Scope:**
  - Student identity management and role-based access control.
  - Club discovery, executive succession, and membership request processing.
  - Multi-tier event lifecycle management: drafting, faculty advisor review, moderation, and publishing.
  - Concurrency-safe event registration and automated waitlist promotion.
  - Cryptographically signed, dynamic rotating QR code attendance tracking with manual organizer fallback.
  - Automated PDF certificate generation, tamper-proof hashing, and public validation endpoints.
  - Real-time in-app announcements, unread notifications, and asynchronous email dispatches.
  - Post-event attendee feedback collection and administrative analytics reporting.
- **Out of Scope (Release 1.0):**
  - Paid ticketing and third-party payment gateway integration.
  - Native mobile application builds (iOS / Android); responsive web interface is provided instead.
  - Biometric hardware integration for attendance verification.
  - Automated bi-directional synchronization with university legacy Student Information Systems (SIS).

### 1.5 Definitions, Acronyms, and Abbreviations
- **ACID:** Atomicity, Consistency, Isolation, Durability.
- **Argon2id:** State-of-the-art password-hashing algorithm resistant to GPU cracking and side-channel attacks.
- **JWT:** JSON Web Token, utilized for stateless authentication.
- **RBAC:** Role-Based Access Control.
- **RTM:** Requirements Traceability Matrix.
- **TOTP:** Time-Based One-Time Password algorithm (RFC 6238).
- **UUIDv4:** Universally Unique Identifier version 4.

### 1.6 Project Engineering Team and Governance

| Role | Name | Identification / Affiliation | Core Engineering Responsibilities |
| :--- | :--- | :--- | :--- |
| **Team Leader & Software Engineering Lead** | Md. Shakhawat Hossain | Student ID: 0432320005101009 \| Dept of CSE | System architecture, full-stack implementation, RESTful API design, dynamic QR attendance engine, and tamper-proof PDF certificate validation. |
| **Software Engineer & Team Member** | Fahim Hossain | Student ID: 0432320005101007 \| Dept of CSE | Core feature implementation, testing, dynamic QR integration, and technical documentation. |
| **Course Advisor & Supervisor** | Al Imtiaz | Department of CSE | Academic oversight, specification review, domain requirements validation, and engineering baseline sign-off. |

### 1.7 References
- IEEE Std 830-1998: IEEE Recommended Practice for Software Requirements Specifications.
- ISO/IEC/IEEE 29148:2018: Systems and software engineering: Life cycle processes: Requirements engineering.
- RFC 2119: Key words for use in RFCs to Indicate Requirement Levels.
- RFC 7519: JSON Web Token (JWT) Specification.
- W3C Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.

---

## 2. Overall Description

### 2.1 Product Perspective
CampusConnect operates as an independent, multi-tenant web application hosted within the university cloud infrastructure. It coordinates activities across academic departments, student clubs, and central administrative offices via a RESTful API architecture.

### 2.2 Product Functions (High-Level Context)
```
+-----------------------------------------------------------------------------------------+
|                                      CampusConnect                                      |
+-----------------------------------------------------------------------------------------+
| [Student Portal]     | [Club Executive Desk] | [Faculty Advisor]   | [Admin Console]    |
| - Browse Clubs/Events| - Draft Events        | - Review Events     | - Role Management  |
| - Register/Waitlist  | - Manage Registrations| - Approve / Reject  | - Club Directory   |
| - Dynamic QR Pass    | - Scan QR Attendance  | - Monitor Club KPIs | - Global Analytics |
| - Download Certs     | - Issue Announcements | - Activity Audits   | - System Audit Log |
+-----------------------------------------------------------------------------------------+
|                                    Core REST Services                                   |
| Auth | Clubs | Events | Registrations | Dynamic QR | Certificates | Comms | Reports    |
+-----------------------------------------------------------------------------------------+
|                             PostgreSQL 16 (ACID Relational Core)                        |
|                                Redis (Session Cache / Rate Limits)                      |
+-----------------------------------------------------------------------------------------+
```

### 2.3 User Classes and Characteristics
1. **Student:** Primary consumer. Uses platform on desktop and mobile web to discover activities, apply for club memberships, register for events, present QR codes for attendance, and download certificates.
2. **Club Executive:** Student leader authorized to manage a specific club profile, draft event proposals, inspect participant rosters, execute attendance check-ins, and broadcast club-level notices.
3. **Faculty Advisor:** University faculty member assigned to oversee one or more clubs. Responsible for reviewing event proposals, enforcing university safety/budget guidelines, and approving or rejecting events with written justifications.
4. **Platform Administrator:** Central university staff (Student Affairs / CSE Department IT). Possesses full system authority to provision users, override roles, create club categories, monitor security logs, and generate institutional compliance reports.

### 2.4 Operating Environment
- **Server Environment:** Linux (Ubuntu 22.04 LTS / 24.04 LTS), Node.js runtime (v20+ LTS), PostgreSQL 16, Redis 7.
- **Client Environment:** Modern web browsers supporting ECMAScript 2022+ (Google Chrome 115+, Mozilla Firefox 115+, Apple Safari 16+, Microsoft Edge 115+).
- **Mobile Web Support:** Fully responsive viewport rendering from 360px width upwards.

### 2.5 Design and Implementation Constraints
1. **Relational Engine:** The persistent storage engine MUST be PostgreSQL 16 to guarantee ACID compliance during concurrent registration requests.
2. **Language Consistency:** TypeScript MUST be utilized across both frontend (React) and backend (Express.js) to enforce shared interface types and minimize runtime bugs.
3. **Punctuation and Typography:** All software UI strings, system notifications, log messages, and generated documentation MUST strictly avoid em-dashes and en-dashes.
4. **Stateless Scalability:** Backend application servers MUST remain stateless, relying on Redis for token blacklisting and session metadata.

### 2.6 Assumptions and Dependencies
- **Network Access:** All users possess internet connectivity with HTTPS access to the campus domain.
- **Camera Capability:** Club executives marking attendance via camera require devices with accessible webcams or smartphone cameras supporting WebRTC MediaDevices API.
- **SMTP Gateway:** Transactional emails depend on the availability of a configured institutional SMTP server or dedicated delivery provider.

---

## 3. System Features and Detailed Functional Requirements

### 3.1 User Authentication and Identity Management

#### FR-01: User Registration and Account Provisioning
- **Description:** Prospective users create an account using their institutional email address.
- **Priority:** High
- **Inputs:** Institutional email (`@university.edu`), full name, student ID / faculty ID, department, password (minimum 8 characters, containing uppercase, lowercase, number, and special character).
- **Preconditions:** Email is unassigned; applicant possesses active institutional email access.
- **Normal Flow:**
  1. User submits registration form.
  2. System validates input against strict schema (Zod).
  3. System hashes password using Argon2id with recommended parameters (memory: 64MB, iterations: 3, parallelism: 1).
  4. System inserts user with status `PENDING_VERIFICATION` and dispatches email verification token (UUIDv4, valid 24 hours).
  5. User clicks verification link; account status transitions to `ACTIVE`.
- **Exception Flows:**
  - *Duplicate Email:* System returns HTTP 409 Conflict with generic message to prevent account enumeration.
  - *Weak Password:* System returns HTTP 422 Unprocessable Entity with specific validation failure reasons.
- **Postconditions:** Active user record created with role `STUDENT`.

#### FR-02: Authentication and Session Security
- **Description:** Authenticates users and establishes secure sessions.
- **Priority:** High
- **Inputs:** Email and password credentials.
- **Normal Flow:**
  1. User submits credentials via HTTPS POST.
  2. System checks rate limit (maximum 5 attempts per IP / email per 15-minute window).
  3. System verifies password hash via Argon2id.
  4. System generates short-lived JWT access token (15-minute expiration) and cryptographically secure refresh token (7-day expiration).
  5. Access token and refresh token are returned in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
  6. System writes login timestamp and client IP to `audit_logs`.
- **Exception Flows:**
  - *Invalid Credentials:* Counter incremented in Redis; HTTP 401 Unauthorized returned.
  - *Rate Limit Exceeded:* HTTP 429 Too Many Requests returned with `Retry-After` header.
- **Postconditions:** User authenticated with valid session tokens.

#### FR-03: Token Refresh and Explicit Logout
- **Description:** Manages token rotation and revocation.
- **Priority:** High
- **Normal Flow:**
  1. Client sends refresh request with refresh token cookie.
  2. System verifies token validity against database store, invalidates old refresh token, and issues a new token pair (refresh token rotation).
  3. On logout, refresh token is deleted from database and cookies cleared.

#### FR-04: User Profile Management
- **Description:** Users view and update contact details, avatar URL, bio, and notification preferences.
- **Priority:** Medium
- **Preconditions:** User is authenticated. Email, student ID, and system role are immutable by the user.

---

### 3.2 Club Directory and Membership Lifecycle

#### FR-05: Club Directory and Exploration
- **Description:** Public directory of all registered university clubs categorized by interest area.
- **Priority:** High
- **Normal Flow:** System returns active clubs with name, logo, description, category, executive committee list, and active event count.

#### FR-06: Membership Application Submission
- **Description:** Active students submit membership applications to join clubs.
- **Priority:** High
- **Inputs:** Target club ID, statement of interest.
- **Preconditions:** Student is not already an active member or pending applicant of target club.
- **Normal Flow:** System records `club_memberships` record with status `PENDING`. Club executives receive notification.
- **Exception Flow:** Duplicate application returns HTTP 400 Bad Request.

#### FR-07: Membership Review and Executive Approval
- **Description:** Authorized club executives approve or decline membership applications.
- **Priority:** High
- **Preconditions:** Requesting user holds `CLUB_EXECUTIVE` or `FACULTY_ADVISOR` role for the specified club.
- **Normal Flow:** Executive marks application as `APPROVED` or `REJECTED`. System updates status, records reviewer ID, and dispatches notification to applicant.

#### FR-08: Executive Tenure and Role Succession
- **Description:** Club administrators or faculty advisors promote active members to executive status or revoke executive privileges upon leadership transition.
- **Priority:** Medium
- **Postconditions:** Updated role in `club_memberships` table and audit log entry created.

---

### 3.3 Event Creation, Lifecycle, and Approval Workflow

#### FR-09: Event Proposal Drafting
- **Description:** Club executives draft new campus events.
- **Priority:** High
- **Inputs:** Title, description, category ID, venue, start timestamp, end timestamp, capacity limit, registration deadline, banner image URL, eligibility rules.
- **Preconditions:** User is an executive of the hosting club.
- **Normal Flow:** Event record created with status `DRAFT`. Executive may edit all fields.

#### FR-10: Event Proposal Submission
- **Description:** Executive submits draft event for faculty advisor review.
- **Normal Flow:** Status transitions from `DRAFT` to `PENDING_APPROVAL`. Editing is locked for executives while under review. Assigned faculty advisor receives notification.

#### FR-11: Faculty Advisor Review and Decision
- **Description:** Faculty advisor reviews event details and makes an authoritative approval decision.
- **Priority:** High
- **Inputs:** Event ID, decision (`APPROVED` or `REJECTED`), written review remarks.
- **Preconditions:** Reviewer is the designated faculty advisor for the hosting club or platform administrator.
- **Normal Flow (Approval):** Status transitions to `APPROVED`. Event becomes publicly discoverable once publishing date arrives.
- **Normal Flow (Rejection):** Status transitions to `REJECTED`. Review remarks are stored and executive is notified. Event returns to editable draft state for amendment.

#### FR-12: Event Publishing and Visibility Controls
- **Description:** Approved events automatically transition to `PUBLISHED` upon scheduled publication time.
- **Priority:** High

#### FR-13: Event Modification and Cancellation Policy
- **Description:** Executives or advisors cancel an event due to unforeseen circumstances.
- **Normal Flow:** Event status updated to `CANCELLED`. System triggers high-priority email and in-app notifications to all registered participants.

---

### 3.4 Event Discovery, Registration, and Concurrency Control

#### FR-14: Search and Filter Engine
- **Description:** Search events by keyword, club, category, date range, and seat availability.
- **Priority:** High
- **Performance:** Results returned within p95 < 200ms using PostgreSQL full-text search (`tsvector`).

#### FR-15: Concurrency-Safe Event Registration
- **Description:** Students register for open events within capacity constraints.
- **Priority:** High
- **Preconditions:**
  - Event is `PUBLISHED`.
  - Current timestamp is before `registration_deadline`.
  - Student has no existing active registration for this event.
- **Normal Flow:**
  1. Transaction initiated with isolation level `READ COMMITTED`.
  2. System locks event row: `SELECT capacity, registered_count FROM events WHERE id = $1 FOR UPDATE`.
  3. System evaluates: `registered_count < capacity`.
  4. System inserts record into `registrations` with status `CONFIRMED`.
  5. System increments `registered_count` by 1.
  6. Transaction commits.
  7. System issues unique Registration Ticket UUID and renders attendee pass.
- **Exception Flows:**
  - *Capacity Reached:* Transaction commits without seat increment; user is placed on waitlist (FR-16).
  - *Duplicate Registration:* PostgreSQL unique constraint (`user_id`, `event_id`) catches collision; returns HTTP 409 Conflict.
- **Postconditions:** Guaranteed zero over-booking under high concurrency.

#### FR-16: Automated Waitlist Management
- **Description:** When an event is at maximum capacity, students can join an ordered waitlist.
- **Priority:** Medium
- **Normal Flow:** Record created in `registrations` with status `WAITLISTED` and incrementing `waitlist_position`.

#### FR-17: Registration Cancellation and Waitlist Promotion
- **Description:** Registered students can cancel their attendance.
- **Priority:** High
- **Normal Flow:**
  1. Student cancels registration.
  2. Status set to `CANCELLED`.
  3. Database trigger or service checks for lowest `waitlist_position` on this event.
  4. Top waitlisted student is promoted to `CONFIRMED`.
  5. System sends urgent email/notification to promoted student with 12-hour confirmation window.

#### FR-18: Attendee Roster Export
- **Description:** Club executives export attendee lists in CSV format.
- **Priority:** Medium
- **Access Control:** Restricted to executives of the hosting club and administrators.

---

### 3.5 Secure Attendance Tracking and Dynamic QR Engine

#### FR-19: Dynamic Rotating QR Code Generation
- **Description:** Prevents proxy attendance by replacing static QR codes with time-rotating tokens.
- **Priority:** High
- **Normal Flow:**
  1. Event session opens on organizer terminal.
  2. Backend generates dynamic token: `HMAC_SHA256(event_id + timestamp_slot, server_secret)`.
  3. Token rotates every 20 seconds.
  4. Organizer screen displays live QR code that students scan with their mobile devices.
  - *Alternative Mode (Student Pass Scan):* Student presents personal attendee pass containing signed JWT; verified executive scans student pass using device webcam.

#### FR-20: Attendance Validation and Check-In
- **Description:** Validates attendance token against server time slot.
- **Priority:** High
- **Normal Flow:**
  1. Student scan submits token, student session, and geolocation (optional campus perimeter check).
  2. Server verifies token validity (current window or immediate previous window: +/- 20 seconds tolerance for clock skew).
  3. Server verifies student holds `CONFIRMED` registration for event.
  4. Server creates record in `attendance_records` with timestamp, `method = 'QR_SCAN'`, and `status = 'PRESENT'`.
  5. Registration status updated to `ATTENDED`.
- **Exception Flows:**
  - *Expired Token:* HTTP 400 Bad Request: "QR token expired. Please rescan current display."
  - *Not Registered:* HTTP 403 Forbidden: "No confirmed registration found for this event."
  - *Duplicate Scan:* HTTP 409 Conflict: "Attendance already recorded at [timestamp]."

#### FR-21: Manual Attendance Fallback
- **Description:** Authorized executives manually mark attendance for students unable to scan.
- **Priority:** High
- **Normal Flow:** Executive searches student by student ID or name, verifies identity, and marks attendance. Audit record logged with `method = 'MANUAL_OVERRIDE'` and executive ID.

#### FR-22: Live Attendance Dashboard
- **Description:** Displays real-time check-in counters and roster updates during the event.
- **Priority:** Medium

---

### 3.6 Digital Certificate Issuance and Public Verification

#### FR-23: Automated Eligibility Verification
- **Description:** Identifies attendees eligible for event completion certificates.
- **Priority:** High
- **Eligibility Criteria:**
  - User has `attendance_records` status `PRESENT`.
  - Required event feedback form submitted (if configured).
  - Event status is `COMPLETED`.

#### FR-24: Certificate Generation Engine
- **Description:** Compiles and stores digitally verifiable PDF certificates.
- **Priority:** High
- **Inputs:** Student full name, event title, hosting club, completion date, authorized signatory name.
- **Normal Flow:**
  1. Asynchronous worker (BullMQ) receives generation job.
  2. Worker generates unique cryptographic Certificate Serial Number (format: `CC-YYYY-[8-CHAR-HEX]`).
  3. Worker calculates SHA-256 fingerprint of certificate payload.
  4. PDF compiled with embedded verification QR code pointing to public URL.
  5. PDF stored securely in cloud / object storage.
  6. Record inserted into `certificates` table.

#### FR-25: Student Certificate Retrieval
- **Description:** Students view earned certificates in their profile and download PDF copies.
- **Priority:** High

#### FR-26: Public Verification Portal
- **Description:** Allows external parties (employers, academic boards) to verify certificate validity without logging in.
- **Priority:** High
- **Endpoint:** `GET /api/v1/certificates/verify/:serial_number`
- **Output:** Public status page displaying: Recipient Name, Event Title, Issuing Club, Date Issued, Validity (`ACTIVE` / `REVOKED`), and Cryptographic Hash.

---

### 3.7 Notification Dispatch and Announcements

#### FR-27: Targeted Club Announcements
- **Description:** Executives publish announcements to all club members or registered event participants.
- **Priority:** Medium
- **Channels:** In-app feed and broadcast email.

#### FR-28: Real-Time In-App Notification Center
- **Description:** Delivers alerts for registration confirmations, waitlist promotions, approvals, and reminders.
- **Priority:** High
- **Features:** Unread badge counter, mark as read, link to relevant resource.

#### FR-29: Email Notification Gateway
- **Description:** Asynchronous processing of transactional emails via background job queue.
- **Priority:** High
- **Resilience:** Automatic retry with exponential backoff for failed SMTP transmissions (up to 3 attempts).

---

### 3.8 Post-Event Feedback and Analytics Reporting

#### FR-30: Attendee Feedback Submission
- **Description:** Attendees submit ratings (1 to 5 stars) and qualitative feedback post-event.
- **Priority:** Medium
- **Rules:** Feedback permitted only once per attended event; optional anonymity flag supported.

#### FR-31: Club Executive Activity Reports
- **Description:** Club-level metrics on total attendees, attendance rate, feedback score average, and member growth.
- **Priority:** Medium

#### FR-32: Central University Administrative Reports
- **Description:** Institutional dashboard displaying campus-wide engagement metrics, active clubs, event volume, and departmental participation breakdowns.
- **Priority:** High

---

### 3.9 Administrative Governance and Audit Logging

#### FR-33: User and Role Management
- **Description:** Administrators assign, elevate, or revoke user roles across the platform.
- **Priority:** High

#### FR-34: System Category and Taxonomy Management
- **Description:** Administrators create and maintain event categories and club interest domains.
- **Priority:** Low

#### FR-35: Comprehensive Audit Logging
- **Description:** System logs all sensitive operations to an immutable `audit_logs` table.
- **Priority:** High
- **Logged Events:** User login failures, role elevations, event approval/rejection, manual attendance overrides, certificate revocations.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
- **Design System:** Responsive desktop and mobile layout utilizing clean typography, high visual contrast, and clear state indicators.
- **Accessibility:** Compliance with WCAG 2.1 Level AA standards including keyboard navigation, ARIA attributes, and minimum contrast ratio of 4.5:1 for standard text.
- **Key Views:**
  1. Public Landing & Event Discovery Portal (Search, Filters, Event Cards).
  2. Event Detail & Registration Page (Capacity meter, deadline countdown, registration button).
  3. Student Dashboard (Registered events, earned certificates, club memberships).
  4. Club Executive Workspace (Event editor, roster manager, live QR attendance console).
  5. Faculty Advisor Review Queue (Proposal review, approval/rejection modal with remarks).
  6. Central Administrator Command Center (User management, audit log viewer, analytics charts).

### 4.2 Hardware Interfaces
- **Mobile Camera / Webcam:** Standard camera access via HTML5 `MediaDevices.getUserMedia()` for scanning attendance QR codes.

### 4.3 Software Interfaces
- **Database Server:** PostgreSQL 16 connection via connection pool (maximum 20 connections per API instance).
- **In-Memory Cache:** Redis 7 for rate-limiting counters, active session blacklists, and temporary QR tokens.
- **Email Service:** Standard SMTP / API provider for email delivery.
- **File Storage:** Local secure volume or S3-compatible object store for event banner images and generated PDF certificates.

### 4.4 Communications Interfaces
- **HTTPS Protocol:** Mandatory TLS 1.3 encryption on all public endpoints; HTTP traffic automatically redirected to HTTPS with HSTS headers enabled.
- **RESTful API Standards:** JSON request and response payloads, standard HTTP status codes (200, 201, 400, 401, 403, 404, 409, 422, 429, 500).

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements
- **NFR-01 (Read Latency):** 95% of public read requests (event browsing, club profiles) MUST respond in under 250 milliseconds under a concurrent load of 500 active users.
- **NFR-02 (Write Latency):** 95% of transactional writes (registrations, attendance check-ins) MUST complete in under 400 milliseconds.
- **NFR-03 (Batch Processing):** Certificate generation and bulk email dispatch MUST run asynchronously in background workers, completing within 60 seconds of job dispatch without degrading REST API response times.
- **NFR-04 (Database Connection Pool):** Query execution times for indexed lookups MUST not exceed 50 milliseconds.

### 5.2 Reliability and Availability Requirements
- **NFR-05 (System Availability):** The platform SHALL maintain 99.5% uptime during standard academic terms, scheduled maintenance windows excluded.
- **NFR-06 (Data Consistency):** Concurrency controls SHALL guarantee zero event over-booking under simultaneous registration attempts.
- **NFR-07 (Backup and Recovery):** Automated daily full database dumps (`pg_dump`) combined with WAL archiving, supporting a Recovery Point Objective (RPO) of < 1 hour and a Recovery Time Objective (RTO) of < 4 hours.

### 5.3 Security Requirements
- **NFR-08 (Credential Protection):** All passwords MUST be hashed using Argon2id. Cleartext passwords SHALL NEVER be logged or transmitted unencrypted.
- **NFR-09 (Session Hardening):** Authentication tokens MUST be transported exclusively within `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
- **NFR-10 (Brute Force Defense):** Authentication routes MUST enforce IP and account-level rate limiting (maximum 5 failed attempts per 15 minutes).
- **NFR-11 (Injection Defense):** All SQL queries MUST use parameterized queries via an ORM/query builder. All user-supplied HTML/text MUST be sanitized to prevent Cross-Site Scripting (XSS).
- **NFR-12 (Audit Compliance):** All administrative overrides, role changes, and attendance edits MUST be logged to the immutable `audit_logs` table.

### 5.4 Software Quality Attributes
- **Maintainability:** Modular layered architecture separating Controller, Service, and Data Access layers. Comprehensive unit and integration test coverage targeting >= 80%.
- **Usability:** Responsive interface adapting to mobile (>= 360px), tablet, and desktop viewports.
- **Portability:** Containerized deployment using Docker and Docker Compose for reproducible local and production deployment.

---

## 6. Data Architecture and Relational Schema

### 6.1 Entity-Relationship Overview
The CampusConnect relational database comprises 12 core tables organized around the student life cycle, club operations, event governance, and audit trails.

```
+-------------+         +-------------------+         +-----------------+
|    users    | 1 --- 1 |  student_profiles |         | event_categories|
+-------------+         +-------------------+         +-----------------+
       | 1                                                     | 1
       |                                                       |
       +-----------+ 1                                         | *
       |           |                                    +-----------------+
       |           v *                                  |     events      |
       |    +------------------+                        +-----------------+
       |    | club_memberships |                               ^ 1
       |    +------------------+                               |
       |           ^ *                                         |
       |           |                                           |
       |    +------------------+ 1                             |
       +--> |      clubs       | ------------------------------+
            +------------------+
                     | 1
                     |
                     +--------------------------+
                     |                          |
                     v *                        v *
            +------------------+       +------------------+
            |  registrations   |       |  announcements   |
            +------------------+       +------------------+
             1 |            1 |
               |              |
               v 1            v 1
      +-----------------+   +------------------+
      |attendance_records|  |   certificates   |
      +-----------------+   +------------------+
```

### 6.2 Relational Data Dictionary

#### Table: `users`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique user identifier |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | Institutional email address |
| `password_hash` | VARCHAR(255) | NOT NULL | Argon2id cryptographic hash |
| `role` | VARCHAR(32) | NOT NULL, DEFAULT 'STUDENT' | Enum: STUDENT, CLUB_EXECUTIVE, FACULTY_ADVISOR, ADMIN |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'ACTIVE' | Enum: PENDING_VERIFICATION, ACTIVE, SUSPENDED |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

#### Table: `student_profiles`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique profile identifier |
| `user_id` | UUID | NOT NULL, UNIQUE, FK -> users(id) ON DELETE CASCADE | Associated user ID |
| `student_id_number`| VARCHAR(64) | NOT NULL, UNIQUE | University student ID number |
| `full_name` | VARCHAR(128) | NOT NULL | Official registered name |
| `department` | VARCHAR(128) | NOT NULL | Academic department |
| `batch_year` | INTEGER | NOT NULL | Enrollment batch year |
| `phone_number` | VARCHAR(32) | NULL | Contact phone number |
| `avatar_url` | VARCHAR(512) | NULL | URL to profile picture |

#### Table: `clubs`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique club identifier |
| `name` | VARCHAR(128) | NOT NULL, UNIQUE | Official club name |
| `slug` | VARCHAR(128) | NOT NULL, UNIQUE | URL-friendly slug |
| `description` | TEXT | NOT NULL | Mission and activity details |
| `category` | VARCHAR(64) | NOT NULL | Domain (Technical, Cultural, Sports, etc.) |
| `logo_url` | VARCHAR(512) | NULL | Club logo asset path |
| `faculty_advisor_id`| UUID | NOT NULL, FK -> users(id) | Assigned faculty advisor user ID |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'ACTIVE' | Enum: ACTIVE, INACTIVE, SUSPENDED |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Inception date |

#### Table: `club_memberships`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Membership record ID |
| `club_id` | UUID | NOT NULL, FK -> clubs(id) ON DELETE CASCADE | Club reference |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE | Student user reference |
| `club_role` | VARCHAR(32) | NOT NULL, DEFAULT 'MEMBER' | Enum: MEMBER, EXECUTIVE, PRESIDENT, TREASURER |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'PENDING'| Enum: PENDING, APPROVED, REJECTED, TERMINATED |
| `joined_at` | TIMESTAMPTZ | NULL | Approval timestamp |
| Unique Index | (club_id, user_id) | UNIQUE | Prevents duplicate applications |

#### Table: `events`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique event identifier |
| `club_id` | UUID | NOT NULL, FK -> clubs(id) | Hosting club ID |
| `title` | VARCHAR(255) | NOT NULL | Event title |
| `description` | TEXT | NOT NULL | Comprehensive agenda |
| `venue` | VARCHAR(255) | NOT NULL | Physical hall or virtual link |
| `start_time` | TIMESTAMPTZ | NOT NULL | Event start time |
| `end_time` | TIMESTAMPTZ | NOT NULL | Event conclusion time |
| `capacity` | INTEGER | NOT NULL, CHECK (capacity > 0) | Maximum attendance capacity |
| `registered_count` | INTEGER | NOT NULL, DEFAULT 0 | Count of active confirmed attendees |
| `registration_deadline`| TIMESTAMPTZ | NOT NULL | Cutoff time for registration |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'DRAFT' | DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PUBLISHED, COMPLETED, CANCELLED |
| `advisor_remarks` | TEXT | NULL | Reason for approval or rejection |
| `requires_feedback_for_cert`| BOOLEAN | NOT NULL, DEFAULT TRUE | Feedback prerequisite flag |
| `created_by` | UUID | NOT NULL, FK -> users(id) | Executive who drafted the event |

#### Table: `registrations`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique registration ID |
| `event_id` | UUID | NOT NULL, FK -> events(id) ON DELETE CASCADE | Associated event ID |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE | Registered student ID |
| `ticket_code` | VARCHAR(64) | NOT NULL, UNIQUE | Public verification ticket code |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'CONFIRMED'| CONFIRMED, WAITLISTED, CANCELLED, ATTENDED |
| `waitlist_position`| INTEGER | NULL | Rank on waitlist |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Registration timestamp |
| Unique Index | (event_id, user_id) | UNIQUE | Eliminates double registrations |

#### Table: `attendance_records`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique attendance record ID |
| `event_id` | UUID | NOT NULL, FK -> events(id) | Associated event ID |
| `user_id` | UUID | NOT NULL, FK -> users(id) | Attending student ID |
| `registration_id`| UUID | NOT NULL, UNIQUE, FK -> registrations(id) | Associated registration |
| `check_in_time` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Verified check-in timestamp |
| `method` | VARCHAR(32) | NOT NULL | QR_SCAN, MANUAL_OVERRIDE |
| `recorded_by` | UUID | NOT NULL, FK -> users(id) | Executive or staff member ID |

#### Table: `certificates`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique certificate ID |
| `serial_number` | VARCHAR(64) | NOT NULL, UNIQUE | Public verification serial code |
| `event_id` | UUID | NOT NULL, FK -> events(id) | Attended event ID |
| `user_id` | UUID | NOT NULL, FK -> users(id) | Recipient student ID |
| `pdf_url` | VARCHAR(512) | NOT NULL | Secure asset storage URI |
| `sha256_hash` | VARCHAR(64) | NOT NULL | SHA-256 integrity hash of PDF |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'VALID' | Enum: VALID, REVOKED |
| `issued_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Generation timestamp |

#### Table: `audit_logs`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Sequential log identifier |
| `actor_user_id` | UUID | NULL, FK -> users(id) | Performing user ID |
| `action` | VARCHAR(64) | NOT NULL | Event name (e.g. EVENT_APPROVED) |
| `target_entity` | VARCHAR(64) | NOT NULL | Target table name |
| `target_id` | VARCHAR(64) | NOT NULL | Identifier of modified record |
| `ip_address` | VARCHAR(45) | NOT NULL | IPv4 or IPv6 client address |
| `user_agent` | VARCHAR(255) | NULL | Client browser user agent |
| `details` | JSONB | NULL | Before/after state snapshot |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Log creation timestamp |

---

## 7. Role-Based Access Control (RBAC) Matrix

| Resource / Action | Student | Club Executive | Faculty Advisor | Platform Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Browse Clubs & Events** | Read | Read | Read | Read |
| **Apply for Club Membership**| Create | N/A | N/A | N/A |
| **Manage Club Members** | None | Approve / Reject | Read | Full Control |
| **Draft / Edit Event** | None | Create / Update (Own) | Read | Full Control |
| **Approve / Reject Event** | None | None | Approve / Reject | Full Control |
| **Register for Event** | Create / Cancel | Create / Cancel | Read | Full Control |
| **Scan Attendance** | None | Execute (Own Club) | Read | Full Control |
| **Manual Attendance Override**| None | Execute (With Log) | Execute | Full Control |
| **Download Certificate** | Read (Own) | Read (Own) | Read | Full Control |
| **Verify Certificate (Public)**| Read | Read | Read | Read |
| **Publish Announcements** | None | Create (Own Club) | Create (Assigned) | Create (Global) |
| **View System Audit Logs** | None | None | None | Read |
| **User Role Assignment** | None | None | None | Create / Update |

---

## 8. Requirements Traceability Matrix and Acceptance Scenarios

### 8.1 Requirements Traceability Matrix (RTM)

| Business Objective | Functional Req | Relational Entity | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| **Centralize Event Discovery** | FR-05, FR-14 | `clubs`, `events` | AC-01, AC-02 |
| **Secure Authentication** | FR-01, FR-02, FR-03 | `users`, `audit_logs` | AC-03, AC-04 |
| **Auditable Governance** | FR-09, FR-10, FR-11 | `events`, `audit_logs` | AC-05, AC-06 |
| **Reliable Registration** | FR-15, FR-16, FR-17 | `registrations`, `events`| AC-07, AC-08 |
| **Tamper-Resistant Attendance**| FR-19, FR-20, FR-21 | `attendance_records` | AC-09, AC-10 |
| **Verifiable Credentials** | FR-23, FR-24, FR-26 | `certificates` | AC-11, AC-12 |

### 8.2 Executable Acceptance Scenarios (BDD Gherkin Format)

#### Scenario AC-07: Concurrency-Safe Event Registration Capacity Enforcement
```gherkin
Scenario: Enforce maximum registration capacity under concurrent requests
  Given an event "AI Innovation Workshop" exists with capacity 50 and registered_count 49
  When two students attempt to register simultaneously at timestamp T
  Then exactly one student registration succeeds with HTTP 201 Created
  And the second student receives HTTP 200 OK with status "WAITLISTED"
  And the event registered_count remains exactly 50
  And no database lock deadlock error is exposed to either client
```

#### Scenario AC-09: Defense Against Attendance QR Code Screenshot Sharing
```gherkin
Scenario: Reject expired or forwarded attendance QR token
  Given an ongoing event "Robotics Hackathon"
  And student "Rahim" holds a confirmed registration
  When student "Karim" attempts check-in using a screenshot of Rahim's QR token taken 45 seconds prior
  Then the check-in request is rejected with HTTP 400 Bad Request
  And the error response specifies "QR token expired. Please rescan live display."
  And no record is created in the attendance_records table
```

#### Scenario AC-11: Public Certificate Verification Integrity
```gherkin
Scenario: Public verification of earned completion certificate
  Given student "Ayesha" has status "ATTENDED" and completed event feedback
  When an employer visits "/api/v1/certificates/verify/CC-2026-A1B2C3D4"
  Then the system displays the student full name, event title, issuing club, and issue date
  And the certificate cryptographic status is confirmed as "VALID"
  And no login credentials are required to view the verification status
```

---

## 9. Verification and Quality Assurance Plan

1. **Unit Testing:** All controllers, utility services (Argon2id hashing, HMAC token generator, PDF serial generator), and data validators tested using Vitest / Jest with minimum 85% statement coverage.
2. **Integration Testing:** End-to-end API route testing utilizing Supertest against an ephemeral PostgreSQL Docker container.
3. **Concurrency & Load Testing:** Execute concurrent registration burst tests using k6 (simulating 200 virtual users competing for the final 5 event slots) to certify zero over-booking.
4. **Security Penetration Auditing:** Automated scanning for OWASP Top 10 vulnerabilities (SQL injection, XSS, broken access control, insecure direct object references).
