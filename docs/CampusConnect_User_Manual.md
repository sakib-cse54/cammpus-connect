# Stakeholder and Role-Based User Manual
## CampusConnect: University Club, Event & Activity Management Platform

**Document Identifier:** CC-USR-2026-V1.0  
**Engineering Baseline Version:** 1.0  
**Date:** October 2026  
**Software Engineering Lead:** Md. Shakhawat Hossain (Student ID: 0432320005101009) | Department of Computer Science and Engineering  
**Academic Supervisor & Course Advisor:** Al Imtiaz | Department of Computer Science and Engineering  
**Standard Compliance:** IEEE Std 26514-2018 (Requirements for Designers and Developers of User Documentation)  
**Status:** Approved Operational Manual  

---

## 1. Introduction and Platform Access

### 1.1 Purpose
This Stakeholder and Role-Based User Manual provides comprehensive, step-by-step guidance for operating **CampusConnect**, the university's centralized club, event, and extracurricular management platform. The manual is organized by user role: Student, Club Executive, Faculty Advisor, and System Administrator.

### 1.2 Accessing the Platform
CampusConnect is accessible via modern desktop and mobile web browsers (Chrome, Firefox, Safari, Edge) at:
`https://campusconnect.edu`

### 1.3 Standards and Punctuation
- **Punctuation Standard:** Strictly utilizes standard ASCII hyphens (-), colons (:), and pipes (|). Zero typographic em-dashes or en-dashes are permitted across all documentation and interface guidelines.
- **Documentation Standard:** IEEE Std 26514-2018 (User Documentation).

---

## 2. Student Portal User Manual

The Student Portal empowers enrolled students to discover campus organizations, participate in academic and cultural activities, and build a verified extracurricular portfolio.

### 2.1 Account Creation and Authentication
1. **Registration:**
   - Navigate to `https://campusconnect.edu/register`.
   - Enter your Full Name, Department, Official Student ID Number (e.g., `0432320005101009`), and University Email (`@student.university.edu`).
   - Create a password of at least 8 characters containing upper and lower case letters, a number, and a symbol.
   - Submit the form. The system will create your account with immediate Student privileges.
2. **Login:**
   - Enter your registered email and password at `/login`.
   - Upon successful verification, you will be redirected to the Student Discovery Feed.

### 2.2 Discovering Clubs and Joining Organizations
1. **Browse Directory:** Navigate to the **Clubs** tab in the main navigation bar.
2. **Filter & Search:** Use category pills (e.g., Technology, Cultural, Sports, Debate) or enter keywords in the search bar.
3. **Inspect Club Profile:** Click on any club card to view its description, faculty advisor name, executive board members, and public event history.
4. **Apply for Membership:** Click **Join Club**. Your application enters `PENDING` status. Once reviewed by a Club Executive, you will receive an in-app confirmation notification.

### 2.3 Event Registration and Waitlist Management
1. **Browse Events:** Visit the **Events** tab to explore upcoming seminars, workshops, and competitions.
2. **Register for an Event:** Click on the target event to inspect date, venue, capacity, speaker roster, and registration deadlines.
3. **Confirmed Slot:** If open seats remain, clicking **Register Now** immediately reserves your seat (`CONFIRMED`). A confirmation badge and event pass will appear on your dashboard.
4. **Automated Waitlist:** If the event has reached its maximum capacity, clicking **Join Waitlist** places you into an automated FIFO queue with your current position number displayed.
5. **Cancellation:** If you can no longer attend, click **Cancel Registration** from your profile. This immediately frees the slot and automatically promotes the next waitlisted student.

### 2.4 Live Event Attendance and Dynamic QR Code Pass
To eliminate proxy check-ins, CampusConnect utilizes time-sensitive dynamic attendance passes:
1. **Live Scanning Flow:**
   - Arrive at the event venue.
   - When the organizer opens the session, scan the rotating QR code projected on the main hall screen using your smartphone camera or in-app scanner.
   - The token rotates every 20 seconds; ensure you scan the live projection rather than a screenshot.
   - Your check-in will be confirmed with a green checkmark and timestamp.
2. **Personal Pass Alternative:** If requested by organizers, tap **Show My Event Pass** on your mobile web app. Present the dynamic rotating QR code on your screen to the executive check-in desk for scanner validation.

### 2.5 Accessing Verifiable Completion Certificates
1. **Certificate Eligibility:** Following event conclusion, attendees with verified check-in records become eligible for certificate issuance.
2. **Download PDF:** Navigate to **My Profile -> Certificates**. Click **Download PDF** to obtain your high-resolution official credential.
3. **Public Sharing:** Each certificate contains a unique serial (e.g., `CC-2026-A1B2C3D4`) and a verification URL suitable for inclusion on your LinkedIn profile, CV, or graduate school application.

---

## 3. Club Executive Operational Manual

Club Executives hold administrative control over their student organization, managing event proposals, attendee rosters, and check-in desks.

### 3.1 Club Executive Dashboard Overview
Executives access specialized management tools via the **Executive Desk** menu:
- **Member Roster:** View all enrolled members and review pending applicant requests.
- **Event Studio:** Draft, edit, and monitor event proposals through their approval lifecycles.
- **Attendance Desk:** Launch live attendance projection displays and scanner check-in interfaces.

