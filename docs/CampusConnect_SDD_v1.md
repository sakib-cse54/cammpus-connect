# Software Design Document (SDD)
## CampusConnect: University Club, Event & Activity Management Platform

**Document Identifier:** CC-SDD-2026-V1.0  
**Engineering Baseline Version:** 1.0  
**Date:** October 2026  
**Software Engineering Lead:** Md. Shakhawat Hossain (Student ID: 0432320005101009) | Department of Computer Science and Engineering  
**Academic Supervisor & Course Advisor:** Al Imtiaz | Department of Computer Science and Engineering  
**Standard Compliance:** IEEE Std 1016-2009 (Standard for Information Technology: Systems Design: Software Design Descriptions)  
**Status:** Approved Engineering Baseline  

---

## 1. Introduction and Architectural Goals

### 1.1 Purpose
This Software Design Document (SDD) provides the definitive technical architecture and low-level system design for **CampusConnect**, a centralized university extracurricular and club management platform. This specification bridges the high-level functional requirements documented in the Software Requirements Specification (`CC-SRS-2026-V2.0`) and the implementation codebase. It details the modular component decomposition, concurrency mechanics, data architecture, RESTful API contracts, and cryptographic verification pipelines.

### 1.2 System Scope
CampusConnect consolidates student organizational activities across university departments. The platform orchestrates 4 distinct stakeholder roles: Students, Club Executives, Faculty Advisors, and System Administrators. Primary design objectives include:

1. **ACID Transactional Integrity:** Absolute prevention of event over-registration and race conditions during high-volume registration rushes via row-level locking.
2. **Anti-Proxy Attendance Assurance:** Prevention of attendance fraud (such as QR screenshot sharing among students) through dynamic, short-lived rotating cryptographic tokens.
3. **Verifiable Digital Credentials:** Generation of cryptographically signed, tamper-proof completion certificates accessible via a public validation endpoint.
4. **Deterministic Auditability:** Comprehensive, immutable audit trails capturing every lifecycle change, approval, rejection, and role elevation.
5. **Responsive and Accessible Performance:** API latency targets with p95 < 250ms for read operations and p95 < 400ms for transactional writes under concurrent loads.

### 1.3 Design Constraints and Standards
- **Punctuation Standard:** Strictly utilizes standard ASCII hyphens (-), colons (:), and pipes (|). Zero em-dashes or en-dashes are permitted across all documentation and source code.
- **Typography Standard:** Times New Roman body text, clean tables with soft ash header shading (`#F1F5F9`), and pure black typography (`#000000`).
- **Software Standards:** IEEE Std 1016-2009 (Software Design Descriptions), RFC 7519 (JSON Web Tokens), RFC 6238 (TOTP Algorithm), RFC 7807 (Problem Details for HTTP APIs).

---

## 2. Architectural Overview and System Context

### 2.1 C4 Context Level Diagram (System in Environment)

The system coordinates interactions between students, club leadership, university faculty, and automated background workers:

