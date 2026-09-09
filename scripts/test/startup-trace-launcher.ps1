$ErrorActionPreference = 'Stop'
$fixture = Join-Path $env:TEMP ('codex-trace-test-' + [Guid]::NewGuid().ToString('N'))
$install = Join-Path $fixture 'Codex with spaces'
$appRoot = Join-Path $install '_internal\app'
$diagnostic = Join-Path $fixture 'diagnostic'
New-Item -ItemType Directory -Path (Join-Path $appRoot 'patches'), $diagnostic | Out-Null
Copy-Item (Join-Path $PSScriptRoot '..\diagnostics\*') $diagnostic
$init = Join-Path $appRoot 'patches\init.cjs'
[System.IO.File]::WriteAllText($init, '// original test hook')
$originalHash = (Get-FileHash $init).Hash
[System.IO.File]::WriteAllText((Join-Path $install 'enterprise-build.json'), '{"base":{"appVersion":"26.901.51231"}}')
# A local throwaway executable checks the launcher lifecycle. The separate
# installed-app smoke verifies Electron debugger attachment and exceptions.
Add-Type -TypeDefinition @'
using System;
using System.IO;
public static class TraceFixture {
    public static void Main() {
        if (Environment.GetEnvironmentVariable("CODEX_TRACE_FIXTURE_NO_REPORT") != "1")
            File.WriteAllText(Environment.GetEnvironmentVariable("CODEX_STARTUP_TRACE_FILE"), "fixture report");
    }
}
'@ -OutputAssembly (Join-Path $appRoot 'ChatGPT.exe') -OutputType ConsoleApplication
$previous = $env:CODEX_STARTUP_TRACE_FILE
$env:CODEX_STARTUP_TRACE_FILE = 'existing-env-sentinel'
try {
    & (Join-Path $diagnostic 'Trace-CodexStartup.ps1') -InstallDir $install
    if ((Get-FileHash $init).Hash -ne $originalHash) { throw 'Original hook was not restored.' }
    if ($env:CODEX_STARTUP_TRACE_FILE -ne 'existing-env-sentinel') { throw 'Parent environment was not restored.' }
    if (Get-ChildItem (Join-Path $appRoot 'patches') -Filter '*.backup-*') { throw 'Unexpected backup left after normal exit.' }
    $env:CODEX_TRACE_FIXTURE_NO_REPORT = '1'
    $failed = $false
    try { & (Join-Path $diagnostic 'Trace-CodexStartup.ps1') -InstallDir $install }
    catch { $failed = $_.Exception.Message -like 'No trace was produced*' }
    if (-not $failed) { throw 'Missing-report failure was not detected.' }
    if ((Get-FileHash $init).Hash -ne $originalHash) { throw 'Original hook was not restored after failure.' }
    Write-Host 'Launcher success/failure paths restore original bytes and parent environment.'
} finally {
    $env:CODEX_STARTUP_TRACE_FILE = $previous
    Remove-Item Env:CODEX_TRACE_FIXTURE_NO_REPORT -ErrorAction SilentlyContinue
}
