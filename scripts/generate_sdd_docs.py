#!/usr/bin/env python3
"""
CampusConnect Software Design Document (SDD) Generator
Standard: IEEE Std 1016-2009 (Systems Design: Software Design Descriptions)
Typography: Times New Roman, 12pt body, pure black #000000, fully justified.
Tables: Soft ash header fill (#F1F5F9), bold black text, minimal borders, repeated headers.
Punctuation: Strictly ASCII hyphens (-), colons (:), pipes (|). Zero em/en dashes.
Zero empty pages: Headings use page_break_before where appropriate.
Outputs: docs/CampusConnect_SDD_v1.docx and docs/CampusConnect_SDD_v1.pdf
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

def build_sdd_document():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(base_dir, '..', 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    
    docx_path = os.path.join(docs_dir, 'CampusConnect_SDD_v1.docx')
    pdf_path = os.path.join(docs_dir, 'CampusConnect_SDD_v1.pdf')
    
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
    r_title = p_title.add_run("SOFTWARE DESIGN DOCUMENT")
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
        ["Document Identifier", "CC-SDD-2026-V1.0 (IEEE Std 1016-2009 Standard)"],
        ["Engineering Version", "Version 1.0 (Architecture Baseline)"],
        ["Software Engineering Team", "Md. Shakhawat Hossain (Student ID: 0432320005101009) | Fahim Hossain (Student ID: 0432320005101007) | Department of CSE"],
        ["Course Advisor & Supervisor", "Al Imtiaz | Department of Computer Science and Engineering"],
        ["Reviewing Body", "Faculty Academic Review Board | Division of Computing and Systems"],
        ["Release Date & Status", "October 2026 | Approved for Engineering Implementation"]
    ]
    add_styled_table(doc, meta_headers, meta_data, [2.2, 4.3])
    
    # =========================================================================
    # SECTION 1: INTRODUCTION AND ARCHITECTURAL GOALS
    # =========================================================================
    add_header_p(doc, "1. Introduction and Architectural Goals", level=1)
    
    add_header_p(doc, "1.1 Purpose", level=2)
    add_body_p(doc, 
        "This Software Design Document (SDD) provides the definitive technical architecture and low-level system design for CampusConnect, a centralized university extracurricular and club management platform. This specification bridges the high-level functional requirements documented in the Software Requirements Specification (CC-SRS-2026-V2.0) and the implementation codebase. It details the modular component decomposition, concurrency mechanics, data architecture, RESTful API contracts, and cryptographic verification pipelines."
    )
    
    add_header_p(doc, "1.2 System Scope", level=2)
    add_body_p(doc,
        "CampusConnect consolidates student organizational activities across university departments. The platform orchestrates 4 distinct stakeholder roles: Students, Club Executives, Faculty Advisors, and System Administrators. Primary design objectives include:"
    )
    add_bullet_p(doc, "Absolute prevention of event over-registration and race conditions during high-volume registration rushes via row-level locking.", bold_prefix="1. ACID Transactional Integrity: ")
    add_bullet_p(doc, "Elimination of attendance fraud (such as QR screenshot sharing among students) through dynamic, short-lived rotating cryptographic tokens.", bold_prefix="2. Anti-Proxy Attendance Assurance: ")
    add_bullet_p(doc, "Generation of cryptographically signed, tamper-proof completion certificates accessible via a public validation endpoint.", bold_prefix="3. Verifiable Digital Credentials: ")
    add_bullet_p(doc, "Comprehensive, immutable audit trails capturing every lifecycle change, approval, rejection, and role elevation.", bold_prefix="4. Deterministic Auditability: ")
    add_bullet_p(doc, "API latency targets with p95 < 250ms for read operations and p95 < 400ms for transactional writes under concurrent loads.", bold_prefix="5. Responsive Performance: ")

    add_header_p(doc, "1.3 Design Constraints and Standards", level=2)
    add_body_p(doc,
        "The system design strictly adheres to IEEE Std 1016-2009 for software design documentation, RFC 7519 for JWT token handling, RFC 6238 for time-based one-time password (TOTP) generation, and RFC 7807 for REST API problem details. Furthermore, all documents and source code strictly avoid typographic em-dashes and en-dashes, employing ASCII hyphens, colons, and pipes exclusively."
    )

    # =========================================================================
    # SECTION 2: ARCHITECTURAL OVERVIEW AND SYSTEM CONTEXT
    # =========================================================================
    add_header_p(doc, "2. Architectural Overview and System Context", level=1)
    
    add_header_p(doc, "2.1 C4 Context Level Architecture", level=2)
    add_body_p(doc,
        "CampusConnect operates within the campus cloud network, integrating four primary human actors and background workers into a coherent, secure topology:"
    )
    add_code_block(doc,
        "+--------------------------------------------------------------------------------------------------+\n"
        "|                                    CAMPUSCONNECT SYSTEM CONTEXT                                  |\n"
        "+--------------------------------------------------------------------------------------------------+\n"
        "|                                                                                                  |\n"
        "|   +-------------------+    +----------------------+    +-------------------+    +------------+   |\n"
        "|   |   Student User    |    | Club Executive User  |    |  Faculty Advisor  |    | Sys Admin  |   |\n"
        "|   | (Web Browser/PWA) |    |  (Leadership Desk)   |    | (Review & Audit)  |    |  (Console) |   |\n"
        "|   +---------+---------+    +----------+-----------+    +---------+---------+    +-----+------+   |\n"
        "|             |                         |                          |                    |          |\n"
        "|             +-------------------------+--------------------------+--------------------+          |\n"
        "|                                       | (HTTPS / JSON REST API)                                  |\n"
        "|                                       v                                                          |\n"
        "|                    +--------------------------------------+                                      |\n"
        "|                    |      CampusConnect Web API Gateway   |                                      |\n"
        "|                    |     (Node.js 20 LTS / Express / TS)  |                                      |\n"
        "|                    +------------------+-------------------+                                      |\n"
        "|                                       |                                                          |\n"
        "|             +-------------------------+-------------------------+                                |\n"
        "|             |                                                   |                                |\n"
        "|             v                                                   v                                |\n"
        "|   +-------------------+                               +--------------------+                     |\n"
        "|   |   PostgreSQL 16   |                               |       Redis 7      |                     |\n"
        "|   | (ACID Relational  |                               |  (Session Cache,   |                     |\n"
        "|   |   Data Core)      |                               |  Rate Limits & Q)  |                     |\n"
        "|   +-------------------+                               +--------------------+                     |\n"
        "|                                                                                                  |\n"
        "+--------------------------------------------------------------------------------------------------+"
    )

    add_header_p(doc, "2.2 C4 Container Level Decomposition", level=2)
    add_body_p(doc, "1. Client Web Application: Single-page application built with TypeScript, communicating with backend REST endpoints via secure HTTP-only cookies and JSON payloads.")
    add_body_p(doc, "2. REST API Gateway: Node.js 20+ LTS runtime executing Express.js with TypeScript. Enforces input validation schemas (Zod), JWT verification, and RBAC authorization barriers.")
    add_body_p(doc, "3. Relational Core: PostgreSQL 16 server housing all persistent normalized entities with ACID guarantees, foreign keys, and row-level locking.")
    add_body_p(doc, "4. Fast Cache & Queue Engine: Redis 7 providing sub-millisecond session state lookup, token blacklist validation, and token-bucket rate limiting.")
    add_body_p(doc, "5. Asynchronous Job Worker: Dedicated worker processing PDF certificate rendering and notification dispatches without blocking event loop workers.")

    # =========================================================================
    # SECTION 3: ARCHITECTURAL DECISION RECORDS (ADRs)
    # =========================================================================
    add_header_p(doc, "3. Architectural Decision Records (ADRs)", level=1)
    
    add_header_p(doc, "3.1 ADR-01: Modular Monolith Architecture", level=2)
    add_body_p(doc, "Decision: Build CampusConnect as a modular monolith in Node.js/TypeScript rather than distributed microservices.")
    add_body_p(doc, "Rationale: Microservices introduce distributed transactions, eventual consistency hazards, network serialization latency, and deployment complexity. A modular monolith provides clean domain boundary separation while preserving single-database ACID transactions essential for slot reservations.")

    add_header_p(doc, "3.2 ADR-02: PostgreSQL 16 Relational Engine", level=2)
    add_body_p(doc, "Decision: Mandate PostgreSQL 16 as the persistent data store, rejecting document-based NoSQL engines.")
    add_body_p(doc, "Rationale: CampusConnect data is inherently relational: users belong to clubs, clubs own events, events receive registrations, registrations yield attendance, and attendance earns certificates. PostgreSQL offers battle-tested ACID compliance, foreign key constraints, composite indexing, and row-level locking (SELECT ... FOR UPDATE) required to eliminate race conditions during registration bursts.")

    add_header_p(doc, "3.3 ADR-03: Dynamic HMAC/TOTP Attendance Tokens", level=2)
    add_body_p(doc, "Decision: Implement dynamic rotating QR codes with 15 to 30 second validity windows.")
    add_body_p(doc, "Rationale: Standard static QR codes displayed on paper or static screens can be easily photographed, sent via instant messaging, and scanned by absent peers, compromising attendance validity. Rotating cryptographic tokens ensure that only physically present attendees viewing the live display or presenting a refreshed personal token can be checked in.")

    add_header_p(doc, "3.4 ADR-04: Cryptographically Verifiable Digital Certificates", level=2)
    add_body_p(doc, "Decision: Issue PDF certificates containing embedded SHA-256 digests and public verification URLs.")
    add_body_p(doc, "Rationale: Event completion certificates are frequently presented on student resumes and scholarship portfolios, creating a risk of digital forgery. Third-party evaluators, employers, and academic departments can verify authenticity instantly without needing system credentials.")

    add_header_p(doc, "3.5 ADR-05: Secure Password Hashing with bcrypt (and Argon2id Roadmap)", level=2)
    add_body_p(doc, "Decision: Enforce secure password hashing using bcrypt with 12 salt rounds across all student and faculty credentials, with an architectural migration abstraction in place for Argon2id.")
    add_body_p(doc, "Rationale: bcrypt is an industry-standard, battle-tested cryptographic hash providing tunable computational cost against brute-force attacks. The system encapsulates hashing within the authentication service to enable seamless migration to Argon2id in a future major release.")

    # =========================================================================
    # SECTION 4: COMPONENT AND MODULE DESIGN
    # =========================================================================
    add_header_p(doc, "4. Component and Module Design", level=1)
    
    add_header_p(doc, "4.1 Authentication and Role-Based Access Control (RBAC)", level=2)
    add_body_p(doc, "The platform strictly segments privileges into 4 access tiers. Every incoming request traverses the authentication middleware to verify JWT signatures, followed by the authorization barrier checking specific role permissions.")
    
    rbac_headers = ["Resource Entity", "Operation", "Student", "Club Exec", "Advisor", "Sys Admin"]
    rbac_data = [
        ["User Profile", "View / Edit Self", "Yes", "Yes", "Yes", "Yes"],
        ["User Accounts", "Assign System Roles", "No", "No", "No", "Yes"],
        ["Clubs", "Browse Directory", "Yes", "Yes", "Yes", "Yes"],
        ["Clubs", "Create / Disable Club", "No", "No", "No", "Yes"],
        ["Clubs", "Edit Metadata", "No", "Yes (Own)", "Yes (Own)", "Yes"],
        ["Club Members", "Request Membership", "Yes", "No", "No", "No"],
        ["Club Members", "Approve / Remove", "No", "Yes (Own)", "Yes (Own)", "Yes"],
        ["Events", "View Published", "Yes", "Yes", "Yes", "Yes"],
        ["Events", "Draft & Submit", "No", "Yes (Own)", "No", "Yes"],
        ["Events", "Approve / Reject", "No", "No", "Yes (Assigned)", "Yes"],
        ["Registrations", "Register / Cancel Self", "Yes", "Yes", "Yes", "Yes"],
        ["Registrations", "View Full Roster", "No", "Yes (Own)", "Yes (Assigned)", "Yes"],
        ["Attendance", "Present Dynamic QR", "Yes", "Yes", "Yes", "Yes"],
        ["Attendance", "Scan & Check-in", "No", "Yes (Own)", "Yes (Assigned)", "Yes"],
        ["Certificates", "Download Self", "Yes", "Yes", "Yes", "Yes"],
        ["Certificates", "Verify Public Hash", "Public", "Public", "Public", "Public"],
        ["Audit Logs", "Query Audit Trail", "No", "No", "No", "Yes"]
    ]
    add_styled_table(doc, rbac_headers, rbac_data, [1.4, 1.4, 0.7, 0.9, 1.1, 1.0])

    add_header_p(doc, "4.2 Concurrency-Safe Event Registration Engine", level=2)
    add_body_p(doc, "To ensure that event registrations never exceed established room or venue capacities during sudden registration spikes, all slot allocations are encapsulated within transactional row-level locking:")
    add_code_block(doc,
        "BEGIN;\n"
        "-- Lock the event row against concurrent modifications\n"
        "SELECT id, capacity, registered_count, status, registration_deadline\n"
        "FROM events WHERE id = $event_id FOR UPDATE;\n\n"
        "-- Verify registration validity\n"
        "IF status != 'PUBLISHED' OR NOW() > registration_deadline THEN\n"
        "    ROLLBACK; RAISE EXCEPTION 'Registration closed';\n"
        "END IF;\n\n"
        "-- Verify user registration existence\n"
        "IF EXISTS(SELECT 1 FROM registrations WHERE user_id = $user_id AND event_id = $event_id) THEN\n"
        "    ROLLBACK; RAISE EXCEPTION 'User already registered';\n"
        "END IF;\n\n"
        "-- Allocate confirmed slot or enqueue onto waitlist in registrations table\n"
        "IF registered_count < capacity THEN\n"
        "    INSERT INTO registrations (id, event_id, user_id, ticket_code, status, waitlist_position, created_at)\n"
        "    VALUES (gen_random_uuid(), $event_id, $user_id, $ticket_code, 'CONFIRMED', NULL, NOW());\n"
        "    UPDATE events SET registered_count = registered_count + 1 WHERE id = $event_id;\n"
        "    COMMIT; -- Confirmed slot allocated\n"
        "ELSE\n"
        "    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO next_pos\n"
        "    FROM registrations WHERE event_id = $event_id AND status = 'WAITLISTED';\n"
        "    INSERT INTO registrations (id, event_id, user_id, ticket_code, status, waitlist_position, created_at)\n"
        "    VALUES (gen_random_uuid(), $event_id, $user_id, $ticket_code, 'WAITLISTED', next_pos, NOW());\n"
        "    COMMIT; -- Placed into FIFO waitlist position\n"
        "END IF;"
    )

    add_header_p(doc, "4.3 Dynamic Anti-Proxy Attendance Mechanism", level=2)
    add_body_p(doc, "The attendance module prevents proxy check-ins by generating rotating HMAC tokens refreshed every 20 seconds. The server accepts tokens from the current time step (T0) and provides a 20-second grace window (T-1) to accommodate minor network latency. Screenshots shared with absent peers expire before they can be transmitted and submitted.")

    add_header_p(doc, "4.4 Verifiable Digital Certificate Pipeline", level=2)
    add_body_p(doc, "Upon event completion and attendance validation, eligible students can download cryptographically signed completion certificates. Each certificate features an immutable serial (CC-2026-UUID8), a SHA-256 integrity hash calculated over student details and event metadata, and a QR link pointing directly to the public verification endpoint.")

    # =========================================================================
    # SECTION 5: RELATIONAL DATA ARCHITECTURE
    # =========================================================================
    add_header_p(doc, "5. Relational Data Architecture and Schema", level=1)
    add_body_p(doc, "The persistent storage layer is structured into 13 normalized relational tables in PostgreSQL 16:")

    schema_headers = ["Table Name", "Primary Key", "Foreign Key Dependencies", "Critical Indexing"]
    schema_data = [
        ["users", "id (UUID)", "None", "UNIQUE(email)"],
        ["student_profiles", "id (UUID)", "user_id -> users(id)", "UNIQUE(user_id), UNIQUE(student_id_number)"],
        ["event_categories", "id (UUID)", "None", "UNIQUE(name)"],
        ["clubs", "id (UUID)", "faculty_advisor_id -> users(id)", "UNIQUE(slug), UNIQUE(name)"],
        ["club_memberships", "id (UUID)", "club_id -> clubs, user_id -> users", "UNIQUE(club_id, user_id)"],
        ["events", "id (UUID)", "club_id -> clubs, created_by -> users", "INDEX(club_id), INDEX(status)"],
        ["registrations", "id (UUID)", "event_id -> events, user_id -> users", "UNIQUE(event_id, user_id), UNIQUE(ticket_code)"],
        ["attendance_records", "id (UUID)", "event_id -> events, user_id -> users, reg_id -> registrations", "UNIQUE(registration_id), INDEX(event_id, user_id)"],
        ["certificates", "id (UUID)", "event_id -> events, user_id -> users", "UNIQUE(serial_number), UNIQUE(event_id, user_id)"],
        ["announcements", "id (UUID)", "club_id -> clubs, author_id -> users", "INDEX(club_id)"],
        ["notifications", "id (UUID)", "user_id -> users", "INDEX(user_id, is_read)"],
        ["feedback", "id (UUID)", "event_id -> events, user_id -> users", "UNIQUE(event_id, user_id)"],
        ["audit_logs", "id (UUID)", "actor_id -> users(id)", "INDEX(timestamp DESC)"]
    ]
    add_styled_table(doc, schema_headers, schema_data, [1.5, 1.2, 2.0, 1.8])

    # =========================================================================
    # SECTION 6: RESTFUL API CONTRACTS
    # =========================================================================
    add_header_p(doc, "6. RESTful API Contracts and Interfaces", level=1)
    add_body_p(doc, "The backend exposes structured RESTful JSON endpoints adhering to RFC 7807 problem details for all client error responses:")

    api_headers = ["Method", "Route Endpoint", "Access", "Payload / Action Description"]
    api_data = [
        ["POST", "/api/v1/auth/register", "Public", "Register student account with university email and student profile."],
        ["POST", "/api/v1/auth/login", "Public", "Authenticate credentials; return JWT & set refresh cookie."],
        ["POST", "/api/v1/auth/refresh", "Cookie", "Exchange refresh token for refreshed 15-minute JWT."],
        ["POST", "/api/v1/auth/logout", "Auth", "Revoke refresh token and invalidate client cookies."],
        ["GET", "/api/v1/auth/me", "Auth", "Retrieve profile and permissions of authenticated user."],
        ["GET", "/api/v1/auth/users", "Sys Admin", "List all registered accounts with role filters."],
        ["PATCH", "/api/v1/auth/users/:id/role", "Sys Admin", "Update user system role assignment."],
        ["GET", "/api/v1/clubs", "Public", "List clubs with category and active status filtering."],
        ["GET", "/api/v1/clubs/:idOrSlug", "Public", "Retrieve full club profile, executive board, and events."],
        ["POST", "/api/v1/clubs", "Sys Admin", "Create a newly chartered student organization."],
        ["POST", "/api/v1/clubs/:clubId/apply", "Student", "Submit membership request to target club."],
        ["GET", "/api/v1/clubs/:clubId/members", "Auth", "Retrieve member roster with status filtering."],
        ["PATCH", "/api/v1/clubs/:clubId/members/:membershipId", "Club Exec", "Approve or reject pending membership request."],
        ["GET", "/api/v1/clubs/:clubId/analytics", "Club Exec", "Retrieve executive activity and membership metrics."],
        ["GET", "/api/v1/events", "Public", "Browse upcoming published events with category filter."],
        ["GET", "/api/v1/events/:id", "Public", "Retrieve event details, remaining slots, and speaker info."],
        ["POST", "/api/v1/events", "Club Exec", "Create new event proposal in DRAFT state."],
        ["POST", "/api/v1/events/:id/submit", "Club Exec", "Submit draft event to faculty advisor for review."],
        ["POST", "/api/v1/events/:id/review", "Advisor", "Approve or reject event with mandatory written notes."],
        ["POST", "/api/v1/events/:eventId/register", "Student", "Atomic slot registration or waitlist reservation."],
        ["POST", "/api/v1/registrations/:registrationId/cancel", "Student", "Cancel registration; triggers automated waitlist promotion."],
        ["GET", "/api/v1/events/:eventId/attendance/live-qr", "Club Exec", "Retrieve rotating HMAC attendance token for live display."],
        ["POST", "/api/v1/events/:eventId/attendance/scan", "Student", "Submit dynamic QR token for attendance verification."],
        ["POST", "/api/v1/events/:eventId/attendance/manual", "Club Exec", "Organizer fallback check-in for manual validation."],
        ["POST", "/api/v1/events/:eventId/certificates/issue", "Club Exec", "Generate tamper-proof completion certificates."],
        ["GET", "/api/v1/certificates/me", "Student", "List all certificates earned by authenticated student."],
        ["GET", "/api/v1/certificates/verify/:serialNumber", "Public", "Stateless public verification of certificate validity."],
        ["GET", "/api/v1/analytics/admin", "Sys Admin", "Query system-wide metrics and institutional KPIs."],
        ["GET", "/api/v1/health", "Public", "Service liveness and health probe."]
    ]
    add_styled_table(doc, api_headers, api_data, [0.8, 2.3, 0.9, 2.5])

    # =========================================================================
    # SECTION 7: SECURITY AND NON-FUNCTIONAL ARCHITECTURE
    # =========================================================================
    add_header_p(doc, "7. Security and Non-Functional Architecture", level=1)
    
    add_header_p(doc, "7.1 Threat Mitigation Strategy", level=2)
    sec_headers = ["Vulnerability Vector", "Targeted Asset", "CampusConnect Defense Mechanism"]
    sec_data = [
        ["SQL Injection", "Relational Database", "Parameterized queries with native PostgreSQL bindings."],
        ["Cross-Site Scripting (XSS)", "Client Web App", "HTML escaping and strict Content Security Policy (CSP)."],
        ["Cross-Site Request Forgery", "Authenticated APIs", "SameSite=Strict cookie policy and CORS origin lock."],
        ["Race Conditions", "Event Capacity", "Pessimistic row-level locking (SELECT ... FOR UPDATE)."],
        ["Credential Stuffing", "Auth Endpoints", "Redis token-bucket rate limiting (5 attempts per 15 min)."],
        ["Certificate Forgery", "Completion Credentials", "Cryptographic SHA-256 signature and public verification."],
        ["Proxy Attendance", "Check-in QR Pass", "Dynamic TOTP tokens with 20s rotation and short TTL."]
    ]
    add_styled_table(doc, sec_headers, sec_data, [1.8, 1.8, 2.9])

    add_header_p(doc, "7.2 Performance and Latency Budgets", level=2)
    add_body_p(doc, "1. Read Latency: p95 response time < 250ms for club and event discovery under 500 concurrent connections.")
    add_body_p(doc, "2. Transactional Write Latency: p95 response time < 400ms for event registration under 200 concurrent requests.")
    add_body_p(doc, "3. Asynchronous Worker Throughput: Certificate generation completed within 60 seconds of event closing.")
    add_body_p(doc, "4. Availability Standard: 99.5% uptime during active academic semesters with automated health checks.")

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
    build_sdd_document()