```
+--------------------------------------------------------------------------------------------------+
|                                    CAMPUSCONNECT SYSTEM CONTEXT                                  |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   +-------------------+    +----------------------+    +-------------------+    +------------+   |
|   |   Student User    |    | Club Executive User  |    |  Faculty Advisor  |    | Sys Admin  |   |
|   | (Web Browser/PWA) |    |  (Leadership Desk)   |    | (Review & Audit)  |    |  (Console) |   |
|   +---------+---------+    +----------+-----------+    +---------+---------+    +-----+------+   |
|             |                         |                          |                    |          |
|             +-------------------------+--------------------------+--------------------+          |
|                                       | (HTTPS / JSON REST API)                                  |
|                                       v                                                          |
|                    +--------------------------------------+                                      |
|                    |      CampusConnect Web API Gateway   |                                      |
|                    |     (Node.js 20 LTS / Express / TS)  |                                      |
|                    +------------------+-------------------+                                      |
|                                       |                                                          |
|             +-------------------------+-------------------------+                                |
|             |                                                   |                                |
|             v                                                   v                                |
|   +-------------------+                               +--------------------+                     |
|   |   PostgreSQL 16   |                               |       Redis 7      |                     |
|   | (ACID Relational  |                               |  (Session Cache,   |                     |
|   |   Data Core)      |                               |  Rate Limits & Q)  |                     |
|   +-------------------+                               +--------------------+                     |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

### 2.2 C4 Container Level Architecture

CampusConnect is structured as a modular monolith optimized for maintainability, straightforward deployment, and strict transactional consistency:

1. **Client Single-Page Application (SPA):** Built with modern TypeScript and responsive UI components. Communicates exclusively with the API backend over HTTPS using secure HTTP-only cookies.
2. **REST API Gateway & Core Service Layer:** An Express.js application written in strict TypeScript. Encapsulates business logic, input sanitization via Zod schemas, role-based authorization barriers, and cryptographic token verification.
3. **Relational Core (PostgreSQL 16):** Houses all normalized relational entities. Enforces referential integrity, foreign key cascades, unique constraints, and atomic row-level locks (`SELECT ... FOR UPDATE`).
4. **Fast-Access Memory Cache (Redis 7):** Operates as a distributed cache for read-heavy club and event listings, token revocation blacklists, and rate-limiting counters.
5. **Background Asynchronous Worker:** Manages compute-intensive or latency-sensitive background tasks, including PDF certificate compilation and transactional email dispatches.

---

## 3. Architectural Decision Records (ADRs)

### 3.1 ADR-01: Modular Monolithic Architecture vs Microservices
- **Context:** The system must handle extracurricular management for a university campus (up to 15,000 active students and 100 student clubs). Peak load occurs during semester kickoff registration windows.
- **Decision:** Implement a modular monolith within a single Node.js/TypeScript codebase rather than distributed microservices.
- **Rationale:** Microservices introduce distributed transactions, eventual consistency hazards, network serialization latency, and deployment complexity. A modular monolith provides clean domain boundary separation while preserving single-database ACID transactions essential for slot reservations.

### 3.2 ADR-02: PostgreSQL 16 Relational Engine vs Document Store (MongoDB)
- **Context:** The initial faculty draft left database selection undecided between PostgreSQL and MongoDB.
- **Decision:** Mandate PostgreSQL 16 as the sole persistent data store.
- **Rationale:** CampusConnect data is inherently relational: users belong to clubs, clubs own events, events receive registrations, registrations yield attendance, and attendance earns certificates. PostgreSQL offers battle-tested ACID compliance, foreign key constraints, composite indexing, and row-level locking (`SELECT ... FOR UPDATE`) required to eliminate race conditions during registration bursts.

### 3.3 ADR-03: Dynamic HMAC/TOTP Attendance Tokens vs Static QR Codes
- **Context:** Standard static QR codes displayed on paper or static screens can be easily photographed, sent via instant messaging, and scanned by absent peers, compromising attendance validity.
- **Decision:** Implement a dynamic rotating QR attendance mechanism utilizing HMAC-SHA256 time-window tokens (15 to 30 second validity).
- **Rationale:** Rotating cryptographic tokens ensure that only physically present attendees viewing the live display or presenting a refreshed personal token can be checked in. Once expired, intercepted tokens are immediately rejected by the server.

### 3.4 ADR-04: Cryptographically Verifiable Digital Certificates
- **Context:** Event completion certificates are frequently presented on student resumes and scholarship portfolios, creating a risk of digital forgery.
- **Decision:** Render certificates with embedded SHA-256 verification digests and a public QR link pointing to a stateless verification endpoint (`/api/v1/certificates/verify/{certificate_id}`).
- **Rationale:** Third-party evaluators, employers, and academic departments can verify authenticity instantly without needing system credentials.

### 3.5 ADR-05: Secure Password Hashing Strategy (bcrypt with Argon2id Roadmap)
- **Context:** User credential security is paramount for campus accounts.
- **Decision:** Standardize on bcrypt with 12 salt rounds for active production credentials, encapsulated behind an authentication abstraction enabling seamless migration to Argon2id in a future major release.
- **Rationale:** bcrypt with cost factor 12 provides robust defense against GPU-accelerated brute-force attacks and is supported natively by standard node environments without external native compilation dependencies.

---

## 4. Detailed Component and Module Design

### 4.1 Authentication and Role-Based Access Control (RBAC) Module
The authentication subsystem manages identity verification, session persistence, and permission enforcement across the platform.

```
+-----------------------------------------------------------------------------------------+
|                               AUTHENTICATION FLOW PIPELINE                              |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [Client Login Request]                                                                 |
|         |                                                                               |
|         v                                                                               |
|  +--------------------+                                                                 |
|  | Rate Limit Check   | ----> Exceeded (>5 attempts / 15m) ----> Return HTTP 429        |
|  +---------+----------+                                                                 |
|            | Valid Rate                                                                 |
|            v                                                                            |
|  +--------------------+                                                                 |
|  | Schema Validation  | ----> Malformed email/pass ------------> Return HTTP 400        |
|  +---------+----------+                                                                 |
|            | Valid Format                                                               |
|            v                                                                            |
|  +--------------------+                                                                 |
|  | DB User Lookup     | ----> User not found ------------------> Return HTTP 401        |
|  +---------+----------+                                                                 |
|            | Found                                                                      |
|            v                                                                            |
|  +--------------------+                                                                 |
|  | Password Verify    | ----> Argon2id mismatch ---------------> Return HTTP 401        |
|  +---------+----------+                                                                 |
|            | Verified                                                                   |
|            v                                                                            |
|  +-----------------------------------------------------------------------------------+  |
|  | Mint Tokens:                                                                      |  |
|  | - Access Token: JWT (15-minute TTL, payload: userId, email, role)                  |  |
|  | - Refresh Token: Cryptographic UUIDv4 (7-day TTL, stored hashed in DB)            |  |
|  | Set HTTP-only, Secure, SameSite=Strict Cookie for Refresh Token                   |  |
|  | Return Access Token and User Profile in JSON Payload (HTTP 200 OK)                 |  |
|  +-----------------------------------------------------------------------------------+  |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

