#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$ProjectPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScaffoldDir = Join-Path $ScriptDir "scaffold"
$RtkInstallDir = Join-Path $env:LOCALAPPDATA "rtk\bin"
$IcmInstallDir = Join-Path $env:LOCALAPPDATA "icm\bin"
$LocalBinDir = Join-Path $env:USERPROFILE ".local\bin"

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

function Write-Utf8File {
    param(
        [string]$Path,
        [string]$Content
    )

    $parent = Split-Path -Parent $Path
    if ($parent) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
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

function Refresh-SessionPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $combined = @($machinePath, $userPath, $env:Path) -join ";"
    $env:Path = (($combined -split ";" | Where-Object { $_ } | Select-Object -Unique) -join ";")
}

function Add-UserPathEntry {
    param([string]$PathEntry)

    if ([string]::IsNullOrWhiteSpace($PathEntry)) {
        return
    }

    New-Item -ItemType Directory -Path $PathEntry -Force | Out-Null

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $entries = @()
    if ($userPath) {
        $entries = $userPath -split ";" | Where-Object { $_ }
    }

    $normalized = $PathEntry.TrimEnd('\\')
    if (-not ($entries | Where-Object { $_.TrimEnd('\\') -ieq $normalized })) {
        $newUserPath = (($entries + $PathEntry) | Where-Object { $_ } | Select-Object -Unique) -join ";"
        [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
    }

    Refresh-SessionPath
}

function Add-SessionPathEntry {
    param([string]$PathEntry)

    if ([string]::IsNullOrWhiteSpace($PathEntry)) {
        return
    }

    if (-not ($env:Path -split ";" | Where-Object { $_.TrimEnd('\\') -ieq $PathEntry.TrimEnd('\\') })) {
        $env:Path = "$PathEntry;$env:Path"
    }
}

function Get-ExecutablePath {
    param(
        [string]$Name,
        [string[]]$Candidates = @()
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        if ($command.Path) {
            return $command.Path
        }
        if ($command.Source) {
            return $command.Source
        }
    }

    foreach ($candidate in $Candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Get-RtkPath {
    return Get-ExecutablePath -Name "rtk" -Candidates @(
        (Join-Path $RtkInstallDir "rtk.exe"),
        (Join-Path $env:USERPROFILE ".cargo\bin\rtk.exe"),
        (Join-Path $LocalBinDir "rtk.exe")
    )
}

function Get-IcmPath {
    return Get-ExecutablePath -Name "icm" -Candidates @(
        (Join-Path $IcmInstallDir "icm.exe"),
        (Join-Path $LocalBinDir "icm.exe")
    )
}

function Get-UvPath {
    return Get-ExecutablePath -Name "uv" -Candidates @(
        (Join-Path $LocalBinDir "uv.exe")
    )
}

function Get-SpecifyPath {
    return Get-ExecutablePath -Name "specify" -Candidates @(
        (Join-Path $LocalBinDir "specify.exe")
    )
}

function Get-CommandOutput {
    param(
        [string]$BinaryPath,
        [string[]]$Arguments
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

function Confirm-Update {
    param(
        [string]$ToolName,
        [string]$CurrentVersion,
        [string]$DefaultAction = "Keep"
    )

    $choice = Read-Host "▸ $ToolName already installed ($CurrentVersion). [U]pdate / [K]eep? [k]"
    return ($choice -eq "u" -or $choice -eq "U")
}

function Get-LatestGitHubTag {
    param([string]$Repo)
    $release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
    return $release.tag_name
}

function Install-RtkRelease {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    if ($arch -eq [System.Runtime.InteropServices.Architecture]::Arm64) {
        Write-Warn "RTK only publishes x86_64 Windows binaries upstream. Windows ARM64 will rely on x64 emulation."
    } elseif ($arch -ne [System.Runtime.InteropServices.Architecture]::X64) {
        throw "Unsupported Windows architecture for RTK: $arch"
    }

    $tag = Get-LatestGitHubTag -Repo "rtk-ai/rtk"
    $assetName = "rtk-x86_64-pc-windows-msvc.zip"
    $url = "https://github.com/rtk-ai/rtk/releases/download/$tag/$assetName"
    $tempZip = Join-Path $env:TEMP "rtk-$([guid]::NewGuid()).zip"
    $tempDir = Join-Path $env:TEMP "rtk-extract-$([guid]::NewGuid())"

    try {
        New-Item -ItemType Directory -Path $RtkInstallDir -Force | Out-Null
        Write-Info "Downloading RTK release $tag..."
        Invoke-WebRequest -Uri $url -OutFile $tempZip -UseBasicParsing
        Expand-Archive -Path $tempZip -DestinationPath $tempDir -Force

        $binary = Join-Path $tempDir "rtk.exe"
        if (-not (Test-Path -LiteralPath $binary)) {
            $binary = Get-ChildItem -LiteralPath $tempDir -Filter "rtk*.exe" -Recurse | Select-Object -First 1 -ExpandProperty FullName
        }
        if (-not $binary) {
            throw "rtk.exe was not found in the downloaded archive."
        }

        Copy-Item -LiteralPath $binary -Destination (Join-Path $RtkInstallDir "rtk.exe") -Force
    } finally {
        if (Test-Path -LiteralPath $tempZip) {
            Remove-Item -LiteralPath $tempZip -Force
        }
        if (Test-Path -LiteralPath $tempDir) {
            Remove-Item -LiteralPath $tempDir -Recurse -Force
        }
    }

    Add-UserPathEntry $RtkInstallDir
    Add-SessionPathEntry $RtkInstallDir
    Refresh-SessionPath
}

function Install-Rtk {
    $rtkPath = Get-RtkPath
    if ($rtkPath) {
        $currentVersion = Get-CommandOutput -BinaryPath $rtkPath -Arguments @("--version")
        if (-not (Confirm-Update -ToolName "RTK" -CurrentVersion $currentVersion)) {
            Write-Ok "RTK kept ($currentVersion)"
            return
        }
    }

    Write-Info "Installing RTK (token optimizer)..."
    Install-RtkRelease

    $installedPath = Get-RtkPath
    $version = Get-CommandOutput -BinaryPath $installedPath -Arguments @("--version")
    $gainOutput = Get-CommandOutput -BinaryPath $installedPath -Arguments @("gain")
    if ($gainOutput -match "not a rtk command") {
        throw "The installed rtk binary is not RTK Token Killer."
    }
    Write-Ok "RTK installed ($version)"
}

function Install-IcmWithOfficialScript {
    $script = Invoke-WebRequest -Uri "https://raw.githubusercontent.com/rtk-ai/icm/main/install.ps1" -UseBasicParsing | Select-Object -ExpandProperty Content
    & ([ScriptBlock]::Create($script))
    Add-UserPathEntry $IcmInstallDir
    Add-SessionPathEntry $IcmInstallDir
    Refresh-SessionPath
}

function Install-Icm {
    $icmPath = Get-IcmPath
    if ($icmPath) {
        $currentVersion = Get-CommandOutput -BinaryPath $icmPath -Arguments @("--version")
        if (-not (Confirm-Update -ToolName "ICM" -CurrentVersion $currentVersion)) {
            Write-Ok "ICM kept ($currentVersion)"
            return
        }
    }

    Write-Info "Installing ICM (persistent memory)..."
    Install-IcmWithOfficialScript

    $installedPath = Get-IcmPath
    $version = Get-CommandOutput -BinaryPath $installedPath -Arguments @("--version")
    Write-Ok "ICM installed ($version)"
}

function Ensure-IcmAvailable {
    $icmPath = Get-IcmPath
    if ($icmPath) {
        return $icmPath
    }

    throw "ICM is mandatory. Installation cannot continue without a working icm command."
}

function Install-Uv {
    $uvPath = Get-UvPath
    if ($uvPath) {
        Write-Ok "uv $(Get-CommandOutput -BinaryPath $uvPath -Arguments @("--version"))"
        return
    }

    Write-Info "Installing uv (Python package manager, required for spec-kit)..."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install --id astral-sh.uv -e --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Null
        Refresh-SessionPath
    } elseif (Get-Command pipx -ErrorAction SilentlyContinue) {
        pipx install uv | Out-Null
        Add-UserPathEntry $LocalBinDir
    } elseif (Get-Command pip -ErrorAction SilentlyContinue) {
        pip install uv | Out-Null
        Add-UserPathEntry $LocalBinDir
    } else {
        throw "No supported installer found for uv. Windows 11 normally includes winget; otherwise install pipx or pip and rerun setup.ps1."
    }

    $installedPath = Get-UvPath
    if (-not $installedPath) {
        throw "uv installation completed but the command is still not available in PATH."
    }
    Write-Ok "uv $(Get-CommandOutput -BinaryPath $installedPath -Arguments @("--version"))"
}

function ConvertTo-Version {
    param([string]$VersionText)

    $sanitized = ($VersionText -replace '^[^0-9]*', '' -replace '[^0-9.].*$', '')
    if ([string]::IsNullOrWhiteSpace($sanitized)) {
        return $null
    }

    try {
        return [version]$sanitized
    } catch {
        return $null
    }
}

function Ensure-DashboardRuntimePrerequisites {
    $requiredNodeVersion = [version]'20.19.0'
    $requiredPnpmVersion = [version]'11.3.0'

    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        throw "Dashboard runtime is mandatory. Node >=20.19.0 is required."
    }

    $nodeVersion = ConvertTo-Version -VersionText ((& $nodeCommand.Source -p "process.versions.node" 2>$null) | Select-Object -First 1)
    if (-not $nodeVersion -or $nodeVersion -lt $requiredNodeVersion) {
        throw "Dashboard runtime requires Node >=20.19.0."
    }

    $corepackCommand = Get-Command corepack -ErrorAction SilentlyContinue
    if ($corepackCommand) {
        return "corepack"
    }

    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpmCommand) {
        throw "Dashboard runtime is mandatory. Install pnpm@11.3.0 or provide corepack before running setup.ps1."
    }

    $pnpmVersion = ConvertTo-Version -VersionText ($pnpmCommand | ForEach-Object { & $_.Source --version 2>$null } | Select-Object -First 1)
    if (-not $pnpmVersion -or $pnpmVersion -lt $requiredPnpmVersion) {
        throw "Dashboard runtime requires pnpm >=11.3.0 when corepack is unavailable."
    }

    return "pnpm"
}

function Install-Specify {
    Add-UserPathEntry $LocalBinDir
    Add-SessionPathEntry $LocalBinDir

    $specifyPath = Get-SpecifyPath
    if ($specifyPath) {
        $version = Get-CommandOutput -BinaryPath $specifyPath -Arguments @("version")
        if (-not $version) {
            $version = "installed"
        }
        Write-Ok "Specify CLI $version"
        return
    }

    $uvPath = Get-UvPath
    if (-not $uvPath) {
        Write-Warn "uv is not available, so Specify CLI cannot be installed automatically."
        return
    }

    Write-Info "Installing Specify CLI (spec-kit)..."
    & $uvPath tool install specify-cli --from git+https://github.com/github/spec-kit.git
    Add-UserPathEntry $LocalBinDir
    Add-SessionPathEntry $LocalBinDir

    $specifyPath = Get-SpecifyPath
    if ($specifyPath) {
        Write-Ok "Specify CLI installed"
    } else {
        Write-Warn "Specify CLI install finished, but the command is not in PATH yet. Restart the terminal after setup if needed."
    }
}

function Copy-ScaffoldMissing {
    param(
        [string]$From,
        [string]$To
    )

    Get-ChildItem -LiteralPath $From -Force -Recurse | ForEach-Object {
        $relativePath = $_.FullName.Substring($From.Length).TrimStart('\\', '/')
        if (-not $relativePath) {
            return
        }

        $targetPath = Join-Path $To $relativePath
        if ($_.PSIsContainer) {
            if (-not (Test-Path -LiteralPath $targetPath)) {
                New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
            }
            return
        }

        $parent = Split-Path -Parent $targetPath
        if ($parent) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }

        if (-not (Test-Path -LiteralPath $targetPath)) {
            Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Force
        }
    }
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

    $json = $Object | ConvertTo-Json -Depth 100
    Write-Utf8File -Path $Path -Content "$json`n"
}

function Set-WindowsVscodeSettings {
    param([string]$TargetProjectPath)

    $settingsPath = Join-Path $TargetProjectPath ".vscode\settings.json"
    $settings = Read-JsonObject -Path $settingsPath
    if (-not ($settings -is [System.Collections.IDictionary])) {
        $settings = @{}
    }

    $pathEntries = @(
        $RtkInstallDir,
        $IcmInstallDir,
        $LocalBinDir,
        (Join-Path $env:USERPROFILE ".cargo\bin")
    ) + ($env:Path -split ";")

    $settings["terminal.integrated.env.windows"] = @{
        Path = (($pathEntries | Where-Object { $_ } | Select-Object -Unique) -join ";")
    }

    Write-JsonObject -Path $settingsPath -Object $settings
    Write-Ok "PATH configured in .vscode/settings.json for Windows"
}

function Set-WindowsHookConfigs {
    param([string]$TargetProjectPath)

    $rtkHookPath = Join-Path $TargetProjectPath ".github\hooks\rtk-rewrite.json"
    $icmHookPath = Join-Path $TargetProjectPath ".github\hooks\icm.json"

    $rtkHook = @{
        hooks = @{
            PreToolUse = @(
                @{
                    type = "command"
                    command = "powershell -NoProfile -ExecutionPolicy Bypass -File .github/scripts/rtk-hook.ps1"
                    cwd = "."
                    timeout = 5
                }
            )
        }
    }

    $icmHook = @{
        version = 1
        hooks = @{
            sessionStart = @(
                @{
                    type = "command"
                    command = "powershell -NoProfile -ExecutionPolicy Bypass -File .github/scripts/icm-hook.ps1 start"
                    cwd = "."
                    timeout = 10
                }
            )
            preToolUse = @(
                @{
                    type = "command"
                    command = "powershell -NoProfile -ExecutionPolicy Bypass -File .github/scripts/icm-hook.ps1 pre"
                    cwd = "."
                    timeout = 5
                }
            )
            postToolUse = @(
                @{
                    type = "command"
                    command = "powershell -NoProfile -ExecutionPolicy Bypass -File .github/scripts/icm-hook.ps1 post"
                    cwd = "."
                    timeout = 10
                }
            )
            userPromptSubmitted = @(
                @{
                    type = "command"
                    command = "powershell -NoProfile -ExecutionPolicy Bypass -File .github/scripts/icm-hook.ps1 prompt"
                    cwd = "."
                    timeout = 10
                }
            )
        }
    }

    Write-JsonObject -Path $rtkHookPath -Object $rtkHook
    Write-JsonObject -Path $icmHookPath -Object $icmHook
    Write-Ok "PowerShell hook wrappers configured for Windows"
}

function Set-WorkspaceMcpConfig {
    param([string]$TargetProjectPath)

    $mcpPath = Join-Path $TargetProjectPath ".vscode\mcp.json"
    $mcpConfig = @{
        servers = @{
            icm = @{
                type = "stdio"
                command = "powershell"
                args = @(
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    '${workspaceFolder}\.github\scripts\icm-serve.ps1'
                )
            }
        }
    }

    Write-JsonObject -Path $mcpPath -Object $mcpConfig
    Write-Ok "Workspace MCP configured in .vscode/mcp.json for Windows"
}

if (-not $ProjectPath) {
    $ProjectPath = Read-Host "📂 Project path to install AOI into"
}

$ProjectPath = Expand-UserPath -PathValue $ProjectPath
if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
    Write-Err "Directory not found: $ProjectPath"
    exit 1
}

