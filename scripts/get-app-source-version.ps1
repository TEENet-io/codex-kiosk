# Reports which upstream Codex the next build would use, before anything is
# downloaded.
#
# It deliberately does NOT produce the release tag. The release is named after
# the version the application reports about itself, which lives inside
# app.asar and so is unknowable until the MSIX has been fetched and unpacked --
# build-offline-package.ps1 composes the tag once it has that.
#
# What is knowable here is the MSIX identity version, which is what decides
# whether this upstream package has already been built. It is emitted as
# releaseMarker, the string carried in every release name, so CI can answer
# that by listing releases.
[CmdletBinding()]
param(
    [string]$ConfigPath = 'config/offline-package.json'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$PathValue
    )

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $PathValue))
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot '..'))
$configFile = Resolve-AbsolutePath -BasePath $repoRoot -PathValue $ConfigPath
$config = Get-Content -Path $configFile -Raw | ConvertFrom-Json
$mode = [string]$config.appSource.mode

switch ($mode) {
    'archive' {
        $required = @{}
        foreach ($name in @('url', 'version', 'sha256', 'packageFamilyName')) {
            $property = $config.appSource.PSObject.Properties[$name]
            if ($null -eq $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
                throw "Archive app source is missing required property '$name'."
            }
            $required[$name] = [string]$property.Value
        }
        if ($required.sha256 -notmatch '^[0-9a-fA-F]{64}$') {
            throw 'Archive app source sha256 must contain exactly 64 hexadecimal characters.'
        }

        $fileNameProperty = $config.appSource.PSObject.Properties['fileName']
        $fileName = if ($null -eq $fileNameProperty) { '' } else { [string]$fileNameProperty.Value }
        $version = $required.version
        [ordered]@{
            packageId = $config.packageId
            sourceMode = $mode
            version = $version
            releaseMarker = 'MSIX {0}' -f $version
            packageFamilyName = $required.packageFamilyName
            selected = [ordered]@{
                fileName = $fileName
                href = $required.url
                sha256 = $required.sha256.ToLowerInvariant()
            }
        } | ConvertTo-Json -Depth 8
    }
    'rg_adguard' {
        $resolverArgs = @('--package-family-name', $config.appSource.packageFamilyName, '--ring', $config.appSource.ring)
        $pinnedProp = $config.appSource.PSObject.Properties['pinnedVersion']
        if ($null -ne $pinnedProp -and -not [string]::IsNullOrWhiteSpace([string]$pinnedProp.Value)) {
            $resolverArgs += @('--version', [string]$pinnedProp.Value)
        }
        $resolverJson = node (Join-Path $scriptRoot 'resolve-store-bundle-url.mjs') @resolverArgs
        if ($LASTEXITCODE -ne 0) {
            throw 'The rg-adguard resolver failed.'
        }

        $resolved = $resolverJson | ConvertFrom-Json
        [ordered]@{
            packageId = $config.packageId
            sourceMode = $mode
            version = $resolved.version
            releaseMarker = 'MSIX {0}' -f $resolved.version
            packageFamilyName = $resolved.packageFamilyName
            selected = $resolved.selected
        } | ConvertTo-Json -Depth 8
    }
    'installed_store' {
        $package = Get-AppxPackage -Name $config.packageId | Sort-Object Version -Descending | Select-Object -First 1
        if ($null -eq $package) {
            throw "Store package '$($config.packageId)' was not found on this machine."
        }

        [ordered]@{
            packageId = $config.packageId
            sourceMode = $mode
            version = $package.Version.ToString()
            releaseMarker = 'MSIX {0}' -f $package.Version
            packageFamilyName = $package.PackageFamilyName
            selected = $null
        } | ConvertTo-Json -Depth 8
    }
    default {
        throw "Unsupported app source mode: $mode"
    }
}
