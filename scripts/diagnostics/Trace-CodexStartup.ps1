param([string]$InstallDir = (Join-Path $env:USERPROFILE 'Codex'))
$ErrorActionPreference = 'Stop'
$appRoot = Join-Path $InstallDir '_internal\app'
$exe = Join-Path $appRoot 'ChatGPT.exe'
$init = Join-Path $appRoot 'patches\init.cjs'
$modulePath = Join-Path $PSScriptRoot 'startup-trace.cjs'
$metadata = Get-Content -LiteralPath (Join-Path $InstallDir 'enterprise-build.json') -Raw | ConvertFrom-Json
if ($metadata.base.appVersion -ne '26.901.51231') { throw 'This diagnostic supports Codex 26.901.51231 only.' }
foreach ($file in @($exe, $init, $modulePath)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required file missing: $file" }
}
$running = Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" | Where-Object { $_.ExecutablePath -eq $exe }
if ($running) { throw 'Close Codex completely, then run this diagnostic again.' }
$id = [Guid]::NewGuid().ToString('N')
$reportDir = Join-Path $PSScriptRoot ('report-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $id.Substring(0, 6))
New-Item -ItemType Directory -Path $reportDir | Out-Null
$report = Join-Path $reportDir 'startup-trace.jsonl'
$backup = $init + '.backup-' + $id
$original = [System.IO.File]::ReadAllBytes($init)
[System.IO.File]::WriteAllBytes($backup, $original)
$suffix = "`n;require(" + (ConvertTo-Json -InputObject $modulePath -Compress) + ");`n"
$patched = $original + [System.Text.Encoding]::UTF8.GetBytes($suffix)
$previousOutput = $env:CODEX_STARTUP_TRACE_FILE
$patchedHash = $null
try {
    [System.IO.File]::WriteAllBytes($init, $patched)
    $patchedHash = (Get-FileHash -LiteralPath $init -Algorithm SHA256).Hash
    $env:CODEX_STARTUP_TRACE_FILE = $report
    Write-Host 'Codex will open with its existing settings and history.'
    Write-Host 'When the error appears, click Retry once, then close Codex completely.'
    Write-Host 'The trace stops automatically after two minutes. No tokens or chat contents are collected.'
    $child = Start-Process -FilePath $exe -WorkingDirectory $appRoot -PassThru
    $child.WaitForExit()
} finally {
    $env:CODEX_STARTUP_TRACE_FILE = $previousOutput
    if ($patchedHash -and (Get-FileHash -LiteralPath $init -Algorithm SHA256).Hash -eq $patchedHash) {
        [System.IO.File]::WriteAllBytes($init, $original)
        Remove-Item -LiteralPath $backup
        Write-Host 'Temporary instrumentation removed; original program file restored.'
    } else {
        Write-Warning "Program file changed during tracing. Original backup retained at: $backup"
    }
}
if (-not (Test-Path -LiteralPath $report)) { throw 'No trace was produced. The application may have handed off to an existing process.' }
Write-Host "Send this report: $report"
