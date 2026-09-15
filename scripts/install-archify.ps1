#!/usr/bin/env pwsh
# scripts/install-archify.ps1 — Archify skill installer (diagram authoring gate).
#
# Contraparte PowerShell de install-archify.sh. Archify compila un JSON-IR tipado
# a un diagrama HTML autocontenido y validado. AOI lo usa en la Fase -2
# (`/sdd-genesis`) para dos cosas, y ninguna es un ahorro de tokens:
#
#   1. Un diagrama `sequence` por cada cruce de frontera declarado — el artefacto
#      que la Blueprint Gate exige cuando dice que un cruce debe tener un flujo.
#   2. `Architecture Delta` entre dos blueprints validados, que es lo que detecta
#      deriva cuando un SBC acoplado cambia bajo otro.
#
# Se instala GLOBAL y deliberadamente NO se vendoriza en el repositorio:
# `.agents/skills` es una ruta gobernada, y meter ahí un skill de terceros haría
# que la paridad del scaffold exigiera una copia byte a byte de upstream.
#
# Invocaciones:
#   pwsh scripts/install-archify.ps1            # interactivo
#   pwsh scripts/install-archify.ps1 -Yes       # no interactivo
#   pwsh scripts/install-archify.ps1 -Update    # reinstalar / refrescar
#   pwsh scripts/install-archify.ps1 -DryRun    # solo previsualizar

[CmdletBinding()]
param(
    [switch]$Yes,
    [switch]$DryRun,
    [switch]$Update
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Las raíces globales de skills que leen los harnesses de AOI: `codex` resuelve a
# ~/.agents/skills (raíz de Codex/Antigravity) y `claude-code` a ~/.claude/skills.
$SkillAgents = @("codex", "claude-code")
$SkillSpec = "tt-a1i/archify"
$SkillName = "archify"

function Write-Info { param([string]$Message) Write-Host "▸ $Message" -ForegroundColor Blue }
function Write-Ok   { param([string]$Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Err  { param([string]$Message) Write-Host "✗ $Message" -ForegroundColor Red }

function Get-ArchifyCandidates {
    return @(
        (Join-Path $HOME ".agents/skills/$SkillName/bin/archify.mjs"),
        (Join-Path $HOME ".claude/skills/$SkillName/bin/archify.mjs"),
        (Join-Path $HOME ".agents/skills/$SkillName/$SkillName/bin/archify.mjs"),
        (Join-Path $HOME ".claude/skills/$SkillName/$SkillName/bin/archify.mjs")
    )
}

# Verifica LOCALIZANDO el renderizador, no confiando en el código de salida del
# instalador: el CLI `skills` sale 0 en los comandos que acepta, haya escrito o
# no un destino que este repositorio pueda alcanzar.
function Find-Archify {
    foreach ($candidate in Get-ArchifyCandidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    return $null
}

function Install-ForAgent {
    param([string]$Agent)
    # `--copy` en vez de symlink a propósito: un skill enlazado se rompe cuando se
    # poda la caché del CLI, y fijar esta herramienta es por determinismo.
    & npx -y skills add $SkillSpec --skill $SkillName --agent $Agent --global --copy --yes
}

Write-Host ""
Write-Host "═══ AOI Archify installer ═══" -ForegroundColor Cyan
Write-Host ""
Write-Info "Rol en AOI: determinismo y detección de deriva arquitectónica — NO ahorro de tokens."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Archify requires Node.js, and no node binary was found."
    exit 1
}

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Err "Archify is distributed through the 'skills' CLI; npx is required."
    exit 1
}

$currentBin = Find-Archify
if ($currentBin -and -not $Update) {
    if ($Yes) {
        Write-Ok "archify already installed ($currentBin)"
        exit 0
    }

    $choice = Read-Host "▸ archify already installed at $currentBin. [U]pdate / [K]eep? [k]"
    if ($choice -notmatch '^[uU]') {
        Write-Ok "archify kept ($currentBin)"
        exit 0
    }
    $Update = $true
}

if ($DryRun) {
    foreach ($agent in $SkillAgents) {
        Write-Info "[DRY-RUN] npx -y skills add $SkillSpec --skill $SkillName --agent $agent --global --copy --yes"
    }
    Write-Info "[DRY-RUN] verificaré luego: $(Join-Path $HOME ".agents/skills/$SkillName/bin/archify.mjs")"
    exit 0
}

foreach ($agent in $SkillAgents) {
    Write-Info "Instalando para '$agent'..."
    try {
        Install-ForAgent -Agent $agent
    } catch {
        Write-Warn "el CLI falló para '$agent' — sigo con el resto."
    }
}

$currentBin = Find-Archify
if (-not $currentBin) {
    Write-Err "El instalador terminó pero el renderizador no está en ninguna ruta esperada."
    Write-Err "Se esperaba algo como: $(Join-Path $HOME ".agents/skills/$SkillName/bin/archify.mjs")"
    Write-Err "Sin el renderizador, la compuerta de diagrama no puede satisfacerse."
    exit 1
}

# El chequeo de update hace egress de red contra un manifest fijo. AOI lo corta:
# un instrumento que se conecta solo para avisar de una versión nueva introduce
# una dependencia de red en un flujo que se define por ser determinista.
$env:ARCHIFY_UPDATE_CHECK_DISABLED = "1"

Write-Ok "archify ready ($currentBin)"
Write-Info "ARCHIFY_UPDATE_CHECK_DISABLED=1 — el chequeo de actualización queda desactivado."
Write-Info "Verificación: node `"$currentBin`" doctor"
