#!/usr/bin/env python3
"""
CampusConnect SRS Document Generator
Standard: IEEE Std 830-1998 / ISO/IEC/IEEE 29148
Typography: Times New Roman, 12pt body, pure black #000000, fully justified.
Tables: Soft ash header fill (#F1F5F9), bold black text, minimal borders, repeated headers.
Punctuation: Strictly ASCII hyphens (-), colons (:), pipes (|). Zero em/en dashes.
Zero empty pages: Headings use page_break_before where appropriate.
Outputs: docs/CampusConnect_SRS_v2.docx and docs/CampusConnect_SRS_v2.pdf
"""

import os
import sys
import subprocess
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def sanitize_text(text: str) -> str:
    """Ensure strict avoidance of em-dashes and en-dashes."""
    for ch in [chr(0x2014), chr(0x2015), '&' + 'mdash;', '&' + '#8212;']:
        text = text.replace(ch, ' - ')
    for ch in [chr(0x2013), '&' + 'ndash;', '&' + '#8211;']:
        text = text.replace(ch, '-')
    return text


def set_cell_background(cell, color_hex="F1F5F9"):
    """Set subtle background fill for table cells."""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    """Set internal cell padding (in dxa: 20 dxa = 1 pt)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table):
    """Set clean, minimal horizontal borders for tables."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>'
        f'<w:insideV w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def set_table_header_and_split(table):
    """Ensure header repeats on page breaks and rows never awkwardly split in half."""
    header_tr = table.rows[0]._tr.get_or_add_trPr()
    header_tr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
    
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

def add_header_p(doc, text, level=1, page_break_before=False):
    text = sanitize_text(text)
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    if page_break_before:
        p.paragraph_format.page_break_before = True
        
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.color.rgb = RGBColor(0, 0, 0)
    run.bold = True
    
    if level == 1:
        run.font.size = Pt(15)
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
    elif level == 2:
        run.font.size = Pt(13)
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
    elif level == 3:
        run.font.size = Pt(12)
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
    return p

def add_body_p(doc, text, bold_prefix="", space_after=5):
    text = sanitize_text(text)
    bold_prefix = sanitize_text(bold_prefix)
    p = doc.add_paragraph()
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(space_after)
    
    if bold_prefix:
        r_bold = p.add_run(bold_prefix)
        r_bold.font.name = 'Times New Roman'
        r_bold.font.size = Pt(12)
        r_bold.font.color.rgb = RGBColor(0, 0, 0)
        r_bold.bold = True
        
    r_body = p.add_run(text)
    r_body.font.name = 'Times New Roman'
    r_body.font.size = Pt(12)
    r_body.font.color.rgb = RGBColor(0, 0, 0)
    return p

def add_bullet_p(doc, text, bold_prefix=""):
    text = sanitize_text(text)
    bold_prefix = sanitize_text(bold_prefix)
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(3)
    
    if bold_prefix:
        r_bold = p.add_run(bold_prefix)
        r_bold.font.name = 'Times New Roman'
        r_bold.font.size = Pt(12)
        r_bold.font.color.rgb = RGBColor(0, 0, 0)
        r_bold.bold = True
        
    r_body = p.add_run(text)
    r_body.font.name = 'Times New Roman'
    r_body.font.size = Pt(12)
    r_body.font.color.rgb = RGBColor(0, 0, 0)
    return p

def add_code_block(doc, code_text):
    code_text = sanitize_text(code_text)
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    set_cell_background(cell, "F8FAFC")
    set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
    
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'<w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.line_spacing = 1.05
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(code_text)
    run.font.name = 'DejaVu Sans Mono'
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(15, 23, 42)

def add_styled_table(doc, headers, data, col_widths=None):
    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    set_table_header_and_split(table)
    
    # Style header row
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = sanitize_text(title)
        set_cell_background(hdr_cells[i], "F1F5F9")  # Soft ash / light gray
        set_cell_margins(hdr_cells[i], top=90, bottom=90, left=120, right=120)
        p = hdr_cells[i].paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        for r in p.runs:
            r.font.name = 'Times New Roman'
            r.font.size = Pt(10)
            r.font.color.rgb = RGBColor(0, 0, 0)
            r.bold = True
            
    # Style data rows
    for r_idx, row_values in enumerate(data):
        row_cells = table.rows[r_idx + 1].cells
        for c_idx, val in enumerate(row_values):
            row_cells[c_idx].text = sanitize_text(str(val))
            set_cell_margins(row_cells[c_idx], top=70, bottom=70, left=120, right=120)
            p = row_cells[c_idx].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            for r in p.runs:
                r.font.name = 'Times New Roman'
                r.font.size = Pt(9.5)
                r.font.color.rgb = RGBColor(0, 0, 0)
                
    if col_widths:
        for row in table.rows:
            for idx, w in enumerate(col_widths):
                row.cells[idx].width = Inches(w)