### 3.2 Drafting and Submitting Event Proposals
1. **Initiate Draft:** In the Event Studio, click **Create New Event**.
2. **Enter Event Metadata:**
   - **Title:** Clear, concise title of the proposed activity.
   - **Category:** Select Workshop, Seminar, Hackathon, Cultural, or Meeting.
   - **Venue & Mode:** Specify room number, campus auditorium, or virtual link.
   - **Schedule:** Define start time, end time, and registration deadline.
   - **Capacity:** Set the maximum attendee limit based on venue fire code or resources.
   - **Description:** Provide a detailed agenda, speaker profiles, and learning outcomes.
3. **Submit for Faculty Review:** Review all fields and click **Submit for Approval**. The event transitions to `SUBMITTED` status and is automatically routed to your assigned Faculty Advisor.

### 3.3 Operating the Live Attendance Check-in Desk
1. **Launch Live Screen:** At the venue, open the event dashboard on a laptop connected to the projector and click **Launch Attendance Screen**.
2. **Dynamic Display:** The screen presents a full-screen dynamic QR code that automatically rotates its cryptographic HMAC seed every 20 seconds with a visual countdown timer.
3. **Manual Check-in Fallback:** If an attendee experiences mobile device issues, navigate to the **Roster Check-in** tab, search for the student by Student ID or Name, and click **Manual Check-in**. The system logs the entry as `ORGANIZER_MANUAL` for audit compliance.

### 3.4 Publishing Club Announcements
1. Click **Broadcast Announcement** in the club management tab.
2. Compose title and body content. Select priority (`NORMAL` or `URGENT`).
3. Click **Publish**. Urgent notices immediately notify all enrolled club members via in-app banners and email notifications.

---

## 4. Faculty Advisor Governance Handbook

Faculty Advisors provide academic oversight and governance, ensuring student activities comply with university safety, budget, and academic standards.

### 4.1 Advisor Review Queue
When a student club drafts an event, it appears in the **Advisor Moderation Queue** with full details and historical context:
1. **Compliance Inspection:** Verify that the proposed event does not clash with university examination schedules, that the venue reservation is confirmed, and that safety/budget requirements are satisfied.
2. **Approval Action:** Click **Approve Event**. The event status immediately updates to `PUBLISHED`, making it discoverable and open for student registration.
3. **Rejection Action:** Click **Reject Proposal**. A mandatory modal requires the advisor to enter constructive written remarks explaining why the proposal was rejected and outlining corrective actions required for resubmission.

### 4.2 Club Activity Audits and Performance Metrics
Advisors can inspect real-time club metrics, including active membership totals, semester event completion rates, average attendee ratings, and historical audit logs.

---

## 5. System Administrator Governance Guide

System Administrators possess root-level governance over the platform infrastructure, user role assignments, and security monitoring.

### 5.1 User Role Management and Account Administration
1. **Role Delegation:** Locate user profiles in the **Admin Console -> Users** table. Elevate verified student leaders to `CLUB_EXECUTIVE` or assign faculty members to `FACULTY_ADVISOR`.
2. **Account Suspension:** In the event of academic suspension or policy violations, toggle user status from `ACTIVE` to `SUSPENDED`. Suspended users are immediately denied API access and their active session tokens are invalidated.

### 5.2 Club Lifecycle and Advisor Assignment
1. **Chartering New Clubs:** Click **Create Club**. Enter name, category, description, and assign the designated Faculty Advisor.
2. **Club Status Oversight:** Move clubs to `PROBATION` or `INACTIVE` status if governance compliance thresholds are breached.

### 5.3 System Audit Trail Inspection
1. Navigate to **Admin Console -> Audit Logs**.
2. Filter immutable operational records by Actor ID, Entity Type (`EVENT`, `USER`, `CLUB`), Date Range, or IP Address.
3. Export audit records to CSV for formal university governance reviews.

---

## 6. Public Credential Verification Guide

Any external evaluator, employer, or academic institution can verify the authenticity of a CampusConnect certificate without creating an account:

```
+-----------------------------------------------------------------------------------------+
|                              PUBLIC VERIFICATION WORKFLOW                               |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [External Evaluator / Employer]                                                        |
|         |                                                                               |
|         | Option 1: Scans QR code printed on physical/PDF certificate                   |
|         | Option 2: Visits https://campusconnect.edu/verify and enters Serial Number   |
|         v                                                                               |
|  [GET /api/v1/certificates/verify/{certificate_serial}]                                 |
|         |                                                                               |
|         v                                                                               |
|  +-----------------------------------------------------------------------------------+  |
|  | Server validates SHA-256 digital fingerprint against database records:           |  |
|  | - Recipient Name: Ayesha Siddiqua                                                 |  |
|  | - Student ID: 0432320005101015                                                    |  |
|  | - Event Title: Annual Hackathon 2026                                              |  |
|  | - Issuing Organization: Computer Science Society                                  |  |
|  | - Issue Date: October 28, 2026                                                     |  |
|  | - Credential Status: VERIFIED AND AUTHENTIC (Green Shield)                        |  |
|  +-----------------------------------------------------------------------------------+  |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

---
