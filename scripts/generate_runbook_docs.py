#!/usr/bin/env python3
"""
CampusConnect Deployment & Operational Runbook Generator
Standard: IEEE Std 828-2012 / NIST SP 800-145
Typography: Times New Roman, 12pt body, pure black #000000, fully justified.
Tables: Soft ash header fill (#F1F5F9), bold black text, minimal borders, repeated headers.
Punctuation: Strictly ASCII hyphens (-), colons (:), pipes (|). Zero em/en dashes.
Zero empty pages: Headings use page_break_before where appropriate.
Outputs: docs/CampusConnect_Deployment_Runbook.docx and docs/CampusConnect_Deployment_Runbook.pdf
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

def build_runbook_document():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(base_dir, '..', 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    
    docx_path = os.path.join(docs_dir, 'CampusConnect_Deployment_Runbook.docx')
    pdf_path = os.path.join(docs_dir, 'CampusConnect_Deployment_Runbook.pdf')
    
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
    r_title = p_title.add_run("DEPLOYMENT AND OPERATIONAL RUNBOOK")
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
        ["Document Identifier", "CC-OPS-2026-V1.0 (IEEE Std 828-2012 Standard)"],
        ["Engineering Version", "Version 1.0 (Operational Baseline)"],
        ["Software Engineering Team", "Md. Shakhawat Hossain (Student ID: 0432320005101009) | Fahim Hossain (Student ID: 0432320005101007) | Department of CSE"],
        ["Course Advisor & Supervisor", "Al Imtiaz | Department of Computer Science and Engineering"],
        ["Reviewing Body", "Faculty Academic Review Board | Division of Computing and Systems"],
        ["Release Date & Status", "October 2026 | Approved for Engineering Implementation"]
    ]
    add_styled_table(doc, meta_headers, meta_data, [2.2, 4.3])
    
    # =========================================================================
    # SECTION 1: INTRODUCTION AND OVERVIEW
    # =========================================================================
    add_header_p(doc, "1. Introduction and System Overview", level=1)
    
    add_header_p(doc, "1.1 Purpose", level=2)
    add_body_p(doc,
        "This Deployment and Operational Runbook establishes standard operating procedures for installing, configuring, deploying, monitoring, and maintaining CampusConnect, a centralized university extracurricular and club management platform. It serves as the operational guide for software engineers, DevOps personnel, and campus systems administrators."
    )
    
    add_header_p(doc, "1.2 System Topology", level=2)
    add_body_p(doc,
        "CampusConnect is architected as a modular containerized stack comprising an Express.js/TypeScript REST API, a single-page web frontend, a persistent PostgreSQL 16 database, an in-memory Redis 7 instance, and an Nginx reverse proxy providing TLS termination and static caching."
    )

    # =========================================================================
    # SECTION 2: INFRASTRUCTURE PREREQUISITES
    # =========================================================================
    add_header_p(doc, "2. Infrastructure Prerequisites and Environment Matrix", level=1)
    
    add_header_p(doc, "2.1 Hardware and OS Requirements", level=2)
    hw_headers = ["Component", "Minimum Specification", "Recommended Production"]
    hw_data = [
        ["Compute / CPU", "2 Virtual Cores (x86_64 or ARM64)", "4 Virtual Cores (Dedicated)"],
        ["Memory (RAM)", "4 GB RAM", "8 GB to 16 GB ECC RAM"],
        ["Disk Storage", "20 GB SSD Storage", "100 GB NVMe SSD with automated snapshots"],
        ["Operating System", "Ubuntu Linux 22.04 LTS", "Ubuntu Linux 24.04 LTS (HWE Kernel)"],
        ["Network Interface", "100 Mbps Ethernet", "1 Gbps redundant network interfaces"]
    ]
    add_styled_table(doc, hw_headers, hw_data, [1.8, 2.3, 2.4])

    add_header_p(doc, "2.2 Software Runtime Dependencies", level=2)
    sw_headers = ["Technology", "Minimum Supported Version", "Purpose in Stack"]
    sw_data = [
        ["Node.js", "Version 20.x LTS (Iron)", "Backend API and worker process execution."],
        ["PostgreSQL", "Version 16.x Alpine", "Persistent ACID relational database core."],
        ["Redis", "Version 7.x Alpine", "Fast session cache, rate-limiting, and queue store."],
        ["Docker Engine", "Version 24.0+", "Containerized infrastructure execution."],
        ["Docker Compose", "Version 2.20+", "Multi-container service orchestration."],
        ["Nginx", "Version 1.24+", "Reverse proxy, SSL/TLS termination, and gzip compression."]
    ]
    add_styled_table(doc, sw_headers, sw_data, [1.8, 2.2, 2.5])

    # =========================================================================
    # SECTION 3: ENVIRONMENT CONFIGURATION
    # =========================================================================
    add_header_p(doc, "3. Environment Variable Configuration Schema", level=1)
    add_body_p(doc, "Configure runtime secrets via .env in the project root adhering to the following schema:")
    add_code_block(doc,
        "# Server Runtime\n"
        "NODE_ENV=production\n"
        "PORT=5000\n"
        "API_PREFIX=/api/v1\n"
        "CLIENT_ORIGIN=https://campusconnect.edu\n\n"
        "# PostgreSQL Relational Core\n"
        "POSTGRES_HOST=postgres\n"
        "POSTGRES_PORT=5432\n"
        "POSTGRES_DB=campusconnect_db\n"
        "POSTGRES_USER=campusconnect_user\n"
        "POSTGRES_PASSWORD=your_secure_db_password_here\n"
        "POSTGRES_POOL_MIN=4\n"
        "POSTGRES_POOL_MAX=20\n\n"
        "# Redis Cache & Rate Limiting\n"
        "REDIS_HOST=redis\n"
        "REDIS_PORT=6379\n"
        "REDIS_PASSWORD=your_secure_redis_password_here\n\n"
        "# Cryptography & JWT\n"
        "JWT_ACCESS_SECRET=your_super_secret_jwt_access_key_min_64_chars\n"
        "JWT_ACCESS_EXPIRES_IN=15m\n"
        "JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key_min_64_chars\n"
        "JWT_REFRESH_EXPIRES_IN=7d\n"
        "ATTENDANCE_HMAC_SECRET=your_hmac_attendance_signing_secret_key\n"
        "ATTENDANCE_WINDOW_SECONDS=20\n"
        "CERTIFICATE_SIGNING_KEY=your_university_certificate_rsa_private_key"
    )

    # =========================================================================
    # SECTION 4: LOCAL DEVELOPMENT SETUP
    # =========================================================================
    add_header_p(doc, "4. Local Development and Testing Setup", level=1)
    add_body_p(doc, "Execute the following sequence to bootstrap the local development environment:")
    add_code_block(doc,
        "# Step 1: Install workspace dependencies\n"
        "npm install\n\n"
        "# Step 2: Start PostgreSQL and Redis infrastructure\n"
        "docker compose up -d postgres redis\n\n"
        "# Step 3: Run database seeding script\n"
        "npm run seed --workspace=server\n\n"
        "# Step 4: Start development servers with live reload\n"
        "npm run dev"
    )

    # =========================================================================
    # SECTION 5: HEALTH CHECK AND OBSERVABILITY
    # =========================================================================
    add_header_p(doc, "5. Health Check and Observability Runbook", level=1)
    health_headers = ["Endpoint", "HTTP Method", "Expected Status", "Subsystem Checks"]
    health_data = [
        ["/api/v1/health", "GET", "HTTP 200 OK", "Process uptime, memory RSS, event loop lag."],
        ["/api/v1/health/ready", "GET", "HTTP 200 OK", "PostgreSQL pool query (SELECT 1), Redis ping (PONG)."]
    ]
    add_styled_table(doc, health_headers, health_data, [1.8, 1.2, 1.5, 2.0])

    # =========================================================================
    # SECTION 6: BACKUP AND DISASTER RECOVERY
    # =========================================================================
    add_header_p(doc, "6. Backup, Disaster Recovery, and Point-In-Time Restoration", level=1)
    add_body_p(doc, "1. Automated Logical Backups: Nightly cron job executes pg_dump with gzip compression, retaining snapshots for 30 days.")
    add_body_p(doc, "2. Emergency Restoration: In case of catastrophic volume corruption, the restoration playbook drops the corrupted DB, recreates the schema, and streams the latest uncompressed SQL archive into PostgreSQL within 30 minutes (RTO < 30m, RPO < 1h).")

    # =========================================================================
    # SECTION 7: INCIDENT RESPONSE PLAYBOOK
    # =========================================================================
    add_header_p(doc, "7. Incident Response and Troubleshooting Playbook", level=1)
    inc_headers = ["Incident Scenario", "Root Cause", "Operational Remediation"]
    inc_data = [
        ["DB Connection Saturation", "Unclosed async queries or excessive pool size.", "Terminate idle connections >5m; tune POSTGRES_POOL_MAX."],
        ["Attendance Clock Drift", "NTP desynchronization on host machine.", "Restart systemd-timesyncd; verify T-1 grace window."],
        ["Redis Memory Exhaustion", "Keys missing Time-To-Live expiration.", "Apply allkeys-lru eviction policy via redis-cli config."]
    ]
    add_styled_table(doc, inc_headers, inc_data, [1.8, 2.0, 2.7])

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
    build_runbook_document()
