#!/usr/bin/env python3
"""
Academic Diagram Generator for CampusConnect Final Report
Strictly adheres to IEEE Publication Standard:
- Maximum 3 colors: Grayscale/Charcoal (#0F172A), Pure White (#FFFFFF), and Subtle Navy Accent (#1E3A8A / #F1F5F9)
- 2D flat vector layout, crisp bounding boxes, orthogonal connection routing, DejaVu Sans font
- Output directory: docs/images/
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Global styling
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['font.size'] = 9.5
plt.rcParams['axes.edgecolor'] = '#0F172A'
plt.rcParams['axes.linewidth'] = 1.0

COLOR_BORDER = '#0F172A'       # Deep Charcoal
COLOR_FILL_WHITE = '#FFFFFF'   # Pure White
COLOR_FILL_GRAY = '#F8FAFC'    # Light Ash Fill
COLOR_HEADER_FILL = '#F1F5F9'  # Header Fill
COLOR_ACCENT = '#1E3A8A'       # IEEE Navy
COLOR_LINE = '#0F172A'         # Black/Charcoal Line

def save_fig(fig, output_path, dpi=300):
    fig.savefig(output_path, dpi=dpi, bbox_inches='tight', pad_inches=0.15, facecolor='white')
    plt.close(fig)
    print(f"Generated diagram: {output_path}")

# =============================================================================
# 1. Figure 2.1: System Architecture Diagram
# =============================================================================
def generate_architecture_diagram(output_path):
    fig, ax = plt.subplots(figsize=(10, 6.2))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Title Box
    ax.text(50, 96, "Fig. 2.1. Multi-Tier Distributed Architecture of CampusConnect Platform", 
            ha='center', va='center', weight='bold', fontsize=11, color=COLOR_BORDER)

    # Tier 1: Client Layer
    tier1 = patches.FancyBboxPatch((4, 73), 92, 18, boxstyle="square,pad=0.2",
                                   edgecolor=COLOR_BORDER, facecolor=COLOR_FILL_GRAY, linewidth=1.2)
    ax.add_patch(tier1)
    ax.text(6, 88, "PRESENTATION TIER (Single Page Application - React 19 / TypeScript / Vite / Tailwind CSS)", 
            weight='bold', fontsize=9, color=COLOR_ACCENT)

    clients = [
        (8, "Student Portal\n- Discover Events\n- Concurrency Booking\n- Token Check-In"),
        (32, "Executive Desk\n- Event Proposals\n- Dynamic QR Host\n- Roster Management"),
        (56, "Advisor Governance\n- Proposal Review\n- Compliance Checks\n- Formal Remarks"),
        (80, "Admin Console\n- RBAC Elevation\n- Club Charters\n- Immutable Audit")
    ]
    for x, text in clients:
        box = patches.FancyBboxPatch((x, 75), 18, 11, boxstyle="square,pad=0.2",
                                     edgecolor=COLOR_BORDER, facecolor=COLOR_FILL_WHITE, linewidth=1.0)
        ax.add_patch(box)
        ax.text(x + 9, 80.5, text, ha='center', va='center', fontsize=7.5, color=COLOR_BORDER)

    # Arrow 1: HTTPS / REST API
    ax.annotate("", xy=(50, 63), xytext=(50, 73),
                arrowprops=dict(arrowstyle="<->", color=COLOR_LINE, lw=1.2))
    ax.text(52, 68, "HTTPS / REST API (JWT Bearer Token + JSON Payloads)", va='center', fontsize=8, color=COLOR_BORDER)

    # Tier 2: Application / API Layer
    tier2 = patches.FancyBboxPatch((4, 38), 92, 25, boxstyle="square,pad=0.2",
                                   edgecolor=COLOR_BORDER, facecolor=COLOR_FILL_GRAY, linewidth=1.2)
    ax.add_patch(tier2)
    ax.text(6, 60, "APPLICATION & BUSINESS LOGIC TIER (Node.js / Express 5 REST API Architecture)", 
            weight='bold', fontsize=9, color=COLOR_ACCENT)

    modules = [
        (6, "Authentication\n& RBAC Guard\n(JWT / BCrypt)"),
        (24, "ACID Seat Engine\n(Pessimistic Lock\n& FIFO Waitlist)"),
        (42, "Anti-Proxy QR\n(HMAC-SHA256\n20s Rotation)"),
        (60, "Certificate Engine\n(PDFKit Vector &\nSHA-256 Digest)"),
        (78, "Security Logger\n(Append-Only\nAudit Ledger)")
    ]
    for x, text in modules:
        box = patches.FancyBboxPatch((x, 41), 16, 15, boxstyle="square,pad=0.2",
                                     edgecolor=COLOR_BORDER, facecolor=COLOR_FILL_WHITE, linewidth=1.0)
        ax.add_patch(box)
        ax.text(x + 8, 48.5, text, ha='center', va='center', fontsize=7.5, color=COLOR_BORDER)

    # Arrow 2: Data Persistence Access
    ax.annotate("", xy=(50, 27), xytext=(50, 38),
                arrowprops=dict(arrowstyle="<->", color=COLOR_LINE, lw=1.2))
    ax.text(52, 32.5, "SQL Connection Pool (Parameterized Queries + ACID Transactions)", va='center', fontsize=8, color=COLOR_BORDER)

    # Tier 3: Data & Storage Layer
    tier3 = patches.FancyBboxPatch((4, 4), 92, 23, boxstyle="square,pad=0.2",
                                   edgecolor=COLOR_BORDER, facecolor=COLOR_FILL_GRAY, linewidth=1.2)
    ax.add_patch(tier3)
    ax.text(6, 24, "DATA PERSISTENCE & STORAGE TIER (Hybrid Relational Core + File Storage)", 
            weight='bold', fontsize=9, color=COLOR_ACCENT)

    dbs = [
        (10, "PostgreSQL 16\n(Production Core)\n- Row Locks (FOR UPDATE)\n- ACID Transactions"),
        (40, "SQLite 3 (WAL Mode)\n(Local & Zero-Config)\n- Concurrency Mutex\n- In-Memory Fallback"),
        (70, "Storage & Artifacts\n(Local Disk / S3)\n- Signed PDF Certificates\n- Verification QR Files")
    ]
    for x, text in dbs:
        box = patches.FancyBboxPatch((x, 7), 22, 14, boxstyle="square,pad=0.2",
                                     edgecolor=COLOR_BORDER, facecolor=COLOR_FILL_WHITE, linewidth=1.0)
        ax.add_patch(box)
        ax.text(x + 11, 14, text, ha='center', va='center', fontsize=7.5, color=COLOR_BORDER)

    save_fig(fig, output_path)

# =============================================================================
# 2. Figure 2.2: Concurrency & Waitlist Sequence Diagram
# =============================================================================
def generate_concurrency_sequence(output_path):
    fig, ax = plt.subplots(figsize=(10, 6.2))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 96, "Fig. 2.2. Concurrency-Safe Event Booking & Automated Waitlist Promotion Sequence", 
            ha='center', va='center', weight='bold', fontsize=11, color=COLOR_BORDER)

    # Lifelines
    actors = [
        (12, "Student A\n(Applicant 1)"),
        (35, "Student B\n(Applicant 2)"),
        (62, "Registration Controller\n(Express API)"),
        (88, "Database Engine\n(ACID Transaction)")
    ]

    for x, name in actors:
        box = patches.FancyBboxPatch((x - 10, 85), 20, 7, boxstyle="square,pad=0.2",
                                     edgecolor=COLOR_BORDER, facecolor=COLOR_HEADER_FILL, linewidth=1.0)
        ax.add_patch(box)
        ax.text(x, 88.5, name, ha='center', va='center', fontsize=7.5, weight='bold', color=COLOR_BORDER)
        ax.plot([x, x], [10, 85], linestyle='--', color='#94A3B8', lw=1.0)

    # Sequence steps
    steps = [
        (80, 12, 62, "1: POST /events/:id/register", True),
        (74, 62, 88, "2: BEGIN TRANSACTION + SELECT FOR UPDATE", True),
        (68, 88, 62, "3: Seats Available (count < capacity)", False),
        (62, 62, 88, "4: INSERT registration (status='CONFIRMED')", True),
        (56, 88, 62, "5: COMMIT TRANSACTION", False),
        (50, 62, 12, "6: 201 Created (CONFIRMED, Ticket: TCK-01)", False),
        (44, 35, 62, "7: POST /events/:id/register (Simultaneous Burst)", True),
        (38, 62, 88, "8: BEGIN + Lock Capacity Check (count >= cap)", True),
        (32, 62, 88, "9: INSERT registration (status='WAITLISTED', pos=1)", True),
        (26, 62, 35, "10: 201 Created (WAITLISTED, Queue Pos: #1)", False),
        (20, 12, 62, "11: POST /registrations/:id/cancel (Seat Relinquished)", True),
        (14, 62, 88, "12: Cancel Seat + Auto-Promote Waitlist Candidate #1", True),
        (8, 88, 35, "13: Notification Dispatched: Seat Confirmed (Promoted)", False)
    ]

    for y, x1, x2, label, is_req in steps:
        style = "->" if is_req else "-->"
        ax.annotate("", xy=(x2, y), xytext=(x1, y),
                    arrowprops=dict(arrowstyle="->", linestyle="-" if is_req else "--", color=COLOR_BORDER, lw=1.0))
        mid_x = (x1 + x2) / 2
        ax.text(mid_x, y + 1.2, label, ha='center', va='bottom', fontsize=7, color=COLOR_ACCENT if is_req else COLOR_BORDER)

    save_fig(fig, output_path)

# =============================================================================
# 3. Figure 2.3: 20-Second Dynamic Rotating QR Sequence Diagram
# =============================================================================
def generate_qr_sequence(output_path):
    fig, ax = plt.subplots(figsize=(10, 6.0))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 96, "Fig. 2.3. Anti-Proxy Dynamic Rotating QR Code Attendance Verification Workflow", 
            ha='center', va='center', weight='bold', fontsize=11, color=COLOR_BORDER)

    actors = [
        (14, "Club Executive\n(Venue Projector)"),
        (42, "Student Attendee\n(Mobile Scanner)"),
        (70, "Attendance API\n(Express Controller)"),
        (90, "HMAC Engine\n& Database")
    ]

    for x, name in actors:
        box = patches.FancyBboxPatch((x - 11, 85), 22, 7, boxstyle="square,pad=0.2",
                                     edgecolor=COLOR_BORDER, facecolor=COLOR_HEADER_FILL, linewidth=1.0)
        ax.add_patch(box)
        ax.text(x, 88.5, name, ha='center', va='center', fontsize=7.5, weight='bold', color=COLOR_BORDER)
        ax.plot([x, x], [10, 85], linestyle='--', color='#94A3B8', lw=1.0)

    steps = [
        (78, 14, 70, "1: GET /events/:id/attendance/live-qr", True),
        (72, 70, 90, "2: slot = floor(now/20); token = HMAC(slot, secret)", True),
        (66, 90, 70, "3: Return token + Data URL (20s expiry timer)", False),
        (60, 70, 14, "4: Project QR code + 20s visual countdown ring", False),
        (52, 42, 14, "5: Scans projected dynamic QR at entrance", True),
        (44, 42, 70, "6: POST /attendance/scan { token, event_id }", True),
        (36, 70, 90, "7: Verify HMAC signature across (slot, slot-1)", True),
        (28, 90, 70, "8: Token Valid & In Time Window -> Log Attendance", False),
        (20, 70, 42, "9: 200 OK: Attendance Verified (Pass Issued)", False),
        (12, 70, 42, "10: Post-Window Token Replay Attempt -> 400 Expired", False)
    ]

    for y, x1, x2, label, is_req in steps:
        ax.annotate("", xy=(x2, y), xytext=(x1, y),
                    arrowprops=dict(arrowstyle="->", linestyle="-" if is_req else "--", color=COLOR_BORDER, lw=1.0))
        mid_x = (x1 + x2) / 2
        ax.text(mid_x, y + 1.2, label, ha='center', va='bottom', fontsize=7, color=COLOR_ACCENT if is_req else COLOR_BORDER)

    save_fig(fig, output_path)

# =============================================================================
# 4. Figure 2.4: Entity-Relationship Diagram (ERD)
# =============================================================================
def generate_erd_diagram(output_path):
    fig, ax = plt.subplots(figsize=(10, 6.5))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 97, "Fig. 2.4. Entity-Relationship Data Model of CampusConnect (11 Core Relational Entities)", 
            ha='center', va='center', weight='bold', fontsize=11, color=COLOR_BORDER)

    tables = [
        (4, 70, 24, 22, "users\n(Core Identity)", ["PK: id (UUID)", "email (UNIQUE)", "password_hash", "role (ENUM)", "status, created_at"]),
        (38, 70, 24, 22, "student_profiles\n(Academic Info)", ["PK: id (UUID)", "FK: user_id", "student_id_number", "department, batch", "phone_number"]),
        (72, 70, 24, 22, "clubs\n(Student Societies)", ["PK: id (UUID)", "name, slug (UNIQUE)", "category, description", "FK: faculty_advisor_id", "status, created_at"]),
        
        (4, 38, 24, 24, "events\n(Lifecycle Engine)", ["PK: id (UUID)", "FK: club_id", "title, description", "venue, start/end_time", "capacity, reg_count", "status, remarks", "FK: created_by"]),
        (38, 38, 24, 24, "registrations\n(ACID Seat Ledger)", ["PK: id (UUID)", "FK: event_id", "FK: user_id", "ticket_code (UNIQUE)", "status (CONFIRMED/..)", "waitlist_position", "created_at"]),
        (72, 38, 24, 24, "club_memberships\n(Enrollment)", ["PK: id (UUID)", "FK: club_id", "FK: user_id", "club_role (PRESIDENT/..)", "status (APPROVED/..)", "joined_at"]),
        
        (4, 6, 24, 24, "attendance_records\n(Anti-Proxy Pass)", ["PK: id (UUID)", "FK: event_id", "FK: user_id", "FK: registration_id", "check_in_time", "method (QR/MANUAL)", "verified_by"]),
        (38, 6, 24, 24, "certificates\n(Tamper-Proof PDF)", ["PK: id (UUID)", "serial_number (UNIQUE)", "FK: event_id, user_id", "sha256_hash", "pdf_url, status", "issued_at"]),
        (72, 6, 24, 24, "audit_logs\n(Immutable Audit)", ["PK: id (UUID)", "FK: actor_id", "action (ENUM)", "entity_type, entity_id", "details (JSON)", "ip_address, timestamp"])
    ]

    for x, y, w, h, title, fields in tables:
        # Table container
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="square,pad=0.2",
                                     edgecolor=COLOR_BORDER, facecolor=COLOR_FILL_WHITE, linewidth=1.1)
        ax.add_patch(box)
        # Header banner
        header = patches.FancyBboxPatch((x, y + h - 5.5), w, 5.5, boxstyle="square,pad=0.2",
                                        edgecolor=COLOR_BORDER, facecolor=COLOR_HEADER_FILL, linewidth=1.0)
        ax.add_patch(header)
        ax.text(x + w / 2, y + h - 2.8, title, ha='center', va='center', fontsize=7.5, weight='bold', color=COLOR_ACCENT)
        # Field list
        field_y = y + h - 7.5
        for field in fields:
            ax.text(x + 1.5, field_y, field, ha='left', va='center', fontsize=6.8, color=COLOR_BORDER)
            field_y -= 3.2

    # Relationship connectors
    ax.plot([28, 38], [81, 81], color=COLOR_BORDER, lw=1.0) # users -> student_profiles (1:1)
    ax.text(33, 82.5, "1:1", ha='center', fontsize=6.5, weight='bold')

    ax.plot([62, 72], [81, 81], color=COLOR_BORDER, lw=1.0) # users -> clubs advisor (1:N)
    ax.text(67, 82.5, "1:N", ha='center', fontsize=6.5, weight='bold')

    ax.plot([84, 84], [70, 62], color=COLOR_BORDER, lw=1.0) # clubs -> memberships (1:N)
    ax.text(85.5, 66, "1:N", va='center', fontsize=6.5, weight='bold')

    ax.plot([16, 16], [70, 62], color=COLOR_BORDER, lw=1.0) # users -> events created_by (1:N)
    ax.text(17.5, 66, "1:N", va='center', fontsize=6.5, weight='bold')

    ax.plot([28, 38], [50, 50], color=COLOR_BORDER, lw=1.0) # events -> registrations (1:N)
    ax.text(33, 51.5, "1:N", ha='center', fontsize=6.5, weight='bold')

    ax.plot([50, 50], [38, 30], color=COLOR_BORDER, lw=1.0) # registrations -> certificates (1:1)
    ax.text(51.5, 34, "1:1", va='center', fontsize=6.5, weight='bold')

    ax.plot([16, 16], [38, 30], color=COLOR_BORDER, lw=1.0) # events -> attendance (1:N)
    ax.text(17.5, 34, "1:N", va='center', fontsize=6.5, weight='bold')

    save_fig(fig, output_path)

# =============================================================================
# 5. Figure 4.3: CI/CD Pipeline Flowchart
# =============================================================================
def generate_cicd_pipeline(output_path):
    fig, ax = plt.subplots(figsize=(10, 3.8))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 50)
    ax.axis('off')

    ax.text(50, 46, "Fig. 4.1. Automated GitHub Actions CI/CD Pipeline & Quality Gate Workflow", 
            ha='center', va='center', weight='bold', fontsize=11, color=COLOR_BORDER)

    stages = [
        (4, "Git Push / PR\n(main/release)\nBranch Trigger"),
        (20, "Static Analysis\n- ESLint Quality\n- TypeScript Strict\n- Zero 'any' Rule"),
        (38, "Backend Vitest\n- 20 Test Suites\n- 267/267 Tests Pass\n- Concurrency Audit"),
        (56, "Client Bundle\n- Vite 6 Production\n- Tree-Shaking\n- 453 kB Bundle Check"),
        (74, "Security Gate\n- Audit Log Check\n- Zero CVE Check\n- Secret Scan"),
        (88, "Automated Release\n- Release Tag v2.0\n- Docker Compose\n- Zero-Downtime")
    ]

    for i, (x, text) in enumerate(stages):
        box_w = 14 if i == 0 else 15 if i < 5 else 10
        box = patches.FancyBboxPatch((x, 8), box_w, 28, boxstyle="square,pad=0.2",
                                     edgecolor=COLOR_BORDER, facecolor=COLOR_FILL_WHITE, linewidth=1.1)
        ax.add_patch(box)
        # Stage top indicator
        bar = patches.FancyBboxPatch((x, 32), box_w, 4, boxstyle="square,pad=0.2",
                                     edgecolor=COLOR_BORDER, facecolor=COLOR_HEADER_FILL, linewidth=1.0)
        ax.add_patch(bar)
        ax.text(x + box_w / 2, 34, f"Stage {i+1}", ha='center', va='center', fontsize=7, weight='bold', color=COLOR_ACCENT)
        ax.text(x + box_w / 2, 19, text, ha='center', va='center', fontsize=6.8, color=COLOR_BORDER)

        if i < len(stages) - 1:
            next_x = stages[i+1][0]
            ax.annotate("", xy=(next_x, 22), xytext=(x + box_w, 22),
                        arrowprops=dict(arrowstyle="->", color=COLOR_BORDER, lw=1.1))

    save_fig(fig, output_path)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    images_dir = os.path.join(base_dir, "..", "docs", "images")
    os.makedirs(images_dir, exist_ok=True)

    generate_architecture_diagram(os.path.join(images_dir, "fig_2_1_architecture.png"))
    generate_concurrency_sequence(os.path.join(images_dir, "fig_2_2_concurrency_seq.png"))
    generate_qr_sequence(os.path.join(images_dir, "fig_2_3_qr_seq.png"))
    generate_erd_diagram(os.path.join(images_dir, "fig_2_4_erd.png"))
    generate_cicd_pipeline(os.path.join(images_dir, "fig_4_1_cicd_pipeline.png"))

if __name__ == '__main__':
    main()
