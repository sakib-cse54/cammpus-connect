#!/usr/bin/env python3
"""
CampusConnect Stakeholder and Role-Based User Manual Generator
Standard: IEEE Std 26514-2018 (Requirements for Designers and Developers of User Documentation)
Typography: Times New Roman, 12pt body, pure black #000000, fully justified.
Tables: Soft ash header fill (#F1F5F9), bold black text, minimal borders, repeated headers.
Punctuation: Strictly ASCII hyphens (-), colons (:), pipes (|). Zero em/en dashes.
Zero empty pages: Headings use page_break_before where appropriate.
Outputs: docs/CampusConnect_User_Manual.docx and docs/CampusConnect_User_Manual.pdf
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

def build_user_manual_document():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(base_dir, '..', 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    
    docx_path = os.path.join(docs_dir, 'CampusConnect_User_Manual.docx')
    pdf_path = os.path.join(docs_dir, 'CampusConnect_User_Manual.pdf')
    
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
    r_title = p_title.add_run("STAKEHOLDER & USER MANUAL")
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
        ["Document Identifier", "CC-USR-2026-V1.0 (IEEE Std 26514-2018 Standard)"],
        ["Engineering Version", "Version 1.0 (Operational Baseline)"],
        ["Software Engineering Team", "Md. Shakhawat Hossain (Student ID: 0432320005101009) | Fahim Hossain (Student ID: 0432320005101007) | Department of CSE"],
        ["Course Advisor & Supervisor", "Al Imtiaz | Department of Computer Science and Engineering"],
        ["Reviewing Body", "Faculty Academic Review Board | Division of Computing and Systems"],
        ["Release Date & Status", "October 2026 | Approved for Engineering Implementation"]
    ]
    add_styled_table(doc, meta_headers, meta_data, [2.2, 4.3])
    
    # =========================================================================
    # SECTION 1: PLATFORM ACCESS AND NAVIGATION
    # =========================================================================
    add_header_p(doc, "1. Introduction and Platform Access", level=1)
    add_body_p(doc, 
        "This Stakeholder and Role-Based User Manual provides comprehensive, step-by-step guidance for operating CampusConnect, the university's centralized club, event, and extracurricular management platform. The manual is organized by user role: Student, Club Executive, Faculty Advisor, and System Administrator."
    )
    add_body_p(doc,
        "The platform is accessible via modern desktop and mobile web browsers (Chrome, Firefox, Safari, Edge) at: https://campusconnect.edu"
    )

    # =========================================================================
    # SECTION 2: STUDENT PORTAL MANUAL
    # =========================================================================
    add_header_p(doc, "2. Student Portal User Manual", level=1)
    
    add_header_p(doc, "2.1 Account Creation and Authentication", level=2)
    add_body_p(doc, "1. Registration: Navigate to /register. Enter your Full Name, Department, Official Student ID Number (e.g., 0432320005101009), and University Email. Choose a secure password with at least 8 characters.")
    add_body_p(doc, "2. Login: Access /login and provide your university credentials. The platform will authenticate and redirect you to the personal discovery dashboard.")

    add_header_p(doc, "2.2 Discovering Clubs and Joining Organizations", level=2)
    add_body_p(doc, "Browse registered campus societies under the Clubs directory. Click on any club to review its mission, executive leadership, and upcoming activities. Click Join Club to submit an application.")

    add_header_p(doc, "2.3 Event Registration and Automated Waitlist", level=2)
    add_body_p(doc, "When viewing an event with available seats, click Register Now for immediate confirmation. If the event is full, click Join Waitlist to secure a FIFO position. If a registered attendee cancels, the system automatically promotes the first waitlisted student and notifies them via email.")

    add_header_p(doc, "2.4 Dynamic Attendance Check-in", level=2)
    add_body_p(doc, "At the venue, scan the dynamic rotating QR code projected on the hall screen. The code rotates every 20 seconds; screenshots sent from absent peers will expire and fail validation.")

    add_header_p(doc, "2.5 Official Completion Certificates", level=2)
    add_body_p(doc, "Following event completion and attendance validation, visit My Profile -> Certificates to download your cryptographically signed PDF certificate featuring an immutable serial and public verification URL.")

    # =========================================================================
    # SECTION 3: CLUB EXECUTIVE OPERATIONAL MANUAL
    # =========================================================================
    add_header_p(doc, "3. Club Executive Operational Manual", level=1)
    
    add_header_p(doc, "3.1 Drafting and Submitting Event Proposals", level=2)
    add_body_p(doc, "From the Executive Desk, click Create New Event. Populate title, category, venue, schedule, capacity limits, and agenda. Click Submit for Review to route the proposal to your assigned Faculty Advisor.")

    add_header_p(doc, "3.2 Operating the Dynamic Check-in Desk", level=2)
    add_body_p(doc, "At the event venue, open the Attendance Desk on a laptop connected to the room projector and click Launch Attendance Screen. The live projection rotates HMAC seeds every 20 seconds. For students with device issues, use the Roster Check-in tab to confirm attendance manually.")

    # =========================================================================
    # SECTION 4: FACULTY ADVISOR GOVERNANCE
    # =========================================================================
    add_header_p(doc, "4. Faculty Advisor Governance Handbook", level=1)
    add_body_p(doc, "Faculty Advisors review incoming student event proposals in the Moderation Queue:")
    add_bullet_p(doc, "Validates schedule conflicts, room reservations, and safety protocols before granting approval.", bold_prefix="Compliance Check: ")
    add_bullet_p(doc, "Immediately publishes the event to the university catalog and enables student registrations.", bold_prefix="Approve Action: ")
    add_bullet_p(doc, "Requires mandatory written remarks detailing deficiencies so student organizers can revise and resubmit.", bold_prefix="Reject Action: ")

    # =========================================================================
    # SECTION 5: SYSTEM ADMINISTRATOR GUIDE
    # =========================================================================
    add_header_p(doc, "5. System Administrator Governance Guide", level=1)
    admin_headers = ["Governance Function", "Administrative Scope", "Key Action"]
    admin_data = [
        ["User Role Delegation", "Global Users", "Elevate students to Club Executive or faculty to Advisor."],
        ["Account Sanctions", "Policy Violations", "Toggle user status between ACTIVE and SUSPENDED."],
        ["Club Chartering", "Organization Lifecycle", "Create new club charters and assign supervising faculty."],
        ["System Audit Trail", "Compliance & Forensics", "Filter immutable audit logs by actor, entity, and timestamp."]
    ]
    add_styled_table(doc, admin_headers, admin_data, [2.0, 2.0, 2.5])

    # =========================================================================
    # SECTION 6: PUBLIC VERIFICATION
    # =========================================================================
    add_header_p(doc, "6. Public Credential Verification Guide", level=1)
    add_body_p(doc, "External evaluators, employers, and graduate schools can verify certificate authenticity by visiting https://campusconnect.edu/verify and entering the certificate serial number. The system verifies the SHA-256 digital fingerprint against database records and presents a verified status badge with zero login requirements.")

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
    build_user_manual_document()