$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$ProjectName = Split-Path -Leaf $ProjectPath

Write-Header "AOI → $ProjectName"

if (-not (Test-Path -LiteralPath $ScaffoldDir -PathType Container)) {
    Write-Err "Scaffold directory not found at: $ScaffoldDir"
    Write-Err "Make sure you're running from the AOI root."
    exit 1
}

Write-Header "Phase 1: Tools"
try {
    Install-Rtk
} catch {
    Write-Warn "RTK installation failed — continuing without token optimization. $($_.Exception.Message)"
}
Install-Icm
$null = Ensure-IcmAvailable
Install-Uv
Install-Specify

Write-Header "Phase 1.5: NVIDIA customendpoint (opcional)"
$nvidiaScript = Join-Path $PSScriptRoot "scripts/nvidia-vscode-setup.ps1"
if (Test-Path $nvidiaScript) {
    Write-Info "Detectando VS Code para configurar custom endpoint NVIDIA (Kimi K2.6, DeepSeek V4 Pro, MiniMax M3, Qwen 3.5)."
    Write-Info "Presione Enter para ejecutar ahora, o 'n' + Enter para omitir (AOI seguirá funcionando con defaults vendor-copilot)."
    $nvidiaChoice = Read-Host "▸ Configurar customendpoint NVIDIA? [Y/n]"
    if ($nvidiaChoice -match '^[nN]([oO])?$') {
        Write-Warn "Saltado por elección del operador. AOI continúa con defaults vendor-copilot (Gemini 3.1 Pro Preview / GPT-5.4 xhigh)."
    } else {
        try {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $nvidiaScript
            if ($LASTEXITCODE -ne 0) {
                Write-Warn "nvidia-vscode-setup.ps1 salió con código $LASTEXITCODE — el setup continúa. El operador puede correrlo manualmente tras finalizar."
            }
        } catch {
            Write-Warn "No se pudo invocar nvidia-vscode-setup.ps1: $($_.Exception.Message) — el setup continúa."
        }
    }
} else {
    Write-Warn "scripts/nvidia-vscode-setup.ps1 no encontrado junto a setup.ps1 — saltando Phase 1.5"
}

