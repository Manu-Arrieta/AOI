# scripts/nvidia-vscode-setup.ps1 — Optional NVIDIA customendpoint setup for VS Code (Windows)
#
# Detects the local VS Code User dir (resolving both `%APPDATA%\Code\User\` and
# `%APPDATA%\Roaming\Code\User\` forms — they are equivalent on Windows, but the
# latter is the fully-expanded form that some installations/portable setups
# require). Copies the AOI scaffold `.vscode/ChatLanguageModel.example.json`,
# and reminds the operator to replace the placeholder API key. Never touches git
# or commits secrets.
#
# Invocation:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nvidia-vscode-setup.ps1                    # prompt
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nvidia-vscode-setup.ps1 -Yes               # skip confirm
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nvidia-vscode-setup.ps1 -ApiKey <KEY>      # apply API key
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nvidia-vscode-setup.ps1 -DryRun            # print, do not run
#
# Exit codes:
#   0  ok (or skipped by design)
#   1  fatal error
#   2  vscode user dir not found (operator can continue without)
#   3  api key still placeholder after copy (operator reminder)

[CmdletBinding()]
param(
  [switch]$Yes,
  [switch]$DryRun,
  [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot  = Split-Path -Parent $ScriptDir
$TemplateFile = Join-Path $RepoRoot "scaffold/.vscode/ChatLanguageModel.example.json"
$Placeholder  = "APIKEY-CONFIGURADA-PREVIAMENTE"

if (-not (Test-Path $TemplateFile)) {
  Write-Host "✗ Template missing: $TemplateFile" -ForegroundColor Red
  exit 1
}

function Info($msg)  { Write-Host "▸ $msg" -ForegroundColor Blue }
function Ok($msg)    { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Err($msg)   { Write-Host "✗ $msg" -ForegroundColor Red }
function Header($msg){ Write-Host ""; Write-Host "═══ $msg ═══" -ForegroundColor Cyan; Write-Host "" }

# Locate VS Code User dir with dual-path resolution.
#
# Both forms are equivalent on Windows:
#   - "$env:APPDATA\Code\User"           ← what `$env:APPDATA` resolves to when set
#   - "$env:APPDATA\Roaming\Code\User"   ← fully-expanded form (`%APPDATA%\Roaming` ↔ `%APPDATA%`)
# The expanded form is needed in some standalone/portable setups where `%APPDATA%`
# is unset or where the operator follows a docs link that explicitly writes
# `\Roaming\`. We try both and pick the first one that exists. Mirrors the
# fallback used by `scaffold/aoi_apps/agentic-ops-dashboard/server/utils/token-observability/collect-copilot-token-usage.ts`.
$VscodeUserDir = $null
$VscodeUserCandidates = @()
if (-not [string]::IsNullOrEmpty($env:APPDATA)) {
  $VscodeUserCandidates += Join-Path $env:APPDATA "Code\User"
  $VscodeUserCandidates += Join-Path $env:APPDATA "Roaming\Code\User"
}
$VscodeUserCandidates += Join-Path $env:LOCALAPPDATA "Code\User"        # fallback for portable installs
$VscodeUserCandidates += Join-Path $env:LOCALAPPDATA "Roaming\Code\User"

foreach ($candidate in $VscodeUserCandidates) {
  if (Test-Path $candidate) {
    $VscodeUserDir = $candidate
    break
  }
}

if (-not $VscodeUserDir) {
  Warn "VS Code User dir not found. Tried:"
  foreach ($candidate in $VscodeUserCandidates) { Warn "  - $candidate" }
  Warn "Skip opcional sin bloquear. (Operator puede crear manualmente y reintentar.)"
  exit 2
}

$DestFile = Join-Path $VscodeUserDir "ChatLanguageModel.json"

# ── Profile-aware destination resolution ──────────────────────────────────────
# VS Code profiles re-route chatLanguageModels.json to
#   profiles/<profile-id>/chatLanguageModels.json
# when the workspace is associated with a non-default profile.
$StorageFile = Join-Path $VscodeUserDir "globalStorage\storage.json"
if (Test-Path $StorageFile) {
  try {
    $storage = Get-Content $StorageFile -Raw | ConvertFrom-Json
    $workspaceUri = "file://$RepoRoot" -replace '\\', '/'
    $profileId = $storage.profileAssociations.workspaces.PSObject.Properties |
      Where-Object { $_.Name -eq $workspaceUri } |
      ForEach-Object { $_.Value }

    if ($profileId -and $profileId -ne '__default__profile__') {
      $ProfileDest = Join-Path $VscodeUserDir "profiles\$profileId\chatLanguageModels.json"
      if (Test-Path (Split-Path $ProfileDest -Parent)) {
        $DestFile = $ProfileDest
      }
    }
  } catch {
    # storage.json parse failed — fall back to root destination
  }
}

Header "NVIDIA customendpoint setup (opcional)"
Info "VS Code User dir detectado: $VscodeUserDir"
Info "Template origen:   $TemplateFile"
Info "Archivo destino:   $DestFile"
if ($DestFile -match 'profiles\\(.+)\\') {
  Info "  ️ → Workspace usa perfil VS Code ($($Matches[1])): la configuración de modelos se aplica a este perfil."
}

# Re-entry check
if (Test-Path $DestFile) {
  Warn "El archivo destino ya existe: $DestFile"
  if (-not $Yes) {
    $overwrite = Read-Host "▸ Sobrescribir el archivo existente? [y/N]"
    if ($overwrite -notmatch '^[yY]([eE][sS])?$') {
      Warn "Skipped por elección del operador. AOI continúa con defaults vendor-copilot."
      exit 0
    }
  }
}

# Consent (skip with -Yes, -DryRun, or -ApiKey)
if (-not $Yes -and -not $DryRun -and [string]::IsNullOrEmpty($ApiKey)) {
  $consent = Read-Host "▸ ¿Copiar template NVIDIA al VS Code User dir? [y/N]"
  if ($consent -notmatch '^[yY]([eE][sS])?$') {
    Warn "Skipped por elección del operador. AOI continúa con defaults vendor-copilot."
    exit 0
  }
}

if ($DryRun) {
  Info "[DRY-RUN] mkdir -p \"$VscodeUserDir\""
  Info "[DRY-RUN] copy \"$TemplateFile\" -> \"$DestFile\""
  if (-not [string]::IsNullOrEmpty($ApiKey)) {
    Info "[DRY-RUN] replace '$Placeholder' with supplied API key (hidden)"
  } else {
    Info "[DRY-RUN] no -ApiKey provided: destino conserva placeholder"
  }
  Ok "DRY-RUN completado"
  exit 0
}

New-Item -ItemType Directory -Force -Path $VscodeUserDir | Out-Null
Copy-Item -Path $TemplateFile -Destination $DestFile -Force

if (-not [string]::IsNullOrEmpty($ApiKey)) {
  (Get-Content $DestFile -Raw) -replace $Placeholder, $ApiKey | Set-Content -Path $DestFile -NoNewline
  Ok "API key reemplazada en $DestFile"
} else {
  Warn "Destino conserva placeholder '$Placeholder'. El operador debe editarlo manualmente."
  Warn "Editá: $DestFile"
}

Ok "NVIDIA customendpoint listo en $DestFile"
Warn "Recordatorio: NUNCA committear $DestFile. Está en .gitignore ('ChatLanguageModel.json', tracked: 'ChatLanguageModel.example.json')."
Warn "Si NO reemplazás la API key, los modelos NVIDIA NO estarán accesibles — AOI continuará con defaults vendor-copilot (Gemini 3.1 Pro Preview / GPT-5.4 xhigh)."

exit 0
