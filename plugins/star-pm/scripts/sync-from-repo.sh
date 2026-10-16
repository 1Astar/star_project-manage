#!/usr/bin/env bash
# Sync private .cursor/skills → plugins/star-pm/skills（可移植覆盖指针 skill）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PLUGIN="$(cd "$(dirname "$0")/.." && pwd)"

rsync -a --delete \
  --exclude '_link_skills.py' \
  --exclude '_link_skills_mac.sh' \
  --exclude 'README.md' \
  --exclude '_from-star-pm' \
  "$ROOT/.cursor/skills/" "$PLUGIN/skills/"

mkdir -p "$PLUGIN/skills/starpm-method" "$PLUGIN/gpt/knowledge"
cp "$ROOT/method/starpm-skill/SKILL.md" "$PLUGIN/skills/starpm-method/SKILL.md"
cp "$ROOT/docs/ai/CANONICAL_RULES.md" "$PLUGIN/gpt/knowledge/CANONICAL_RULES.md"

# Portable overlays for former pointer skills
if [[ -f "$HOME/.cursor/skills-cursor/canvas/SKILL.md" ]]; then
  cp "$HOME/.cursor/skills-cursor/canvas/SKILL.md" "$PLUGIN/skills/canvas/SKILL.md"
fi
if [[ -f "$HOME/.cursor/skills-cursor/create-skill/SKILL.md" ]]; then
  cp "$HOME/.cursor/skills-cursor/create-skill/SKILL.md" "$PLUGIN/skills/create-skill/SKILL.md"
fi

# Keep Star portable brainstorming / verification if present in portable/
PORTABLE="$PLUGIN/portable-overlays"
if [[ -d "$PORTABLE" ]]; then
  for name in brainstorming verification-before-completion; do
    [[ -f "$PORTABLE/$name/SKILL.md" ]] && cp "$PORTABLE/$name/SKILL.md" "$PLUGIN/skills/$name/SKILL.md"
  done
fi

echo "synced → $PLUGIN/skills ($(ls -d "$PLUGIN/skills"/*/ | wc -l | tr -d ' ') skills)"
