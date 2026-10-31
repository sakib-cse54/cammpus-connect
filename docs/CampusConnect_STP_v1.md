# Software Test Plan (STP)
## CampusConnect: University Club, Event & Activity Management Platform

**Document Identifier:** CC-STP-2026-V1.0  
**Engineering Baseline Version:** 1.0  
**Date:** October 2026  
**Software Engineering Lead:** Md. Shakhawat Hossain (Student ID: 0432320005101009) | Department of Computer Science and Engineering  
**Academic Supervisor & Course Advisor:** Al Imtiaz | Department of Computer Science and Engineering  
**Standard Compliance:** ISO/IEC/IEEE 29119-3:2013 (Software Testing: Test Documentation)  
**Status:** Approved Quality Assurance Baseline  

---

## 1. Introduction and Test Objectives

### 1.1 Purpose
This Software Test Plan (STP) defines the verification and validation framework for **CampusConnect**, a centralized university extracurricular and club management platform. This document operationalizes the acceptance criteria defined in the Software Requirements Specification (`CC-SRS-2026-V2.0`) and the technical architecture specified in the Software Design Document (`CC-SDD-2026-V1.0`).

### 1.2 Test Objectives
The testing program must verify system correctness, security posture, and resilience across the following core dimensions:

1. **ACID Concurrency Verification:** Validate that parallel registration bursts hitting capacity limits never produce over-booking, negative slot counts, or unhandled database deadlocks.
2. **Dynamic Attendance Security:** Verify that rotating HMAC-SHA256 tokens strictly expire within their designated time window (20 seconds) and resist screenshot-sharing replay attacks.
3. **Cryptographic Certificate Integrity:** Confirm that generated PDF certificates accurately reflect event participation records and that any payload tampering invalidates the verification hash.
4. **Role-Based Access Enforcement:** Validate that horizontal and vertical privilege escalation attempts between Student, Club Executive, Faculty Advisor, and System Administrator roles are blocked with HTTP 403 Forbidden.
5. **Coverage and Performance Baselines:** Enforce a minimum of 85% statement coverage across business logic modules and confirm p95 API response times under 250ms for read operations and under 400ms for write operations.

### 1.3 Standards and Punctuation
- **Punctuation Standard:** Strictly utilizes standard ASCII hyphens (-), colons (:), and pipes (|). Zero em-dashes or en-dashes are permitted across all documentation and test suites.
- **Testing Standard:** ISO/IEC/IEEE 29119-3:2013 (Software Testing: Test Documentation) and IEEE Std 829-2008.

---

## 2. Test Strategy and Testing Pyramid

CampusConnect adopts a multi-tier test pyramid balancing fast unit tests, deterministic integration tests, high-concurrency race condition simulations, and security penetration suites:

