#!/usr/bin/env python3
"""
CampusConnect Software Test Plan (STP) Generator
Standard: ISO/IEC/IEEE 29119-3:2013 / IEEE Std 829-2008
Typography: Times New Roman, 12pt body, pure black #000000, fully justified.
Tables: Soft ash header fill (#F1F5F9), bold black text, minimal borders, repeated headers.
Punctuation: Strictly ASCII hyphens (-), colons (:), pipes (|). Zero em/en dashes.
Zero empty pages: Headings use page_break_before where appropriate.
Outputs: docs/CampusConnect_STP_v1.docx and docs/CampusConnect_STP_v1.pdf
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

def build_stp_document():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(base_dir, '..', 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    
    docx_path = os.path.join(docs_dir, 'CampusConnect_STP_v1.docx')
    pdf_path = os.path.join(docs_dir, 'CampusConnect_STP_v1.pdf')
    
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
    r_title = p_title.add_run("SOFTWARE TEST PLAN")
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
        ["Document Identifier", "CC-STP-2026-V1.0 (ISO/IEC/IEEE 29119-3:2013 Standard)"],
        ["Engineering Version", "Version 1.0 (Quality Assurance Baseline)"],
        ["Software Engineering Team", "Md. Shakhawat Hossain (Student ID: 0432320005101009) | Fahim Hossain (Student ID: 0432320005101007) | Department of CSE"],
        ["Course Advisor & Supervisor", "Al Imtiaz | Department of Computer Science and Engineering"],
        ["Reviewing Body", "Faculty Academic Review Board | Division of Computing and Systems"],
        ["Release Date & Status", "October 2026 | Approved for Engineering Implementation"]
    ]
    add_styled_table(doc, meta_headers, meta_data, [2.2, 4.3])
    
    # =========================================================================
    # SECTION 1: INTRODUCTION AND TEST OBJECTIVES
    # =========================================================================
    add_header_p(doc, "1. Introduction and Test Objectives", level=1)
    
    add_header_p(doc, "1.1 Purpose", level=2)
    add_body_p(doc,
        "This Software Test Plan (STP) defines the verification and validation framework for CampusConnect, a centralized university extracurricular and club management platform. This document operationalizes the acceptance criteria defined in the Software Requirements Specification (CC-SRS-2026-V2.0) and the technical architecture specified in the Software Design Document (CC-SDD-2026-V1.0)."
    )
    
    add_header_p(doc, "1.2 Test Objectives", level=2)
    add_body_p(doc, "The testing program must verify system correctness, security posture, and resilience across the following core dimensions:")
    add_bullet_p(doc, "Validate that parallel registration bursts hitting capacity limits never produce over-booking, negative slot counts, or unhandled database deadlocks.", bold_prefix="1. ACID Concurrency: ")
    add_bullet_p(doc, "Verify that rotating HMAC-SHA256 tokens strictly expire within their designated time window (20 seconds) and resist screenshot-sharing replay attacks.", bold_prefix="2. Anti-Proxy Attendance: ")
    add_bullet_p(doc, "Confirm that generated PDF certificates accurately reflect event participation records and that any payload tampering invalidates the verification hash.", bold_prefix="3. Digital Certificate Integrity: ")
    add_bullet_p(doc, "Validate that horizontal and vertical privilege escalation attempts between Student, Club Executive, Faculty Advisor, and System Administrator roles are blocked with HTTP 403 Forbidden.", bold_prefix="4. Access Control Enforcement: ")
    add_bullet_p(doc, "Enforce a minimum of 85% statement coverage across business logic modules and confirm p95 API response times under 250ms for read operations and under 400ms for write operations.", bold_prefix="5. Coverage and Performance: ")

    # =========================================================================
    # SECTION 2: TEST STRATEGY AND TESTING PYRAMID
    # =========================================================================
    add_header_p(doc, "2. Test Strategy and Testing Pyramid", level=1)
    add_body_p(doc, "CampusConnect adopts a multi-tier test pyramid balancing fast unit tests, deterministic integration tests, high-concurrency race condition simulations, and security penetration suites:")
    
    add_code_block(doc,
        "+-----------------------------------------------------------------------------------------+\n"
        "|                                    TESTING PYRAMID                                      |\n"
        "+-----------------------------------------------------------------------------------------+\n"
        "|                                                                                         |\n"
        "|                                       / \\                                               |\n"
        "|                                      /   \\                                              |\n"
        "|                                     / E2E \\  --> Automated User Flows                   |\n"
        "|                                    /-------\\                                            |\n"
        "|                                   / Concurr \\ --> k6 High-Concurrency Burst (Race Tests)|\n"
        "|                                  /-----------\\                                          |\n"
        "|                                 / Integration \\ --> Supertest + Real PostgreSQL Engine  |\n"
        "|                                /---------------\\                                        |\n"
        "|                               /   Unit Testing  \\ --> Vitest: Crypto, Hash, Zod Schemas |\n"
        "|                              +-------------------+                                      |\n"
        "|                                                                                         |\n"
        "+-----------------------------------------------------------------------------------------+"
    )

    add_body_p(doc, "1. Level 1 - Unit Testing (Vitest): Enforces >= 85% statement coverage on pure business logic, input validation schemas, token rotating math, and cryptographic hash verification.")
    add_body_p(doc, "2. Level 2 - API Integration Testing (Supertest + PostgreSQL): Exercises full HTTP lifecycle across authentication, role-based authorization, and transactional database rollbacks.")
    add_body_p(doc, "3. Level 3 - Concurrency Stress Testing (k6): Validates ACID row-level locking by dispatching 100+ virtual users simultaneously against an event with 5 remaining slots.")
    add_body_p(doc, "4. Level 4 - Security & Penetration Testing: Audits OWASP Top 10 defenses, expired token rejection, certificate forgery detection, and rate limiting barriers.")

    # =========================================================================
    # SECTION 3: TEST ENVIRONMENT AND TOOLING
    # =========================================================================
    add_header_p(doc, "3. Test Environment and Tooling Configuration", level=1)
    
    tool_headers = ["Testing Tier", "Primary Tooling", "Configuration & Scope"]
    tool_data = [
        ["Unit Test Runner", "Vitest 3.0+", "Fast in-memory TypeScript runner with V8 coverage."],
        ["HTTP Integration", "Supertest 7.0+", "Direct route invocations against Express application."],
        ["Test Relational DB", "PostgreSQL 16 (Docker)", "Isolated campusconnect_test database on port 5433."],
        ["Cache & Rate Limiting", "Sliding Window / Redis 7", "In-memory sliding window map with Redis 7 container configuration."],
        ["Load & Stress Engine", "k6", "Virtual user scripting for race-condition validation."],
        ["Coverage Enforcer", "Vitest Coverage", "Enforces 85% statement and 80% branch thresholds."]
    ]
    add_styled_table(doc, tool_headers, tool_data, [1.8, 2.0, 2.7])

    # =========================================================================
    # SECTION 4: COMPREHENSIVE TEST CASE SPECIFICATIONS
    # =========================================================================
    add_header_p(doc, "4. Comprehensive Test Case Specifications", level=1)
    
    add_header_p(doc, "4.1 Authentication and Access Control (TC-AUTH)", level=2)
    auth_headers = ["Test ID", "Test Case Title", "Precondition", "Input / Trigger", "Expected Result"]
    auth_data = [
        ["TC-AUTH-01", "Student Registration", "Valid email format", "POST /api/v1/auth/register", "HTTP 201 Created; bcrypt hash persisted"],
        ["TC-AUTH-02", "Duplicate Email Block", "Email already exists", "POST /api/v1/auth/register", "HTTP 409 Conflict; account collision blocked"],
        ["TC-AUTH-03", "Valid Credential Login", "Account ACTIVE", "POST /api/v1/auth/login", "HTTP 200 OK; JWT returned, cookie set"],
        ["TC-AUTH-04", "Invalid Password Block", "Registered user", "POST /api/v1/auth/login (bad pass)", "HTTP 401 Unauthorized; enumeration blocked"],
        ["TC-AUTH-05", "Rate Limit Enforcement", "Zero attempts prior", "6 failed logins in 60s", "HTTP 429 Too Many Requests on 6th call"],
        ["TC-AUTH-06", "Token Refresh Rotation", "Valid refresh cookie", "POST /api/v1/auth/refresh", "HTTP 200 OK; new JWT and rotated refresh token"]
    ]
    add_styled_table(doc, auth_headers, auth_data, [1.1, 1.4, 1.3, 1.3, 1.4])

    add_header_p(doc, "4.2 Event Governance and Concurrency (TC-EVENT)", level=2)
    event_headers = ["Test ID", "Test Case Title", "Precondition", "Input / Trigger", "Expected Result"]
    event_data = [
        ["TC-EVENT-01", "Draft Event Creation", "Club Exec authenticated", "POST /api/v1/events (valid body)", "HTTP 201 Created; initial status DRAFT"],
        ["TC-EVENT-02", "Advisor Review Approval", "Event in SUBMITTED state", "POST /api/v1/events/:id/review (APPROVE)", "HTTP 200 OK; status transitions to PUBLISHED"],
        ["TC-EVENT-03", "Advisor Rejection Notes", "Event in SUBMITTED state", "POST /api/v1/events/:id/review (REJECT)", "HTTP 200 OK; rejection_reason logged"],
        ["TC-EVENT-04", "Capacity Race Condition", "Capacity=5, registered=4", "10 concurrent registrations", "Exactly 1 CONFIRMED; 9 WAITLISTED"],
        ["TC-EVENT-05", "Waitlist FIFO Promotion", "Capacity=50, 3 on waitlist", "POST /api/v1/registrations/:id/cancel", "HTTP 200 OK; first waitlisted promoted"]
    ]
    add_styled_table(doc, event_headers, event_data, [1.1, 1.4, 1.4, 1.3, 1.3])

    add_header_p(doc, "4.3 Dynamic Attendance and Anti-Proxy Testing (TC-ATTEND)", level=2)
    attend_headers = ["Test ID", "Test Case Title", "Precondition", "Input / Trigger", "Expected Result"]
    attend_data = [
        ["TC-ATTEND-01", "Live Rotating QR Mint", "Club Exec for event", "GET /api/v1/events/:id/attendance/live-qr", "HTTP 200 OK; HMAC token with 20s TTL"],
        ["TC-ATTEND-02", "Valid Check-in Scan", "Confirmed participant", "POST /api/v1/events/:id/attendance/scan", "HTTP 200 OK; check-in timestamp saved"],
        ["TC-ATTEND-03", "Expired Token Block", "Token generated 60s ago", "POST /api/v1/events/:id/attendance/scan", "HTTP 400 Bad Request; expired token rejected"],
        ["TC-ATTEND-04", "Duplicate Scan Block", "Already checked in", "POST /api/v1/events/:id/attendance/scan", "HTTP 409 Conflict; duplicate check-in denied"],
        ["TC-ATTEND-05", "Unregistered Scan Block", "No registration record", "POST /api/v1/events/:id/attendance/scan", "HTTP 403 Forbidden; registration required"]
    ]
    add_styled_table(doc, attend_headers, attend_data, [1.1, 1.4, 1.3, 1.3, 1.4])

    add_header_p(doc, "4.4 Digital Certificates and Verification (TC-CERT)", level=2)
    cert_headers = ["Test ID", "Test Case Title", "Precondition", "Input / Trigger", "Expected Result"]
    cert_data = [
        ["TC-CERT-01", "Eligible Certificate Mint", "Attendance verified", "GET /api/v1/certificates/me", "HTTP 200 OK; returns signed serial"],
        ["TC-CERT-02", "Ineligible Certificate Block", "No attendance record", "GET /api/v1/certificates/me", "HTTP 403 Forbidden; attendance mandatory"],
        ["TC-CERT-03", "Public Credential Verification", "Valid serial in DB", "GET /api/v1/certificates/verify/:serialNumber", "HTTP 200 OK; returns valid details (no login)"],
        ["TC-CERT-04", "Tampered Serial Block", "Unknown serial string", "GET /api/v1/certificates/verify/:serialNumber", "HTTP 404 Not Found; error envelope"]
    ]
    add_styled_table(doc, cert_headers, cert_data, [1.1, 1.4, 1.3, 1.3, 1.4])

    # =========================================================================
    # SECTION 5: CONCURRENCY STRESS SPECIFICATION
    # =========================================================================
    add_header_p(doc, "5. Concurrency Stress Specification (k6 Script)", level=1)
    add_body_p(doc, "The concurrency test suite simulates sudden registration rushes using k6. 100 virtual users attempt simultaneous registration against an event with 10 open slots:")
    add_code_block(doc,
        "import http from 'k6/http';\n"
        "import { check } from 'k6';\n\n"
        "export const options = {\n"
        "  vus: 100,\n"
        "  iterations: 100,\n"
        "  thresholds: {\n"
        "    http_req_duration: ['p(95)<400'],\n"
        "    http_req_failed: ['rate<0.01'],\n"
        "  },\n"
        "};\n\n"
        "export default function () {\n"
        "  const res = http.post('http://localhost:5000/api/v1/events/EVENT_ID/register');\n"
        "  check(res, {\n"
        "    'Valid Response': (r) => r.status === 201 || r.status === 200,\n"
        "    'No Server Failures': (r) => r.status !== 500,\n"
        "  });\n"
        "}"
    )

    # =========================================================================
    # SECTION 6: PASS / FAIL CRITERIA
    # =========================================================================
    add_header_p(doc, "6. Pass / Fail Criteria and Quality Gates", level=1)
    add_body_p(doc, "1. Unit Test Pass Rate: 100% of unit tests in Vitest must pass without skips.")
    add_body_p(doc, "2. Code Coverage: Global statement coverage >= 85%, branch coverage >= 80%.")
    add_body_p(doc, "3. Integration Testing: 100% of Supertest route tests against PostgreSQL must pass.")
    add_body_p(doc, "4. Concurrency Assertion: Zero over-allocation and zero deadlocks during k6 load tests.")
    add_body_p(doc, "5. Security Audits: Zero High or Critical security vulnerabilities in dependency tree.")

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
    build_stp_document()
