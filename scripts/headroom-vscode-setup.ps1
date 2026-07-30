# scripts/headroom-vscode-setup.ps1 — Print Headroom runtime env plan (Windows).
#
# Does NOT write secrets to VS Code ChatLanguageModel.json (NVIDIA layer is
# orthogonal). Prints an actionable env-var plan + PowerShell snippet for the
# operator. Idempotent / read-only. Never auto-edits $PROFILE silently.
#
# Invocations:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/headroom-vscode-setup.ps1                    # info
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/headroom-vscode-setup.ps1 -EmitPowerShell   # snippet
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/headroom-vscode-setup.ps1 -DryRun          # alias of -EmitPowerShell

[CmdletBinding()]
param(
  [switch]$EmitPowerShell,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot  = Split-Path -Parent $ScriptDir

function Info($msg)  { Write-Host "▸ $msg" -ForegroundColor Blue }
function Ok($msg)    { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Header($msg){ Write-Host ""; Write-Host "═══ $msg ═══" -ForegroundColor Cyan; Write-Host "" }

if ($EmitPowerShell -or $DryRun) {
  @'

# Headroom runtime env (adjacent to AOI bootstrapper — does NOT touch VS Code
# ChatLanguageModel.json which belongs to NVIDIA customendpoint layer)
$env:HEADROOM_HOST = "127.0.0.1"
$env:HEADROOM_PORT = "8787"
$env:HEADROOM_PROXY_PORT = "8787"
# Optional: GitHub Copilot CLI token for `headroom wrap copilot --subscription`
# $env:GITHUB_COPILOT_TOKEN = "ghp_xxxxx"            # OR run `headroom copilot-auth login`
# Optional: opt-out of in-proxy update check
# $env:HEADROOM_UPDATE_CHECK = "off"
# Optional: output shaper (off by default)
# $env:HEADROOM_OUTPUT_SHAPER = "1"
'@
  exit 0
}

Header "Headroom config plan"
Info "Headroom NO toca archivos VS Code. Se configura por envvars."
Info "Este bootstrap NO modifica automáticamente `$PROFILE silenciosamente."

Info ""
Info "-- Pasos opcionales para el operador --"
Write-Host "  1. (Persistir env vars) Pegar este snippet al inicio de `$PROFILE:`" -ForegroundColor Blue
Write-Host ""
Write-Host "      # Headroom (env vars persistente)" -ForegroundColor DarkGray
Write-Host "      `$env:HEADROOM_HOST = '127.0.0.1'" -ForegroundColor DarkGray
Write-Host "      `$env:HEADROOM_PORT = '8787'" -ForegroundColor DarkGray
Write-Host "      `$env:HEADROOM_PROXY_PORT = '8787'" -ForegroundColor DarkGray
Write-Host "" -ForegroundColor DarkGray
Write-Host "  2. (Opcional) Autenticar GitHub Copilot CLI subscription:" -ForegroundColor Blue
Write-Host "      headroom copilot-auth login" -ForegroundColor Blue
Write-Host ""
Write-Host "  3. (Opcional) Activar el proxy:" -ForegroundColor Blue
Write-Host "      headroom proxy --port `$env:HEADROOM_PORT" -ForegroundColor Blue
Write-Host ""
Write-Host "  4. (Opcional) Wrappear Copilot CLI:" -ForegroundColor Blue
Write-Host "      headroom wrap copilot --subscription -- --model gpt-4o" -ForegroundColor Blue
Write-Host ""

Info "-- Emisión rápida (copy-paste) --"
Warn "-EmitPowerShell / -DryRun imprime el snippet al stdout sin interactividad:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/headroom-vscode-setup.ps1 -EmitPowerShell >> `$PROFILE" -ForegroundColor Blue
Write-Host ""

Header "Avisos importantes"
Warn "headroom learn --apply puede escribir sobre AGENTS.md / CLAUDE.md sin awareness AOI."
Warn "Si usas AOI bootstrapper, NO corras 'headroom learn --apply' sin revisar 'git diff' primero."
Warn "  Recomendación: usar 'headroom learn --dry-run' y mergear manualmente si el diff toca archivos AOI-managed."
Warn "Cuando termines, hacé 'git checkout -- GEMINI.md AGENTS.md CLAUDE.md' para descartar cambios no aprobados."
Write-Host ""

Info "-- Estado actual --"
try {
  $ver = (& headroom --version 2>$null).Trim()
  if ($ver) { Ok "Headroom instalado: $ver" } else { Warn "Headroom NO instalado. Para instalar: powershell .\scripts\install-headroom.ps1" }
} catch { Warn "Headroom NO instalado. Para instalar: powershell .\scripts\install-headroom.ps1" }

$homeDir = $env:USERPROFILE
$headroomDir = Join-Path $homeDir ".headroom"
if (Test-Path $headroomDir) { Ok "Workspace dir detectado: $headroomDir" } else { Info "Workspace dir se creará al primer 'headroom proxy'. Path por default: $headroomDir" }

Ok "Documentación completa: https://headroom-docs.vercel.app/docs/installation"