#### 4-Tier RBAC Permission Grid:

| Resource Entity | Operation | Student | Club Executive | Faculty Advisor | System Administrator |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **User Accounts** | View Profile / Edit Self | Yes | Yes | Yes | Yes |
| **User Accounts** | Assign System Roles | No | No | No | Yes |
| **Clubs** | Browse Directory | Yes | Yes | Yes | Yes |
| **Clubs** | Create / Disable Club | No | No | No | Yes |
| **Clubs** | Edit Club Metadata | No | Yes (Own Club) | Yes (Own Club) | Yes |
| **Club Members** | Request / Join | Yes | No | No | No |
| **Club Members** | Approve / Remove Member| No | Yes (Own Club) | Yes (Own Club) | Yes |
| **Events** | View Published Events | Yes | Yes | Yes | Yes |
| **Events** | Draft & Submit Proposal| No | Yes (Own Club) | No | Yes |
| **Events** | Approve / Reject Event | No | No | Yes (Assigned) | Yes |
| **Registrations** | Register / Cancel Self | Yes | Yes | Yes | Yes |
| **Registrations** | View Attendee Roster | No | Yes (Own Event)| Yes (Assigned) | Yes |
| **Attendance** | Present Dynamic QR Pass| Yes | Yes | Yes | Yes |
| **Attendance** | Scan & Confirm Check-in| No | Yes (Own Event)| Yes (Assigned) | Yes |
| **Certificates** | View / Download Self | Yes | Yes | Yes | Yes |
| **Certificates** | Verify Public Credential| Public | Public | Public | Public |
| **Audit Logs** | Query System Audit Trail| No | No | No | Yes |

---

### 4.2 Concurrency-Safe Event Registration Engine
Event registrations are prone to race conditions when limited slots are offered to thousands of competing students. CampusConnect enforces strict transactional reservation logic:

