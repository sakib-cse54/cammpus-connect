# CampusConnect API Changes v3 | Frontend Build Reference

Base path: `/api/v1` (unless noted). All timestamps in responses are ISO 8601 UTC strings (`2026-11-02T04:00:00.000Z`). All datetimes sent by the client must be ISO 8601 **with an offset**, for example `2026-11-02T10:00:00+06:00` (Asia/Dhaka, UTC+06:00, no DST). Calendar days (`YYYY-MM-DD`) are Dhaka calendar days.

Authentication: `Authorization: Bearer <access token>` (or the `access_token` cookie). An expired or invalid token returns 401 with `code` `TOKEN_EXPIRED` or `TOKEN_INVALID`; on `TOKEN_EXPIRED` call `POST /auth/refresh`.

This document covers every endpoint added or changed by the v3 backend work: foundation, security and event lifecycle, academic calendar and venues, check-in v2 and signed certificates, and the OBE co-curricular transcript (BAETE PO1 to PO12).

---

## 1. Common conventions

### 1.1 Error envelope

Every error uses one shape. Each response also carries an `X-Request-Id` header.

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "issues": [{ "path": "end_time", "message": "end_time must be after start_time" }],
  "requestId": "6f1c0b0e-2a7d-4b55-9c1e-1f0f5d1d9a11"
}
```

| Status | Meaning |
|---|---|
| 400 | Validation failed (`issues` lists each field) |
| 401 | Not logged in, or token expired/invalid |
| 403 | Logged in but not allowed |
| 404 | Not found (also used to hide non-public resources) |
| 409 | State conflict (wrong status, duplicate, schedule conflict) |
| 429 | Rate limited |
| 500 | `{ "error": "Internal Server Error", "requestId": "..." }` only; quote the `requestId` in bug reports |

### 1.2 Club access roles

Several endpoints say "club role". That means one of:

- `ADMIN` (platform admin),
- `ADVISOR` (the club's faculty advisor),
- `EXECUTIVE` (an APPROVED member with club role PRESIDENT, EXECUTIVE or TREASURER).

### 1.3 Event status machine

```
DRAFT -> PENDING_APPROVAL | CANCELLED
PENDING_APPROVAL -> PUBLISHED | REJECTED | CANCELLED
REJECTED -> PENDING_APPROVAL
PUBLISHED -> CANCELLED | COMPLETED
```

An illegal or concurrent transition returns 409. Only `PUBLISHED`, `COMPLETED` and `CANCELLED` events are public.

---

## 2. Clubs and memberships

### GET /me/clubs (new, logged in)

Clubs the caller can manage or belongs to as an office bearer.

```json
{ "clubs": [{ "id": "club-uits-computer", "name": "UITS Computer Club", "slug": "uits-computer-club", "category": "Technology", "logo_url": null, "role": "EXECUTIVE" }] }
```

`role` is `PRESIDENT`, `EXECUTIVE`, `TREASURER` or `FACULTY_ADVISOR`.

### GET /clubs/:clubId/events (new, club role)

All events of the club in every status, with `waitlist_count`.

```json
{ "events": [{ "id": "event-ai-web-workshop", "title": "...", "status": "DRAFT", "start_time": "2026-11-02T04:00:00.000Z", "waitlist_count": 0 }] }
```

### PATCH /clubs/:clubId/members/:membershipId (changed, club role)

Request body changed from `{status}` to:

```json
{ "decision": "APPROVED", "role": "MEMBER" }
```

- `decision`: `APPROVED` or `REJECTED`. `role` (optional): `MEMBER`, `EXECUTIVE`, `TREASURER`, `PRESIDENT`.
- Only `PENDING` memberships can be reviewed (409 otherwise). You cannot review your own (403). Only the advisor or an admin can grant `PRESIDENT` (403).
- 404 when the membership does not belong to `:clubId`.

### GET /clubs/:clubId/members (changed)

Club managers get the full rows. Everyone else gets only `full_name` and `club_role`. The response has a `view` field:

```json
{ "members": [{ "full_name": "Ayesha Siddiqua", "club_role": "MEMBER" }], "view": "PUBLIC" }
```

### GET /clubs/:idOrSlug (changed)

The public club profile no longer includes email, student id or department of members/advisor.

### POST /clubs/:clubId/announcements (changed)

The club comes only from the URL (a `club_id` in the body is ignored). The announcement and member notifications are written atomically.

---

## 3. Events

### GET /events (changed, public)

Query: `search?`, `category?`, `club_id?`, `status?` where `status` is only `PUBLISHED` (default), `COMPLETED` or `CANCELLED`.

### GET /events/:id (changed, optional auth)

Non-public events return 404 unless the caller has a club role for the event's club.

### POST /events (changed, ADMIN or club executive of `club_id`)

```json
{
  "club_id": "club-uits-computer",
  "title": "Intro to Rust",
  "description": "Hands-on session",
  "venue_id": "venue-computer-lab-501",
  "start_time": "2026-11-12T10:00:00+06:00",
  "end_time": "2026-11-12T12:00:00+06:00",
  "registration_deadline": "2026-11-11T23:59:00+06:00",
  "capacity": 60,
  "requires_feedback_for_cert": true,
  "override_reason": "Approved by registrar for exam week",
  "po_tags": [{ "code": "PO5", "weight": 3 }, { "code": "PO12", "weight": 1 }]
}
```

- `venue` (free text) or `venue_id` is required. When `venue_id` is given, `venue` is filled with the venue name.
- Rules: start before end; deadline on or before start; capacity 1 to 5000.
- `po_tags` (optional): proposed BAETE PO tags, see section 8.
- `override_reason` (5 to 500 chars) lets an ADMIN or the club advisor bypass schedule errors (logged to the audit log). Anyone else gets 403 `OVERRIDE_FORBIDDEN`.

Response 201:

```json
{ "message": "Event drafted successfully", "eventId": "1b8f...", "schedule_warnings": [{ "code": "BLACKOUT_WARN", "message": "Overlaps Victory Day" }] }
```

Schedule conflict, 409:

```json
{ "error": "Schedule conflict", "code": "SCHEDULE_CONFLICT", "issues": [{ "path": "VENUE_CONFLICT", "message": "Computer Lab 501 is booked by 'Hackathon' at that time" }] }
```

### PATCH /events/:id (new, ADMIN or club executive)

Any subset of: `title`, `description`, `venue`, `venue_id`, `start_time`, `end_time`, `registration_deadline`, `capacity`, `requires_feedback_for_cert`, `override_reason`, `po_tags`. Only `DRAFT` or `REJECTED` events (409 otherwise). The schedule is re-checked only when time, venue or capacity changes. Sending `po_tags` replaces the event's whole tag set (`[]` clears it).

```json
{ "message": "Event updated", "event": { "id": "...", "status": "DRAFT" }, "po_tags": [{ "code": "PO5", "weight": 3, "title_en": "Modern tool usage", "title_bn": "..." }], "schedule_warnings": [] }
```

### POST /events/:id/submit (changed, ADMIN or club executive)

Body (optional): `{ "override_reason": "..." }`. Re-checks the schedule. Response: `{ "message": "...", "schedule_warnings": [] }`.

### POST /events/:id/review (changed, ADMIN or club advisor)

```json
{ "decision": "APPROVED", "remarks": "Looks good", "override_reason": "optional", "po_tags": [{ "code": "PO9", "weight": 2 }] }
```

- Only `PENDING_APPROVAL` events (409 otherwise). `remarks` required when rejecting.
- On `APPROVED` the advisor may set/override PO tags. The event must end up with at least one tag: if `po_tags` is missing or empty and the event has no tags yet, the response is 400 with `code` `PO_TAGS_REQUIRED`.
- Schedule check and approval run in one transaction.

Response: `{ "message": "Event proposal has been approved and is now published", "schedule_warnings": [] }`

### POST /events/:id/cancel (new, club role)

`{ "reason": "Venue flooded" }` (3 to 1000 chars). Cancels active registrations and notifies registrants. A `PUBLISHED` event whose `start_time` has passed cannot be cancelled: 409 `EVENT_ALREADY_STARTED` (use `POST /events/:id/complete` instead), so attendance and issued certificates stay consistent.

```json
{ "message": "Event cancelled successfully", "registrations_cancelled": 12 }
```

### POST /events/:id/complete (new, club role)

No body. 409 unless `PUBLISHED`, 400 before `end_time`. Response `{ "message": "Event marked as completed" }`.

### GET /events/review/pending (unchanged route; advisors see only their clubs)

---

## 4. Registrations

### POST /events/:eventId/register (changed)

Seats are taken atomically; a full event puts you on the waitlist. Registration closes at the event start.

201:

```json
{ "status": "CONFIRMED", "ticketCode": "TCK-...", "registrationId": "...", "message": "Registration confirmed successfully" }
```

200 when full: `{ "status": "WAITLISTED", "waitlistPosition": 3, "ticketCode": "...", "registrationId": "...", "message": "..." }`.

### POST /registrations/:registrationId/cancel (changed)

Only `CONFIRMED` or `WAITLISTED`, before start, on a `PUBLISHED` event. The first waitlisted student is promoted and notified. Response `{ "message": "...", "promotedWaitlistCandidate": true }`.

### GET /events/:eventId/roster (changed: club role required)

---

## 5. Attendance and check-in v2

### GET /events/:eventId/attendance/live-qr (club role)

```json
{ "event_id": "event-ai-web-workshop", "token": "...", "short_code": "482913", "checkin_url": "http://localhost:5173/checkin/event-ai-web-workshop?t=...", "qr_data_url": "data:image/png;base64,...", "rotation_interval_seconds": 20, "expires_in_seconds": 13 }
```

The QR encodes `checkin_url`. Tokens rotate every 20 seconds; the current and previous slot are accepted.

### POST /events/:eventId/attendance/scan (changed, logged-in student)

Headers: optional `X-Device-Id: <uuid>` (400 if malformed).

```json
{ "token": "...", "lat": 23.8012, "lng": 90.4281, "accuracy": 25 }
```

or `{ "short_code": "482913" }` (exactly one of `token` / `short_code`). `student_id` is ignored (no proxy check-in).

- Check-in window: event `PUBLISHED`, from 30 minutes before start until end. Duplicate check-in: 409.
- Out-of-range scans are recorded and flagged, not rejected.

Response 201:

```json
{ "message": "Attendance successfully confirmed via dynamic QR scan", "attendance_id": "...", "flags": ["OUT_OF_RANGE"], "distance_m": 412.6 }
```

Flags: `OUT_OF_RANGE`, `SHARED_DEVICE`.

### POST /events/:eventId/attendance/manual (changed, club role)

Now requires `reason`: `{ "student_id_number": "0432320005101003", "reason": "Phone battery dead" }` -> 201 `{ "message": "...", "attendance_id": "..." }`.

### POST /events/:eventId/attendance/batch (new, club role)

Offline scans uploaded later. Body is an array or `{ "items": [...] }`, 1 to 500 items:

```json
{ "items": [{ "ticket_code": "TCK-RAHIM-01", "scanned_at": "2026-11-02T10:05:00+06:00", "idempotency_key": "b2c1..." }] }
```

```json
{ "event_id": "...", "processed": 1, "checked_in": 1, "results": [{ "idempotency_key": "b2c1...", "ticket_code": "TCK-RAHIM-01", "status": "CHECKED_IN", "attendance_id": "..." }] }
```

`status`: `CHECKED_IN`, `DUPLICATE`, `NOT_FOUND`, `INELIGIBLE`, `OUT_OF_WINDOW`. Replaying a batch is safe.

### GET /events/:eventId/attendance (changed, club role)

Each attendee has `flags: string[]` and `distance_m`; a top-level `flagged_count` is added.

---

## 6. Certificates

### POST /events/:eventId/certificates/issue (changed)

Body `{ "user_id": "optional" }` (honoured only for club roles). Requires attendance, the event ended or `COMPLETED`, not `CANCELLED`, and feedback if the event requires it (403 otherwise). An existing certificate is returned with 200; a new one with 201. While another request is still generating the same certificate the response is 409 `CERTIFICATE_PENDING` (retry shortly); a claim left `PENDING` for more than 10 minutes (e.g. a crash mid-render) is re-claimed and issued normally. `pdf_url` is a logical path only and cannot be fetched; download through the route below.

```json
{ "message": "Certificate successfully generated and cryptographically signed", "certificate": { "id": "...", "serial_number": "CC-2026-N6JPJI4KO54QIMFP5XAKP7VA4E", "pdf_url": "/storage/certificates/CC-2026-....pdf", "sha256_hash": "674d...", "status": "VALID" } }
```

### GET /certificates/download/:serialNumber (changed: login required)

Owner, club role or admin. Returns the PDF. The old `/storage/...` static URLs are removed; fetch PDFs through this route with the auth header.

### POST /certificates/:serialNumber/revoke (new, ADMIN or club advisor)

`{ "reason": "Issued in error" }` -> `{ "message": "Certificate revoked", "serial_number": "CC-...", "status": "REVOKED" }`; 409 if not VALID.

### GET /certificates/verify/:serialNumber (changed, public, 60/min/IP)

Student id is masked to the last 4 digits; department is not returned.

### GET /certificates/:serialNumber/credential (new, public, 60/min/IP)

```json
{
  "jws": "eyJhbGciOiJFZERTQSIs...",
  "status": "VALID",
  "payload": {
    "iss": "CampusConnect UITS", "sub": "************1007", "name": "Ayesha Siddiqua",
    "event": "Intra-University Programming Contest", "club": "UITS Computer Club", "event_date": "2026-10-16",
    "issued_at": "2026-10-30T13:40:00.000Z", "serial": "CC-2026-N6JP...", "po": ["PO1", "PO2", "PO5"], "sha256": "674d..."
  }
}
```

`po` now lists the event's BAETE PO tags at issue time. 404 if unknown or issued before signing existed.

### POST /certificates/verify-jws (new, public, 60/min/IP)

`{ "jws": "..." }` ->

```json
{ "valid": true, "signature_valid": true, "kid": "a1b2c3d4e5f60718", "payload": { "serial": "CC-..." }, "status": "VALID" }
```

On failure `valid: false` with `reason`: `BAD_SIGNATURE`, `MALFORMED` (including a payload without a string `serial`), `UNSUPPORTED_ALG`, `UNKNOWN_KID`, `WRONG_TYPE` (a validly signed JWS of another credential type, e.g. a transcript), `UNKNOWN_SERIAL`, `REVOKED` (plus `revoked_at`) or `SUPERSEDED`. `signature_valid` is `false` for every reason before `UNKNOWN_SERIAL`.

Type binding: certificate JWS headers are `{ "alg": "EdDSA", "typ": "JWT", "cty": "CC-CERTIFICATE", "kid": "..." }`; transcript JWS headers carry `"cty": "CC-OBE-TRANSCRIPT"` and the payload `typ` must match. Certificates signed before this change (no `cty`, no payload `typ`) still verify.

### GET /.well-known/jwks.json (new, public; also at the app root without `/api/v1`)

```json
{ "keys": [{ "kty": "OKP", "crv": "Ed25519", "x": "...", "kid": "a1b2c3d4e5f60718", "alg": "EdDSA", "use": "sig" }] }
```

---

## 7. Academic calendar, venues and scheduling

### GET /venues (new, public; ADMIN may add `?all=1` to include inactive)

```json
{ "venues": [{ "id": "venue-multipurpose-hall", "name": "Multipurpose Hall", "building": "Main", "capacity": 400, "latitude": 23.801, "longitude": 90.428, "radius_m": 150, "is_active": 1 }] }
```

### POST /venues, PATCH /venues/:id (new, ADMIN)

Body: `{ "name", "capacity", "building?", "latitude?", "longitude?", "radius_m?", "is_active?" }` (PATCH: any subset). 201/200 `{ "venue": {...} }`; 409 on duplicate name; 404 on unknown id.

### GET /calendar?from&to (new, public)

Defaults to now through +180 days.

```json
{
  "from": "...", "to": "...", "timezone": "Asia/Dhaka",
  "semesters": [{ "id": "sem-...", "name": "Fall 2026", "start_date": "2026-09-01", "end_date": "2026-12-31" }],
  "blackouts": [{ "id": "...", "kind": "MIDTERM", "title_en": "Midterm Examinations", "title_bn": "...", "starts_at": "...", "ends_at": "...", "tentative": 0, "severity": "BLOCK" }]
}
```

### POST /calendar/blackouts, PATCH /calendar/blackouts/:id (new, ADMIN)

```json
{ "kind": "HOLIDAY", "title_en": "Durga Puja", "title_bn": "...", "starts_at": "2026-10-20T00:00:00+06:00", "ends_at": "2026-10-21T00:00:00+06:00", "severity": "WARN", "tentative": false, "semester_id": null }
```

`kind`: `FINAL_EXAM`, `MIDTERM`, `HOLIDAY`, `NATIONAL_DAY`. `severity`: `BLOCK` (error) or `WARN`. Response `{ "blackout": {...} }`.

### POST /schedule/check (new, logged in)

`{ "start": "...", "end": "...", "venue_id?": "...", "capacity?": 80, "exclude_event_id?": "..." }` ->

```json
{ "errors": [{ "code": "VENUE_CONFLICT", "message": "...", "ref": { "id": "...", "title": "...", "starts_at": "...", "ends_at": "..." } }], "warnings": [{ "code": "OUTSIDE_SEMESTER", "message": "..." }] }
```

Error codes: `BLACKOUT_BLOCK`, `VENUE_CONFLICT`, `VENUE_CAPACITY`, `VENUE_INACTIVE`. Warning codes: `BLACKOUT_WARN`, `OUTSIDE_SEMESTER`.

Visibility: a `VENUE_CONFLICT` with an unpublished event (e.g. `PENDING_APPROVAL`) of a club the caller does not manage is redacted to `{ "code": "VENUE_CONFLICT", "message": "The venue is already booked during this time", "window": { "starts_at": "...", "ends_at": "..." } }` (no `ref`). ADMIN, the club advisor and its executives see `ref`. The same redaction applies to the 409 `SCHEDULE_CONFLICT` issues from event create, edit and review.

### GET /venues/:id/free-slots?date=YYYY-MM-DD&duration=120 (new, logged in)

```json
{ "venue_id": "...", "date": "2026-11-12", "duration_minutes": 120, "timezone": "Asia/Dhaka", "slots": [{ "start": "2026-11-12T02:00:00.000Z", "end": "2026-11-12T04:00:00.000Z" }] }
```

Up to 5 slots between 08:00 and 20:00 Dhaka, 30-minute steps.

---

## 8. OBE co-curricular transcript (BAETE PO1 to PO12)

Club activity is mapped to the 12 BAETE program outcomes so students get a co-curricular transcript and departments/IQAC get attainment evidence.

### 8.1 Scoring rules

- Attended event tagged with a PO at weight `w` (1 to 3): `+w` points.
- Reflection written for that event: `+0.5 * w` bonus.
- Approved club role held for `m` months (at least 1, at most 12): `+w * m / 3` for each PO in the role mapping (PRESIDENT: PO9 3, PO11 2, PO10 1; TREASURER: PO11 3, PO9 1; EXECUTIVE: PO9 2, PO10 1; MEMBER: PO9 1).
- Levels per PO: `NOT_STARTED` (0), `DEVELOPING` (0 to < 3), `PROFICIENT` (3 to < 6), `EXEMPLARY` (6 or more).

### 8.2 PO tag object

Request: `{ "code": "PO1".."PO12", "weight": 1..3 }` (`weight` defaults to 2). A list holds each code at most once (max 12). Response tags add `title_en` and `title_bn`.

### GET /outcomes (new, public)

```json
{
  "framework": "BAETE",
  "outcomes": [{ "code": "PO1", "framework": "BAETE", "title_en": "Engineering knowledge", "title_bn": "প্রকৌশল জ্ঞান", "description": "..." }],
  "role_outcomes": { "PRESIDENT": { "PO9": 3, "PO10": 1, "PO11": 2 }, "MEMBER": { "PO9": 1 } },
  "scoring": { "level_thresholds": { "DEVELOPING": 0, "PROFICIENT": 3, "EXEMPLARY": 6 }, "reflection_bonus": 0.5, "role_month_cap": 12 }
}
```

### GET /events/:id/outcomes (new, optional auth)

Public for public events; for other statuses only club roles (404 otherwise).

```json
{ "event_id": "event-demo-cse-contest-past", "po_tags": [{ "code": "PO1", "weight": 2, "title_en": "Engineering knowledge", "title_bn": "..." }] }
```

### PUT /events/:id/outcomes (new, club role)

Body `{ "po_tags": [{ "code": "PO5", "weight": 3 }] }` replaces the full set. Executives may only tag `DRAFT` or `REJECTED` events (409 otherwise, they propose). The advisor or an admin may set/override tags on any non-cancelled event. Cancelled: 409. Response is the same shape as GET.

### POST /events/:id/reflection (new, logged in, attendees only)

`{ "text": "20 to 1000 characters" }`. 403 if the caller has no attendance record. Posting again updates the same reflection.

```json
{ "reflection": { "id": "...", "event_id": "...", "text": "...", "created_at": "...", "updated_at": "..." } }
```

### GET /me/transcript (new, logged in)

```json
{
  "transcript": {
    "framework": "BAETE",
    "generated_at": "2026-10-30T13:40:00.000Z",
    "student": { "user_id": "user-student-3", "full_name": "Ayesha Siddiqua", "student_id_number": "0432320005101003", "department": "Department of Computer Science and Engineering", "batch_year": 2023 },
    "semesters": [{
      "semester_id": "sem-demo-current", "name": "Fall 2026",
      "activities": [{
        "event_id": "event-demo-cse-contest-past", "event_title": "Intra-University Programming Contest",
        "club_id": "club-uits-computer", "club_name": "UITS Computer Club", "club_role": "MEMBER",
        "attended_at": "2026-10-16T04:03:00.000Z", "attended_date": "2026-10-16",
        "certificate_serial": "CC-2026-...", "po_tags": [{ "code": "PO2", "weight": 3 }], "reflection": true
      }]
    }],
    "roles": [{ "club_id": "club-uits-computer", "club_name": "UITS Computer Club", "club_role": "MEMBER", "joined_at": "..." }],
    "attainment": {
      "outcomes": [{ "code": "PO2", "points": 4.5, "level": "PROFICIENT", "sources": { "events": 1, "reflections": 1, "roles": 0 } }],
      "total_points": 9.83,
      "level_counts": { "NOT_STARTED": 8, "DEVELOPING": 2, "PROFICIENT": 2, "EXEMPLARY": 0 }
    }
  }
}
```

- `club_role` is the student's approved role in the hosting club, or `PARTICIPANT`.
- Activities in no recorded semester are grouped under `semester_id: null`, `name: "Outside a recorded semester"`.
- `certificate_serial` is only set for VALID certificates. Cancelled events are excluded.
- `attainment.outcomes` always lists all 12 POs.

### GET /me/transcript.pdf (new, logged in)

Issues a new signed snapshot and returns `application/pdf` (black and white A4) as an attachment. Header `X-Transcript-Id: TR-XXXXXXXXXXXXXXXXXXXX`. The PDF holds a QR code to `<PUBLIC_URL or CLIENT_URL>/transcripts/verify/<id>` and the EdDSA JWS. The client should add a route `/transcripts/verify/:id` that calls the endpoint below.

### GET /transcripts/verify/:id (new, public, 60/min/IP)

`id` must match `TR-` plus 20 base32 characters (400 otherwise, 404 if unknown).

```json
{
  "valid": true,
  "signature_valid": true,
  "jws": "eyJhbGciOiJFZERTQSIs...",
  "transcript": {
    "typ": "CC-OBE-TRANSCRIPT", "iss": "CampusConnect UITS", "tid": "TR-...", "sub": "************1003",
    "name": "Ayesha Siddiqua", "department": "Department of Computer Science and Engineering", "framework": "BAETE",
    "issued_at": "...", "activity_count": 1,
    "attainment": [{ "code": "PO1", "points": 3, "level": "PROFICIENT" }]
  }
}
```

`valid` is false when the stored snapshot no longer matches its signature. `signature_valid` is `null` for an unsigned snapshot (signing key unavailable when issued). The JWS can also be checked offline with the JWKS.

### GET /reports/po-attainment (new, FACULTY_ADVISOR or ADMIN)

Query: `department?` (exact name), `from?`, `to?` (ISO with offset, filter by event start; normalized to UTC before comparison, and echoed in `filters` as UTC), `format=json|csv` (default json).

```json
{
  "framework": "BAETE",
  "filters": { "department": "Department of Computer Science and Engineering" },
  "levels": ["NOT_STARTED", "DEVELOPING", "PROFICIENT", "EXEMPLARY"],
  "departments": [{
    "department": "Department of Computer Science and Engineering", "students": 3,
    "outcomes": { "PO1": { "NOT_STARTED": 1, "DEVELOPING": 0, "PROFICIENT": 2, "EXEMPLARY": 0 } }
  }]
}
```

Each cell counts students at that level; the four counts of a PO add up to `students`. Students are active users with role STUDENT or CLUB_EXECUTIVE. Role credit is not date-filtered.

`format=csv` returns `text/csv` (formula-safe, quoted cells):

```
"department","students","po_code","not_started","developing","proficient","exemplary"
"Department of Computer Science and Engineering","3","PO1","1","0","2","0"
```

---

## 9. Removed or behaviour changes to note

- Auth: `POST /auth/refresh` (`refresh_token` cookie or body) is rate limited to 30 per minute per IP. Refresh tokens carry a per-user `token_version`; logout (`POST /auth/logout`), any role or status change via `PATCH /auth/users/:id/role` revoke all outstanding refresh tokens (403 `TOKEN_REVOKED`). Refresh tokens issued before this change are rejected (log in again). Access tokens still live up to 15 minutes after a role change.
- `PATCH /auth/users/:id/role` body is validated: `role?` one of `STUDENT|CLUB_EXECUTIVE|FACULTY_ADVISOR|ADMIN`, `status?` one of `ACTIVE|SUSPENDED` (400 with `issues`), 404 for an unknown user.
- 500 responses from auth and analytics endpoints no longer include `details`; they return `{ "error": "Internal Server Error", "requestId": "..." }`.
- Migration `008_timestamp_normalization` rewrites legacy timestamps to ISO 8601 UTC: naive event `start_time`, `end_time`, `registration_deadline` are read as Asia/Dhaka wall time; naive server-generated columns (`created_at`, `check_in_time`, `issued_at`, `joined_at`, ...) as UTC; offset values are converted. It also adds `users.token_version`.

- `/storage/*` static routes are removed (use the authenticated download route).
- Rate limits: login 5 per IP plus email and 30 per IP per 15 minutes; public verify endpoints 60 per minute per IP (429).
- Feedback list, roster, live QR, manual check-in and attendance list all need a club role for the event's club.
