import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { CBM_BOUNDARIES } from './ensure-cbmignore.mjs'
import { DEFAULT_SYNC_PATHS } from '../scaffold/validate-scaffold-parity.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const POSIX = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')
const WINDOWS = fs.readFileSync(path.join(REPO, 'setup.ps1'), 'utf8')
const ROOT_IGNORE = fs.readFileSync(path.join(REPO, '.cbmignore'), 'utf8')
const SCAFFOLD_IGNORE = fs.readFileSync(path.join(REPO, 'scaffold/.cbmignore'), 'utf8')
const DASHBOARD_IGNORE = fs.readFileSync(path.join(REPO, 'aoi_apps/agentic-ops-dashboard/.cbmignore'), 'utf8')
const SCAFFOLD_DASHBOARD_IGNORE = fs.readFileSync(path.join(REPO, 'scaffold/aoi_apps/agentic-ops-dashboard/.cbmignore'), 'utf8')

function cbmIgnorePatterns(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

function assertControlPlaneBoundary(source) {
  assert.deepEqual(
    cbmIgnorePatterns(source),
    ['scaffold/', 'aoi_apps/'],
    'el grafo de control-plane debe excluir exactamente el espejo y la app auxiliar'
  )
}

function assertDashboardBoundary(source) {
  assert.deepEqual(
    cbmIgnorePatterns(source),
    ['.output/'],
    'el grafo del dashboard debe excluir el bundle Nuxt generado'
  )
}

function between(source, start, end) {
  const startAt = source.indexOf(start)
  const endAt = source.indexOf(end, startAt + start.length)
  assert.notEqual(startAt, -1, `no se encontró el inicio: ${start}`)
  assert.notEqual(endAt, -1, `no se encontró el cierre: ${end}`)
  return source.slice(startAt, endAt)
}

test('BIC-2026-007: la frontera Codebase se instala y se mantiene idéntica en el espejo', () => {
  assertControlPlaneBoundary(ROOT_IGNORE)
  assert.equal(SCAFFOLD_IGNORE, ROOT_IGNORE, '.cbmignore dejó de tener paridad byte a byte')
  assert.ok(DEFAULT_SYNC_PATHS.includes('.cbmignore'), 'la reinstalación no gobierna .cbmignore')
  assertDashboardBoundary(DASHBOARD_IGNORE)
  assert.equal(SCAFFOLD_DASHBOARD_IGNORE, DASHBOARD_IGNORE, 'el .cbmignore del dashboard dejó de tener paridad byte a byte')
  assert.ok(DEFAULT_SYNC_PATHS.includes('aoi_apps/agentic-ops-dashboard/.cbmignore'), 'la reinstalación Dashboard no gobierna su .cbmignore')
  assert.match(ROOT_IGNORE, new RegExp(CBM_BOUNDARIES['control-plane'].marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(DASHBOARD_IGNORE, new RegExp(CBM_BOUNDARIES.dashboard.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('BIC-2026-007: control negativo — sin la exclusión dashboard el contrato falla', () => {
  assert.throws(
    () => assertControlPlaneBoundary('scaffold/\n'),
    /aoi_apps/,
    'la prueba no detectó que el dashboard duplicaría símbolos en el grafo principal'
  )
  assert.throws(
    () => assertDashboardBoundary(''),
    /\.output/,
    'la prueba no detectó que el bundle Nuxt contaminara el grafo del dashboard'
  )
})

test('BIC-2026-007: ambos instaladores indexan únicamente después de materializar el workspace', () => {
  const posixPhase18 = between(POSIX, '# ── Phase 1.8: Codebase Memory MCP', '# Reinstall is detected HERE')
  assert.doesNotMatch(posixPhase18, /index_repository/, 'POSIX aún indexa el árbol previo a Phase 3')

  const posixDeferred = between(
    POSIX,
    '# ── Codebase Memory initial graphs (after the workspace is materialized)',
    'if [ "$PROFILE_INCLUDES_DASHBOARD" -eq 1 ] && [ -f "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/package.json" ]; then'
  )
  assert.match(posixDeferred, /if \[ "\$PROFILE_INCLUDES_ADVANCED" -eq 1 \] && \[ -n "\$\{CBM_BIN_INIT:-\}" \]; then/)
  assert.match(posixDeferred, /CBM_INDEX_PATHS=\("\$PROJECT_PATH"\)/)
  assert.match(posixDeferred, /CBM_INDEX_PATHS\+=\("\$CBM_DASHBOARD_PATH"\)/)
  assert.match(posixDeferred, /for CBM_INDEX_PATH in "\$\{CBM_INDEX_PATHS\[@\]\}"; do\s+"\$CBM_BIN_INIT" cli index_repository/)

  const windowsPhase18 = between(WINDOWS, 'Write-Header "Phase 1.8: Codebase Memory MCP (Advanced)"', 'Write-Header "Phase 2: Spec-Kit"')
  assert.doesNotMatch(windowsPhase18, /index_repository/, 'PowerShell aún indexa el árbol previo a Phase 3')
  assert.match(windowsPhase18, /\$CodebaseMemoryInitialIndexPath = \$cbmBinInit/)

  const windowsDeferred = between(
    WINDOWS,
    '# `.cbmignore` keeps the primary graph about the source-of-truth control plane:',
    'if ($ProfileIncludesDashboard -and (Test-Path -LiteralPath (Join-Path $ProjectPath "aoi_apps\\agentic-ops-dashboard\\package.json") -PathType Leaf)) {'
  )
  assert.match(windowsDeferred, /if \(\$ProfileIncludesAdvanced -and \$CodebaseMemoryInitialIndexPath\)/)
  assert.match(windowsDeferred, /\$indexRoots = @\(\$ProjectPath\)/)
  assert.match(windowsDeferred, /\$indexRoots \+= \$dashboardIndexPath/)
  assert.match(windowsDeferred, /foreach \(\$repoPath in @\(\$pathsJson \| ConvertFrom-Json\)\) \{\s+& \$bin cli index_repository/)
})

test('BIC-2026-007: los instaladores materializan la frontera del Owner antes de reflejarla e indexarla', () => {
  const posixBoundary = between(
    POSIX,
    '# An Owner may already have a .cbmignore.',
    'mkdir -p "$PROJECT_PATH/scaffold"'
  )
  assert.match(posixBoundary, /node "\$CBM_BOUNDARY_SCRIPT" --file "\$PROJECT_PATH\/\.cbmignore" --boundary control-plane/)
  assert.match(posixBoundary, /node "\$CBM_BOUNDARY_SCRIPT" --file "\$CBM_DASHBOARD_PATH\/\.cbmignore" --boundary dashboard/)

  const windowsBoundary = between(
    WINDOWS,
    '# An Owner may already have a .cbmignore.',
    '# Replicate scaffold mirror inside target'
  )
  assert.match(windowsBoundary, /& \$nodePath \$cbmBoundaryScript "--file" \(Join-Path \$ProjectPath "\.cbmignore"\) "--boundary" "control-plane"/)
  assert.match(windowsBoundary, /& \$nodePath \$cbmBoundaryScript "--file" \(Join-Path \$cbmDashboardPath "\.cbmignore"\) "--boundary" "dashboard"/)

  const windowsMirror = between(
    WINDOWS,
    '# Replicate scaffold mirror inside target',
    'Prune-UnselectedHarnessFiles -TargetDir $targetScaffoldDir -SelectedHarness $Harness'
  )
  assert.match(windowsMirror, /Copy-Item -LiteralPath \(Join-Path \$ProjectPath "\.cbmignore"\) -Destination \(Join-Path \$targetScaffoldDir "\.cbmignore"\) -Force/)
  assert.match(windowsMirror, /Copy-Item -LiteralPath \$dashboardIgnore -Destination \$mirrorDashboardIgnore -Force/)
})