```sql
-- Transactional Registration Execution Flow
BEGIN;

-- Step 1: Lock the event record to serialize concurrent registration requests
SELECT id, capacity, registered_count, status, registration_deadline
FROM events
WHERE id = $event_id
FOR UPDATE;

-- Step 2: Validate event operational status and deadline
IF status != 'PUBLISHED' OR NOW() > registration_deadline THEN
    ROLLBACK;
    RAISE EXCEPTION 'Event registration is closed';
END IF;

-- Step 3: Check existing registration status
SELECT id, status FROM registrations
WHERE user_id = $user_id AND event_id = $event_id;

IF FOUND THEN
    ROLLBACK;
    RAISE EXCEPTION 'User already registered for this event';
END IF;

-- Step 4: Evaluate capacity threshold
IF registered_count < capacity THEN
    -- Allocate confirmed slot
    INSERT INTO registrations (id, user_id, event_id, status, registered_at)
    VALUES (gen_random_uuid(), $user_id, $event_id, 'CONFIRMED', NOW());
    
    UPDATE events
    SET registered_count = registered_count + 1
    WHERE id = $event_id;
    
    COMMIT;
    -- Return HTTP 201 Created (Confirmed Slot)
ELSE
    -- Slot unavailable: place into automated waitlist in registrations table
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO next_pos 
    FROM registrations WHERE event_id = $event_id AND status = 'WAITLISTED';
    
    INSERT INTO registrations (id, event_id, user_id, ticket_code, status, waitlist_position, created_at)
    VALUES (gen_random_uuid(), $event_id, $user_id, $ticket_code, 'WAITLISTED', next_pos, NOW());
            
    COMMIT;
    -- Return HTTP 200 OK (Waitlisted Position)
END IF;
```

When a confirmed participant cancels their registration, the system invokes an automated promotion procedure:

```sql
-- Automated Waitlist Promotion Procedure
BEGIN;

-- Lock target event row
SELECT id, capacity, registered_count FROM events WHERE id = $event_id FOR UPDATE;

-- Update registration status to CANCELLED
UPDATE registrations SET status = 'CANCELLED' WHERE id = $registration_id;

-- If cancelled registration was confirmed, promote first waitlisted student
IF was_confirmed THEN
    UPDATE events SET registered_count = registered_count - 1 WHERE id = $event_id;

    -- Select first waitlisted student in FIFO order
    SELECT id, user_id FROM registrations 
    WHERE event_id = $event_id AND status = 'WAITLISTED' 
    ORDER BY waitlist_position ASC 
    LIMIT 1;

    IF FOUND THEN
        -- Promote waitlisted student to confirmed status
        UPDATE registrations SET status = 'CONFIRMED', waitlist_position = NULL WHERE id = next_in_line_id;
        
        UPDATE events SET registered_count = registered_count + 1 WHERE id = $event_id;
        
        -- Create notification for promoted student
        INSERT INTO notifications (id, user_id, title, message, link_url, is_read, created_at)
        VALUES (gen_random_uuid(), promoted_user_id, 'Waitlist Promotion Confirmed!',
                'A slot opened up and your registration has been automatically confirmed.',
                '/events/' || $event_id, FALSE, NOW());
    END IF;
END IF;

COMMIT;
```

---

### 4.3 Dynamic Anti-Proxy Attendance Architecture
To eliminate proxy check-ins where absent students obtain forwarded QR code screenshots, the platform utilizes time-windowed rotating tokens:

```
+-----------------------------------------------------------------------------------------+
|                             DYNAMIC QR ATTENDANCE LIFECYCLE                             |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [Live Event Projector / Executive Scanner]                                             |
|         |                                                                               |
|         | Generates rotating HMAC seed every 20 seconds:                                |
|         | Token = HMAC_SHA256(SecretKey, event_id + ":" + current_time_step)             |
|         v                                                                               |
|  [Display Dynamic QR Code on Screen]                                                    |
|         |                                                                               |
|         | Student scans live display with smartphone:                                   |
|         v                                                                               |
|  [POST /api/v1/attendance/check-in]                                                     |
|  Payload: { event_id, dynamic_token, user_location_opt }                                |
|         |                                                                               |
|         +---> Server verifies HMAC validity:                                            |
|         |     - Check token for current step (T0) and previous step (T-1, 20s grace)    |
|         |     - If step > T0 or step < T-1: REJECT (HTTP 400 "Token Expired")           |
|         |                                                                               |
|         +---> Server checks confirmed registration:                                     |
|         |     - Query registrations WHERE user_id = $user_id AND event_id = $event_id   |
|         |     - If not confirmed: REJECT (HTTP 403 "No Confirmed Registration")         |
|         |                                                                               |
|         +---> Check duplicate attendance:                                               |
|         |     - Query attendance_records WHERE user_id = $user_id                       |
|         |     - If already checked in: REJECT (HTTP 409 "Already Checked In")           |
|         |                                                                               |
|         v                                                                               |
|  [Record Recorded in attendance_records Table (HTTP 200 OK)]                            |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

---

### 4.4 Cryptographic Certificate Minting and Verification Pipeline
Upon successful attendance verification and optional event feedback completion, students become eligible for digital certificate issuance:

1. **Trigger:** Event Organizer closes event and triggers `/api/v1/certificates/generate/{event_id}` or student requests self-service download.
2. **Eligibility Verification:** Checks that `attendance_records.check_in_time IS NOT NULL` and `feedback_submissions.id IS NOT NULL` (if feedback mandatory).
3. **Payload Fingerprinting:**
   - Certificate Unique Serial: `CC-2026-UUID8`
   - Content String: `recipient_name|student_id|event_title|issue_date|organizer_id`
   - Cryptographic Digest: `SHA256(Content String + University_Private_Key)`
4. **PDF Generation (PDFKit / Canvas):**
   - Renders high-resolution vector layout with university seal and signatures.
   - Embeds verification QR code pointing directly to `https://campusconnect.edu/verify/{certificate_id}`.
