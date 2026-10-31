#!/usr/bin/env python3
"""
CampusConnect Final Project Report Generator
Course: CSE0613316 - Software Project Design and Development (Autumn 2026 | Short Format)
Supervised by: Al Imtiaz, Assistant Professor, Department of CSE, UITS
Authors: Md. Shakhawat Hossain (0432320005101009) & Fahim Hossain (0432320005101007)

Standards:
- docx-azhar / IEEE publication standard: Times New Roman, 12pt body, pure black #000000, fully justified.
- Punctuation: Strictly ASCII short hyphens (-), colons (:), and pipes (|). Zero em-dashes and en-dashes.
- Tables: Soft ash header fill (#F1F5F9), bold black text, clean borders, cantSplit, tblHeader.
- Figures: High-resolution PNG vectors and authentic Linux terminal screenshots embedded cleanly.
- Page numbering: Section 1 (Front Matter) lower Roman (i, ii, ...), Section 2 (Main Chapters) Arabic (1, 2, ...).
- Zero empty pages: Precision page breaks only on major chapter and front matter boundaries.
"""

import os
import sys
import re
import subprocess
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def sanitize_text(text: str) -> str:
    """Ensure strict avoidance of em-dashes, en-dashes, and elongated bars."""
    for ch in [chr(0x2014), chr(0x2015), '&' + 'mdash;', '&' + '#8212;']:
        text = text.replace(ch, ' - ')
    for ch in [chr(0x2013), '&' + 'ndash;', '&' + '#8211;']:
        text = text.replace(ch, '-')
    return text

def set_cell_background(cell, color_hex="F1F5F9"):
    """Set subtle background fill for table cells."""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=60, bottom=60, left=100, right=100):
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

