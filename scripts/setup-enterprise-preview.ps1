[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Only seed the skill creator if absent. Never replace employee-created skills,
# administrator credentials, model configuration or conversation data.
$codexPath = if ([string]::IsNullOrWhiteSpace($env:CODEX_HOME)) {
    Join-Path $env:USERPROFILE '.codex'
} else { $env:CODEX_HOME }
$source = Join-Path $PSScriptRoot 'seed/codex-home/skills/.system/skill-creator'
$destination = Join-Path $codexPath 'skills/.system/skill-creator'
if (-not (Test-Path -LiteralPath $destination)) {
    if (-not (Test-Path -LiteralPath (Join-Path $source 'SKILL.md'))) {
        throw 'Bundled skill-creator is missing.'
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Recurse
}
