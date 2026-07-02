#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [switch]$Yes,
    [switch]$DryRun,
    [switch]$Update,
    [ValidateSet("standard", "ui")]
    [string]$Variant = "standard"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$UpstreamUrl = "https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1"
$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\codebase-memory-mcp"

function Write-Info {
    param([string]$Message)
    Write-Host "▸ $Message" -ForegroundColor Blue
}

function Write-Ok {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══ $Message ═══" -ForegroundColor Cyan
    Write-Host ""
}

function Get-CodebaseMemoryPath {
    $candidates = @(
        (Join-Path $InstallDir "codebase-memory-mcp.exe"),
        (Join-Path $env:USERPROFILE ".local\bin\codebase-memory-mcp.exe")
    )

    $command = Get-Command "codebase-memory-mcp" -ErrorAction SilentlyContinue
    if ($command) {
        foreach ($propertyName in @("Source", "Path", "Definition")) {
            if ($command.PSObject.Properties.Name -contains $propertyName) {
                $value = [string]$command.$propertyName
                if ($value -and (Test-Path -LiteralPath $value)) {
                    return $value
                }
            }
        }
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Get-CommandOutput {
    param(
        [string]$BinaryPath,
        [string[]]$Arguments = @()
    )

    if (-not $BinaryPath) {
        return ""
    }

    try {
        return ((& $BinaryPath @Arguments 2>$null) | Select-Object -First 1)
    } catch {
        return ""
    }
}

function Invoke-UpstreamInstaller {
    param([string]$SelectedVariant)

    $tempScriptPath = Join-Path ([System.IO.Path]::GetTempPath()) ("aoi-cbm-install-" + [System.Guid]::NewGuid().ToString("N") + ".ps1")
    try {
        Invoke-WebRequest -Uri $UpstreamUrl -OutFile $tempScriptPath -UseBasicParsing

        $installerArgs = @("--skip-config")
        if ($SelectedVariant -eq "ui") {
            $installerArgs += "--ui"
        } else {
            $installerArgs += "--standard"
        }

        & powershell -NoProfile -ExecutionPolicy Bypass -File $tempScriptPath @installerArgs
        return $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $tempScriptPath -Force -ErrorAction SilentlyContinue
    }
}

Write-Header "AOI codebase-memory-mcp installer (opcional)"
Write-Info "Modo seguro AOI: instalar binario + omitir config global (--skip-config)"

$currentPath = Get-CodebaseMemoryPath
if ($currentPath -and -not $Update) {
    $currentVersion = Get-CommandOutput -BinaryPath $currentPath -Arguments @("--version")
    if ($Yes) {
        Write-Ok "codebase-memory-mcp ya instalado ($currentVersion)"
        exit 0
    }

    $choice = Read-Host "▸ codebase-memory-mcp already installed ($currentVersion). [U]pdate / [K]eep? [k]"
    if ($choice -ne "u" -and $choice -ne "U") {
        Write-Ok "codebase-memory-mcp kept ($currentVersion)"
        exit 0
    }
}

if ($DryRun) {
    Write-Info "[DRY-RUN] Invoke-WebRequest $UpstreamUrl -> <temp>.ps1"
    Write-Info "[DRY-RUN] powershell -NoProfile -ExecutionPolicy Bypass -File <temp>.ps1 --skip-config --$Variant"
    exit 0
}

$installExitCode = Invoke-UpstreamInstaller -SelectedVariant $Variant
if ($installExitCode -ne 0) {
    Write-Err "Upstream installer failed with exit code $installExitCode"
    exit $installExitCode
}

$currentPath = Get-CodebaseMemoryPath
if (-not $currentPath) {
    Write-Err "codebase-memory-mcp was installed but is not resolvable yet"
    Write-Err "Expected candidate: $(Join-Path $InstallDir 'codebase-memory-mcp.exe')"
    exit 1
}

Write-Ok "codebase-memory-mcp ready $(Get-CommandOutput -BinaryPath $currentPath -Arguments @('--version'))"
Write-Ok "AOI will keep MCP registration workspace-local via .vscode/mcp.json"