Write-Header "Phase 1.6: Headroom compression layer (opcional)"
$headroomInstall = Join-Path $PSScriptRoot "scripts/install-headroom.ps1"
$headroomPreview = Join-Path $PSScriptRoot "scripts/headroom-vscode-setup.ps1"
if (Test-Path $headroomInstall) {
    Write-Info "Headroom (headroomlabs-ai/headroom) provee compresión proxy/MCP/library para reducir 60-95% tokens."
    Write-Info "Es CAPA OPCIONAL encima de AOI bootstrapper. NO se auto-activa."
    Write-Info "Si no se instala, AOI continúa funcionando exactamente igual. Default: y/N → N."
    $headroomChoice = Read-Host "▸ Instalar Headroom y mostrar plan de activación? [y/N]"
    if ($headroomChoice -match '^[yY]([eE][sS])?$') {
        try {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $headroomInstall -Yes
            if ($LASTEXITCODE -ne 0) {
                Write-Warn "install-headroom.ps1 salió con código $LASTEXITCODE — Headroom es opcional. Setup continúa."
            }
        } catch {
            Write-Warn "No se pudo invocar install-headroom.ps1: $($_.Exception.Message) — el setup continúa."
        }
        if (Test-Path $headroomPreview) {
            Write-Info "Headroom (si se instaló) se configura por envvars (NO modifica VS Code ChatLanguageModel.json)."
            try {
                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $headroomPreview
            } catch {
                Write-Warn "headroom-vscode-setup.ps1 falló — AOI continúa. Operador puede correrlo manualmente."
            }
        }
    } else {
        Write-Warn "Saltado por elección del operador. AOI continúa sin Headroom."
    }
} else {
    Write-Warn "scripts/install-headroom.ps1 no encontrado junto a setup.ps1 — saltando Phase 1.6"
}

