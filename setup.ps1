param(
    [Parameter(Position = 0)]
    [string]$ProjectPath = "",
    [Parameter()]
    [string]$Harness = "all",
    [Parameter()]
    [switch]$Yes = $false,
    [Parameter()]
    [switch]$NonInteractive = $false
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

function Invoke-WindowsPowerShellFile {
    param(
        [string]$ScriptPath,
        [string[]]$Arguments = @()
    )

    if (-not (Test-Path -LiteralPath $ScriptPath -PathType Leaf)) {
        throw "Script not found: $ScriptPath"
    }

    $scriptDir = Split-Path -Parent $ScriptPath
    $scriptName = [System.IO.Path]::GetFileNameWithoutExtension($ScriptPath)
    $tempScriptPath = Join-Path $scriptDir ("aoi-$scriptName-$([System.Guid]::NewGuid().ToString('N').Substring(0, 6)).ps1")
    $powershellPath = Get-ExecutablePath -Name "powershell.exe" -Candidates @(
        (Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe")
    )

    if (-not $powershellPath) {
        $powershellPath = Get-ExecutablePath -Name "powershell"
    }

    if (-not $powershellPath) {
        throw "Windows PowerShell executable not found."
    }

    try {
        $content = [System.IO.File]::ReadAllText($ScriptPath)
        $content = $content.TrimStart([char]0xFEFF)
        $content = $content -replace "`r`n", "`n"
        $content = $content -replace "`r", "`n"

        $encoding = New-Object System.Text.UTF8Encoding($true)
        [System.IO.File]::WriteAllText($tempScriptPath, $content, $encoding)

        $childOutput = & $powershellPath -NoProfile -ExecutionPolicy Bypass -File $tempScriptPath @Arguments 2>&1
        $childExitCode = $LASTEXITCODE

        foreach ($line in $childOutput) {
            Write-Host $line
        }

        return $childExitCode
    } finally {
        Remove-Item -LiteralPath $tempScriptPath -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-ProcessWithCapture {
    param(
        [string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = ""
    )

    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()

    try {
        $startInfo = @{
            FilePath = $FilePath
            ArgumentList = $Arguments
            Wait = $true
            PassThru = $true
            NoNewWindow = $true
            RedirectStandardOutput = $stdoutPath
            RedirectStandardError = $stderrPath
        }

        if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
            $startInfo["WorkingDirectory"] = $WorkingDirectory
        }

        $process = Start-Process @startInfo
        $stdoutLines = @()
        $stderrLines = @()

        if ((Get-Item -LiteralPath $stdoutPath).Length -gt 0) {
            $stdoutLines = @(Get-Content -LiteralPath $stdoutPath)
        }

        if ((Get-Item -LiteralPath $stderrPath).Length -gt 0) {
            $stderrLines = @(Get-Content -LiteralPath $stderrPath)
        }

        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            Stdout = $stdoutLines
            Stderr = $stderrLines
            CombinedOutput = @($stdoutLines + $stderrLines)
        }
    } finally {
        Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
    }
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

    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
        foreach ($propertyName in @("Path", "Definition", "Source")) {
            $property = $command.PSObject.Properties[$propertyName]
            if (-not $property) {
                continue
            }

            $value = [string]$property.Value
            if ([string]::IsNullOrWhiteSpace($value)) {
                continue
            }

            if ($propertyName -in @("Path", "Definition") -and (Test-Path -LiteralPath $value)) {
                return $value
            }

            if ($propertyName -eq "Source") {
                return $value
            }
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

function Get-CodebaseMemoryPath {
    return Get-ExecutablePath -Name "codebase-memory-mcp" -Candidates @(
        (Join-Path $env:LOCALAPPDATA "Programs\codebase-memory-mcp\codebase-memory-mcp.exe"),
        (Join-Path $LocalBinDir "codebase-memory-mcp.exe")
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

    if ($Yes.IsPresent -or $NonInteractive.IsPresent) {
        return $false
    }

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

    $nodePath = Get-ExecutablePath -Name "node"
    if (-not $nodePath) {
        throw "Dashboard runtime is mandatory. Node >=20.19.0 is required."
    }

    $nodeVersion = ConvertTo-Version -VersionText ((& $nodePath -p "process.versions.node" 2>$null) | Select-Object -First 1)
    if (-not $nodeVersion -or $nodeVersion -lt $requiredNodeVersion) {
        throw "Dashboard runtime requires Node >=20.19.0."
    }

    $corepackPath = Get-ExecutablePath -Name "corepack"
    if ($corepackPath) {
        return "corepack"
    }

    $pnpmPath = Get-ExecutablePath -Name "pnpm"
    if (-not $pnpmPath) {
        throw "Dashboard runtime is mandatory. Install pnpm@11.3.0 or provide corepack before running setup.ps1."
    }

    $pnpmVersion = ConvertTo-Version -VersionText ((& $pnpmPath --version 2>$null) | Select-Object -First 1)
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
        $relativePath = $_.FullName.Substring($From.Length).TrimStart('\', '/')
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
    $servers = @{
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

    $cbmPath = Get-CodebaseMemoryPath
    if ($cbmPath) {
        $servers["codebase-memory-mcp"] = @{
            type = "stdio"
            command = $cbmPath
        }
    }

    $mcpConfig = @{
        servers = $servers
    }

    Write-JsonObject -Path $mcpPath -Object $mcpConfig
    if ($cbmPath) {
        Write-Ok "Workspace MCP configured in .vscode/mcp.json for Windows (ICM + codebase-memory-mcp)"
    } else {
        Write-Ok "Workspace MCP configured in .vscode/mcp.json for Windows (ICM only)"
    }
}

if (-not $ProjectPath) {
    $ProjectPath = Read-Host "📂 Project path to install AOI into"
}

$ProjectPath = Expand-UserPath -PathValue $ProjectPath
$ProjectPath = $ProjectPath.Trim('"').Trim("'")
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
    $nvidiaChoice = "n"
    if (-not ($Yes.IsPresent -or $NonInteractive.IsPresent)) {
        $nvidiaChoice = Read-Host "▸ Configurar customendpoint NVIDIA? [Y/n]"
    }
    if ($nvidiaChoice -match '^[nN]([oO])?$') {
        Write-Warn "Saltado por elección del operador. AOI continúa con defaults vendor-copilot (Gemini 3.1 Pro Preview / GPT-5.4 xhigh)."
    } else {
        try {
            $nvidiaExitCode = Invoke-WindowsPowerShellFile -ScriptPath $nvidiaScript
            if ($nvidiaExitCode -ne 0) {
                Write-Warn "nvidia-vscode-setup.ps1 salió con código $nvidiaExitCode — el setup continúa. El operador puede correrlo manualmente tras finalizar."
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
    Write-Info "Headroom (headroomlabs-ai/headroom) provee compresión proxy/MCP/library para reducir 60-95% tokens en flujos CLI."
    Write-Info "NO intercepta VS Code Copilot Chat (extensión nativa). Para ese contexto el ahorro viene de RTK + codebase-memory-mcp."
    $headroomChoice = "n"
    if (-not ($Yes.IsPresent -or $NonInteractive.IsPresent)) {
        $headroomChoice = Read-Host "▸ Instalar Headroom? [Y/n]"
    }
    if ($headroomChoice -match '^[nN]([oO])?$') {
        Write-Warn "Headroom omitido. AOI continúa sin capa de compresión CLI."
    } else {
        try {
            $headroomInstallExitCode = Invoke-WindowsPowerShellFile -ScriptPath $headroomInstall -Arguments @("-Yes")
            if ($headroomInstallExitCode -ne 0) {
                Write-Warn "install-headroom.ps1 salió con código $headroomInstallExitCode — el setup continúa sin Headroom."
                Write-Warn "El operador puede reintentar luego: powershell scripts/install-headroom.ps1 -Yes"
            } else {
                if (Test-Path $headroomPreview) {
                    Write-Info "Headroom se configura por envvars (NO modifica VS Code ChatLanguageModel.json)."
                    try {
                        $headroomPreviewExitCode = Invoke-WindowsPowerShellFile -ScriptPath $headroomPreview
                        if ($headroomPreviewExitCode -ne 0) {
                            Write-Warn "headroom-vscode-setup.ps1 falló — el setup continúa. Configurá las envvars manualmente."
                        }
                    } catch {
                        Write-Warn "No se pudo invocar headroom-vscode-setup.ps1: $($_.Exception.Message) — el setup continúa."
                    }
                }
                Write-Ok "Headroom instalado y configurado."
            }
        } catch {
            Write-Warn "No se pudo invocar install-headroom.ps1: $($_.Exception.Message) — el setup continúa sin Headroom."
        }
    }
} else {
    Write-Warn "scripts/install-headroom.ps1 no encontrado junto a setup.ps1 — saltando Phase 1.6"
}

Write-Header "Phase 1.7: AOI Headroom integration (obligatorio)"
$wrapSrc = Join-Path $PSScriptRoot "scripts\aoi-headroom-wrap.ps1"
$wrapShSrc = Join-Path $PSScriptRoot "scripts\aoi-headroom-wrap.sh"
$guardSrc = Join-Path $PSScriptRoot ".githooks\pre-commit-aoi-guard.sh"

if (-not (Test-Path -LiteralPath $wrapSrc) -or -not (Test-Path -LiteralPath $guardSrc)) {
    Write-Err "AOI Headroom integration assets missing in installer. Setup cannot complete."
    exit 1
}

$projectScriptsDir = Join-Path $ProjectPath "scripts"
$projectGithooksDir = Join-Path $ProjectPath ".githooks"
$projectBinDir = Join-Path $projectScriptsDir "bin"

New-Item -ItemType Directory -Path $projectScriptsDir -Force | Out-Null
New-Item -ItemType Directory -Path $projectGithooksDir -Force | Out-Null

Copy-Item -LiteralPath $wrapSrc -Destination (Join-Path $projectScriptsDir "aoi-headroom-wrap.ps1") -Force
if (Test-Path -LiteralPath $wrapShSrc) {
    Copy-Item -LiteralPath $wrapShSrc -Destination (Join-Path $projectScriptsDir "aoi-headroom-wrap.sh") -Force
}
Copy-Item -LiteralPath $guardSrc -Destination (Join-Path $projectGithooksDir "pre-commit-aoi-guard.sh") -Force

Write-Ok "Installed aoi-headroom-wrap → PROJECT/scripts/"
Write-Ok "Installed pre-commit-aoi-guard.sh → PROJECT/.githooks/"

# Install the aoi-copilot shim
New-Item -ItemType Directory -Path $projectBinDir -Force | Out-Null
$shimContent = @'
#!/usr/bin/env bash
# AOI Copilot shim — routes to aoi-headroom-wrap.sh so the call exits via
# `headroom wrap copilot --subscription`.
exec bash "$(dirname "$0")/../aoi-headroom-wrap.sh" "$@"
'@
[System.IO.File]::WriteAllText((Join-Path $projectBinDir "aoi-copilot"), $shimContent, (New-Object System.Text.UTF8Encoding($false)))
Write-Ok "Installed aoi-copilot shim → PROJECT/scripts/bin/"

# Chain into pre-commit
$projectGitDir = Join-Path $ProjectPath ".git"
$preCommitPath = Join-Path $projectGitDir "hooks\pre-commit"
$guardProjectPath = Join-Path $projectGithooksDir "pre-commit-aoi-guard.sh"

if (Test-Path -LiteralPath $projectGitDir -PathType Container) {
    if (Test-Path -LiteralPath $preCommitPath) {
        $existingContent = Get-Content -LiteralPath $preCommitPath -Raw
        if ($existingContent -notmatch "pre-commit-aoi-guard.sh") {
            Copy-Item -LiteralPath $preCommitPath -Destination "$preCommitPath.aoi-bak" -Force
            $chainContent = @"
#!/usr/bin/env bash
# AOI bootstrap chain: run guard first, then delegate to project pre-commit.
SELF_DIR=`$(cd `"$(dirname `"`$0`")`" && pwd)
bash `"`$SELF_DIR/../../.githooks/pre-commit-aoi-guard.sh`" `"`$@`" || exit `$?
if [ -f `"`$SELF_DIR/pre-commit.aoi-bak`" ]; then
  exec bash `"`$SELF_DIR/pre-commit.aoi-bak`" `"`$@`"
fi
exit 0
"@
            [System.IO.File]::WriteAllText($preCommitPath, $chainContent, (New-Object System.Text.UTF8Encoding($false)))
            Write-Ok "Chained AOI guard into existing pre-commit hook"
        } else {
            Write-Ok "AOI guard already chained into pre-commit (skipped)"
        }
    } else {
        Copy-Item -LiteralPath $guardSrc -Destination $preCommitPath -Force
        Write-Ok "Installed AOI pre-commit guard → .git/hooks/pre-commit"
    }
} else {
    Write-Info "Target project is not a git repo — AOI guard will activate once 'git init' runs."
    Write-Info "    When ready, run: New-Item -ItemType SymbolicLink -Path .git\hooks\pre-commit -Target ..\..\..\.githooks\pre-commit-aoi-guard.sh"
}

Write-Ok "Phase 1.7 complete"

Write-Header "Phase 1.8: Codebase Memory MCP (opcional)"
$codebaseMemoryInstall = Join-Path $PSScriptRoot "scripts/install-codebase-memory.ps1"
if (Test-Path $codebaseMemoryInstall) {
    Write-Info "codebase-memory-mcp indexa el repo en un knowledge graph local para reducir exploración file-by-file."
    Write-Info "AOI lo instala en modo binario-only (--skip-config) y registra el MCP solo en el workspace actual."
    $cbmChoice = "n"
    if (-not ($Yes.IsPresent -or $NonInteractive.IsPresent)) {
        $cbmChoice = Read-Host "▸ Instalar codebase-memory-mcp? [Y/n]"
    }
    if ($cbmChoice -match '^[nN]([oO])?$') {
        Write-Warn "codebase-memory-mcp omitido. AOI continúa con ICM/Headroom/RTK normales."
    } else {
        Write-Info "Variante UI incluye grafo 3D interactivo en http://localhost:9749"
        $cbmUiChoice = "n"
        if (-not ($Yes.IsPresent -or $NonInteractive.IsPresent)) {
            $cbmUiChoice = Read-Host "▸ Instalar variante con UI (recomendado)? [Y/n]"
        }
        $cbmVariantArgs = if ($cbmUiChoice -match '^[nN]([oO])?$') { @("-Yes", "-Variant", "standard") } else { @("-Yes", "-Variant", "ui") }
        $cbmWithUi = $cbmVariantArgs -notcontains "standard"
        try {
            $cbmExitCode = Invoke-WindowsPowerShellFile -ScriptPath $codebaseMemoryInstall -Arguments $cbmVariantArgs
            if ($cbmExitCode -ne 0) {
                Write-Warn "install-codebase-memory.ps1 salió con código $cbmExitCode — el setup continúa."
                Write-Warn "El operador puede reintentar luego; el MCP workspace-local quedará en ICM only."
            } else {
                # Post-install config: enable auto_index (native git watcher) and UI
                $cbmBinInit = Get-CodebaseMemoryPath
                if ($cbmBinInit) {
                    try { & $cbmBinInit config set auto_index true 2>$null; Write-Ok "codebase-memory-mcp: auto_index activado (watcher nativo de git)" } catch {}
                    if ($cbmWithUi) {
                        try { & $cbmBinInit config set ui true 2>$null; Write-Ok "codebase-memory-mcp: UI activada en http://localhost:9749" } catch {}
                        try { & $cbmBinInit config set port 9749 2>$null } catch {}
                    }
                    # Initial index — Start-Job so it's non-blocking. auto_index handles subsequent changes.
                    Write-Info "Indexando el repo por primera vez en background (codebase-memory-mcp)..."
                    Start-Job -ScriptBlock {
                        param($bin, $repoPath, $log)
                        & $bin cli index_repository "{`"repo_path`": `"$repoPath`"}" >> $log 2>&1
                    } -ArgumentList $cbmBinInit, $ProjectPath, "$env:TEMP\codebase-memory-mcp-index.log" | Out-Null
                    Write-Ok "Index inicial lanzado en background → $env:TEMP\codebase-memory-mcp-index.log"
                }
            }
        } catch {
            Write-Warn "No se pudo invocar install-codebase-memory.ps1: $($_.Exception.Message) — el setup continúa."
        }
    }
} else {
    Write-Warn "scripts/install-codebase-memory.ps1 no encontrado junto a setup.ps1 — saltando Phase 1.8"
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

# Ensure AOI governed assets override generic specify init outputs
Copy-Item -LiteralPath (Join-Path $ScaffoldDir ".github\*") -Destination (Join-Path $ProjectPath ".github") -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath (Join-Path $ScaffoldDir "scripts\*") -Destination (Join-Path $ProjectPath "scripts") -Recurse -Force -ErrorAction SilentlyContinue

# Replicate scaffold mirror inside target
$targetScaffoldDir = Join-Path $ProjectPath "scaffold"
Copy-ScaffoldMissing -From $ScaffoldDir -To $targetScaffoldDir
Copy-Item -LiteralPath (Join-Path $ScaffoldDir ".github\*") -Destination (Join-Path $targetScaffoldDir ".github") -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath (Join-Path $ScaffoldDir "scripts\*") -Destination (Join-Path $targetScaffoldDir "scripts") -Recurse -Force -ErrorAction SilentlyContinue
Write-Ok "Scaffold mirror preserved in target (scaffold/)"

# Copy pnpm workspace and lock configs
$srcPnpmWorkspace = Join-Path $ScriptDir "pnpm-workspace.yaml"
if (Test-Path -LiteralPath $srcPnpmWorkspace -PathType Leaf) {
    Copy-Item -LiteralPath $srcPnpmWorkspace -Destination (Join-Path $ProjectPath "pnpm-workspace.yaml") -Force -ErrorAction SilentlyContinue
    Copy-Item -LiteralPath $srcPnpmWorkspace -Destination (Join-Path $targetScaffoldDir "pnpm-workspace.yaml") -Force -ErrorAction SilentlyContinue
}
$srcPnpmLock = Join-Path $ScriptDir "pnpm-lock.yaml"
if (Test-Path -LiteralPath $srcPnpmLock -PathType Leaf) {
    Copy-Item -LiteralPath $srcPnpmLock -Destination (Join-Path $ProjectPath "pnpm-lock.yaml") -Force -ErrorAction SilentlyContinue
    Copy-Item -LiteralPath $srcPnpmLock -Destination (Join-Path $targetScaffoldDir "pnpm-lock.yaml") -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".tasks") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".sandboxes") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".resources") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".resources\userstories") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".resources\workflows") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath ".atl") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\app\components") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\app\pages") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\server\api") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\server\routes") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\server\utils") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\shared") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\test") -Force | Out-Null
