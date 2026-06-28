# scripts/aoi-headroom-wrap.ps1 — Mandatory wrapper for GitHub Copilot CLI invocations (Windows).
#
# Mirrors scripts/aoi-headroom-wrap.sh via AOI dual-sync. Refuses to run when
# `headroom` is missing on PATH and re-execs `headroom wrap copilot --subscription`
# preserving argv. Honor exit codes transparently.

[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$Args
)

if ($Args -contains "--aoi-bypass") {
  Write-Host "[aoi-headroom-wrap] BYPASS requested — Headroom mandatory policy violated." -ForegroundColor Red
  Write-Host "    File an explicit override ticket or remove --aoi-bypass from the call site." -ForegroundColor Red
  exit 78
}

$headroomCmd = Get-Command headroom -ErrorAction SilentlyContinue
if (-not $headroomCmd) {
  Write-Host "[FAIL] headroom not found in PATH. Headroom is MANDATORY for AOI." -ForegroundColor Red
  Write-Host "    Re-run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-headroom.ps1 -Yes" -ForegroundColor Red
  Write-Host "    Aborted by AOI bootstrap policy." -ForegroundColor Red
  exit 127
}

if (-not $Args -or $Args.Count -eq 0) {
  Write-Host "[USAGE] aoi-headroom-wrap <copilot args>" -ForegroundColor Yellow
  Write-Host "    Example: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/aoi-headroom-wrap.ps1 --model gpt-4o" -ForegroundColor Yellow
  exit 64
}

Write-Host "[aoi-headroom-wrap] routing through headroom wrap copilot" -ForegroundColor Cyan
& headroom wrap copilot --subscription @Args
exit $LASTEXITCODE
