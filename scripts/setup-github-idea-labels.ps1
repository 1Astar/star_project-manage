# Star PM — 在 GitHub 仓库预建灵感 Issue Labels
# 用法（PowerShell）：
#   $env:GITHUB_TOKEN = "ghp_xxx"
#   .\scripts\setup-github-idea-labels.ps1
# 可选：
#   $env:STUDIO_IDEAS_REPO = "1Astar/star_project-manage"

$ErrorActionPreference = "Stop"

$repo = if ($env:STUDIO_IDEAS_REPO) { $env:STUDIO_IDEAS_REPO.Trim() } else { "1Astar/star_project-manage" }
$token = $env:GITHUB_TOKEN
if (-not $token) {
  Write-Error "请先设置环境变量 GITHUB_TOKEN"
}

$labels = @(
  @{ name = "type:idea"; color = "1D76DB"; description = "Star PM 灵感 Issue" },

  @{ name = "source:chatgpt"; color = "7057FF"; description = "来源：ChatGPT" },
  @{ name = "source:手动"; color = "EDEDED"; description = "来源：手动录入" },
  @{ name = "source:github"; color = "0E8A16"; description = "来源：GitHub" },
  @{ name = "source:notion"; color = "FBCA04"; description = "来源：Notion" },

  @{ name = "status:inbox"; color = "C5DEF5"; description = "灵感收件箱" },
  @{ name = "status:reviewing"; color = "FEF2C0"; description = "审阅中" },
  @{ name = "status:converted"; color = "BFD4F2"; description = "已转项目" },
  @{ name = "status:parked"; color = "D4C5F9"; description = "停车场" },
  @{ name = "status:archived"; color = "E4E669"; description = "已归档" },

  @{ name = "idea-type:product"; color = "0075CA"; description = "产品想法" },
  @{ name = "idea-type:feature"; color = "5319E7"; description = "功能想法" },
  @{ name = "idea-type:ui"; color = "E99695"; description = "UI 想法" },
  @{ name = "idea-type:content"; color = "F9D0C4"; description = "内容想法" },
  @{ name = "idea-type:tech"; color = "006B75"; description = "技术想法" },
  @{ name = "idea-type:business"; color = "B60205"; description = "商业 / 作品集想法" }
)

$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$created = 0
$skipped = 0

foreach ($label in $labels) {
  $body = @{
    name = $label.name
    color = $label.color
    description = $label.description
  } | ConvertTo-Json -Compress

  try {
    Invoke-RestMethod `
      -Uri "https://api.github.com/repos/$repo/labels" `
      -Method POST `
      -Headers $headers `
      -Body $body `
      -ContentType "application/json; charset=utf-8" | Out-Null
    Write-Host "✓ 创建 $($label.name)"
    $created++
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 422) {
      Write-Host "· 已存在 $($label.name)"
      $skipped++
    } else {
      throw
    }
  }
}

Write-Host ""
Write-Host "完成：新建 $created 个，已存在 $skipped 个（仓库 $repo）"
