#!/usr/bin/env python3
"""
CampusConnect Master Documentation Suite Generator
Executes all specification generators to compile complete .docx and .pdf artifacts.
Standard: docx-azhar (Times New Roman, zero em/en dashes, soft ash table headers).
"""

import sys
import subprocess
import os

SCRIPTS = [
    "generate_srs_docs.py",
    "generate_sdd_docs.py",
    "generate_api_docs.py",
    "generate_stp_docs.py",
    "generate_runbook_docs.py",
    "generate_user_manual_docs.py",
    "generate_test_report_docs.py",
    "generate_project_book_docs.py",
    "generate_final_report_docs.py"
]

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    print("=" * 70)
    print("Compiling CampusConnect Documentation Suite (IEEE / docx-azhar)...")
    print("=" * 70)
    
    failures = []
    for script_name in SCRIPTS:
        script_path = os.path.join(base_dir, script_name)
        print(f"\n[EXEC] Running {script_name}...")
        try:
            res = subprocess.run([sys.executable, script_path], check=True, text=True, capture_output=True)
            print(res.stdout.strip())
        except subprocess.CalledProcessError as e:
            print(f"[FAIL] Error executing {script_name}: {e.stderr}")
            failures.append(script_name)
            
    print("\n" + "=" * 70)
    if failures:
        print(f"Compilation finished with {len(failures)} failures: {', '.join(failures)}")
        sys.exit(1)
    else:
        print("All documentation artifacts compiled successfully into docs/ directory.")
        print("=" * 70)

if __name__ == '__main__':
    main()
