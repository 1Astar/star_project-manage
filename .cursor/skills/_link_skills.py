# -*- coding: utf-8 -*-
"""Junction Star PM skills into ~/.cursor/skills so every Cursor window can load them."""
import subprocess
from pathlib import Path

SRC = Path(r"E:\文档\star\工具\private\工具\star_project-manage\.cursor\skills")
DST = Path(r"C:\Users\l1397\.cursor\skills")
PROJECT_SKILLS = Path(r"E:\文档\star\.cursor\skills")
PROJECT_RULES = Path(r"E:\文档\star\.cursor\rules")
USER_RULES = Path(r"C:\Users\l1397\.cursor\rules")

# Authoritative PM skills to expose globally (skip pointer-only duplicates that already
# exist as Cursor/Codex builtins unless missing).
LINK_NAMES = [
    "doc-delivery-formats",
    "word-docx-professional",
    "ppt-consulting-visual",
    "product-scheme-design",
    "version-management",
    "safe-file-delete",
    "star-pm-write-release",
    "using-star-skills",
    "defer-scope-record",
]

DST.mkdir(parents=True, exist_ok=True)
PROJECT_SKILLS.mkdir(parents=True, exist_ok=True)
PROJECT_RULES.mkdir(parents=True, exist_ok=True)
USER_RULES.mkdir(parents=True, exist_ok=True)


def junction(link: Path, target: Path):
    if not target.exists():
        print("SKIP missing target", target)
        return
    if link.exists() or link.is_symlink():
        # Replace plain copy of star-pm-write-release with junction to single source
        if link.is_symlink() or link.is_junction():
            print("OK exists", link.name)
            return
        # If directory copy, remove and re-junction for SSOT
        import shutil

        print("REPLACE copy -> junction", link.name)
        shutil.rmtree(link)
    # mklink /J needs cmd
    cmd = f'cmd /c mklink /J "{link}" "{target}"'
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip(), "->", link.name)
    if r.returncode != 0:
        print("FAIL", link, r.returncode)


for name in LINK_NAMES:
    target = SRC / name
    junction(DST / name, target)
    junction(PROJECT_SKILLS / name, target)

print("done")
