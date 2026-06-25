# scripts/install-headroom.ps1 — Optional Headroom (headroom-ai) installation (Windows).
#
# Detects preferred Python package manager in priority order (uv → pipx → pip).
# Defaults to prebuilt wheel where available; on Intel/legacy Windows builds the
# toolchain falls back to source and may require MSVC Build Tools + Rust.
#
# Invocations:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-headroom.ps1                    # interactive
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-headroom.ps1 -Yes               # skip prompts
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-headroom.ps1 -Method uv         # force one method
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-headroom.ps1 -DryRun           # plan only
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-headroom.ps1 -Extras all       # extras selection
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-headroom.ps1 -Update           # upgrade in place
#
# Exit codes:
#   0  ok (or skipped by design)
#   1  fatal error
#   2  no usable python package manager (operator can continue without)
#   3  install failed (operator reminder)

[CmdletBinding()]
param(
  [switch]$Yes,
  [switch]$DryRun,
  [switch]$Update,
  [string]$Method = "",
  [string]$Extras = "all"
)

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot   = Split-Path -Parent $ScriptDir
$Pkg        = "headroom-ai"
$ExtrasSpec = "$Extras"

function Info($msg)  { Write-Host "▸ $msg" -ForegroundColor Blue }
function Ok($msg)    { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Err($msg)   { Write-Host "✗ $msg" -ForegroundColor Red }
function Header($msg){ Write-Host ""; Write-Host "═══ $msg ═══" -ForegroundColor Cyan; Write-Host "" }

# ── Capability detection ────────────────────────────────────────────────────────
function DetectArch { [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() }

function Is-WinLegacy {
  # Source install (build Rust) likely needs MSVC tools. Prebuilt wheels are
  # published for win_amd64 on supported Python versions. Heuristic: anything
  # not win_amd64 OR Python below 3.10 falls back to source.
  try { $py = (Get-Command python -ErrorAction Stop).Source }
  catch { $py = $null }
  if (-not $py) { return $true }
  $ver = (& python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null).Trim()
  $major, $minor = $ver -split "\."
  if ([int]$major -lt 3 -or ([int]$major -eq 3 -and [int]$minor -lt 10)) { return $true }
  return $false
}

function Probe-Installed {
  $ver = $null
  try { $ver = (& headroom --version 2>$null).Trim() } catch { $ver = $null }
  if ($ver) { Ok "Headroom ya instalado ($ver)."; return $true }
  return $false
}

# ── Installer dispatch ───────────────────────────────────────────────────────────
function Install-With-Uv {
  if ($DryRun) { Info "[DRY-RUN] uv tool install --python python3.12 $Pkg[$ExtrasSpec]"; return }
  if ($Update) {
    uv tool install --upgrade $Pkg 2>$null
    if ($LASTEXITCODE -ne 0) { uv tool install --upgrade $Pkg }
  } else {
    uv tool install --python python3.12 "$Pkg[$ExtrasSpec]"
  }
}

function Install-With-Pipx {
  if ($DryRun) { Info "[DRY-RUN] pipx install --python python3.12 $Pkg[$ExtrasSpec]"; return }
  if ($Update) {
    pipx upgrade $Pkg
  } else {
    pipx install --python python3.12 "$Pkg[$ExtrasSpec]"
  }
  if ($LASTEXITCODE -ne 0) { throw "pipx install failed: exitcode=$LASTEXITCODE" }
}

function Install-With-Pip {
  if ($DryRun) { Info "[DRY-RUN] python -m pip install --user --only-binary :all: $Pkg[$ExtrasSpec]"; return }
  python -m pip install --user --only-binary :all: "$Pkg[$ExtrasSpec]"
  if ($LASTEXITCODE -ne 0) { throw "pip install failed: exitcode=$LASTEXITCODE" }
}

function Choose-Method {
  if ($Method -ne "") {
    $cmd = switch ($Method) {
      "uv"   { "uv" }
      "pipx" { "pipx" }
      "pip"  { "python" }
      default { throw "Método desconocido: $Method (use uv|pipx|pip)" }
    }
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
      throw "Método forzado $Method pero $cmd no está en PATH"
    }
    return $Method
  }

  if (Get-Command uv -ErrorAction SilentlyContinue)   { return "uv" }
  if (Get-Command pipx -ErrorAction SilentlyContinue) { return "pipx" }
  if (Get-Command python -ErrorAction SilentlyContinue) { return "pip" }
  throw "No hay Python package manager"
}

# ── Main ────────────────────────────────────────────────────────────────────────
Header "AOI Headroom installer (opcional)"
Info "Paquete target: $Pkg[$ExtrasSpec]"

$arch = DetectArch
$os   = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription
Info "Plataforma: $os / $arch"

if ((Probe-Installed) -and (-not $Update)) {
  Warn "Headroom ya está instalado. Use -Update para actualizar o -Yes para reintentar."
  if (-not $Yes) {
    $ch = Read-Host "▸ ¿Continuar anyway? [y/N]"
    if ($ch -notmatch '^[yY]([eE][sS])?$') { Info "Saltado por elección del operador. AOI continúa."; exit 0 }
  }
}

if (Is-WinLegacy) {
  Warn "Plataforma Windows detectada sin wheel prebuilt garantizado (legacy / Python <3.10 o arch no AMD64)."
  Warn "La instalación compilará desde source (Rust toolchain + MSVC Build Tools requeridos)."
  if (-not $Yes -and -not $DryRun) {
    $ch = Read-Host "▸ ¿Continuar con build from source? [y/N]"
    if ($ch -notmatch '^[yY]([eE][sS])?$') { Warn "Saltado por elección del operador."; exit 0 }
  }
}

try {
  $Method = Choose-Method
} catch {
  Err $_.Exception.Message
  exit 2
}

Info "Method seleccionado: $Method"

# Consent (skip with -Yes or -DryRun)
if (-not $Yes -and -not $DryRun) {
  $ch = Read-Host "▸ ¿Instalar $Pkg[$ExtrasSpec] vía $Method? [y/N]"
  if ($ch -notmatch '^[yY]([eE][sS])?$') { Warn "Saltado por elección del operador. AOI continúa sin Headroom."; exit 0 }
}

$installerError = $null
try {
  switch ($Method) {
    "uv"   { Install-With-Uv }
    "pipx" { Install-With-Pipx }
    "pip"  { Install-With-Pip }
    default { throw "Método no implementado: $Method" }
  }
} catch {
  $installerError = $_.Exception.Message
}

if ($installerError) {
  Err "La instalación de Headroom falló: $installerError"
  Err "Headroom es opcional — AOI continúa sin él. Ver [red/firewall/MsVC/Rust toolchain] e intente de nuevo."
  exit 3
}

if ($DryRun) {
  Ok "[DRY-RUN] Headroom se instalaría vía $Method."
} else {
  Ok "Headroom instalado vía $Method."
  try {
    $ver = (& headroom --version 2>$null).Trim()
    if ($ver) { Ok "Verificación: $ver" } else { Warn "Headroom instalado pero no aparece en PATH actual. Reabrí PowerShell." }
  } catch { Warn "Headroom instalado pero no aparece en PATH actual." }
}

Ok "Installer finalizado."
Warn "Headroom está instalado pero NO está activo. Para activarlo:"
Write-Host "  headroom proxy --port 8787    # proxy OpenAI-compatible en localhost" -ForegroundColor Blue
Write-Host "  headroom wrap copilot --subscription -- --model gpt-4o    # wrappear GitHub Copilot CLI" -ForegroundColor Blue
Warn "AVISO: NO corra 'headroom learn --apply' durante sesiones AOI activas — puede modificar GEMINI.md, AGENTS.md o CLAUDE.md sin awareness AOI. Use --dry-run y revise diff primero."
exit 0
