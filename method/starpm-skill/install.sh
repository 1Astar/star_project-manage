#!/usr/bin/env bash
set -euo pipefail
SOURCE="$(cd "$(dirname "$0")" && pwd)"
DEST="${HOME}/.cursor/skills/starpm-method"
if [[ ! -f "${SOURCE}/SKILL.md" ]]; then
  echo "SKILL.md not found in ${SOURCE}" >&2
  exit 1
fi
mkdir -p "${DEST}"
cp -R "${SOURCE}/." "${DEST}/"
echo "Installed StarPM Method Skill -> ${DEST}"
echo "Reload Cursor Agent / restart Cursor. MCP: see CONNECT_MCP.md"
