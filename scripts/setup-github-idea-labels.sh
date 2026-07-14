#!/usr/bin/env bash
# Star PM — 在 GitHub 仓库预建灵感 Issue Labels
# 用法：
#   export GITHUB_TOKEN=ghp_xxx
#   bash scripts/setup-github-idea-labels.sh
# 可选：
#   export STUDIO_IDEAS_REPO=1Astar/star_project-manage

set -euo pipefail

REPO="${STUDIO_IDEAS_REPO:-1Astar/star_project-manage}"
TOKEN="${GITHUB_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "请先设置环境变量 GITHUB_TOKEN" >&2
  exit 1
fi

create_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  local payload
  payload=$(printf '{"name":"%s","color":"%s","description":"%s"}' "$name" "$color" "$description")

  local http_code
  http_code=$(curl -sS -o /tmp/star-pm-label-response.json -w "%{http_code}" -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data-binary "$payload" \
    "https://api.github.com/repos/${REPO}/labels")

  if [[ "$http_code" == "201" ]]; then
    echo "✓ 创建 ${name}"
    return 0
  fi

  if [[ "$http_code" == "422" ]]; then
    echo "· 已存在 ${name}"
    return 1
  fi

  echo "✗ 失败 ${name} (HTTP ${http_code})" >&2
  cat /tmp/star-pm-label-response.json >&2 || true
  exit 1
}

CREATED=0
SKIPPED=0

labels=(
  "type:idea|1D76DB|Star PM 灵感 Issue"
  "source:chatgpt|7057FF|来源：ChatGPT"
  "source:手动|EDEDED|来源：手动录入"
  "source:github|0E8A16|来源：GitHub"
  "source:notion|FBCA04|来源：Notion"
  "status:inbox|C5DEF5|灵感收件箱"
  "status:reviewing|FEF2C0|审阅中"
  "status:converted|BFD4F2|已转项目"
  "status:done|B4E1C5|已完成"
  "status:parked|D4C5F9|停车场"
  "status:archived|E4E669|已归档"
  "idea-type:product|0075CA|产品想法"
  "idea-type:feature|5319E7|功能想法"
  "idea-type:ui|E99695|UI 想法"
  "idea-type:content|F9D0C4|内容想法"
  "idea-type:tech|006B75|技术想法"
  "idea-type:business|B60205|商业 / 作品集想法"
)

for entry in "${labels[@]}"; do
  IFS='|' read -r name color description <<< "$entry"
  if create_label "$name" "$color" "$description"; then
    CREATED=$((CREATED + 1))
  else
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo ""
echo "完成：新建 ${CREATED} 个，已存在 ${SKIPPED} 个（仓库 ${REPO}）"
