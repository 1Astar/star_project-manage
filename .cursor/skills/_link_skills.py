# -*- coding: utf-8 -*-
"""Junction Star PM skills into ~/.cursor/skills so every Cursor window can load them."""
import subprocess
from pathlib import Path

SRC = Path(r"d:\thing\项目\.cursor\skills")
DST = Path(r"C:\Users\16148\.cursor\skills")
PROJECT_SKILLS = Path(r"d:\thing\项目\star-pm\.cursor\skills")

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
    "brainstorming",
    "canvas",
    "verification-before-completion",
    "create-skill",
]

DST.mkdir(parents=True, exist_ok=True)
PROJECT_SKILLS.mkdir(parents=True, exist_ok=True)


def junction(link: Path, target: Path):
    if not target.exists():
        print("SKIP missing target", target)
        return
    if link.exists() or link.is_symlink():
        if link.is_symlink() or getattr(link, "is_junction", lambda: False)():
            print("OK exists", link.name)
            return
        import shutil

        print("REPLACE copy -> junction", link.name)
        shutil.rmtree(link)
    cmd = f'cmd /c mklink /J "{link}" "{target}"'
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip(), "->", link.name)
    if r.returncode != 0:
        print("FAIL", link, r.returncode)


for name in LINK_NAMES:
    target = SRC / name
    junction(DST / name, target)

print("done")
