#!/usr/bin/env python3
"""
CampusConnect REST API Specification Document Generator
Standard: IEEE Std 830-1998 / RFC 7807 (Problem Details for HTTP APIs) / OpenAPI 3.1
Typography: Times New Roman, 12pt body, pure black #000000, fully justified.
Tables: Soft ash header fill (#F1F5F9), bold black text, minimal borders, repeated headers.
Punctuation: Strictly ASCII hyphens (-), colons (:), pipes (|). Zero em/en dashes.
Zero empty pages: Headings use page_break_before where appropriate.
Outputs: docs/CampusConnect_API_Specification.docx and docs/CampusConnect_API_Specification.pdf
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

def build_api_document():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(base_dir, '..', 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    
    docx_path = os.path.join(docs_dir, 'CampusConnect_API_Specification.docx')
    pdf_path = os.path.join(docs_dir, 'CampusConnect_API_Specification.pdf')
    
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
    r_title = p_title.add_run("RESTFUL APPLICATION PROGRAMMING INTERFACE (API) SPECIFICATION")
    r_title.font.name = 'Times New Roman'
    r_title.font.size = Pt(17)
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
        ["Document Identifier", "CC-API-2026-V1.0 (IEEE Std 830-1998 / RFC 7807 Standard)"],
        ["Engineering Version", "Version 1.0 (API Contract Baseline)"],
        ["Software Engineering Team", "Md. Shakhawat Hossain (Student ID: 0432320005101009) | Fahim Hossain (Student ID: 0432320005101007) | Department of CSE"],
        ["Course Advisor & Supervisor", "Al Imtiaz | Department of Computer Science and Engineering"],
        ["Reviewing Body", "Faculty Academic Review Board | Division of Computing and Systems"],
        ["Release Date & Status", "October 2026 | Approved for Engineering Implementation"]
    ]
    add_styled_table(doc, meta_headers, meta_data, [2.2, 4.3])
    
    # =========================================================================
    # SECTION 1: ARCHITECTURAL PRINCIPLES AND PROTOCOLS
    # =========================================================================
    add_header_p(doc, "1. Architectural Principles and Protocols", level=1)
    
    add_header_p(doc, "1.1 Overview and Purpose", level=2)
    add_body_p(doc, 
        "This document provides the definitive RESTful Application Programming Interface (API) specification for CampusConnect, a centralized university extracurricular and club management platform. It defines all HTTP contracts, authentication schemas, payload definitions, query parameters, authorization tiers, and error envelopes across the 30 server endpoints implemented in the Express.js / TypeScript backend."
    )
    
    add_header_p(doc, "1.2 Transport and Data Formatting Standards", level=2)
    add_bullet_p(doc, "Base URI Prefix: All API endpoints are mounted under the /api/v1 root path.", bold_prefix="1. Routing Prefix: ")
    add_bullet_p(doc, "Encoding and Payload Format: All request and response bodies utilize application/json with UTF-8 character encoding.", bold_prefix="2. Media Type: ")
    add_bullet_p(doc, "Stateless Authentication: Stateless JSON Web Tokens (JWT) passed via HTTP Authorization: Bearer <token> headers.", bold_prefix="3. Authentication: ")
    add_bullet_p(doc, "Persistent Session Refresh: HTTP-only, Secure, SameSite=Strict cookies protect refresh tokens against Cross-Site Scripting (XSS).", bold_prefix="4. Refresh Tokens: ")
    add_bullet_p(doc, "Standardized Error Envelopes: All client and server errors adhere to RFC 7807 Problem Details formatting.", bold_prefix="5. Error Envelopes: ")
    add_bullet_p(doc, "Punctuation Standard: Strictly utilizes ASCII hyphens (-), colons (:), and pipes (|). Zero em-dashes or en-dashes are permitted.", bold_prefix="6. Punctuation: ")

    add_header_p(doc, "1.3 HTTP Status Codes and Error Model", level=2)
    status_headers = ["HTTP Status", "Category", "Description and Trigger Condition"]
    status_data = [
        ["200 OK", "Success", "Standard successful read, update, or cancellation operation."],
        ["201 Created", "Success", "New entity created (user registration, event draft, club charter)."],
        ["400 Bad Request", "Client Error", "Malformed JSON, expired QR tokens, or deadline passed."],
        ["401 Unauthorized", "Client Error", "Missing, invalid, or expired JWT access token."],
        ["403 Forbidden", "Client Error", "Authenticated user lacks role privileges for the requested action."],
        ["404 Not Found", "Client Error", "Target resource (club, event, registration, certificate) does not exist."],
        ["409 Conflict", "Client Error", "Duplicate registration, membership conflict, or attendance double-scan."],
        ["422 Unprocessable", "Client Error", "Zod schema validation failure on request payload."],
        ["429 Too Many Req", "Client Error", "Rate limit exceeded (>5 failed login attempts in 15 minutes)."],
        ["500 Server Error", "Server Error", "Unhandled database or internal server failure."]
    ]
    add_styled_table(doc, status_headers, status_data, [1.2, 1.2, 4.1])

    add_header_p(doc, "1.4 RFC 7807 Error Envelope Specification", level=2)
    add_body_p(doc, "All error responses return a uniform JSON schema providing actionable error details for client error handlers:")
    add_code_block(doc,
        "{\n"
        '  "error": "Conflict: You already hold a confirmed registration for this event",\n'
        '  "status": 409,\n'
        '  "timestamp": "2026-10-30T12:00:00.000Z",\n'
        '  "path": "/api/v1/events/e2b3c4d5-6a7b-8c9d-0e1f-2a3b4c5d6e7f/register"\n'
        "}"
    )

    # =========================================================================
    # SECTION 2: AUTHENTICATION AND USER MANAGEMENT (MODULE 1)
    # =========================================================================
    add_header_p(doc, "2. Module 1: Authentication and User Management", level=1)
    
    auth_headers = ["Method & Path", "Access", "Request Schema", "Response Schema & Status"]
    auth_data = [
        [
            "POST /api/v1/auth/register",
            "Public",
            "{ email, password, full_name, student_id_number, department, batch_year, phone_number }",
            "201 Created\n{ message, user: { id, email, role }, profile }"
        ],
        [
            "POST /api/v1/auth/login",
            "Public",
            "{ email, password }",
            "200 OK\n{ accessToken, user: { id, email, role, profile } }\nSet-Cookie: refreshToken"
        ],
        [
            "POST /api/v1/auth/refresh",
            "Cookie",
            "Cookie: refreshToken",
            "200 OK\n{ accessToken, user: { id, email, role } }"
        ],
        [
            "POST /api/v1/auth/logout",
            "Auth",
            "Headers: Authorization: Bearer <token>",
            "200 OK\n{ message: 'Logged out successfully' }\nClear-Cookie: refreshToken"
        ],
        [
            "GET /api/v1/auth/me",
            "Auth",
            "Headers: Authorization: Bearer <token>",
            "200 OK\n{ user: { id, email, role, profile } }"
        ],
        [
            "GET /api/v1/auth/users",
            "Admin",
            "Query: role, status, page, limit",
            "200 OK\n{ users: [ { id, email, role, status, profile } ], total }"
        ],
        [
            "PATCH /api/v1/auth/users/:id/role",
            "Admin",
            "{ role: 'STUDENT' | 'CLUB_EXECUTIVE' | 'FACULTY_ADVISOR' | 'ADMIN' }",
            "200 OK\n{ message: 'Role updated', user: { id, email, role } }"
        ]
    ]
    add_styled_table(doc, auth_headers, auth_data, [1.8, 0.8, 2.1, 1.8])

    # =========================================================================
    # SECTION 3: CLUBS AND MEMBERSHIP MANAGEMENT (MODULE 2)
    # =========================================================================
    add_header_p(doc, "3. Module 2: Clubs and Membership Management", level=1)
    
    club_headers = ["Method & Path", "Access", "Request Schema", "Response Schema & Status"]
    club_data = [
        [
            "GET /api/v1/clubs",
            "Public",
            "Query: category, search",
            "200 OK\n{ clubs: [ { id, name, slug, category, logo_url, member_count } ] }"
        ],
        [
            "GET /api/v1/clubs/:idOrSlug",
            "Public",
            "Param: idOrSlug (UUID or slug)",
            "200 OK\n{ club: { id, name, description, category, advisor, executives, events } }"
        ],
        [
            "POST /api/v1/clubs",
            "Admin",
            "{ name, slug, description, category, logo_url, faculty_advisor_id }",
            "201 Created\n{ message: 'Club created', club: { id, name, slug } }"
        ],
        [
            "POST /api/v1/clubs/:clubId/apply",
            "Student",
            "{ reason?: string }",
            "201 Created\n{ message: 'Application submitted', membershipId, status: 'PENDING' }"
        ],
        [
            "GET /api/v1/clubs/:clubId/members",
            "Auth",
            "Query: status ('PENDING' | 'APPROVED')",
            "200 OK\n{ members: [ { id, user_id, full_name, student_id_number, club_role, status } ] }"
        ],
        [
            "PATCH /api/v1/clubs/:clubId/members/:membershipId",
            "Club Exec",
            "{ status: 'APPROVED' | 'REJECTED', club_role?: 'MEMBER' | 'EXECUTIVE' }",
            "200 OK\n{ message: 'Membership status updated', membership: { id, status, club_role } }"
        ],
        [
            "GET /api/v1/clubs/:clubId/analytics",
            "Club Exec",
            "Param: clubId",
            "200 OK\n{ totalMembers, activeEvents, totalRegistrations, averageAttendanceRate }"
        ]
    ]
    add_styled_table(doc, club_headers, club_data, [1.8, 0.8, 2.1, 1.8])

    # =========================================================================
    # SECTION 4: EVENT GOVERNANCE AND LIFECYCLE (MODULE 3)
    # =========================================================================
    add_header_p(doc, "4. Module 3: Event Governance and Lifecycle", level=1)
    
    event_headers = ["Method & Path", "Access", "Request Schema", "Response Schema & Status"]
    event_data = [
        [
            "GET /api/v1/events",
            "Public",
            "Query: category, clubId, status, search",
            "200 OK\n{ events: [ { id, title, club_name, venue, start_time, capacity, registered_count } ] }"
        ],
        [
            "GET /api/v1/events/review/pending",
            "Advisor / Admin",
            "Headers: Authorization: Bearer <token>",
            "200 OK\n{ pendingEvents: [ { id, title, club_name, capacity, start_time, created_by } ] }"
        ],
        [
            "GET /api/v1/events/:id",
            "Public",
            "Param: id (Event UUID)",
            "200 OK\n{ event: { id, title, description, venue, capacity, registered_count, is_registered } }"
        ],
        [
            "POST /api/v1/events",
            "Club Exec",
            "{ club_id, title, description, venue, start_time, end_time, capacity, registration_deadline }",
            "201 Created\n{ message: 'Event drafted', event: { id, title, status: 'DRAFT' } }"
        ],
        [
            "POST /api/v1/events/:id/submit",
            "Club Exec",
            "Param: id (Event UUID)",
            "200 OK\n{ message: 'Event submitted for advisor review', status: 'SUBMITTED' }"
        ],
        [
            "POST /api/v1/events/:id/review",
            "Advisor / Admin",
            "{ status: 'APPROVED' | 'REJECTED', advisor_remarks: string }",
            "200 OK\n{ message: 'Review recorded', status: 'PUBLISHED' | 'REJECTED' }"
        ],
        [
            "POST /api/v1/events/:id/cancel",
            "Club Exec / Admin",
            "{ reason: string }",
            "200 OK\n{ message: 'Event cancelled', status: 'CANCELLED' }"
        ]
    ]
    add_styled_table(doc, event_headers, event_data, [1.8, 0.9, 2.0, 1.8])

    # =========================================================================
    # SECTION 5: REGISTRATIONS AND WAITLIST CONCURRENCY (MODULE 4)
    # =========================================================================
    add_header_p(doc, "5. Module 4: Registrations and Concurrency-Safe Waitlist", level=1)
    
    reg_headers = ["Method & Path", "Access", "Request Schema", "Response Schema & Status"]
    reg_data = [
        [
            "POST /api/v1/events/:eventId/register",
            "Student",
            "Param: eventId (Concurrency Safe)",
            "201 Created (Confirmed Slot)\n{ status: 'CONFIRMED', ticketCode, message }\nOR 200 OK (Waitlisted)\n{ status: 'WAITLISTED', waitlistPosition: 3 }"
        ],
        [
            "POST /api/v1/registrations/:registrationId/cancel",
            "Student / Admin",
            "Param: registrationId",
            "200 OK\n{ message: 'Registration cancelled', promotedStudentUserId }"
        ],
        [
            "GET /api/v1/registrations/me",
            "Student",
            "Headers: Authorization: Bearer <token>",
            "200 OK\n{ registrations: [ { id, event_title, venue, status, ticket_code, waitlist_position } ] }"
        ],
        [
            "GET /api/v1/events/:eventId/roster",
            "Club Exec / Advisor",
            "Param: eventId",
            "200 OK\n{ confirmed: [ { user_id, full_name, ticket_code } ], waitlisted: [ ... ] }"
        ]
    ]
    add_styled_table(doc, reg_headers, reg_data, [1.8, 0.9, 1.9, 1.9])

    # =========================================================================
    # SECTION 6: DYNAMIC QR ATTENDANCE TRACKING (MODULE 5)
    # =========================================================================
    add_header_p(doc, "6. Module 5: Dynamic Anti-Proxy Attendance Tracking", level=1)
    
    attend_headers = ["Method & Path", "Access", "Request Schema", "Response Schema & Status"]
    attend_data = [
        [
            "GET /api/v1/events/:eventId/attendance/live-qr",
            "Club Exec",
            "Param: eventId",
            "200 OK\n{ dynamicToken: 'HMAC_SHA256', expiresInSeconds: 20, timeStep: 172900000 }"
        ],
        [
            "POST /api/v1/events/:eventId/attendance/scan",
            "Student",
            "{ dynamicToken: string }",
            "200 OK\n{ message: 'Check-in confirmed', checkInTime: '2026-10-30T12:00:00Z', method: 'DYNAMIC_QR' }"
        ],
        [
            "POST /api/v1/events/:eventId/attendance/manual",
            "Club Exec",
            "{ student_id_number: string }",
            "200 OK\n{ message: 'Manual check-in recorded', method: 'ORGANIZER_MANUAL' }"
        ],
        [
            "GET /api/v1/events/:eventId/attendance",
            "Club Exec / Advisor",
            "Param: eventId",
            "200 OK\n{ totalCheckedIn: 48, records: [ { user_id, student_name, check_in_time, method } ] }"
        ]
    ]
    add_styled_table(doc, attend_headers, attend_data, [1.8, 0.9, 1.9, 1.9])

    # =========================================================================
    # SECTION 7: CERTIFICATES AND PUBLIC VERIFICATION (MODULE 6)
    # =========================================================================
    add_header_p(doc, "7. Module 6: Certificates and Public Verification", level=1)
    
    cert_headers = ["Method & Path", "Access", "Request Schema", "Response Schema & Status"]
    cert_data = [
        [
            "POST /api/v1/events/:eventId/certificates/issue",
            "Club Exec",
            "Param: eventId",
            "200 OK\n{ message: 'Certificates generated', issuedCount: 45, failedCount: 0 }"
        ],
        [
            "GET /api/v1/certificates/me",
            "Student",
            "Headers: Authorization: Bearer <token>",
            "200 OK\n{ certificates: [ { id, serial_number, event_title, issue_date, pdf_url } ] }"
        ],
        [
            "GET /api/v1/certificates/download/:serialNumber",
            "Public",
            "Param: serialNumber",
            "200 OK\nContent-Type: application/pdf\n(High-resolution official credential stream)"
        ],
        [
            "GET /api/v1/certificates/verify/:serialNumber",
            "Public (No Auth)",
            "Param: serialNumber",
            "200 OK\n{ status: 'VALID', recipientName, studentId, eventTitle, clubName, issueDate, sha256 }"
        ]
    ]
    add_styled_table(doc, cert_headers, cert_data, [1.8, 0.9, 1.8, 2.0])

    # =========================================================================
    # SECTION 8: ANNOUNCEMENTS, FEEDBACK & NOTIFICATIONS (MODULE 7)
    # =========================================================================
    add_header_p(doc, "8. Module 7: Announcements, Notifications and Feedback", level=1)
    
    comm_headers = ["Method & Path", "Access", "Request Schema", "Response Schema & Status"]
    comm_data = [
        [
            "GET /api/v1/clubs/:clubId/announcements",
            "Public",
            "Param: clubId",
            "200 OK\n{ announcements: [ { id, title, content, author_name, created_at } ] }"
        ],
        [
            "POST /api/v1/clubs/:clubId/announcements",
            "Club Exec",
            "{ title: string, content: string }",
            "201 Created\n{ message: 'Announcement published', id, created_at }"
        ],
        [
            "GET /api/v1/notifications",
            "Auth",
            "Headers: Authorization: Bearer <token>",
            "200 OK\n{ notifications: [ { id, title, message, link_url, is_read, created_at } ] }"
        ],
        [
            "PATCH /api/v1/notifications/:id/read",
            "Auth",
            "Param: id (Notification UUID)",
            "200 OK\n{ message: 'Marked as read', is_read: true }"
        ],
        [
            "POST /api/v1/events/:eventId/feedback",
            "Student (Attended)",
            "{ rating: 1..5, comments?: string, is_anonymous?: boolean }",
            "201 Created\n{ message: 'Feedback submitted successfully' }"
        ],
        [
            "GET /api/v1/events/:eventId/feedback",
            "Club Exec / Advisor",
            "Param: eventId",
            "200 OK\n{ averageRating: 4.8, totalSubmissions: 42, feedbackList: [ ... ] }"
        ]
    ]
    add_styled_table(doc, comm_headers, comm_data, [1.8, 0.9, 1.9, 1.9])

    # =========================================================================
    # SECTION 9: INSTITUTIONAL ANALYTICS AND HEALTH (MODULE 8)
    # =========================================================================
    add_header_p(doc, "9. Module 8: Institutional Analytics and Operational Health", level=1)
    
    admin_headers = ["Method & Path", "Access", "Request Schema", "Response Schema & Status"]
    admin_data = [
        [
            "GET /api/v1/analytics/admin",
            "Sys Admin",
            "Headers: Authorization: Bearer <token>",
            "200 OK\n{ totalUsers, activeClubs, totalEvents, totalRegistrations, certificatesIssued }"
        ],
        [
            "GET /api/v1/health",
            "Public",
            "None",
            "200 OK\n{ status: 'HEALTHY', timestamp: '2026-10-30T12:00:00Z', platform: 'CampusConnect v2.0' }"
        ]
    ]
    add_styled_table(doc, admin_headers, admin_data, [1.8, 0.9, 1.8, 2.0])

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
    build_api_document()