```
+-----------------------------------------------------------------------------------------+
|                                    TESTING PYRAMID                                      |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|                                       / \                                               |
|                                      /   \                                              |
|                                     / E2E \  --> Automated User Flows                   |
|                                    /-------\                                            |
|                                   / Concurr \ --> k6 High-Concurrency Burst (Race Tests)|
|                                  /-----------\                                          |
|                                 / Integration \ --> Supertest + Real PostgreSQL Engine  |
|                                /---------------\                                        |
|                               /   Unit Testing  \ --> Vitest: Crypto, Hash, Zod Schemas |
|                              +-------------------+                                      |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

### 2.1 Testing Levels

#### Level 1: Unit Testing (Vitest)
- **Scope:** Pure functions, cryptographic algorithms, hash verification, utility formatters, and Zod input validation schemas.
- **Isolation:** Executes in memory without network or external database dependencies.
- **Coverage Target:** >= 85% statement and branch coverage.

#### Level 2: API Integration Testing (Supertest + PostgreSQL)
- **Scope:** REST route handlers, controller logic, middleware chaining (authentication, rate limiting, RBAC authorization), and database transactions.
- **Environment:** Dedicated test database container with per-suite deterministic seeding and transactional rollbacks.

#### Level 3: Concurrency and Load Testing (k6)
- **Scope:** Event registration burst simulations (e.g., 200 virtual users competing simultaneously for 10 available event slots).
- **Verification:** Verification of atomic row locking (`SELECT ... FOR UPDATE`), FIFO waitlist allocation, zero over-allocation, and zero unhandled SQL deadlocks.

#### Level 4: Security and Penetration Testing
- **Scope:** OWASP Top 10 vulnerabilities, unauthorized role elevation, JWT tampering, SQL injection payloads, and dynamic QR replay windows.

---

## 3. Test Environment and Tooling Configuration

| Component | Technology | Configuration / Usage |
| :--- | :--- | :--- |
| **Test Runner** | Vitest 3.0+ | Fast TypeScript execution with native ESM and parallel test workers. |
| **HTTP Assertions** | Supertest 7.0+ | Direct HTTP request dispatch against Express application instance. |
| **Test Relational DB**| PostgreSQL 16 (Docker) | Isolated database instance: `campusconnect_test` running on port 5433. |
| **Cache & Rate Limiting**| Sliding Window / Redis 7 | In-memory sliding window map with Redis 7 container configuration. |
| **Load Testing Engine**| k6 | Scripted multi-threaded virtual user stress execution. |
| **Code Coverage** | Vitest V8 Coverage | Configured in `vitest.config.ts` enforcing 85% coverage thresholds. |

---

## 4. Comprehensive Test Case Specifications

### 4.1 Authentication and Access Control (TC-AUTH)

| Test ID | Test Title | Precondition | Input / Trigger | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | Student Account Registration | Valid student email and ID format. | POST `/api/v1/auth/register` with name, email, department, student ID, password. | HTTP 201 Created. User record persisted with bcrypt password hash. |
| **TC-AUTH-02** | Duplicate Email Rejection | Account with target email already exists. | POST `/api/v1/auth/register` with identical email address. | HTTP 409 Conflict. Clear RFC 7807 error message: 'Email address already registered'. |
| **TC-AUTH-03** | Valid Credential Login | User account in ACTIVE status. | POST `/api/v1/auth/login` with correct email and password. | HTTP 200 OK. Returns 15-min JWT access token and sets HTTP-only refresh cookie. |
| **TC-AUTH-04** | Invalid Password Rejection | Registered account exists. | POST `/api/v1/auth/login` with incorrect password. | HTTP 401 Unauthorized. Error response prevents account enumeration. |
| **TC-AUTH-05** | Rate Limiting on Brute Force | IP address with zero prior attempts. | Dispatch 6 consecutive invalid login requests within 60 seconds. | First 5 requests return HTTP 401; 6th request is rejected with HTTP 429 Too Many Requests. |
| **TC-AUTH-06** | Token Refresh Rotation | Valid refresh cookie present. | POST `/api/v1/auth/refresh` without request body. | HTTP 200 OK. Returns new JWT access token and rotates refresh token in database. |
| **TC-AUTH-07** | Revoked Token Rejection | User previously logged out. | Present invalidated refresh token to `/api/v1/auth/refresh`. | HTTP 401 Unauthorized. Refresh request rejected; client cookies cleared. |

---

### 4.2 Club Management and Membership (TC-CLUB)

| Test ID | Test Title | Precondition | Input / Trigger | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **TC-CLUB-01** | Public Directory Query | Multiple active clubs seeded in DB. | GET `/api/v1/clubs` with category filter `TECHNOLOGY`. | HTTP 200 OK. Returns JSON array of matching clubs with summary counts. |
| **TC-CLUB-02** | Membership Application | Authenticated student not in target club. | POST `/api/v1/clubs/:clubId/apply`. | HTTP 201 Created. Record added to `club_memberships` in PENDING status. |
| **TC-CLUB-03** | Duplicate Membership Rejection | Student membership already PENDING or APPROVED.| POST `/api/v1/clubs/:clubId/apply` for same club. | HTTP 409 Conflict. Rejects redundant application. |
| **TC-CLUB-04** | Executive Membership Approval | Club Executive authenticated for target club. | PATCH `/api/v1/clubs/:clubId/members/:membershipId` with status `APPROVED`. | HTTP 200 OK. Membership status transitions to APPROVED; joined_at timestamp set. |
| **TC-CLUB-05** | Unauthorized Membership Approval| Authenticated student not holding executive role.| PATCH `/api/v1/clubs/:clubId/members/:membershipId` with status `APPROVED`. | HTTP 403 Forbidden. Privilege escalation blocked. |

---

### 4.3 Event Governance and Registration Concurrency (TC-EVENT)

| Test ID | Test Title | Precondition | Input / Trigger | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **TC-EVENT-01** | Event Proposal Creation | Authenticated Club Executive. | POST `/api/v1/events` with valid event metadata and capacity = 50. | HTTP 201 Created. Event initialized in DRAFT status. |
| **TC-EVENT-02** | Advisor Review Approval | Event in SUBMITTED state; Faculty Advisor authenticated. | POST `/api/v1/events/:id/review` with status `APPROVED`. | HTTP 200 OK. Event status transitions to PUBLISHED; visible to students. |
| **TC-EVENT-03** | Advisor Rejection with Remarks | Event in SUBMITTED state; Faculty Advisor authenticated. | POST `/api/v1/events/:id/review` with status `REJECTED` and reason text. | HTTP 200 OK. Event status transitions to REJECTED; rejection_reason recorded. |
| **TC-EVENT-04** | Concurrency Race Condition Test | Event has capacity = 5 and registered_count = 4 (1 slot left). | 10 students submit POST `/api/v1/events/:eventId/register` simultaneously. | Exactly 1 student receives HTTP 201 CONFIRMED; remaining 9 receive HTTP 200 WAITLISTED. Registered count = exactly 5. |
| **TC-EVENT-05** | Waitlist FIFO Promotion | Event at capacity (50/50); 3 students on waitlist. | Confirmed participant cancels registration via POST `/api/v1/registrations/:registrationId/cancel`. | HTTP 200 OK. First waitlisted student automatically promoted to CONFIRMED. Capacity remains 50/50. |
| **TC-EVENT-06** | Post-Deadline Registration Block| Current timestamp > registration_deadline. | Student attempts POST `/api/v1/events/:eventId/register`. | HTTP 400 Bad Request. 'Registration deadline has passed'. |

---

### 4.4 Dynamic Anti-Proxy Attendance (TC-ATTEND)

| Test ID | Test Title | Precondition | Input / Trigger | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **TC-ATTEND-01** | Live Token Generation | Authenticated Club Executive for ongoing event. | GET `/api/v1/events/:eventId/attendance/live-qr`. | HTTP 200 OK. Returns dynamic HMAC token and 20-second time-step countdown. |
| **TC-ATTEND-02** | Valid Check-in Scan | Confirmed student scans dynamic token within 20s. | POST `/api/v1/events/:eventId/attendance/scan` with dynamic token. | HTTP 200 OK. Attendance logged in `attendance_records` table with timestamp. |
| **TC-ATTEND-03** | Expired Screenshot Rejection | Dynamic token generated 60 seconds prior. | Student submits expired token via POST `/api/v1/events/:eventId/attendance/scan`. | HTTP 400 Bad Request. 'Dynamic QR token expired. Please rescan live display.' |
| **TC-ATTEND-04** | Duplicate Check-in Block | Student already checked in for target event. | Student attempts second check-in scan. | HTTP 409 Conflict. 'Attendance already recorded for this participant.' |
| **TC-ATTEND-05** | Non-Registered Student Block | Student holds no registration record for event. | Student submits valid dynamic attendance token. | HTTP 403 Forbidden. 'No confirmed registration found for this event.' |

---

### 4.5 Digital Certificates and Verification (TC-CERT)

| Test ID | Test Title | Precondition | Input / Trigger | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **TC-CERT-01** | Eligible Certificate Generation | Student holds verified attendance record. | GET `/api/v1/certificates/me`. | HTTP 200 OK. Returns certificate list with unique serial and download link. |
| **TC-CERT-02** | Ineligible Certificate Block | Student registered but did not attend event. | Student requests certificate generation for target event. | HTTP 403 Forbidden. 'Attendance verification required prior to certificate issuance.' |
| **TC-CERT-03** | Public Credential Verification | Valid certificate CC-2026-A1B2C3D4 in database. | Unauthenticated visitor queries GET `/api/v1/certificates/verify/CC-2026-A1B2C3D4`. | HTTP 200 OK. Returns student name, event title, issuing club, date, and status 'VALID'. |
| **TC-CERT-04** | Invalid Serial Verification | Non-existent or corrupted certificate serial. | Unauthenticated visitor queries GET `/api/v1/certificates/verify/INVALID-SERIAL`. | HTTP 404 Not Found. RFC 7807 error stating certificate record does not exist. |

---

## 5. Concurrency Load Test Specification (k6 Script Definition)

To validate ACID isolation and ensure that race conditions cannot breach capacity limits, the following k6 stress test scenario is executed in CI/CD:

```javascript
// k6 Concurrency Benchmark: Event Registration Rush
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    registration_burst: {
      executor: 'per-vu-iterations',
      vus: 100, // 100 simultaneous virtual users
      iterations: 1,
      maxDuration: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<400'], // 95% of write requests must complete under 400ms
    http_req_failed: ['rate<0.01'],    // Network/server errors must be less than 1%
  },
};