5. **Public Stateless Verification:**
   - External visitor queries `GET /api/v1/certificates/verify/{certificate_id}`.
   - Backend queries `certificates` table and validates integrity hash.
   - Returns public JSON payload confirming student name, event title, club, and issue date with zero login required.

---

## 5. Relational Database Schema and Data Dictionary

The persistent layer comprises 13 core tables in PostgreSQL 16:

```
+-----------------------------------------------------------------------------------------+
|                               RELATIONAL ENTITY RELATIONSHIPS                           |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|       +----------------+                                                                |
|       |     users      |<----------------------+                                        |
|       +-------+--------+                       |                                        |
|         1 |   | 1                              | 1                                      |
|           |   |                                |                                        |
|           |   | * (faculty_advisor_id)         | *                                      |
|           |   +------->+----------------+      +-------+--------+                       |
|           |            |     clubs      |<-------------| club_memberships               |
|           |            +-------+--------+ 1          * +----------------+               |
|           |                    | 1                                                      |
|           | 1                  |                                                        |
|   +-------v------------+       | *                                                      |
|   |  student_profiles  |   +---v------------+                                           |
|   +--------------------+   |     events     |                                           |
|                            +---+---+---+----+                                           |
|                                | 1 | 1 | 1                                              |
|                                |   |   +-------------------+                            |
|                                |   |                     * |                            |
|                              * | * |                 +-----v----------+                 |
|                        +-------v---v----+            |  certificates  |                 |
|                        | registrations  |            +----------------+                 |
|                        +-------+--------+                                               |
|                                | 1                                                      |
|                                |                                                        |
|                                | 1                                                      |
|                        +-------v------------+        +----------------+                 |
|                        | attendance_records |        | notifications  |                 |
|                        +--------------------+        +----------------+                 |
|                                                                                         |
|   +--------------------+       +----------------+    +----------------+                 |
|   |  event_categories  |       |  announcements |    |    feedback    |                 |
|   +--------------------+       +----------------+    +----------------+                 |
|                                                                                         |
|   +--------------------+                                                                |
|   |     audit_logs     |                                                                |
|   +--------------------+                                                                |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

### 5.1 Data Dictionary and Table Definitions

#### Table 1: `users`
Represents all system actors across the 4 security tiers.
- `id` (VARCHAR(36), Primary Key)
- `email` (VARCHAR(255), Unique, Not Null)
- `password_hash` (VARCHAR(255), Not Null)
- `role` (VARCHAR(32), Default: `'STUDENT'`, Not Null)
- `status` (VARCHAR(32), Default: `'ACTIVE'`, Not Null)
- `created_at` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)
- `updated_at` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)

#### Table 2: `student_profiles`
Extended profile information for enrolled students.
- `id` (VARCHAR(36), Primary Key)
- `user_id` (VARCHAR(36), Unique, References `users(id)` ON DELETE CASCADE, Not Null)
- `student_id_number` (VARCHAR(64), Unique, Not Null)
- `full_name` (VARCHAR(128), Not Null)
- `department` (VARCHAR(128), Not Null)
- `batch_year` (INTEGER, Not Null)
- `phone_number` (VARCHAR(32), Nullable)
- `avatar_url` (VARCHAR(512), Nullable)

#### Table 3: `event_categories`
Taxonomy categories for campus extracurricular events.
- `id` (VARCHAR(36), Primary Key)
- `name` (VARCHAR(64), Unique, Not Null)
- `description` (TEXT, Nullable)

#### Table 4: `clubs`
Student clubs and societies registered within the university ecosystem.
- `id` (VARCHAR(36), Primary Key)
- `name` (VARCHAR(128), Unique, Not Null)
- `slug` (VARCHAR(128), Unique, Not Null)
- `description` (TEXT, Not Null)
- `category` (VARCHAR(64), Not Null)
- `logo_url` (VARCHAR(512), Nullable)
- `faculty_advisor_id` (VARCHAR(36), References `users(id)`, Not Null)
- `status` (VARCHAR(32), Default: `'ACTIVE'`, Not Null)
- `created_at` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)

#### Table 5: `club_memberships`
Associative mapping between users and clubs with executive role designations.
- `id` (VARCHAR(36), Primary Key)
- `club_id` (VARCHAR(36), References `clubs(id)` ON DELETE CASCADE, Not Null)
- `user_id` (VARCHAR(36), References `users(id)` ON DELETE CASCADE, Not Null)
- `club_role` (VARCHAR(32), Default: `'MEMBER'`, Not Null)
- `status` (VARCHAR(32), Default: `'PENDING'`, Not Null)
- `joined_at` (TIMESTAMPTZ, Nullable)
- **Constraints:** UNIQUE(`club_id`, `user_id`)

#### Table 6: `events`
Campus activities, seminars, workshops, and competitions.
- `id` (VARCHAR(36), Primary Key)
- `club_id` (VARCHAR(36), References `clubs(id)` ON DELETE CASCADE, Not Null, Indexed)
- `title` (VARCHAR(255), Not Null)
- `description` (TEXT, Not Null)
- `venue` (VARCHAR(255), Not Null)
- `start_time` (TIMESTAMPTZ, Not Null)
- `end_time` (TIMESTAMPTZ, Not Null)
- `capacity` (INTEGER, Not Null, Check: `capacity > 0`)
- `registered_count` (INTEGER, Default: 0, Not Null)
- `registration_deadline` (TIMESTAMPTZ, Not Null)
- `status` (VARCHAR(32), Default: `'DRAFT'`, Not Null, Indexed)
- `advisor_remarks` (TEXT, Nullable)
- `requires_feedback_for_cert` (BOOLEAN, Default: `TRUE`, Not Null)
- `created_by` (VARCHAR(36), References `users(id)`, Not Null)

#### Table 7: `registrations`
Student signups for specific events with atomic capacity tracking and waitlisting.
- `id` (VARCHAR(36), Primary Key)
- `event_id` (VARCHAR(36), References `events(id)` ON DELETE CASCADE, Not Null, Indexed)
- `user_id` (VARCHAR(36), References `users(id)` ON DELETE CASCADE, Not Null, Indexed)
- `ticket_code` (VARCHAR(64), Unique, Not Null)
- `status` (VARCHAR(32), Default: `'CONFIRMED'`, Not Null)
- `waitlist_position` (INTEGER, Nullable)
- `created_at` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)
- **Constraints:** UNIQUE(`event_id`, `user_id`)

#### Table 8: `attendance_records`
Verified physical or virtual event participation logs.
- `id` (VARCHAR(36), Primary Key)
- `event_id` (VARCHAR(36), References `events(id)` ON DELETE CASCADE, Not Null, Indexed)
- `user_id` (VARCHAR(36), References `users(id)` ON DELETE CASCADE, Not Null, Indexed)
- `registration_id` (VARCHAR(36), Unique, References `registrations(id)` ON DELETE CASCADE, Not Null)
- `check_in_time` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)
- `method` (VARCHAR(32), Not Null)
- `recorded_by` (VARCHAR(36), References `users(id)`, Not Null)

#### Table 9: `certificates`
Cryptographically signed credential records.
- `id` (VARCHAR(36), Primary Key)
- `serial_number` (VARCHAR(64), Unique, Not Null, Indexed)
- `event_id` (VARCHAR(36), References `events(id)` ON DELETE CASCADE, Not Null)
- `user_id` (VARCHAR(36), References `users(id)` ON DELETE CASCADE, Not Null)
- `pdf_url` (VARCHAR(512), Not Null)
- `sha256_hash` (VARCHAR(64), Not Null)
- `status` (VARCHAR(32), Default: `'VALID'`, Not Null)
- `issued_at` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)
- **Constraints:** UNIQUE(`event_id`, `user_id`)

#### Table 10: `announcements`
Broadcast notices issued at university or club level.
- `id` (VARCHAR(36), Primary Key)
- `club_id` (VARCHAR(36), References `clubs(id)` ON DELETE CASCADE, Not Null, Indexed)
- `author_id` (VARCHAR(36), References `users(id)`, Not Null)
- `title` (VARCHAR(255), Not Null)
- `content` (TEXT, Not Null)
- `created_at` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)

#### Table 11: `notifications`
In-app student and organizer notifications.
- `id` (VARCHAR(36), Primary Key)
- `user_id` (VARCHAR(36), References `users(id)` ON DELETE CASCADE, Not Null, Indexed)
- `title` (VARCHAR(255), Not Null)
- `message` (TEXT, Not Null)
- `link_url` (VARCHAR(512), Nullable)
- `is_read` (BOOLEAN, Default: `FALSE`, Not Null)
- `created_at` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)

#### Table 12: `feedback`
Attendee ratings and qualitative survey comments.
- `id` (VARCHAR(36), Primary Key)
- `event_id` (VARCHAR(36), References `events(id)` ON DELETE CASCADE, Not Null)
- `user_id` (VARCHAR(36), References `users(id)` ON DELETE CASCADE, Not Null)
- `rating` (INTEGER, Not Null, Check: `rating >= 1 AND rating <= 5`)
- `comments` (TEXT, Nullable)
- `is_anonymous` (BOOLEAN, Default: `FALSE`, Not Null)
- `submitted_at` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)
- **Constraints:** UNIQUE(`event_id`, `user_id`)

#### Table 13: `audit_logs`
Immutable compliance record of privileged operations.
- `id` (VARCHAR(36), Primary Key)
- `actor_id` (VARCHAR(36), Nullable)
- `action` (VARCHAR(128), Not Null)
- `entity_type` (VARCHAR(64), Not Null)
- `entity_id` (VARCHAR(64), Nullable)
- `details` (TEXT, Nullable)
- `ip_address` (VARCHAR(64), Nullable)
- `timestamp` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`, Indexed)

