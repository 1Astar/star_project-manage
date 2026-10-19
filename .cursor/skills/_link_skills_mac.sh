#!/usr/bin/env bash
# Symlink Star PM skills into ~/.cursor/skills (macOS / Linux).
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DST="${HOME}/.cursor/skills"
mkdir -p "$DST"
NAMES=(
  doc-delivery-formats word-docx-professional ppt-consulting-visual product-scheme-design
  version-management safe-file-delete star-pm-write-release using-star-skills
  defer-scope-record brainstorming canvas verification-before-completion create-skill
  star-table-folder mystic-lab-ui html-demo-nav writing-plans prd-prototype-rules
  miniscloud-prd-agents miniscloud-ui-design
)
for name in "${NAMES[@]}"; do
  target="$SRC/$name"
  link="$DST/$name"
  [[ -d "$target" ]] || { echo "SKIP missing $name"; continue; }
  if [[ -L "$link" ]]; then
    [[ "$(readlink "$link")" == "$target" ]] && { echo "OK $name"; continue; }
    rm "$link"
  elif [[ -e "$link" ]]; then
    echo "REPLACE $name"; rm -rf "$link"
  fi
  ln -s "$target" "$link"
  echo "LINKED $name"
done
[[ -e "$DST/README.md" ]] || ln -s "$SRC/README.md" "$DST/README.md"
echo "done -> $DST"