def set_table_borders(table, color="CCCCCC"):
    """Set clean, visible borders for tables."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>'
        f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def set_table_header_and_split(table):
    """Ensure header repeats on page breaks and rows never split across page boundaries."""
    if len(table.rows) > 0:
        header_tr = table.rows[0]._tr.get_or_add_trPr()
        header_tr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
    
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

def add_formatted_text(p, text, font_name="Times New Roman", font_size=12, default_bold=False, default_italic=False, color_rgb=(0, 0, 0)):
    """Parse inline markdown tokens (**bold**, *italic*, `code`) and add runs, supporting <br> line breaks."""
    text = sanitize_text(text)
    sub_lines = re.split(r'<br\s*/?>', text)
    for line_idx, sub_line in enumerate(sub_lines):
        if line_idx > 0:
            p.add_run().add_break()
        tokens = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', sub_line)
        for token in tokens:
            if not token:
                continue
            run = p.add_run()
            run.font.name = font_name
            run.font.color.rgb = RGBColor(*color_rgb)
            
            if token.startswith('**') and token.endswith('**') and len(token) >= 4:
                run.text = token[2:-2]
                run.bold = True
                run.font.size = Pt(font_size)
            elif token.startswith('*') and token.endswith('*') and len(token) >= 2:
                run.text = token[1:-1]
                run.italic = True
                run.font.size = Pt(font_size)
            elif token.startswith('`') and token.endswith('`') and len(token) >= 2:
                run.text = token[1:-1]
                run.font.name = 'DejaVu Sans Mono'
                run.font.size = Pt(max(font_size - 1.5, 8.5))
                run.font.color.rgb = RGBColor(15, 23, 42)
            else:
                run.text = token
                run.bold = default_bold
                run.italic = default_italic
                run.font.size = Pt(font_size)

def add_header_p(doc, text, level=1, page_break_before=False, space_before=None, space_after=None, is_center=False):
    text = sanitize_text(text)
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    if page_break_before:
        p.paragraph_format.page_break_before = True
    if is_center:
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.color.rgb = RGBColor(0, 0, 0)
    run.bold = True
    
    if level == 1:
        run.font.size = Pt(15)
        p.paragraph_format.space_before = Pt(space_before if space_before is not None else 14)
        p.paragraph_format.space_after = Pt(space_after if space_after is not None else 4)
    elif level == 2:
        run.font.size = Pt(13)
        p.paragraph_format.space_before = Pt(space_before if space_before is not None else 11)
        p.paragraph_format.space_after = Pt(space_after if space_after is not None else 3)
    elif level == 3:
        run.font.size = Pt(12)
        p.paragraph_format.space_before = Pt(space_before if space_before is not None else 8)
        p.paragraph_format.space_after = Pt(space_after if space_after is not None else 2)
    elif level == 4:
        run.font.size = Pt(11.5)
        p.paragraph_format.space_before = Pt(space_before if space_before is not None else 6)
        p.paragraph_format.space_after = Pt(space_after if space_after is not None else 2)
    return p

def add_body_p(doc, text, space_after=4, line_spacing=1.15):
    p = doc.add_paragraph()
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = line_spacing
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    add_formatted_text(p, text, font_size=12)
    return p

def add_bullet_p(doc, text, space_after=3):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    add_formatted_text(p, text, font_size=12)
    return p

def add_numbered_p(doc, num_str, text, space_after=3):
    p = doc.add_paragraph()
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.left_indent = Inches(0.25)
    p.paragraph_format.first_line_indent = Inches(-0.25)
    
    r_num = p.add_run(f"{num_str}. ")
    r_num.font.name = 'Times New Roman'
    r_num.font.size = Pt(12)
    r_num.font.color.rgb = RGBColor(0, 0, 0)
    r_num.bold = True
    
    add_formatted_text(p, text, font_size=12)
    return p

def add_code_block(doc, code_text):
    code_text = sanitize_text(code_text)
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    set_cell_background(cell, "F8FAFC")
    set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
    
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
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(code_text)
    run.font.name = 'DejaVu Sans Mono'
    run.font.size = Pt(9.0)
    run.font.color.rgb = RGBColor(15, 23, 42)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(3)

def add_picture_with_caption(doc, img_path, caption_text, width_inches=6.2):
    if not os.path.exists(img_path):
        print(f"[WARN] Image file not found: {img_path}")
        return
        
    p_img = doc.add_paragraph()
    p_img.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(6)
    p_img.paragraph_format.space_after = Pt(2)
    run_img = p_img.add_run()
    run_img.add_picture(img_path, width=Inches(width_inches))
    
    p_cap = doc.add_paragraph()
    p_cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap.paragraph_format.space_before = Pt(1)
    p_cap.paragraph_format.space_after = Pt(6)
    p_cap.paragraph_format.keep_with_next = True
    
    clean_cap = caption_text.strip()
    if clean_cap.startswith("*") and clean_cap.endswith("*"):
        clean_cap = clean_cap[1:-1]
    
    r_cap = p_cap.add_run(sanitize_text(clean_cap))
    r_cap.font.name = 'Times New Roman'
    r_cap.font.size = Pt(10.0)
    r_cap.font.italic = True
    r_cap.font.color.rgb = RGBColor(0, 0, 0)

def get_table_col_widths(headers):
    n = len(headers)
    hdr_lower = [h.lower() for h in headers]
    
    # Specific known tables
    if n == 2 and 'item' in hdr_lower[0]:
        return [1.8, 4.7]
    elif n == 2 and 'abbreviation' in hdr_lower[0]:
        return [2.0, 4.5]
    elif n == 3 and 'member' in hdr_lower[0] and 'signature' in hdr_lower[1]:
        return [3.0, 2.0, 1.5]
    elif n == 3 and 'attribute' in hdr_lower[0]:
        return [1.3, 1.2, 4.0]
    elif n == 3 and 'evaluation criterion' in hdr_lower[0]:
        return [2.7, 1.9, 1.9]
    elif n == 4 and 'tool' in hdr_lower[0]:
        return [1.8, 2.0, 1.2, 1.5]
    elif n == 4 and 'co' in hdr_lower[0] and 'po' in hdr_lower[1] and 'justification' in hdr_lower[2]:
        return [0.7, 0.7, 3.8, 1.3]
    elif n == 4 and 'feature' in hdr_lower[0]:
        return [1.9, 1.5, 1.5, 1.6]
    elif n == 4 and 'quality measure' in hdr_lower[0]:
        return [2.2, 1.6, 1.7, 1.0]
    elif n == 4 and 'milestone' in hdr_lower[0]:
        return [1.8, 0.9, 0.9, 2.9]
    elif n == 4 and 'member' in hdr_lower[0] and 'modules' in hdr_lower[1]:
        return [2.0, 2.2, 1.2, 1.1]
    elif n == 4 and 'member' in hdr_lower[0] and 'agreed' in hdr_lower[1]:
        return [2.6, 1.4, 1.4, 1.1]
    elif n == 6 and 'co no.' in hdr_lower[0]:
        return [0.7, 2.5, 0.6, 1.0, 0.5, 1.2]
    elif n == 6 and 'req id' in hdr_lower[0]:
        return [0.8, 1.8, 1.1, 1.0, 1.0, 0.8]
    elif n == 6 and 'criterion' in hdr_lower[0]:
        return [1.7, 1.8, 0.5, 0.5, 1.0, 1.0]
    elif n == 7 and 'wk' in hdr_lower[0]:
        return [0.5, 1.1, 0.9, 1.1, 1.1, 1.0, 0.8]
    elif n == 13:
        return [0.7] + [0.48] * 12
    else:
        w = 6.5 / max(n, 1)
        return [w] * n

def add_styled_table(doc, headers, data, font_size=9.0):
    col_widths = get_table_col_widths(headers)
    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    set_table_header_and_split(table)
    
    is_matrix = (len(headers) == 13)
    
    # Headers
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = ""
        p = hdr_cells[i].paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.05
        if is_matrix and i > 0:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_formatted_text(p, title, font_size=font_size, default_bold=True)
        set_cell_background(hdr_cells[i], "F1F5F9")
        set_cell_margins(hdr_cells[i], top=50, bottom=50, left=70, right=70)
        
    # Data rows
    for r_idx, row_values in enumerate(data):
        row_cells = table.rows[r_idx + 1].cells
        for c_idx, val in enumerate(row_values):
            if c_idx < len(row_cells):
                row_cells[c_idx].text = ""
                p = row_cells[c_idx].paragraphs[0]
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(2)
                p.paragraph_format.line_spacing = 1.05
                if is_matrix and c_idx > 0:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                add_formatted_text(p, str(val), font_size=font_size, default_bold=False)
                set_cell_margins(row_cells[c_idx], top=40, bottom=40, left=70, right=70)
                
    # Apply widths
    for row in table.rows:
        for idx, w in enumerate(col_widths):
            if idx < len(row.cells):
                row.cells[idx].width = Inches(w)
                
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(3)

def setup_header_footer(section, is_roman=False, is_cover=False):
    if is_cover:
        section.different_first_page_header_footer = True
        return
        
    section.header.is_linked_to_previous = False
    section.footer.is_linked_to_previous = False
    section.different_first_page_header_footer = False
    
    # Page numbering type
    sectPr = section._sectPr
    pgNumType = OxmlElement('w:pgNumType')
    pgNumType.set(qn('w:fmt'), 'lowerRoman' if is_roman else 'decimal')
    pgNumType.set(qn('w:start'), '1')
    sectPr.append(pgNumType)
    
    # Header
    p_hdr = section.header.paragraphs[0]
    p_hdr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_hdr.paragraph_format.space_before = Pt(0)
    p_hdr.paragraph_format.space_after = Pt(0)
    r_hdr = p_hdr.add_run("CSE0613316: SDPM Final Report | CampusConnect Platform")
    r_hdr.font.name = 'Times New Roman'
    r_hdr.font.size = Pt(8.5)
    r_hdr.font.italic = True
    r_hdr.font.color.rgb = RGBColor(100, 116, 139)
    
    # Footer
    p_ft = section.footer.paragraphs[0]
    p_ft.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_ft.paragraph_format.space_before = Pt(0)
    p_ft.paragraph_format.space_after = Pt(0)
    
    r_ft1 = p_ft.add_run("Department of CSE, UITS   |   Page | ")
    r_ft1.font.name = 'Times New Roman'
    r_ft1.font.size = Pt(9.0)
    r_ft1.font.color.rgb = RGBColor(100, 116, 139)
    
    fld_xml = (
        '<w:fldSimple ' + nsdecls('w') + ' w:instr="PAGE">'
        '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="18"/></w:rPr>'
        '<w:t>' + ('i' if is_roman else '1') + '</w:t></w:r>'
        '</w:fldSimple>'
    )
    p_ft._p.append(parse_xml(fld_xml))

def parse_part_blocks(part_text):
    lines = part_text.strip().split("\n")
    blocks = []
    i = 0
    n = len(lines)
    
    while i < n:
        line = lines[i].strip()
        
        if not line:
            i += 1
            continue
        if re.match(r"^Page\s*\|\s*[a-zA-Z0-9]+$", line):
            i += 1
            continue
        if line.startswith("(Times New Roman") or line.startswith("(Note:"):
            i += 1
            continue
            
        # Code block
        if line.startswith("```"):
            lang = line[3:].strip()
            code_lines = []
            i += 1
            while i < n and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            
            caption = ""
            if i < n:
                next_l = lines[i].strip()
                if next_l.startswith("*Fig.") or next_l.startswith("*Listing"):
                    caption = next_l
                    i += 1
                    
            blocks.append(("code", lang, "\n".join(code_lines), caption))
            continue
            
        # Markdown table
        if line.startswith("|") and line.endswith("|"):
            tbl_lines = []
            while i < n and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                tbl_lines.append(lines[i].strip())
                i += 1
            blocks.append(("table", tbl_lines))
            continue
            
        # Headings
        if line.startswith("#### "):
            blocks.append(("h4", line[5:].strip()))
            i += 1
            continue
        if line.startswith("### "):
            blocks.append(("h3", line[4:].strip()))
            i += 1
            continue
        if line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
            i += 1
            continue
        if line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
            i += 1
            continue
            
        # Bullet list
        if line.startswith("- ") or line.startswith("* "):
            blocks.append(("bullet", line[2:].strip()))
            i += 1
            continue
            
        # Numbered list
        m_num = re.match(r"^(\d+)\.\s+(.*)$", line)
        if m_num:
            blocks.append(("numbered", m_num.group(1), m_num.group(2).strip()))
            i += 1
            continue
            
        # Regular paragraph
        para_lines = [line]
        i += 1
        while i < n:
            next_l = lines[i].strip()
            if (not next_l or next_l.startswith("#") or next_l.startswith("|") or 
                next_l.startswith("```") or next_l.startswith("- ") or next_l.startswith("* ") or 
                re.match(r"^\d+\.\s+", next_l) or re.match(r"^Page\s*\|\s*", next_l)):
                break
            para_lines.append(next_l)
            i += 1
        blocks.append(("para", " ".join(para_lines)))
        
    return blocks

def render_cover_page(doc):
    p_inst = doc.add_paragraph()
    p_inst.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.space_before = Pt(36)
    p_inst.paragraph_format.space_after = Pt(2)
    r_inst = p_inst.add_run("UNIVERSITY OF INFORMATION TECHNOLOGY AND SCIENCES (UITS)")
    r_inst.font.name = 'Times New Roman'
    r_inst.font.size = Pt(15)
    r_inst.font.color.rgb = RGBColor(0, 0, 0)
    r_inst.bold = True
    
    p_dept = doc.add_paragraph()
    p_dept.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_dept.paragraph_format.space_before = Pt(0)
    p_dept.paragraph_format.space_after = Pt(36)
    r_dept = p_dept.add_run("DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING")
    r_dept.font.name = 'Times New Roman'
    r_dept.font.size = Pt(13)
    r_dept.font.color.rgb = RGBColor(0, 0, 0)
    r_dept.bold = True
    
    p_rpt = doc.add_paragraph()
    p_rpt.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_rpt.paragraph_format.space_before = Pt(0)
    p_rpt.paragraph_format.space_after = Pt(8)
    r_rpt = p_rpt.add_run("FINAL PROJECT REPORT")
    r_rpt.font.name = 'Times New Roman'
    r_rpt.font.size = Pt(13)
    r_rpt.font.color.rgb = RGBColor(71, 85, 105)
    r_rpt.bold = True
    
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(8)
    p_title.paragraph_format.space_after = Pt(36)
    r_title = p_title.add_run("CampusConnect: Centralized University Club, Event & Activity Management Platform with ACID Concurrency, Cryptographic Verification and Outcome-Based Education (OBE) Attainment")
    r_title.font.name = 'Times New Roman'
    r_title.font.size = Pt(17)
    r_title.font.color.rgb = RGBColor(0, 0, 0)
    r_title.bold = True
    
    p_crs = doc.add_paragraph()
    p_crs.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_crs.paragraph_format.space_before = Pt(0)
    p_crs.paragraph_format.space_after = Pt(2)
    r_crs = p_crs.add_run("A Project Report Submitted in Partial Fulfillment of the Requirements of the Course")
    r_crs.font.name = 'Times New Roman'
    r_crs.font.size = Pt(11)
    r_crs.font.italic = True
    
    p_crscode = doc.add_paragraph()
    p_crscode.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_crscode.paragraph_format.space_before = Pt(0)
    p_crscode.paragraph_format.space_after = Pt(2)
    r_crscode = p_crscode.add_run("CSE0613316 - Software Project Design and Development")
    r_crscode.font.name = 'Times New Roman'
    r_crscode.font.size = Pt(12)
    r_crscode.font.color.rgb = RGBColor(0, 0, 0)
    r_crscode.bold = True
    
    p_sem = doc.add_paragraph()
    p_sem.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sem.paragraph_format.space_before = Pt(0)
    p_sem.paragraph_format.space_after = Pt(32)
    r_sem = p_sem.add_run("Semester: Autumn 2026 | Short Format")
    r_sem.font.name = 'Times New Roman'
    r_sem.font.size = Pt(11)
    r_sem.bold = True
    
    p_by = doc.add_paragraph()
    p_by.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_by.paragraph_format.space_before = Pt(0)
    p_by.paragraph_format.space_after = Pt(3)
    r_by = p_by.add_run("Submitted By:")
    r_by.font.name = 'Times New Roman'
    r_by.font.size = Pt(11.5)
    r_by.bold = True
    
    p_m1 = doc.add_paragraph()
    p_m1.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_m1.paragraph_format.space_before = Pt(0)
    p_m1.paragraph_format.space_after = Pt(1)
    r_m1 = p_m1.add_run("Md. Shakhawat Hossain [Student ID: 0432320005101009]")
    r_m1.font.name = 'Times New Roman'
    r_m1.font.size = Pt(11)
    
    p_m2 = doc.add_paragraph()
    p_m2.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_m2.paragraph_format.space_before = Pt(0)
    p_m2.paragraph_format.space_after = Pt(1)
    r_m2 = p_m2.add_run("Fahim Hossain [Student ID: 0432320005101007]")
    r_m2.font.name = 'Times New Roman'
    r_m2.font.size = Pt(11)
    
    p_dept2 = doc.add_paragraph()
    p_dept2.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_dept2.paragraph_format.space_before = Pt(0)
    p_dept2.paragraph_format.space_after = Pt(28)
    r_dept2 = p_dept2.add_run("Department of Computer Science and Engineering")
    r_dept2.font.name = 'Times New Roman'
    r_dept2.font.size = Pt(11)
    r_dept2.font.italic = True
    
    p_sup = doc.add_paragraph()
    p_sup.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sup.paragraph_format.space_before = Pt(0)
    p_sup.paragraph_format.space_after = Pt(3)
    r_sup = p_sup.add_run("Course Instructor & Project Supervisor:")
    r_sup.font.name = 'Times New Roman'
    r_sup.font.size = Pt(11.5)
    r_sup.bold = True
    
    p_instname = doc.add_paragraph()
    p_instname.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_instname.paragraph_format.space_before = Pt(0)
    p_instname.paragraph_format.space_after = Pt(1)
    r_instname = p_instname.add_run("Al Imtiaz")
    r_instname.font.name = 'Times New Roman'
    r_instname.font.size = Pt(12)
    r_instname.bold = True
    
    p_instdes = doc.add_paragraph()
    p_instdes.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_instdes.paragraph_format.space_before = Pt(0)
    p_instdes.paragraph_format.space_after = Pt(1)
    r_instdes = p_instdes.add_run("Assistant Professor, Department of CSE")
    r_instdes.font.name = 'Times New Roman'
    r_instdes.font.size = Pt(11)
    
    p_loc = doc.add_paragraph()
    p_loc.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_loc.paragraph_format.space_before = Pt(0)
    p_loc.paragraph_format.space_after = Pt(28)
    r_loc = p_loc.add_run("University of Information Technology and Sciences (UITS)\nBaridhara J Block, Dhaka 1212")
    r_loc.font.name = 'Times New Roman'
    r_loc.font.size = Pt(11)
    
    p_dt = doc.add_paragraph()
    p_dt.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_dt.paragraph_format.space_before = Pt(0)
    p_dt.paragraph_format.space_after = Pt(0)
    r_dt = p_dt.add_run("October, 2026")
    r_dt.font.name = 'Times New Roman'
    r_dt.font.size = Pt(11.5)
    r_dt.bold = True

def render_part(doc, part_idx, part_text, images_dir):
    blocks = parse_part_blocks(part_text)
    skip_next = False
    
    for b_idx, block in enumerate(blocks):
        if skip_next:
            skip_next = False
            continue
            
        b_type = block[0]
        
        if b_type == 'h1':
            title = block[1]
            # Check if next block is also an h1 (e.g. Chapter 1 followed by Introduction)
            if b_idx + 1 < len(blocks) and blocks[b_idx + 1][0] == 'h1':
                sub_title = blocks[b_idx + 1][1]
                add_header_p(doc, title.upper(), level=1, space_before=16, space_after=2, is_center=True)
                add_header_p(doc, sub_title.upper(), level=1, space_before=0, space_after=12, is_center=True)
                skip_next = True
            else:
                add_header_p(doc, title, level=1, space_before=14, space_after=4)
        elif b_type == 'h2':
            add_header_p(doc, block[1], level=2, space_before=11, space_after=3)
        elif b_type == 'h3':
            add_header_p(doc, block[1], level=3, space_before=8, space_after=2)
        elif b_type == 'h4':
            add_header_p(doc, block[1], level=4, space_before=6, space_after=2)
        elif b_type == 'para':
            # Check if this paragraph contains IEEE reference citations e.g. [1], [2]
            text = block[1]
            if re.match(r"^\[\d+\]\s+", text):
                # Format reference with hanging indent
                p = doc.add_paragraph()
                p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                p.paragraph_format.line_spacing = 1.15
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.left_indent = Inches(0.35)
                p.paragraph_format.first_line_indent = Inches(-0.35)
                add_formatted_text(p, text, font_size=11.5)
            else:
                add_body_p(doc, text)
        elif b_type == 'bullet':
            add_bullet_p(doc, block[1])
        elif b_type == 'numbered':
            add_numbered_p(doc, block[1], block[2])
        elif b_type == 'table':
            tbl_lines = block[1]
            rows = []
            for l in tbl_lines:
                t = l.strip()
                if t.startswith("|"): t = t[1:]
                if t.endswith("|"): t = t[:-1]
                rows.append([c.strip() for c in t.split("|")])
            if len(rows) >= 2:
                headers = rows[0]
                data = rows[2:] # skip separator row
                add_styled_table(doc, headers, data)
        elif b_type == 'code':
            lang, code_text, caption = block[1], block[2], block[3]
            
            # Map caption to actual figure image
            if "Fig. 2.1" in caption:
                img_path = os.path.join(images_dir, "fig_2_1_architecture.png")
                add_picture_with_caption(doc, img_path, caption, width_inches=6.2)
            elif "Fig. 2.2" in caption:
                img_path = os.path.join(images_dir, "fig_2_2_concurrency_seq.png")
                add_picture_with_caption(doc, img_path, caption, width_inches=6.2)
            elif "Fig. 2.3" in caption:
                img_path = os.path.join(images_dir, "fig_2_3_qr_seq.png")
                add_picture_with_caption(doc, img_path, caption, width_inches=6.2)
            elif "Fig. 2.4" in caption:
                img_path = os.path.join(images_dir, "fig_2_4_erd.png")
                add_picture_with_caption(doc, img_path, caption, width_inches=6.2)
            elif "Fig. 3.1" in caption:
                img_path = os.path.join(images_dir, "terminal_fig1_concurrency.png")
                add_picture_with_caption(doc, img_path, caption, width_inches=6.0)
            elif "Fig. 4.1" in caption:
                img_path = os.path.join(images_dir, "fig_4_1_cicd_pipeline.png")
                add_picture_with_caption(doc, img_path, caption, width_inches=6.2)
            elif "Fig. 4.2" in caption:
                img_path = os.path.join(images_dir, "terminal_fig2_server_tests.png")
                add_picture_with_caption(doc, img_path, caption, width_inches=6.0)
            elif "Fig. 4.3" in caption:
                img_path = os.path.join(images_dir, "terminal_fig3_client_build.png")
                add_picture_with_caption(doc, img_path, caption, width_inches=6.0)
            else:
                # Monospace code block for listings
                add_code_block(doc, code_text)
                if caption:
                    p_cap = doc.add_paragraph()
                    p_cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                    p_cap.paragraph_format.space_before = Pt(1)
                    p_cap.paragraph_format.space_after = Pt(4)
                    add_formatted_text(p_cap, caption, font_size=11, default_italic=True)

def build_final_report():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(base_dir, '..', 'docs')
    images_dir = os.path.join(docs_dir, 'images')
    md_path = os.path.join(docs_dir, 'CampusConnect_Project_Report.md')
    docx_path = os.path.join(docs_dir, 'CampusConnect_Project_Report.docx')
    pdf_path = os.path.join(docs_dir, 'CampusConnect_Project_Report.pdf')
    
    if not os.path.exists(md_path):
        print(f"[ERROR] Markdown file not found: {md_path}")
        sys.exit(1)
        
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()
        
    parts = md_text.split("\n---\n")
    print(f"[INFO] Loaded markdown with {len(parts)} structural parts.")
    
    doc = Document()
    
    # -------------------------------------------------------------
    # SECTION 0: COVER PAGE
    # -------------------------------------------------------------
    sec_cover = doc.sections[0]
    sec_cover.top_margin = Inches(1.0)
    sec_cover.bottom_margin = Inches(1.0)
    sec_cover.left_margin = Inches(1.0)
    sec_cover.right_margin = Inches(1.0)
    sec_cover.page_width = Inches(8.5)
    sec_cover.page_height = Inches(11.0)
    setup_header_footer(sec_cover, is_cover=True)
    
    print("[INFO] Rendering Cover Page...")
    render_cover_page(doc)
    
    # -------------------------------------------------------------
    # SECTION 1: FRONT MATTER (Parts 1 to 11) - Roman Numerals
    # -------------------------------------------------------------
    sec_front = doc.add_section()
    sec_front.top_margin = Inches(1.0)
    sec_front.bottom_margin = Inches(1.0)
    sec_front.left_margin = Inches(1.0)
    sec_front.right_margin = Inches(1.0)
    sec_front.page_width = Inches(8.5)
    sec_front.page_height = Inches(11.0)
    setup_header_footer(sec_front, is_roman=True)
    
    print("[INFO] Rendering Front Matter (Pages i to xi)...")
    for p_idx in range(1, 12):
        if p_idx > 1:
            doc.add_page_break()
        print(f"  -> Rendering Front Matter Part {p_idx}...")
        render_part(doc, p_idx, parts[p_idx], images_dir)
        
    # -------------------------------------------------------------
    # SECTION 2: MAIN BODY & APPENDICES (Parts 12 to 21) - Arabic
    # -------------------------------------------------------------
    sec_body = doc.add_section()
    sec_body.top_margin = Inches(1.0)
    sec_body.bottom_margin = Inches(1.0)
    sec_body.left_margin = Inches(1.0)
    sec_body.right_margin = Inches(1.0)
    sec_body.page_width = Inches(8.5)
    sec_body.page_height = Inches(11.0)
    setup_header_footer(sec_body, is_roman=False)
    
    print("[INFO] Rendering Main Chapters & Appendices (Pages 1 to 24+)...")
    for p_idx in range(12, len(parts)):
        if p_idx > 12:
            doc.add_page_break()
        print(f"  -> Rendering Main Part {p_idx}...")
        render_part(doc, p_idx, parts[p_idx], images_dir)
        
    print(f"\n[INFO] Saving generated Word document: {docx_path}...")
    doc.save(docx_path)
    print("[SUCCESS] Word document saved successfully.")
    
    # -------------------------------------------------------------
    # CONVERT TO PDF VIA LIBREOFFICE HEADLESS
    # -------------------------------------------------------------
    print(f"[INFO] Converting {docx_path} to PDF via LibreOffice...")
    cmd = ["libreoffice", "--headless", "--convert-to", "pdf", docx_path, "--outdir", docs_dir]
    try:
        res = subprocess.run(cmd, check=True, text=True, capture_output=True)
        print(res.stdout.strip())
        print(f"[SUCCESS] PDF compiled successfully: {pdf_path}")
    except subprocess.CalledProcessError as e:
        print(f"[FAIL] Error generating PDF: {e.stderr}")
        sys.exit(1)

if __name__ == '__main__':
    build_final_report()
