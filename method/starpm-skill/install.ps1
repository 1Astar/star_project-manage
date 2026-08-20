#Requires -Version 5.1
param(
  [string]$Source = $PSScriptRoot,
  [string]$Dest = $(Join-Path $env:USERPROFILE ".cursor\skills\starpm-method")
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path (Join-Path $Source "SKILL.md"))) {
  Write-Error "SKILL.md not found in Source: $Source"
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item -Path (Join-Path $Source "*") -Destination $Dest -Recurse -Force
Write-Host "Installed StarPM Method Skill -> $Dest"
Write-Host "Reload Cursor Agent / restart Cursor. MCP: see CONNECT_MCP.md"