---

## 6. External Interfaces and RESTful API Design

All endpoints follow the RFC 7807 problem specification for error formatting and adhere to standard HTTP status codes.

### Standard Error Response Envelope (RFC 7807):
```json
{
  "type": "https://campusconnect.edu/errors/capacity-exceeded",
  "title": "Event Capacity Exceeded",
  "status": 409,
  "detail": "The requested event 'AI Innovation Workshop' has reached its limit of 50 confirmed attendees.",
  "instance": "/api/v1/events/c9b0e1a2-3f4d-4e5a-8b1c-9d0e1f2a3b4c/register",
  "timestamp": "2026-10-30T12:00:00Z"
}
```

### Complete API Endpoint Specifications:

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/register` | Public | Register student account with university email and student profile. |
| **POST** | `/api/v1/auth/login` | Public | Authenticate credentials; return JWT & set refresh cookie. |
| **POST** | `/api/v1/auth/refresh` | Cookie | Exchange refresh token for refreshed 15-minute JWT. |
| **POST** | `/api/v1/auth/logout` | Auth | Revoke refresh token and invalidate client cookies. |
| **GET** | `/api/v1/auth/me` | Auth | Retrieve profile and permissions of authenticated user. |
| **GET** | `/api/v1/auth/users` | Sys Admin | List all registered accounts with role filters. |
| **PATCH**| `/api/v1/auth/users/:id/role` | Sys Admin | Update user system role assignment. |
| **GET** | `/api/v1/clubs` | Public | List clubs with category and active status filtering. |
| **GET** | `/api/v1/clubs/:idOrSlug` | Public | Retrieve full club profile, executive board, and events. |
| **POST** | `/api/v1/clubs` | Sys Admin | Create a newly chartered student organization. |
| **POST** | `/api/v1/clubs/:clubId/apply` | Student | Submit membership request to target club. |
| **GET** | `/api/v1/clubs/:clubId/members` | Auth | Retrieve member roster with status filtering. |
| **PATCH**| `/api/v1/clubs/:clubId/members/:membershipId` | Club Exec | Approve or reject pending membership request. |
| **GET** | `/api/v1/clubs/:clubId/analytics` | Club Exec | Retrieve executive activity and membership metrics. |
| **GET** | `/api/v1/events` | Public | Browse upcoming published events with category filter. |
| **GET** | `/api/v1/events/:id` | Public | Retrieve event details, remaining slots, and speaker info. |
| **POST** | `/api/v1/events` | Club Exec | Create new event proposal in DRAFT state. |
| **POST** | `/api/v1/events/:id/submit` | Club Exec | Submit draft event to faculty advisor for review. |
| **POST** | `/api/v1/events/:id/review` | Advisor | Approve or reject event with mandatory written notes. |
| **POST** | `/api/v1/events/:eventId/register` | Student | Atomic slot registration or waitlist reservation. |
| **POST** | `/api/v1/registrations/:registrationId/cancel` | Student | Cancel registration; triggers automated waitlist promotion. |
| **GET** | `/api/v1/events/:eventId/attendance/live-qr` | Club Exec | Retrieve rotating HMAC attendance token for live display. |
| **POST** | `/api/v1/events/:eventId/attendance/scan` | Student | Submit dynamic QR token for attendance verification. |
| **POST** | `/api/v1/events/:eventId/attendance/manual` | Club Exec | Organizer fallback check-in for manual validation. |
| **POST** | `/api/v1/events/:eventId/certificates/issue` | Club Exec | Generate tamper-proof completion certificates. |
| **GET** | `/api/v1/certificates/me` | Student | List all certificates earned by authenticated student. |
| **GET** | `/api/v1/certificates/verify/:serialNumber` | Public | Stateless public verification of certificate validity. |
| **GET** | `/api/v1/analytics/admin` | Sys Admin | Query system-wide metrics and institutional KPIs. |
| **GET** | `/api/v1/health` | Public | Service liveness and health probe. |

---

## 7. Security Architecture and Compliance

### 7.1 OWASP Top 10 Security Defenses

| Threat Category | Potential Attack Vector | CampusConnect Architectural Mitigation |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Student invoking advisor moderation endpoint. | Explicit RBAC middleware verifying `req.user.role` on every protected route. |
| **A02: Cryptographic Failures** | Exposed passwords or intercepted session tokens. | Argon2id password hashing, HTTPS TLS 1.3 encryption, and HTTP-only SameSite cookies. |
| **A03: Injection** | SQL injection via event search or parameter inputs. | Parameterized queries using PostgreSQL native bindings; zero string interpolation. |
| **A04: Insecure Design** | Over-booking event slots due to parallel race conditions. | Pessimistic row-level locking (`SELECT ... FOR UPDATE`) within ACID transactions. |
| **A05: Security Misconfiguration**| Verbose stack traces leaking database structure. | Global error handling middleware suppressing internal stack traces in production. |
| **A07: Identification Failures** | Brute-force credential stuffing on student accounts. | Redis-backed token bucket rate limiting (5 failed attempts per 15-minute window). |
| **A08: Software & Data Integrity**| Modifying certificate PDF contents to falsify award. | SHA-256 digital signature embedding and external verification against database records. |
| **A09: Logging & Monitoring** | Covert unauthorized privilege escalation. | Immutable `audit_logs` table recording actor, action, timestamp, and IP address. |

---

## 8. Scalability and Performance Engineering

1. **Connection Pooling:** PostgreSQL database connections managed via a shared pool with sizing configured to:
   $$\text{Max Connections} = (\text{CPU Cores} \times 2) + \text{Disk Spindles}$$
   For a standard 4-core cloud instance, pool size is restricted to 20 connections to minimize context switching.
2. **In-Memory Caching:** Redis 7 caches high-frequency read operations (such as the active club directory and event catalog) with a 5-minute Time-To-Live (TTL). Cache invalidation hooks trigger whenever an event status updates.
3. **Database Indexing:** B-Tree composite indexes applied on high-cardinality foreign key pairs (`registrations(event_id, user_id)`, `events(club_id, status)`).
4. **Latency Verification:** Performance targets enforced via automated k6 load tests:
   - Read operations: p95 < 250ms under 500 concurrent connections.
   - Write operations (Registration / Attendance): p95 < 400ms under 200 concurrent connections.

---