Write-Header "Phase 2: Spec-Kit"
Push-Location $ProjectPath
try {
    $specifyPath = Get-SpecifyPath
    if ($specifyPath) {
        Write-Info "Initializing spec-kit for Copilot..."
        try {
            & $specifyPath init . --ai copilot --force 2>$null
            Write-Ok "Spec-kit → Copilot"
        } catch {
            Write-Warn "Spec-kit Copilot init skipped (may need manual setup)"
        }

        Write-Info "Initializing spec-kit for Antigravity..."
        try {
            & $specifyPath init . --ai agy --ai-skills --force 2>$null
            Write-Ok "Spec-kit → Antigravity"
        } catch {
            Write-Warn "Spec-kit Antigravity init skipped (may need manual setup)"
        }
    } else {
        Write-Warn "Specify CLI not found — skipping spec-kit init"
        Write-Warn "Run manually after installing: specify init . --ai copilot --force"
    }
} finally {
    Pop-Location
}

Write-Header "Phase 3: Agentic Infrastructure"
Copy-ScaffoldMissing -From $ScaffoldDir -To $ProjectPath
Write-Ok "Scaffold merged"

New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".tasks") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".sandboxes") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".atl") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".resources") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".resources\userstories") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".resources\workflows") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\app\components") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\app\pages") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\server\api") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\server\routes") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\server\utils") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\shared") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\test") -Force | Out-Null
Write-Ok "Directories: .tasks/ .sandboxes/ .atl/ .resources/ aoi_apps/agentic-ops-dashboard/"