export default function () {
  const eventId = 'e2b3c4d5-6a7b-8c9d-0e1f-2a3b4c5d6e7f'; // Seeded event with capacity = 10
  const token = __ENV[`TOKEN_VU_${__VU}`]; // Pre-authenticated student JWT
  
  const res = http.post(
    `http://localhost:5000/api/v1/events/${eventId}/register`,
    JSON.stringify({}),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  check(res, {
    'Status is 201 Created or 200 Waitlisted': (r) => r.status === 201 || r.status === 200,
    'No 500 Internal Server Errors': (r) => r.status !== 500,
  });
}
```

### Verification Criteria for Concurrency Run:
1. Total registrations with status `CONFIRMED` in database must equal exactly 10.
2. Total registrations with status `WAITLISTED` in database must equal exactly 90.
3. Event column `registered_count` must equal exactly 10.
4. Total HTTP 500 errors must equal 0.

---

## 6. Traceability Matrix (Requirements to Test Cases)

| Requirement ID | Requirement Description | Test Case Mapping | Acceptance Scenario |
| :--- | :--- | :--- | :--- |
| **FR-01** | Student Self-Registration | TC-AUTH-01, TC-AUTH-02 | AC-01 |
| **FR-02** | Credential Authentication | TC-AUTH-03, TC-AUTH-04, TC-AUTH-05 | AC-02 |
| **FR-03** | Token Session Lifecycle | TC-AUTH-06, TC-AUTH-07 | AC-03 |
| **FR-06** | Club Discovery & Directory | TC-CLUB-01 | AC-04 |
| **FR-07** | Membership Application & Roster | TC-CLUB-02, TC-CLUB-03, TC-CLUB-04 | AC-05 |
| **FR-09** | Event Proposal Lifecycle | TC-EVENT-01, TC-EVENT-02, TC-EVENT-03 | AC-06 |
| **FR-14** | Concurrency-Safe Registration | TC-EVENT-04 | AC-07 |
| **FR-15** | Automated Waitlist Promotion | TC-EVENT-05 | AC-08 |
| **FR-17** | Dynamic Rotating QR Attendance | TC-ATTEND-01, TC-ATTEND-02, TC-ATTEND-03 | AC-09 |
| **FR-18** | Duplicate Check-in Prevention | TC-ATTEND-04, TC-ATTEND-05 | AC-10 |
| **FR-20** | Digital Certificate Issuance | TC-CERT-01, TC-CERT-02 | AC-11 |
| **FR-22** | Public Credential Verification | TC-CERT-03, TC-CERT-04 | AC-12 |

---

## 7. Pass / Fail Criteria and Quality Gates

For a software build to pass engineering review and be declared ready for deployment:

1. **Unit Test Pass Rate:** 100% of unit tests in Vitest must pass without skips or mocks bypassing logic.
2. **Code Coverage Threshold:** Global statement coverage >= 85%, branch coverage >= 80%, function coverage >= 90%.
3. **Integration Test Pass Rate:** 100% of Supertest route tests against PostgreSQL must pass.
4. **Concurrency Assertion:** k6 race condition suite must complete with zero over-allocations and zero database lock timeouts.
5. **Security Scan:** Zero High or Critical vulnerabilities identified by automated npm audit and static security analyzers.

---
