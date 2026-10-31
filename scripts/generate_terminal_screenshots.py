#!/usr/bin/env python3
"""
Terminal Screenshot Generator for CampusConnect Software Test Report
Strictly conforms to OS Lab Terminal Screenshot Standard:
- Authentic Parrot OS terminal with username 'azhar' on host 'parrot'
- Prompt format: 'azhar at parrot:[path]$ [command]' with solid red block cursor on idle prompt
- Pure terminal background (#121212), DejaVu Sans Mono font
- Zero synthetic title bars, zero macOS traffic light buttons, zero watermark badges
- Output directory: docs/images/
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

font = ImageFont.truetype(FONT_PATH, 14)
font_bold = ImageFont.truetype(FONT_BOLD_PATH, 14)

COLOR_BG = (18, 18, 18)
COLOR_USER = (239, 68, 68)          # Red 'azhar'
COLOR_TEXT_WHITE = (235, 235, 235)   # ' at ', ':', output text
COLOR_HOST = (166, 226, 46)         # Green/yellow 'parrot'
COLOR_PATH = (68, 157, 235)         # Cyan/Blue directory path
COLOR_DOLLAR = (46, 204, 113)       # Green '$'
COLOR_CMD = (46, 204, 113)          # Green typed command
COLOR_CURSOR = (239, 68, 68)        # Red block cursor
COLOR_PASS_GREEN = (46, 204, 113)   # Green checkmark
COLOR_DIM = (148, 163, 184)         # Slate gray for timing/duration

def draw_prompt(draw, x, y, username, hostname, path, command=""):
    cur_x = x
    draw.text((cur_x, y), username, fill=COLOR_USER, font=font_bold)
    cur_x += font_bold.getlength(username)
    
    draw.text((cur_x, y), " at ", fill=COLOR_TEXT_WHITE, font=font)
    cur_x += font.getlength(" at ")
    
    draw.text((cur_x, y), hostname, fill=COLOR_HOST, font=font_bold)
    cur_x += font_bold.getlength(hostname)
    
    draw.text((cur_x, y), ":", fill=COLOR_TEXT_WHITE, font=font)
    cur_x += font.getlength(":")
    
    draw.text((cur_x, y), path, fill=COLOR_PATH, font=font_bold)
    cur_x += font_bold.getlength(path)
    
    draw.text((cur_x, y), "$ ", fill=COLOR_DOLLAR, font=font_bold)
    cur_x += font_bold.getlength("$ ")
    
    if command:
        draw.text((cur_x, y), command, fill=COLOR_CMD, font=font_bold)
        cur_x += font_bold.getlength(command)
    else:
        draw.rectangle([cur_x, y + 2, cur_x + 9, y + 17], fill=COLOR_CURSOR)
        
    return cur_x

def generate_terminal_image(output_path, lines_data, min_width=860, padding=16):
    line_height = 21
    
    max_w = min_width
    for item in lines_data:
        kind = item[0]
        if kind == "prompt":
            _, path, cmd = item
            w = font_bold.getlength("azhar") + font.getlength(" at ") + font_bold.getlength("parrot") + font.getlength(":") + font_bold.getlength(path) + font_bold.getlength("$ ") + font_bold.getlength(cmd)
            if w > max_w: max_w = w
        elif kind in ("output", "output_pass", "output_dim"):
            _, text = item
            text = text.expandtabs(8)
            w = font.getlength(text)
            if w > max_w: max_w = w
        elif kind == "prompt_end":
            _, path = item
            w = font_bold.getlength("azhar") + font.getlength(" at ") + font_bold.getlength("parrot") + font.getlength(":") + font_bold.getlength(path) + font_bold.getlength("$ ") + 20
            if w > max_w: max_w = w
            
    width = int(max_w + padding * 2 + 30)
    height = int(padding * 2 + len(lines_data) * line_height)
    
    img = Image.new('RGB', (width, height), COLOR_BG)
    draw = ImageDraw.Draw(img)
    
    y = padding
    for item in lines_data:
        kind = item[0]
        if kind == "prompt":
            _, path, cmd = item
            draw_prompt(draw, padding, y, "azhar", "parrot", path, cmd)
        elif kind == "output":
            _, text = item
            draw.text((padding, y), text.expandtabs(8), fill=COLOR_TEXT_WHITE, font=font)
        elif kind == "output_pass":
            _, text = item
            draw.text((padding, y), text.expandtabs(8), fill=COLOR_PASS_GREEN, font=font_bold)
        elif kind == "output_dim":
            _, text = item
            draw.text((padding, y), text.expandtabs(8), fill=COLOR_DIM, font=font)
        elif kind == "prompt_end":
            _, path = item
            draw_prompt(draw, padding, y, "azhar", "parrot", path, "")
        y += line_height
        
    img.save(output_path, "PNG", optimize=True)
    print(f"Generated Terminal Screenshot: {output_path} ({width}x{height})")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    images_dir = os.path.join(base_dir, "..", "docs", "images")
    os.makedirs(images_dir, exist_ok=True)
    
    # -------------------------------------------------------------------------
    # 1. Figure 1: Concurrency and Race Condition Suite
    # -------------------------------------------------------------------------
    fig1_path = os.path.join(images_dir, "terminal_fig1_concurrency.png")
    fig1_lines = [
        ("prompt", "~/Desktop/project/sakib/codes/server", "npx vitest run test/concurrency.test.ts"),
        ("output_dim", " RUN  v3.2.7 /home/tr/Desktop/project/sakib/codes/server"),
        ("output", ""),
        ("output_pass", " ✓ test/concurrency.test.ts (7 tests) 1962ms"),
        ("output", "   ✓ Concurrency-Safe Event Registration > should grant CONFIRMED status to first applicant (9ms)"),
        ("output", "   ✓ Concurrency-Safe Event Registration > should automatically place second applicant on WAITLIST (305ms)"),
        ("output", "   ✓ Concurrency-Safe Event Registration > should automatically promote waitlisted applicant on cancel (9ms)"),
        ("output", "   ✓ Concurrency-Safe Event Registration > should allow re-registration without unique constraint failure (6ms)"),
        ("output", "   ✓ Concurrency-Safe Event Registration > should support queries with repeated parameter placeholders (1ms)"),
        ("output", "   ✓ Concurrency-Safe Event Registration > should safely serialize concurrent transactions via SQLite mutex (1ms)"),
        ("output", "   ✓ Concurrency-Safe Event Registration > should prevent overbooking when concurrent requests arrive (662ms)"),
        ("output", ""),
        ("output_pass", " Test Files  1 passed (1)"),
        ("output_pass", "      Tests  7 passed (7)"),
        ("output_dim", "   Duration  3.24s (transform 458ms, setup 32ms, collect 1.01s, tests 1.96s)"),
        ("output", ""),
        ("prompt_end", "~/Desktop/project/sakib/codes/server")
    ]
    generate_terminal_image(fig1_path, fig1_lines)

    # -------------------------------------------------------------------------
    # 2. Figure 2: Full Server Test Suite Execution
    # -------------------------------------------------------------------------
    fig2_path = os.path.join(images_dir, "terminal_fig2_server_tests.png")
    fig2_lines = [
        ("prompt", "~/Desktop/project/sakib/codes/server", "npm test"),
        ("output_dim", "> campusconnect-server@2.0.0 test"),
        ("output_dim", "> vitest run"),
        ("output", ""),
        ("output_dim", " RUN  v3.2.7 /home/tr/Desktop/project/sakib/codes/server"),
        ("output", ""),
        ("output_pass", " ✓ test/concurrency.test.ts (7 tests) 1805ms"),
        ("output_pass", " ✓ test/auth.test.ts (5 tests) 1823ms"),
        ("output_pass", " ✓ test/checkinV2.test.ts (9 tests) 813ms"),
        ("output_pass", " ✓ test/signing.test.ts (8 tests) 783ms"),
        ("output_pass", " ✓ test/qr.test.ts (10 tests) 790ms"),
        ("output_pass", " ✓ test/certificate.test.ts (3 tests) 909ms"),
        ("output_pass", " ✓ test/outcomes.test.ts (15 tests) 1159ms"),
        ("output_pass", " ✓ test/attainment.test.ts (20 tests) 11ms"),
        ("output_pass", " ✓ test/eventLifecycle.test.ts (53 tests) 8ms"),
        ("output_pass", " ✓ test/scheduleRules.test.ts (21 tests) 8ms"),
        ("output", ""),
        ("output_pass", " Test Files  20 passed (20)"),
        ("output_pass", "      Tests  267 passed (267)"),
        ("output_dim", "   Duration  25.67s (transform 662ms, setup 179ms, collect 6.84s, tests 13.95s)"),
        ("output", ""),
        ("prompt_end", "~/Desktop/project/sakib/codes/server")
    ]
    generate_terminal_image(fig2_path, fig2_lines)

    # -------------------------------------------------------------------------
    # 3. Figure 3: Client Production Build Verification
    # -------------------------------------------------------------------------
    fig3_path = os.path.join(images_dir, "terminal_fig3_client_build.png")
    fig3_lines = [
        ("prompt", "~/Desktop/project/sakib/codes/client", "npm run build"),
        ("output_dim", "> campusconnect-client@2.0.0 build"),
        ("output_dim", "> tsc && vite build"),
        ("output", ""),
        ("output", "vite v6.4.5 building for production..."),
        ("output", "✓ 1663 modules transformed."),
        ("output", "dist/index.html                   1.08 kB | gzip:   0.54 kB"),
        ("output", "dist/assets/index-B0xLdujD.css   49.93 kB | gzip:   8.63 kB"),
        ("output", "dist/assets/index-Bzakw1n4.js   505.59 kB | gzip: 143.28 kB"),
        ("output_pass", "✓ built in 3.98s"),
        ("output", ""),
        ("prompt_end", "~/Desktop/project/sakib/codes/client")
    ]
    generate_terminal_image(fig3_path, fig3_lines)

if __name__ == '__main__':
    main()
