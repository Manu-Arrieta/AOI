#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$ProjectPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

function Expand-UserPath {
    param([string]$PathValue)

    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return $PathValue
    }

    $expanded = [Environment]::ExpandEnvironmentVariables($PathValue)
    if ($expanded -eq "~") {
        return $env:USERPROFILE
    }

    if ($expanded.StartsWith("~\") -or $expanded.StartsWith("~/")) {
        return Join-Path $env:USERPROFILE $expanded.Substring(2)
    }

    return $expanded
}

function ConvertTo-NativeObject {
    param([object]$Value)

    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $table = @{}
        foreach ($key in $Value.Keys) {
            $table[$key] = ConvertTo-NativeObject -Value $Value[$key]
        }
        return $table
    }

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $items = @()
        foreach ($item in $Value) {
            $items += ,(ConvertTo-NativeObject -Value $item)
        }
        return $items
    }

    if ($Value.PSObject -and $Value.PSObject.Properties.Count -gt 0) {
        $table = @{}
        foreach ($property in $Value.PSObject.Properties) {
            $table[$property.Name] = ConvertTo-NativeObject -Value $property.Value
        }
        return $table
    }

    return $Value
}

function Read-JsonObject {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return @{}
    }

    $raw = Get-Content -LiteralPath $Path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @{}
    }

    try {
        return ConvertTo-NativeObject -Value ($raw | ConvertFrom-Json)
    } catch {
        $strippedLines = $raw -split "`r?`n" | Where-Object { $_ -notmatch '^\s*//' }
        $sanitized = ($strippedLines -join "`n")
        $sanitized = [regex]::Replace($sanitized, ",(?=\s*[}\]])", "")
        if ([string]::IsNullOrWhiteSpace($sanitized)) {
            return @{}
        }
        return ConvertTo-NativeObject -Value ($sanitized | ConvertFrom-Json)
    }
}

function Write-JsonObject {
    param(
        [string]$Path,
        [object]$Object
    )

    $parent = Split-Path -Parent $Path
    if ($parent) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $encoding = New-Object System.Text.UTF8Encoding($false)
    $json = $Object | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($Path, "$json`n", $encoding)
}

function Get-IcmPath {
    $command = Get-Command icm -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Path
    }

    $candidate = Join-Path $env:LOCALAPPDATA "icm\bin\icm.exe"
    if (Test-Path -LiteralPath $candidate) {
        return $candidate
    }

    return $null
}

function Remove-DirectoryIfPresent {
    param(
        [string]$Root,
        [string]$RelativePath
    )

    $targetPath = Join-Path $Root $RelativePath
    if (Test-Path -LiteralPath $targetPath -PathType Container) {
        Remove-Item -LiteralPath $targetPath -Recurse -Force
        Write-Ok "Removed $RelativePath/"
    } else {
        Write-Warn "Not found: $RelativePath/ (skipped)"
    }
}

function Remove-IaBaseFile {
    param(
        [string]$Root,
        [string]$RelativePath,
        [string]$Marker
    )

    $targetPath = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
        return
    }

    if (Select-String -LiteralPath $targetPath -Pattern $Marker -Quiet) {
        Remove-Item -LiteralPath $targetPath -Force
        Write-Ok "Removed $RelativePath"
    } else {
        Write-Warn "$RelativePath exists but was not created by AOI (skipped)"
    }
}

if (-not $ProjectPath) {
    $ProjectPath = Read-Host "📂 Project path to remove AOI from"
}

$ProjectPath = Expand-UserPath -PathValue $ProjectPath
if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
    Write-Err "Directory not found: $ProjectPath"
    exit 1
}

$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$ProjectName = Split-Path -Leaf $ProjectPath

Write-Header "AOI Teardown → $ProjectName"

Write-Host "This will remove all agentic infrastructure from:" -ForegroundColor Yellow
Write-Host "  $ProjectPath"
Write-Host ""
Write-Host "Folders/files to remove:"
Write-Host "  .github/agents/"
Write-Host "  .github/hooks/"
Write-Host "  .github/instructions/"
Write-Host "  .github/prompts/"
Write-Host "  .github/scripts/"
Write-Host "  .specify/"
Write-Host "  .resources/"
Write-Host "  aoi_apps/agentic-ops-dashboard/ (including package.json, pnpm-lock.yaml, node_modules/)"
Write-Host "  AGENTS.md  (if from AOI)"
Write-Host "  CLAUDE.md  (if from AOI)"
Write-Host "  .conf/     (configuration snapshot)"
Write-Host ""

$confirm = Read-Host "Confirm? [y/N]"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Warn "Aborted."
    exit 0
}

Write-Header "Removing Infrastructure"

Remove-DirectoryIfPresent -Root $ProjectPath -RelativePath ".agent"
Remove-DirectoryIfPresent -Root $ProjectPath -RelativePath ".specify"
Remove-DirectoryIfPresent -Root $ProjectPath -RelativePath ".resources"
Remove-DirectoryIfPresent -Root $ProjectPath -RelativePath ".conf"
Remove-DirectoryIfPresent -Root $ProjectPath -RelativePath "aoi_apps\agentic-ops-dashboard"