if (Test-Path -LiteralPath (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\package.json") -PathType Leaf) {
    $dashboardInstaller = Ensure-DashboardRuntimePrerequisites
    Write-Info "Installing dashboard package dependencies..."
    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    $corepackCommand = Get-Command corepack -ErrorAction SilentlyContinue
    $dashboardInstallDir = Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard"

    function Invoke-DashboardInstall {
        if ($dashboardInstaller -eq "corepack") {
            & $corepackCommand.Source enable | Out-Null
            & $corepackCommand.Source pnpm install
        } else {
            & $pnpmCommand.Source install
        }
    }

    Push-Location $dashboardInstallDir
    try {
        $installOutput = Invoke-DashboardInstall 2>&1

        if ($LASTEXITCODE -eq 0) {
            if ($dashboardInstaller -eq "corepack") {
                Write-Ok "Dashboard dependencies installed (corepack pnpm)"
            } else {
                Write-Ok "Dashboard dependencies installed (pnpm)"
            }
        } else {
            $joinedOutput = ($installOutput | ForEach-Object { $_.ToString() }) -join "`n"
            if ($joinedOutput -match "ERR_PNPM_IGNORED_BUILDS") {
                Write-Warn "pnpm blocked dependency build scripts; approving known builds and retrying..."
                & $pnpmCommand.Source approve-builds --all
                if ($LASTEXITCODE -ne 0) {
                    throw "Dashboard dependency install failed during approve-builds."
                }

                Invoke-DashboardInstall
                if ($LASTEXITCODE -ne 0) {
                    throw "Dashboard dependency install failed after approve-builds retry."
                }

                Write-Ok "Dashboard dependencies installed after approving build scripts"
            } else {
                throw "Dashboard dependency install failed."
            }
        }
    } catch {
        throw "Dashboard dependency install failed: $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
}

Set-WindowsVscodeSettings -TargetProjectPath $ProjectPath
Set-WindowsHookConfigs -TargetProjectPath $ProjectPath
Set-WorkspaceMcpConfig -TargetProjectPath $ProjectPath

Write-Header "Phase 4: Tool Configuration"
Push-Location $ProjectPath
try {
    $rtkPath = Get-RtkPath
    if ($rtkPath) {
        Write-Ok "RTK → Copilot hooks (PowerShell wrapper)"
    } else {
        Write-Warn "RTK not found — Copilot hook will pass commands through until RTK is installed"
    }

    $icmPath = Ensure-IcmAvailable
    Write-Ok "ICM → Workspace MCP registered (.vscode/mcp.json)"

    try {
        & $icmPath init --mode hook 2>$null
        Write-Ok "ICM → Hooks installed (auto-extraction)"
    } catch {
        Write-Warn "ICM hooks skipped"
    }

    try {
        & $icmPath init --mode skill 2>$null
        Write-Ok "ICM → Skills installed"
    } catch {
        Write-Warn "ICM skills skipped"
    }

    try {
        & $icmPath init --mode cli 2>$null
        Write-Ok "ICM → CLI instructions"
    } catch {
        Write-Warn "ICM CLI instructions skipped"
    }

    Remove-Item -LiteralPath (Join-Path $ProjectPath ".windsurfrules") -Force -ErrorAction SilentlyContinue
} finally {
    Pop-Location
}

Write-Header "Phase 5: ICM Bootstrap"
$icmPath = Ensure-IcmAvailable
try {
    & $icmPath store -t "$ProjectName-context" -c "Project $ProjectName initialized with AOI (Agentic Operational Infrastructure) v3. Stack: Hub-and-Spoke orchestration, SDD lifecycle (spec-kit), ICM persistence (4 methods: memories, memoirs, feedback, transcripts), RTK token optimization. Dual-sync enforced: Copilot (.github/agents/) ↔ Antigravity (.agent/skills/agents/). Task artifacts in .tasks/{feature}/TASK-YYYY-NNN/. Skill registry at .atl/skill-registry.md." -i critical -k "init,aoi,architecture" 2>$null
    Write-Ok "Memory: init context stored (topic: $ProjectName-context)"
} catch {
    Write-Warn "Memory bootstrap skipped"
}

try {
    & $icmPath memoir create -n "$ProjectName-architecture" -d "Architecture decisions and component relationships for $ProjectName" 2>$null
    Write-Ok "Memoir: $ProjectName-architecture created"
} catch {
    Write-Warn "Memoir create skipped"
}

try { & $icmPath memoir add-concept -m "$ProjectName-architecture" -n "sdd-lifecycle" -d "Spec-Driven Development lifecycle: constitution → specify → plan → tasks → implement → verify → archive" -l "type:process,domain:workflow" 2>$null } catch { }
try { & $icmPath memoir add-concept -m "$ProjectName-architecture" -n "hub-and-spoke" -d "Supervisor orchestrates specialized agents per SDD phase" -l "type:pattern,domain:orchestration" 2>$null } catch { }
try { & $icmPath memoir add-concept -m "$ProjectName-architecture" -n "dual-sync" -d "All agents/skills must exist in both Copilot (.github/agents/) and Antigravity (.agent/skills/agents/) formats" -l "type:constraint,domain:sync" 2>$null } catch { }
try { & $icmPath memoir link -m "$ProjectName-architecture" --from "hub-and-spoke" --to "sdd-lifecycle" -r depends_on 2>$null } catch { }
try { & $icmPath memoir link -m "$ProjectName-architecture" --from "dual-sync" --to "hub-and-spoke" -r related_to 2>$null } catch { }
Write-Ok "Memoir: architecture graph bootstrapped"

Write-Header "Phase 6: Base-Project Map"
# Pre-seed a base-project roots PROPOSAL by running the detector. This NEVER
# writes .specify/memory/base-project.json — the confirmed write happens in
# /init after the Owner approves/corrects the proposal.
$baseMapDetector = Join-Path $ProjectPath "scripts\sandbox\detect-base-project.mjs"
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand -and (Test-Path -LiteralPath $baseMapDetector -PathType Leaf)) {
    Write-Info "Detecting base-project roots (proposal only, not written)..."
    try {
        Push-Location $ProjectPath
        $baseMapProposal = & $nodeCommand.Source $baseMapDetector 2>$null
        Pop-Location
        if ($LASTEXITCODE -eq 0 -and $baseMapProposal) {
            $baseMapProposal | ForEach-Object { Write-Host $_ }
            Write-Ok "Base-project map proposed — confirm + write it in /init"
        } else {
            Write-Warn "Base-project detector failed — run /init to detect + confirm the map"
        }
    } catch {
        Write-Warn "Base-project detector failed — run /init to detect + confirm the map"
    }
} else {
    Write-Warn "node or detector missing — base-project map will be detected in /init"
}

Write-Header "Installation Complete"
Write-Host "  Project: $ProjectPath"
Write-Host ""
Write-Host "  Tools installed:"

$rtkPath = Get-RtkPath
if ($rtkPath) {
    Write-Host "    ✓ RTK   $(Get-CommandOutput -BinaryPath $rtkPath -Arguments @("--version"))"
} else {
    Write-Host "    ✗ RTK"
}

$icmPath = Get-IcmPath
if ($icmPath) {
    Write-Host "    ✓ ICM   $(Get-CommandOutput -BinaryPath $icmPath -Arguments @("--version"))"
} else {
    Write-Host "    ✗ ICM"
}

$specifyPath = Get-SpecifyPath
if ($specifyPath) {
    Write-Host "    ✓ Specify CLI"
} else {
    Write-Host "    ✗ Specify CLI"
}

Write-Host ""
Write-Host "  Next steps:"
Write-Host "    1. cd $ProjectPath"
Write-Host "    2. code ."
Write-Host "    3. Run /init in Copilot Chat (bootstrap ICM, directories, base-project map)"
Write-Host "    4. (optional) Run /speckit.constitution to customize project rules"
Write-Host "    5. Start your first cycle: /sdd-new"
if (Test-Path -LiteralPath (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\package.json") -PathType Leaf) {
    Write-Host "    6. Start the dashboard runtime: pnpm --dir aoi_apps/agentic-ops-dashboard dev"
}
Write-Host ""