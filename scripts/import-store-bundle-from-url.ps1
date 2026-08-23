[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BundleUrl,
    [string]$Destination = 'build/source-app',
    [string]$PackageFamilyName = 'OpenAI.Codex_2p2nqsd0c76g0',
    [string]$DownloadedFileName = '',
    [string]$ExpectedSha1 = '',
    [string]$ExpectedSha256 = '',
    [string]$SourceMode = 'rg_adguard',
    [ValidateRange(1, 10)][int]$DownloadAttempts = 4,
    [int[]]$DownloadRetryDelaysSeconds = @(10, 30, 60)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-AbsolutePath {
    param([Parameter(Mandatory = $true)][string]$PathValue)

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $PathValue))
}

function Expand-ZipLikeArchive {
    param(
        [Parameter(Mandatory = $true)][string]$ArchivePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    if (Test-Path $DestinationPath) {
        Remove-Item -Path $DestinationPath -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null

    $tarCommand = Get-Command tar.exe -ErrorAction SilentlyContinue
    if ($null -ne $tarCommand) {
        & $tarCommand.Source -xf $ArchivePath -C $DestinationPath
        if ($LASTEXITCODE -ne 0) {
            throw "tar failed to extract $ArchivePath with exit code $LASTEXITCODE"
        }
        return
    }

    $zipPath = Join-Path ([System.IO.Path]::GetDirectoryName($ArchivePath)) ([System.IO.Path]::GetFileNameWithoutExtension($ArchivePath) + '.zip')
    Copy-Item -Path $ArchivePath -Destination $zipPath -Force

    try {
        Expand-Archive -LiteralPath $zipPath -DestinationPath $DestinationPath -Force
    }
    finally {
        Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-PackageScore {
    param([Parameter(Mandatory = $true)][string]$FileName)

    $score = 0

    if ($FileName -match '(_x64_|x64)') {
        $score += 400
    }

    if ($FileName -match '\.(msixbundle|appxbundle)$') {
        $score += 250
    }

    if ($FileName -match '\.(msix|appx)$') {
        $score += 200
    }

    if ($FileName -match '(resources|resource|language|scale|test|debug|symbol)') {
        $score -= 500
    }

    if ($FileName -match '(arm64|_x86_|_arm_)') {
        $score -= 300
    }

    return $score
}

function Invoke-DownloadWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$OutFile,
        [Parameter(Mandatory = $true)][int]$Attempts,
        [int[]]$RetryDelaysSeconds = @()
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
        try {
            Remove-Item -LiteralPath $OutFile -Force -ErrorAction SilentlyContinue
            Invoke-WebRequest -Uri $Uri -OutFile $OutFile
            if (-not (Test-Path -LiteralPath $OutFile -PathType Leaf) -or (Get-Item -LiteralPath $OutFile).Length -eq 0) {
                throw 'The download completed without producing a non-empty file.'
            }
            return
        }
        catch {
            Remove-Item -LiteralPath $OutFile -Force -ErrorAction SilentlyContinue
            if ($attempt -ge $Attempts) {
                throw "Failed to download package after $Attempts attempts: $($_.Exception.Message)"
            }

            $delayIndex = [Math]::Min($attempt - 1, [Math]::Max(0, $RetryDelaysSeconds.Count - 1))
            $delaySeconds = if ($RetryDelaysSeconds.Count -eq 0) { 0 } else { [Math]::Max(0, $RetryDelaysSeconds[$delayIndex]) }
            Write-Warning "Package download attempt $attempt/$Attempts failed: $($_.Exception.Message). Retrying in $delaySeconds seconds."
            if ($delaySeconds -gt 0) {
                Start-Sleep -Seconds $delaySeconds
            }
        }
    }
}

$destinationRoot = Resolve-AbsolutePath -PathValue $Destination
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('codex-offline-' + [guid]::NewGuid().ToString('N'))
$downloadRoot = Join-Path $tempRoot 'download'
$outerExpandRoot = Join-Path $tempRoot 'outer'
$innerExpandRoot = Join-Path $tempRoot 'inner'

New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null

try {
    if (Test-Path $destinationRoot) {
        Remove-Item -Path $destinationRoot -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null

    if ([string]::IsNullOrWhiteSpace($DownloadedFileName)) {
        $downloadName = [System.IO.Path]::GetFileName(([System.Uri]$BundleUrl).AbsolutePath)
        if ([string]::IsNullOrWhiteSpace($downloadName)) {
            $downloadName = 'codex-package.msix'
        }
    }
    else {
        $downloadName = $DownloadedFileName
    }

    $downloadPath = Join-Path $downloadRoot $downloadName
    if (Test-Path -LiteralPath $BundleUrl -PathType Leaf) {
        Copy-Item -LiteralPath $BundleUrl -Destination $downloadPath -Force
    }
    else {
        Invoke-DownloadWithRetry `
            -Uri $BundleUrl `
            -OutFile $downloadPath `
            -Attempts $DownloadAttempts `
            -RetryDelaysSeconds $DownloadRetryDelaysSeconds
    }

    if (-not [string]::IsNullOrWhiteSpace($ExpectedSha1)) {
        $actualSha1 = (Get-FileHash -Path $downloadPath -Algorithm SHA1).Hash.ToLowerInvariant()
        if ($actualSha1 -ne $ExpectedSha1.ToLowerInvariant()) {
            throw "Downloaded package SHA1 mismatch. Expected $ExpectedSha1 but got $actualSha1"
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($ExpectedSha256)) {
        if ($ExpectedSha256 -notmatch '^[0-9a-fA-F]{64}$') {
            throw 'ExpectedSha256 must contain exactly 64 hexadecimal characters.'
        }
        $actualSha256 = (Get-FileHash -Path $downloadPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
            throw "Downloaded package SHA256 mismatch. Expected $ExpectedSha256 but got $actualSha256"
        }
    }

    $downloadExtension = [System.IO.Path]::GetExtension($downloadPath).ToLowerInvariant()
    $packageArchivePath = $downloadPath

    if ($downloadExtension -in @('.msixbundle', '.appxbundle')) {
        Expand-ZipLikeArchive -ArchivePath $downloadPath -DestinationPath $outerExpandRoot

        $candidatePackage = Get-ChildItem -Path $outerExpandRoot -Recurse -File | Where-Object {
            $_.Extension -in @('.msix', '.appx') -and $_.Name -match '^OpenAI\.Codex_'
        } | Sort-Object @{ Expression = { Get-PackageScore -FileName $_.Name }; Descending = $true }, Name | Select-Object -First 1

        if ($null -eq $candidatePackage) {
            throw 'No main package was found inside the downloaded bundle.'
        }

        $packageArchivePath = $candidatePackage.FullName
    }

    Expand-ZipLikeArchive -ArchivePath $packageArchivePath -DestinationPath $innerExpandRoot

    $manifestPath = Join-Path $innerExpandRoot 'AppxManifest.xml'
    $appSourcePath = Join-Path $innerExpandRoot 'app'
    $metadataPath = Join-Path $destinationRoot 'metadata'

    if (-not (Test-Path $manifestPath)) {
        throw "AppxManifest.xml was not found in the extracted package: $innerExpandRoot"
    }

    if (-not (Test-Path $appSourcePath)) {
        throw "Expected app payload directory was not found: $appSourcePath"
    }

    New-Item -ItemType Directory -Force -Path $metadataPath | Out-Null
    $appDestinationPath = Join-Path $destinationRoot 'app'
    New-Item -ItemType Directory -Force -Path $appDestinationPath | Out-Null
    & robocopy.exe $appSourcePath $appDestinationPath /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -gt 7) {
        throw "robocopy failed to copy the app payload with exit code $LASTEXITCODE"
    }
    Copy-Item -Path $manifestPath -Destination (Join-Path $metadataPath 'AppxManifest.xml') -Force

    [xml]$manifest = Get-Content -Path $manifestPath -Raw
    $identity = $manifest.Package.Identity

    $metadata = [ordered]@{
        appName = $identity.Name
        packageFamilyName = $PackageFamilyName
        version = $identity.Version
        publisher = $identity.Publisher
        exportedAt = (Get-Date).ToString('o')
        exportedAppPath = 'app'
        manifestPath = 'metadata/AppxManifest.xml'
        sourceMode = $SourceMode
        sourceBundleUrl = $BundleUrl
        sourceFileName = $downloadName
        sourceSha1 = if ([string]::IsNullOrWhiteSpace($ExpectedSha1)) { $null } else { $ExpectedSha1.ToLowerInvariant() }
        sourceSha256 = if ([string]::IsNullOrWhiteSpace($ExpectedSha256)) { $null } else { $ExpectedSha256.ToLowerInvariant() }
    }

    $metadata | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $metadataPath 'package-metadata.json') -Encoding UTF8

    # Patch the extracted asar so Store-gated features (e.g. Settings menu)
    # work when running as a standalone exe outside the MSIX container.
    $patchScript = Join-Path $PSScriptRoot 'patch-app-asar.mjs'
    if (Test-Path $patchScript) {
        node $patchScript --app-dir (Join-Path $destinationRoot 'app')
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "patch-app-asar.mjs exited with code $LASTEXITCODE – continuing anyway."
        }
    }

    Write-Output $destinationRoot
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