def build_srs_document():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(base_dir, '..', 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    
    docx_path = os.path.join(docs_dir, 'CampusConnect_SRS_v2.docx')
    pdf_path = os.path.join(docs_dir, 'CampusConnect_SRS_v2.pdf')
    
    doc = Document()
    
    # Page setup: Standard Letter, 1 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.different_first_page_header_footer = False
        
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
    
    # Metadata Block
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
    
    # =========================================================================
    # SECTION 1: INTRODUCTION
    # =========================================================================
    add_header_p(doc, "1. Introduction", level=1)
    
    add_header_p(doc, "1.1 Purpose", level=2)
    add_body_p(doc, "This Software Requirements Specification (SRS) establishes the complete functional, non-functional, data, and system interface requirements for CampusConnect. This document defines the engineering baseline and functions as an authoritative contract among university stakeholders, student organizations, faculty advisors (Al Imtiaz), and the software development team led by Md. Shakhawat Hossain (Student ID: 0432320005101009) and Fahim Hossain (Student ID: 0432320005101007).")
    
    add_header_p(doc, "1.2 Document Conventions", level=2)
    add_body_p(doc, "Requirements are structured using consistent formal identifiers: FR-XX designates functional requirements, NFR-XX designates non-functional quality attributes, and AC-XX designates verifiable acceptance criteria. Requirement priority is categorized as High (mandatory core functionality), Medium (secondary operational feature), or Low (enhancement). The document adheres strictly to standard ASCII hyphens (-), colons (:), and pipes (|) without typographic long hyphens.")
    
    add_header_p(doc, "1.3 Intended Audience and Reading Suggestions", level=2)
    add_body_p(doc, "This specification is organized for distinct technical and managerial stakeholders:")
    add_bullet_p(doc, "Focus on Section 3 (System Features), Section 4 (Interfaces), Section 5 (NFRs), and Section 6 (Relational Schema).", bold_prefix="Software Developers & System Architects: ")
    add_bullet_p(doc, "Focus on Section 1.4 (Scope), Section 2.3 (User Classes), Section 3.3 (Event Governance), and Section 7 (RBAC Matrix).", bold_prefix="Faculty Advisors & University Administrators: ")
    add_bullet_p(doc, "Focus on Section 3 (Normal and Exception Flows), Section 5 (Performance Benchmarks), and Section 8 (Traceability & Acceptance Criteria).", bold_prefix="Quality Assurance Engineers & Testers: ")
    
    add_header_p(doc, "1.4 Project Scope", level=2)
    add_body_p(doc, "CampusConnect replaces fragmented communication channels (informal messaging threads, social media groups, and physical flyers) and error-prone spreadsheets with an integrated, auditable web application platform.")
    add_bullet_p(doc, "User profile management, secure authentication, club directories, membership requests, multi-tier event proposals, faculty advisor review workflows, concurrency-safe registrations, waitlist management, dynamic rotating QR attendance tracking, digitally signed PDF certificate issuance with public verification, in-app notices, and institutional analytics.", bold_prefix="In-Scope Capabilities: ")
    add_bullet_p(doc, "Online ticket payment gateway integration, native mobile operating system builds (iOS/Android native binaries), biometric hardware scanner integration, and automated synchronization with legacy Student Information Systems (SIS).", bold_prefix="Out-of-Scope (Release 1.0): ")
    
    add_header_p(doc, "1.5 Definitions, Acronyms, and Abbreviations", level=2)
    def_headers = ["Acronym / Term", "Definition"]
    def_data = [
        ["ACID", "Atomicity, Consistency, Isolation, Durability guarantees in transactional database engines."],
        ["Argon2id", "Key derivation function optimized to resist GPU cracking and side-channel memory attacks."],
        ["JWT", "JSON Web Token (RFC 7519) utilized for compact, stateless claims verification."],
        ["RBAC", "Role-Based Access Control restricting system operations based on assigned organizational roles."],
        ["TOTP", "Time-Based One-Time Password algorithm (RFC 6238) utilized for rotating attendance tokens."],
        ["UUIDv4", "Universally Unique Identifier version 4 generated via cryptographically secure pseudo-random numbers."]
    ]
    add_styled_table(doc, def_headers, def_data, [1.8, 4.7])
    
    add_header_p(doc, "1.6 Project Engineering Team and Governance", level=2)
    add_body_p(doc, "The design, specification, and implementation of CampusConnect is executed by the project engineering team with academic supervision:")
    team_headers = ["Project Role", "Name & Identification", "Department & Affiliation", "Engineering Scope & Responsibilities"]
    team_data = [
        [
            "Team Leader & Engineering Lead",
            "Md. Shakhawat Hossain\n(ID: 0432320005101009)",
            "Department of Computer Science and Engineering (UITS)",
            "System architecture, relational data modeling, secure authentication, dynamic QR attendance engine, and tamper-proof PDF certificate issuance."
        ],
        [
            "Software Engineer & Team Member",
            "Fahim Hossain\n(ID: 0432320005101007)",
            "Department of Computer Science and Engineering (UITS)",
            "Core feature implementation, test engineering, dynamic QR verification integration, and technical documentation."
        ],
        [
            "Course Advisor & Supervisor",
            "Al Imtiaz",
            "Department of Computer Science and Engineering (UITS)",
            "Requirements governance, technical specification review, academic standards compliance, and engineering baseline sign-off."
        ]
    ]
    add_styled_table(doc, team_headers, team_data, [1.3, 1.7, 1.4, 2.1])
    
    add_header_p(doc, "1.7 References", level=2)
    add_body_p(doc, "1. IEEE Std 830-1998: IEEE Recommended Practice for Software Requirements Specifications.")
    add_body_p(doc, "2. ISO/IEC/IEEE 29148:2018: Systems and software engineering: Life cycle processes: Requirements engineering.")
    add_body_p(doc, "3. RFC 2119: Key words for use in RFCs to Indicate Requirement Levels.")
    add_body_p(doc, "4. RFC 7519: JSON Web Token (JWT) Specification.")
    add_body_p(doc, "5. W3C Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.")
    
    # =========================================================================
    # SECTION 2: OVERALL DESCRIPTION
    # =========================================================================
    add_header_p(doc, "2. Overall Description", level=1)
    
    add_header_p(doc, "2.1 Product Perspective", level=2)
    add_body_p(doc, "CampusConnect operates as a standalone multi-tenant web application hosted within the university cloud environment. It coordinates activities across academic departments, student clubs, and administrative offices through a decoupled client-server architecture. The presentation layer communicates with the backend application server exclusively via a secure RESTful API.")
    
    add_header_p(doc, "2.2 Product Functions Summary", level=2)
    add_body_p(doc, "The system delivers seven principal business capabilities: (1) Identity and Credential Governance; (2) Club Directory and Membership Lifecycle; (3) Event Lifecycle and Multi-Tier Approval; (4) Concurrency-Safe Event Registration and Waitlisting; (5) Anti-Proxy Dynamic QR Attendance Tracking; (6) Cryptographically Signed PDF Certificate Issuance; and (7) Executive and Institutional Analytics Reporting.")
    
    add_header_p(doc, "2.3 User Classes and Characteristics", level=2)
    user_headers = ["User Role", "Target User Persona", "Primary System Responsibilities"]
    user_data = [
        ["Student", "Enrolled university undergraduate and graduate students.", "Explore clubs and events, register, present live QR passes, and download certificates."],
        ["Club Executive", "Elected student leaders managing registered campus organizations.", "Draft events, manage member applications, track participant rosters, and record attendance."],
        ["Faculty Advisor", "Appointed academic faculty members supervising student clubs.", "Audit club compliance, review draft events, and approve or reject proposals with remarks."],
        ["Platform Admin", "Central IT staff and Student Affairs officers.", "Oversee platform categories, audit security logs, override roles, and generate campus reports."]
    ]
    add_styled_table(doc, user_headers, user_data, [1.5, 2.2, 2.8])
    
    add_header_p(doc, "2.4 Operating Environment", level=2)
    add_body_p(doc, "Server Infrastructure: Linux (Ubuntu 22.04 LTS / 24.04 LTS), Node.js runtime (v20+ LTS), PostgreSQL 16 relational database, and Redis 7 in-memory cache. Client Infrastructure: Modern desktop and mobile browsers supporting ECMAScript 2022+ (Google Chrome 115+, Mozilla Firefox 115+, Apple Safari 16+, and Microsoft Edge 115+). Responsive layouts support viewports from 360px width upwards.")
    
    add_header_p(doc, "2.5 Design and Implementation Constraints", level=2)
    add_bullet_p(doc, "PostgreSQL 16 MUST be the persistent database engine to guarantee ACID transactions and row-level locking (SELECT ... FOR UPDATE) during high-concurrency event registration bursts.", bold_prefix="Relational Engine Mandate: ")
    add_bullet_p(doc, "TypeScript MUST be used across frontend and backend layers to share data models and eliminate runtime type mismatches.", bold_prefix="Type Safety: ")
    add_bullet_p(doc, "All application logs, UI text, notification templates, and generated documents MUST strictly avoid em-dashes and en-dashes.", bold_prefix="Typography Standard: ")
    
    add_header_p(doc, "2.6 Assumptions and Dependencies", level=2)
    add_body_p(doc, "Users possess devices with web browser access and HTTPS connectivity. Executives conducting QR check-ins require camera-enabled devices supporting the HTML5 MediaDevices API. Automated email notifications depend on institutional SMTP availability.")
    
    # =========================================================================
    # SECTION 3: SYSTEM FEATURES AND FUNCTIONAL REQUIREMENTS
    # =========================================================================
    add_header_p(doc, "3. System Features and Functional Requirements", level=1, page_break_before=True)
    
    add_header_p(doc, "3.1 User Authentication and Profile Management", level=2)
    add_body_p(doc, "FR-01: User Provisioning. Prospective users create accounts with institutional email (@university.edu), full name, student ID, department, and password (minimum 8 characters with mixed case, number, and symbol). Passwords are hashed using Argon2id. An email verification token (UUIDv4) is issued with a 24-hour expiration window.")
    add_body_p(doc, "FR-02: Authentication & Session Management. Users authenticate via email and password. Protected endpoints enforce rate limits (maximum 5 failed attempts per 15 minutes per IP). On successful verification, the backend issues a short-lived JWT access token (15-minute validity) and a refresh token (7-day validity) transmitted exclusively via HttpOnly, Secure, SameSite=Strict cookies.")
    add_body_p(doc, "FR-03: Token Revocation. Explicit logout revokes the active refresh token in the database and clears client cookies.")
    add_body_p(doc, "FR-04: Profile Management. Students update permitted profile fields (contact phone, bio, notification preferences). Primary identifiers (email, student ID, and role) remain immutable.")
    
    add_header_p(doc, "3.2 Club Directory and Membership Lifecycle", level=2)
    add_body_p(doc, "FR-05: Club Directory. Searchable directory categorizing active university organizations with details on mission, executive leadership, advisor, and active events.")
    add_body_p(doc, "FR-06: Membership Application. Enrolled students submit membership applications with a statement of interest. Duplicate pending applications are rejected by database unique constraints.")
    add_body_p(doc, "FR-07: Executive Processing. Club executives review pending applications and record decisions (Approved or Rejected). System logs the approving executive ID and timestamp.")
    add_body_p(doc, "FR-08: Executive Succession. Faculty advisors or administrators promote active club members to executive rank or revoke leadership upon term completion.")
    
    add_header_p(doc, "3.3 Event Creation, Lifecycle, and Approval Workflow", level=2)
    add_body_p(doc, "FR-09: Event Drafting. Executives draft events specifying title, description, category, venue, start/end timestamps, seat capacity, registration deadline, and prerequisites. State is set to DRAFT.")
    add_body_p(doc, "FR-10: Proposal Submission. Executive submits draft event for formal academic review. Status transitions from DRAFT to PENDING_APPROVAL. Event editing is locked during review.")
    add_body_p(doc, "FR-11: Faculty Advisor Review. Designated faculty advisors review proposal details. Approval transitions status to APPROVED and enables public publishing. Rejection transitions status to REJECTED, mandates written feedback remarks, and returns the event to an editable draft state.")
    add_body_p(doc, "FR-12: Event Cancellation. In emergencies, executives or advisors cancel scheduled events. System marks event as CANCELLED and dispatches immediate notification alerts to all registered attendees.")
    
    add_header_p(doc, "3.4 Event Discovery, Registration, and Concurrency Control", level=2)
    add_body_p(doc, "FR-13: Event Discovery Engine. Full-text search and multi-facet filtering by club, category, date, and open seat availability with p95 latency under 200 milliseconds.")
    add_body_p(doc, "FR-14: Concurrency-Safe Registration. Students register for published events before registration deadlines. The registration engine executes inside a PostgreSQL READ COMMITTED transaction with row-level locking (SELECT capacity, registered_count FROM events WHERE id = $1 FOR UPDATE). If registered_count < capacity, a CONFIRMED registration is created and registered_count incremented atomically. If capacity is exhausted, the user is offered waitlist placement.")
    add_body_p(doc, "FR-15: Automated Waitlist Management. When an event reaches maximum capacity, applicants join an ordered waitlist (WAITLISTED). Upon cancellation by a confirmed participant, the system automatically promotes the first waitlisted applicant to CONFIRMED and dispatches an urgent confirmation alert.")
    add_body_p(doc, "FR-16: Roster Export. Authorized club executives export registration rosters with participant names, student IDs, and registration timestamps in CSV format.")
    
    add_header_p(doc, "3.5 Secure Attendance Tracking and Dynamic QR Engine", level=2)
    add_body_p(doc, "FR-17: Dynamic Rotating QR Tokens. To prevent attendance fraud via screenshotted QR passes, organizer terminals project a dynamic QR code refreshed every 20 seconds using HMAC-SHA256(event_id + time_slot, secret_key). Students scan the live display using their camera.")
    add_body_p(doc, "FR-18: Attendance Validation. The server validates the token against the active and immediate preceding 20-second time slots to tolerate network latency. Upon validation, an attendance record is created with method QR_SCAN, and the registration record is updated to ATTENDED. Duplicate scans are rejected.")
    add_body_p(doc, "FR-19: Manual Attendance Fallback. If a student lacks a functional device or experiences camera failure, authorized executives manually record attendance using the student ID. The system records method MANUAL_OVERRIDE alongside the executive user ID in the audit log.")
    
    add_header_p(doc, "3.6 Digital Certificate Issuance and Public Verification", level=2)
    add_body_p(doc, "FR-20: Eligibility Verification. Attendees are eligible for certificates if they hold an attendance record of PRESENT, have submitted the required post-event feedback form, and the event has concluded.")
    add_body_p(doc, "FR-21: Tamper-Resistant PDF Generation. An asynchronous worker generates a PDF certificate featuring the recipient name, event title, completion date, unique serial number (CC-YYYY-[HEX]), and a cryptographic SHA-256 fingerprint. An embedded verification QR code links directly to the public verification endpoint.")
    add_body_p(doc, "FR-22: Public Verification Portal. A publicly accessible endpoint (GET /api/v1/certificates/verify/:serial_number) allows academic boards, employers, and external evaluators to confirm certificate authenticity without requiring authentication credentials.")
    
    add_header_p(doc, "3.7 Notification Dispatch and Announcements", level=2)
    add_body_p(doc, "FR-23: Broadcast Announcements. Club executives publish notices to club members or registered event attendees via in-app feeds and broadcast emails.")
    add_body_p(doc, "FR-24: Notification Center. Delivers real-time in-app alerts with unread badge counters for registration updates, event approvals, waitlist promotions, and schedule changes.")
    
    add_header_p(doc, "3.8 Post-Event Feedback and Analytics", level=2)
    add_body_p(doc, "FR-25: Structured Feedback. Attendees submit numerical ratings (1 to 5 stars) and qualitative commentary post-event. Duplicate submissions per event are prevented.")
    add_body_p(doc, "FR-26: Analytics Dashboards. Executives view club-level attendance rates, registration velocity, and satisfaction scores. Administrators access university-wide metrics.")
    
    add_header_p(doc, "3.9 Governance and Immutable Audit Logging", level=2)
    add_body_p(doc, "FR-27: Immutable Audit Logging. Every administrative event (approval, rejection, role change, manual attendance override, or certificate revocation) is permanently recorded in the audit_logs table with actor ID, timestamp, IP address, and state snapshot.")
    
    # =========================================================================
    # SECTION 4: EXTERNAL INTERFACE REQUIREMENTS
    # =========================================================================
    add_header_p(doc, "4. External Interface Requirements", level=1, page_break_before=True)
    
    add_header_p(doc, "4.1 User Interfaces", level=2)
    add_body_p(doc, "The interface utilizes responsive layouts conforming to WCAG 2.1 Level AA accessibility standards, featuring high text contrast (minimum 4.5:1), keyboard-navigable controls, and descriptive semantic markup across desktop and mobile devices.")
    
    add_header_p(doc, "4.2 Hardware Interfaces", level=2)
    add_body_p(doc, "Client devices utilize camera hardware via standard HTML5 MediaDevices APIs to scan dynamic QR attendance tokens.")
    
    add_header_p(doc, "4.3 Software Interfaces", level=2)
    soft_headers = ["Component", "Technology Specification", "Interaction Purpose"]
    soft_data = [
        ["Relational Database", "PostgreSQL 16 via pooled TCP connection", "ACID storage for users, clubs, events, registrations, and audit logs."],
        ["In-Memory Cache", "Redis 7 via RESP protocol", "API rate limiting, session token storage, and dynamic QR nonces."],
        ["Asynchronous Queue", "BullMQ background worker system", "Decoupled rendering of PDF certificates and bulk email dispatching."],
        ["Email Delivery", "Configured institutional SMTP gateway", "Transactional verification emails and broadcast announcements."]
    ]
    add_styled_table(doc, soft_headers, soft_data, [1.8, 2.3, 2.4])
    
    add_header_p(doc, "4.4 Communications Interfaces", level=2)
    add_body_p(doc, "All network traffic MUST use HTTPS over TLS 1.3. Plain HTTP connections are automatically redirected with HTTP Strict Transport Security (HSTS) headers enabled. RESTful endpoints exchange JSON payloads using standard HTTP status codes.")
    
    # =========================================================================
    # SECTION 5: NON-FUNCTIONAL REQUIREMENTS
    # =========================================================================
    add_header_p(doc, "5. Non-Functional Requirements", level=1, page_break_before=True)
    
    nfr_headers = ["ID", "Category", "Quantitative Requirement Specification", "Verification Method"]
    nfr_data = [
        ["NFR-01", "Performance", "95% of read requests must respond within < 250ms under 500 concurrent users.", "Automated k6 load test"],
        ["NFR-02", "Performance", "95% of write transactions (registration, attendance) must complete in < 400ms.", "Load test under peak load"],
        ["NFR-03", "Throughput", "Certificate generation and email dispatch completed in < 60s asynchronously.", "Background queue benchmark"],
        ["NFR-04", "Availability", "Platform maintains >= 99.5% uptime during standard university academic terms.", "Cloud uptime monitor"],
        ["NFR-05", "Reliability", "Zero event over-registration permitted under concurrent race conditions.", "Race condition stress test"],
        ["NFR-06", "Security", "Passwords hashed via Argon2id (memory: 64MB, iterations: 3, parallelism: 1).", "Security code audit"],
        ["NFR-07", "Security", "Session tokens stored in HttpOnly, Secure, SameSite=Strict cookies.", "Network inspector test"],
        ["NFR-08", "Security", "Authentication routes enforce maximum 5 failed attempts per 15-minute window.", "Brute force test suite"],
        ["NFR-09", "Compliance", "All administrative operations recorded in immutable audit_logs table.", "Database audit log review"],
        ["NFR-10", "Recovery", "Daily pg_dump with WAL archiving supporting RPO < 1 hour and RTO < 4 hours.", "Disaster recovery drill"]
    ]
    add_styled_table(doc, nfr_headers, nfr_data, [0.8, 1.2, 3.2, 1.3])
    
    # =========================================================================
    # SECTION 6: DATA ARCHITECTURE AND RELATIONAL SCHEMA
    # =========================================================================
    add_header_p(doc, "6. Data Architecture and Relational Schema", level=1, page_break_before=True)
    add_body_p(doc, "CampusConnect mandates PostgreSQL 16 to guarantee relational integrity, foreign key cascading, and row-level locking. The schema comprises 12 normalized tables:")
    
    schema_headers = ["Table Name", "Primary Key", "Key Foreign Keys", "Critical Constraints & Indexes"]
    schema_data = [
        ["users", "id (UUID)", "None", "UNIQUE(email), role ENUM, status ENUM"],
        ["student_profiles", "id (UUID)", "user_id -> users(id)", "UNIQUE(user_id), UNIQUE(student_id_number)"],
        ["clubs", "id (UUID)", "faculty_advisor_id -> users(id)", "UNIQUE(name), UNIQUE(slug)"],
        ["club_memberships", "id (UUID)", "club_id -> clubs(id), user_id -> users(id)", "UNIQUE(club_id, user_id), status ENUM"],
        ["events", "id (UUID)", "club_id -> clubs(id), created_by -> users(id)", "CHECK(capacity > 0), registered_count <= capacity"],
        ["registrations", "id (UUID)", "event_id -> events(id), user_id -> users(id)", "UNIQUE(event_id, user_id), UNIQUE(ticket_code)"],
        ["attendance_records", "id (UUID)", "registration_id -> registrations(id)", "UNIQUE(registration_id), method ENUM"],
        ["certificates", "id (UUID)", "event_id -> events(id), user_id -> users(id)", "UNIQUE(serial_number), UNIQUE(event_id, user_id)"],
        ["announcements", "id (UUID)", "club_id -> clubs(id), author_id -> users(id)", "Index on (club_id, created_at DESC)"],
        ["notifications", "id (UUID)", "recipient_id -> users(id)", "Index on (recipient_id, is_read)"],
        ["feedback_submissions", "id (UUID)", "event_id -> events(id), user_id -> users(id)", "UNIQUE(event_id, user_id), CHECK(rating BETWEEN 1 AND 5)"],
        ["audit_logs", "id (BIGSERIAL)", "actor_user_id -> users(id)", "Immutable append-only, index on (target_entity, target_id)"]
    ]
    add_styled_table(doc, schema_headers, schema_data, [1.4, 1.0, 1.9, 2.2])
    
    # =========================================================================
    # SECTION 7: ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
    # =========================================================================
    add_header_p(doc, "7. Role-Based Access Control (RBAC) Matrix", level=1, page_break_before=True)
    
    rbac_headers = ["System Operation / Resource", "Student", "Club Executive", "Faculty Advisor", "Platform Admin"]
    rbac_data = [
        ["Browse Clubs and Public Events", "Read", "Read", "Read", "Read"],
        ["Apply for Club Membership", "Create", "N/A", "N/A", "N/A"],
        ["Manage Club Members", "None", "Approve / Reject", "Read", "Full Control"],
        ["Draft and Edit Event Proposals", "None", "Create / Update (Own)", "Read", "Full Control"],
        ["Review and Approve / Reject Events", "None", "None", "Approve / Reject", "Full Control"],
        ["Register / Cancel Event Attendance", "Create / Cancel", "Create / Cancel", "Read", "Full Control"],
        ["Conduct Dynamic QR Attendance Scan", "None", "Execute (Own Club)", "Read", "Full Control"],
        ["Execute Manual Attendance Override", "None", "Execute (With Log)", "Execute", "Full Control"],
        ["Download Earned Certificate PDF", "Read (Own)", "Read (Own)", "Read", "Full Control"],
        ["Verify Certificate Validity (Public)", "Read", "Read", "Read", "Read"],
        ["Broadcast Club Announcements", "None", "Create (Own Club)", "Create (Assigned)", "Create (Global)"],
        ["Inspect System Audit Logs", "None", "None", "None", "Read"],
        ["Assign User Roles and Permissions", "None", "None", "None", "Full Control"]
    ]
    add_styled_table(doc, rbac_headers, rbac_data, [2.3, 0.9, 1.2, 1.1, 1.0])
    
    # =========================================================================
    # SECTION 8: TRACEABILITY MATRIX AND ACCEPTANCE CRITERIA
    # =========================================================================
    add_header_p(doc, "8. Traceability Matrix and Acceptance Criteria", level=1, page_break_before=True)
    
    add_header_p(doc, "8.1 Requirements Traceability Matrix", level=2)
    rtm_headers = ["Business Objective", "Functional Reqs", "Relational Entities", "Acceptance Criteria"]
    rtm_data = [
        ["Centralize Activity Discovery", "FR-05, FR-13", "clubs, events", "AC-01, AC-02"],
        ["Secure Identity Governance", "FR-01, FR-02, FR-03", "users, audit_logs", "AC-03, AC-04"],
        ["Event Approval & Moderation", "FR-09, FR-10, FR-11", "events, audit_logs", "AC-05, AC-06"],
        ["Concurrency-Safe Registration", "FR-14, FR-15", "registrations, events", "AC-07, AC-08"],
        ["Tamper-Proof Attendance Tracking", "FR-17, FR-18, FR-19", "attendance_records", "AC-09, AC-10"],
        ["Verifiable Digital Credentials", "FR-20, FR-21, FR-22", "certificates", "AC-11, AC-12"]
    ]
    add_styled_table(doc, rtm_headers, rtm_data, [1.8, 1.3, 1.6, 1.8])
    
    add_header_p(doc, "8.2 Executable Acceptance Scenarios (BDD Format)", level=2)
    
    add_body_p(doc, "Scenario AC-07: Concurrency-Safe Capacity Enforcement", bold_prefix="")
    add_code_block(doc, 
        "Scenario: Enforce maximum registration capacity under concurrent requests\n"
        "  Given an event 'AI Innovation Workshop' exists with capacity 50 and registered_count 49\n"
        "  When two students attempt to register simultaneously at timestamp T\n"
        "  Then exactly one student registration succeeds with HTTP 201 Created\n"
        "  And the second student receives HTTP 200 OK with status 'WAITLISTED'\n"
        "  And the event registered_count remains exactly 50\n"
        "  And no database lock deadlock error is exposed to either client"
    )
    
    add_body_p(doc, "Scenario AC-09: Defense Against Attendance QR Code Screenshot Sharing", bold_prefix="")
    add_code_block(doc,
        "Scenario: Reject expired or forwarded attendance QR token\n"
        "  Given an ongoing event 'Robotics Hackathon'\n"
        "  And student 'Rahim' holds a confirmed registration\n"
        "  When student 'Karim' attempts check-in using a screenshot of Rahim's QR token taken 45s prior\n"
        "  Then the check-in request is rejected with HTTP 400 Bad Request\n"
        "  And the error response specifies 'QR token expired. Please rescan live display.'\n"
        "  And no record is created in the attendance_records table"
    )
    
    add_body_p(doc, "Scenario AC-11: Public Certificate Verification", bold_prefix="")
    add_code_block(doc,
        "Scenario: Public verification of earned completion certificate\n"
        "  Given student 'Ayesha' has status 'ATTENDED' and completed event feedback\n"
        "  When an external evaluator visits '/api/v1/certificates/verify/CC-2026-A1B2C3D4'\n"
        "  Then the system returns recipient name, event title, issuing club, and issue date\n"
        "  And the certificate cryptographic status is confirmed as 'VALID'\n"
        "  And no login credentials are required to view the verification status"
    )
    
    # =========================================================================
    # SECTION 9: VERIFICATION AND TESTING PLAN
    # =========================================================================
    add_header_p(doc, "9. Verification and Quality Assurance Plan", level=1)
    add_body_p(doc, "1. Unit Testing: Core utilities (Argon2id password hasher, HMAC dynamic token generator, certificate serial generator) and schema validation middleware tested using Vitest / Jest targeting >= 85% statement coverage.")
    add_body_p(doc, "2. Integration Testing: End-to-end API workflows tested against an ephemeral PostgreSQL Docker test instance using Supertest.")
    add_body_p(doc, "3. Concurrency Load Testing: Simulated registration rushes executed via k6 (200 virtual users competing for the final 5 event slots) to certify zero over-booking and zero deadlocks.")
    add_body_p(doc, "4. Security Audit: Static code analysis via ESLint security plugins and dynamic OWASP Top 10 penetration sweeps.")
    
    # Save DOCX
    doc.save(docx_path)
    print(f"Generated DOCX: {docx_path}")
    
    # Convert to PDF using LibreOffice headless
    cmd = ["soffice", "--headless", "--convert-to", "pdf", docx_path, "--outdir", docs_dir]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"Generated PDF: {pdf_path}")
    except Exception as e:
        print(f"Warning: PDF conversion failed: {e}")

if __name__ == '__main__':
    build_srs_document()