$appsDir = Join-Path $ProjectPath "aoi_apps"
if (Test-Path -LiteralPath $appsDir -PathType Container) {
    $remainingApps = Get-ChildItem -LiteralPath $appsDir -Force
    if (-not $remainingApps) {
        Remove-Item -LiteralPath $appsDir -Recurse -Force
        Write-Ok "Removed aoi_apps/ (was empty)"
    }
}

foreach ($subdir in @("agents", "hooks", "instructions", "prompts", "scripts")) {
    Remove-DirectoryIfPresent -Root $ProjectPath -RelativePath ".github\$subdir"
}

$copilotInstructions = Join-Path $ProjectPath ".github\copilot-instructions.md"
if (Test-Path -LiteralPath $copilotInstructions) {
    Remove-Item -LiteralPath $copilotInstructions -Force
    Write-Ok "Removed .github/copilot-instructions.md"
}

$githubDir = Join-Path $ProjectPath ".github"
if (Test-Path -LiteralPath $githubDir -PathType Container) {
    $remaining = Get-ChildItem -LiteralPath $githubDir -Force
    if (-not $remaining) {
        Remove-Item -LiteralPath $githubDir -Recurse -Force
        Write-Ok "Removed .github/ (was empty)"
    }
}

Remove-IaBaseFile -Root $ProjectPath -RelativePath "AGENTS.md" -Marker "RTK|icm"
Remove-IaBaseFile -Root $ProjectPath -RelativePath "CLAUDE.md" -Marker "RTK|icm"
Remove-IaBaseFile -Root $ProjectPath -RelativePath ".windsurfrules" -Marker "icm"

# Legacy cleanup: older AOI installs created dashboard workspace files at repo root.
$runtimePackage = Join-Path $ProjectPath "package.json"
if (Test-Path -LiteralPath $runtimePackage -PathType Leaf) {
    $packageContent = Get-Content -LiteralPath $runtimePackage -Raw
    if ($packageContent -match "AOI Agentic Operational Infrastructure Runtime") {
        Remove-Item -LiteralPath $runtimePackage -Force
        Write-Ok "Removed package.json"

        $pnpmWorkspace = Join-Path $ProjectPath "pnpm-workspace.yaml"
        if (Test-Path -LiteralPath $pnpmWorkspace -PathType Leaf) {
            Remove-Item -LiteralPath $pnpmWorkspace -Force
            Write-Ok "Removed pnpm-workspace.yaml"
        }

        $pnpmLock = Join-Path $ProjectPath "pnpm-lock.yaml"
        if (Test-Path -LiteralPath $pnpmLock -PathType Leaf) {
            Remove-Item -LiteralPath $pnpmLock -Force
            Write-Ok "Removed pnpm-lock.yaml"
        }

        Remove-DirectoryIfPresent -Root $ProjectPath -RelativePath "node_modules"
        Remove-DirectoryIfPresent -Root $ProjectPath -RelativePath ".pnpm-store"
    }
}

$settingsPath = Join-Path $ProjectPath ".vscode\settings.json"
if (Test-Path -LiteralPath $settingsPath -PathType Leaf) {
    $settings = Read-JsonObject -Path $settingsPath
    if ($settings -is [System.Collections.IDictionary]) {
        $removed = @()
        foreach ($key in @("terminal.integrated.env.osx", "terminal.integrated.automationProfile.osx", "terminal.integrated.env.windows")) {
            if ($settings.ContainsKey($key)) {
                $settings.Remove($key) | Out-Null
                $removed += $key
            }
        }

        if ($removed.Count -gt 0) {
            Write-JsonObject -Path $settingsPath -Object $settings
            foreach ($key in $removed) {
                Write-Ok "Removed $key from .vscode/settings.json"
            }
        }
    }
}

$vscodeDir = Join-Path $ProjectPath ".vscode"
if (Test-Path -LiteralPath $vscodeDir -PathType Container) {
    $remaining = Get-ChildItem -LiteralPath $vscodeDir -Force
    if (-not $remaining) {
        Remove-Item -LiteralPath $vscodeDir -Recurse -Force
        Write-Ok "Removed .vscode/ (was empty)"
    }
}

$icmPath = Get-IcmPath
if ($icmPath) {
    Write-Info "Cleaning ICM project data for $ProjectName..."
    try {
        & $icmPath forget -t "$ProjectName-context" 2>$null
        Write-Ok "ICM memory cleared ($ProjectName-context)"
    } catch { }
    try {
        & $icmPath memoir delete -n "$ProjectName-architecture" 2>$null
        Write-Ok "ICM memoir deleted ($ProjectName-architecture)"
    } catch { }
    try {
        & $icmPath memoir delete -n "$ProjectName-domain-model" 2>$null
        Write-Ok "ICM memoir deleted ($ProjectName-domain-model)"
    } catch { }
}

Write-Header "Teardown Complete"
Write-Host "  Project: $ProjectPath"
Write-Host ""
Write-Host "  Removed: agentic scaffold, spec-kit init, PATH injection, dashboard runtime"
Write-Host "  Preserved: your source code, venv, docker, tests, etc."
Write-Host ""