Write-Ok "Directories: .tasks/ .sandboxes/ .resources/ aoi_apps/agentic-ops-dashboard/"

if (Test-Path -LiteralPath (Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard\package.json") -PathType Leaf) {
    $dashboardInstaller = Ensure-DashboardRuntimePrerequisites
    Write-Info "Installing dashboard package dependencies..."
    $pnpmPath = Get-ExecutablePath -Name "pnpm"
    $corepackPath = Get-ExecutablePath -Name "corepack"
    $dashboardInstallDir = Join-Path $ProjectPath "aoi_apps\agentic-ops-dashboard"

    function Invoke-DashboardInstall {
        if ($dashboardInstaller -eq "corepack") {
            $enableResult = Invoke-ProcessWithCapture -FilePath $corepackPath -Arguments @("enable") -WorkingDirectory $dashboardInstallDir
            if ($enableResult.ExitCode -ne 0) {
                return $enableResult
            }

            return Invoke-ProcessWithCapture -FilePath $corepackPath -Arguments @("pnpm", "install") -WorkingDirectory $dashboardInstallDir
        } else {
            return Invoke-ProcessWithCapture -FilePath $pnpmPath -Arguments @("install") -WorkingDirectory $dashboardInstallDir
        }
    }

    try {
        $installResult = Invoke-DashboardInstall

        if ($installResult.ExitCode -eq 0) {
            if ($dashboardInstaller -eq "corepack") {
                Write-Ok "Dashboard dependencies installed (corepack pnpm)"
            } else {
                Write-Ok "Dashboard dependencies installed (pnpm)"
            }
        } else {
            $joinedOutput = ($installResult.CombinedOutput | Select-Object -Last 80) -join "`n"
            if ($joinedOutput -match "ERR_PNPM_IGNORED_BUILDS") {
                Write-Warn "pnpm blocked dependency build scripts; approving known builds and retrying..."
                $approveBuildsResult = Invoke-ProcessWithCapture -FilePath $pnpmPath -Arguments @("approve-builds") -WorkingDirectory $dashboardInstallDir
                if ($approveBuildsResult.ExitCode -ne 0) {
                    $approveBuildsOutput = ($approveBuildsResult.CombinedOutput | Select-Object -Last 40) -join "`n"
                    throw "Dashboard dependency install failed during approve-builds.`n$approveBuildsOutput"
                }

                $retryResult = Invoke-DashboardInstall
                if ($retryResult.ExitCode -ne 0) {
                    $retryOutput = ($retryResult.CombinedOutput | Select-Object -Last 80) -join "`n"
                    throw "Dashboard dependency install failed after approve-builds retry.`n$retryOutput"
                }

                Write-Ok "Dashboard dependencies installed after approving build scripts"
            } else {
                if ([string]::IsNullOrWhiteSpace($joinedOutput)) {
                    $joinedOutput = "No process output captured."
                }

                throw "Dashboard dependency install failed.`n$joinedOutput"
            }
        }
    } catch {
        throw "Dashboard dependency install failed: $($_.Exception.Message)"
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
    $cbmPath = Get-CodebaseMemoryPath
    if ($cbmPath) {
        Write-Ok "codebase-memory-mcp → Workspace MCP registered (.vscode/mcp.json)"
    }

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

    $compileRulesScript = Join-Path $ScriptDir "scripts\multi-harness\compile-rules.mjs"
    $nodePath = Get-ExecutablePath -Name "node"
    if ($nodePath -and (Test-Path -LiteralPath $compileRulesScript -PathType Leaf)) {
        try {
            & $nodePath $compileRulesScript --harness $Harness --workspace $ProjectName 2>$null
            Write-Ok "Multi-harness rules compiled ($Harness)"
        } catch { }
    }
} finally {
    Pop-Location
}

Write-Header "Phase 5: ICM Bootstrap"
$icmPath = Ensure-IcmAvailable
try {
    & $icmPath facts set "$ProjectName" "harness.selected" "$Harness" 2>$null
    & $icmPath facts set "$ProjectName" "icm.protocol" "v4" 2>$null
    Write-Ok "Facts: initial configuration registered ($Harness, v4)"
} catch { }

try {
    & $icmPath store -t "$ProjectName-context" -c "$ProjectName initialized with AOI (Agentic Operational Infrastructure) v4. Harness: $Harness. Stack: Hub-and-Spoke orchestration, SDD lifecycle (spec-kit), ICM persistence (5 methods: memories, memoirs, facts, feedback, transcripts), RTK token optimization. Agents in .github/agents/. Task artifacts in .tasks/{feature}/TASK-YYYY-NNN/." -i critical -k "init,aoi,architecture" 2>$null
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
try { & $icmPath memoir link -m "$ProjectName-architecture" --from "hub-and-spoke" --to "sdd-lifecycle" -r depends_on 2>$null } catch { }
Write-Ok "Memoir: architecture graph bootstrapped"

# Fast Briefing: deterministic bootstrap
$briefingsDir = Join-Path $ProjectPath ".specify\memory\briefings"
New-Item -ItemType Directory -Path $briefingsDir -Force | Out-Null
$briefingContent = @"
# $ProjectName — Fast Operational Briefing

- **Workspace**: $ProjectName
- **Architecture**: AOI v4.0.0 (Hub-and-Spoke, SDD Lifecycle, Spatiotemporal Fibers)
- **Harness**: $Harness
- **Memory Protocol**: ICM v0.10+ Protocol v4 (5 Methods: Memories, Memoirs, Facts, Feedback, Transcripts)
- **Health**: Governed via \`pnpm aoi:doctor\`
"@
Set-Content -LiteralPath (Join-Path $briefingsDir "active-briefing.md") -Value $briefingContent -Encoding utf8
Write-Ok "Briefing: deterministic active-briefing.md initialized"

Write-Header "Phase 6: Base-Project Map"
# Pre-seed a base-project roots PROPOSAL by running the detector. This NEVER
# writes .specify/memory/base-project.json — the confirmed write happens in
# /init after the Owner approves/corrects the proposal.
$baseMapDetector = Join-Path $ProjectPath "scripts\sandbox\detect-base-project.mjs"
$nodePath = Get-ExecutablePath -Name "node"
if ($nodePath -and (Test-Path -LiteralPath $baseMapDetector -PathType Leaf)) {
    Write-Info "Detecting base-project roots (proposal only, not written)..."
    try {
        Push-Location $ProjectPath
        $baseMapProposal = & $nodePath $baseMapDetector 2>$null
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

Write-Header "Phase 7: Configuration Snapshot"
$confSnapshotScript = Join-Path $PSScriptRoot "scripts\conf\snapshot-conf.sh"
$bashPath = Get-ExecutablePath -Name "bash"
if ($bashPath -and (Test-Path -LiteralPath $confSnapshotScript -PathType Leaf)) {
    $confAction = "install"
    if (Test-Path -LiteralPath (Join-Path $ProjectPath ".conf\manifest.json")) {
        $confAction = "reinstall"
    }
    Write-Info "Generating configuration snapshot (.conf/)..."
    try {
        Push-Location $ProjectPath
        $confResult = & $bashPath $confSnapshotScript $ScaffoldDir $ProjectPath $confAction "0.1.x" 2>&1
        Pop-Location
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Configuration snapshot persisted to .conf/"
        } else {
            Write-Warn "Configuration snapshot failed (exit $LASTEXITCODE) — smart reinstall may not work on next run"
        }
    } catch {
        Write-Warn "Configuration snapshot failed — bash not available. Smart reinstall unavailable on Windows."
        Write-Warn "Install Git Bash or WSL to enable smart reinstall with conflict detection."
    }
} else {
    Write-Warn "bash or snapshot-conf.sh not found — skipping Phase 7. Smart reinstall unavailable."
    Write-Warn "Install Git Bash to enable smart reinstall with conflict detection."
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

$cbmPath = Get-CodebaseMemoryPath
if ($cbmPath) {
    Write-Host "    ✓ Codebase Memory MCP   $(Get-CommandOutput -BinaryPath $cbmPath -Arguments @("--version"))"
} else {
    Write-Host "    ○ Codebase Memory MCP   optional / not installed"
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
Write-Host "    7. Verify workspace health: pnpm aoi:doctor"
Write-Host ""