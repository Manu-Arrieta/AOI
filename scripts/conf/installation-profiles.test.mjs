import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const POSIX = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')
const WINDOWS = fs.readFileSync(path.join(REPO, 'setup.ps1'), 'utf8')
const SNAPSHOT = fs.readFileSync(path.join(REPO, 'scripts/conf/snapshot-conf.sh'), 'utf8')
const PACKAGE = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))
const README = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8')
const EXTERNAL_SMOKE_ES = fs.readFileSync(path.join(REPO, 'docs/internal/verification/external-smoke-plan.es.md'), 'utf8')
const EXTERNAL_SMOKE_EN = fs.readFileSync(path.join(REPO, 'docs/internal/verification/external-smoke-plan.md'), 'utf8')

test('BIC-2026-005: both installer entry points expose the same closed profile contract', () => {
  assert.match(POSIX, /export INSTALLATION_PROFILE="core"/)
  assert.match(POSIX, /--profile\)/)
  assert.match(POSIX, /core\) ;;/)
  assert.match(POSIX, /advanced\) PROFILE_INCLUDES_ADVANCED=1/)
  assert.match(POSIX, /dashboard\) PROFILE_INCLUDES_ADVANCED=1; PROFILE_INCLUDES_DASHBOARD=1/)
  assert.match(WINDOWS, /\[ValidateSet\("core", "advanced", "dashboard"\)\]/)
  assert.match(WINDOWS, /\[string\]\$Profile = "core"/)
})

test('BIC-2026-005: Core prevents new dashboard copies without deleting an existing one', () => {
  assert.match(POSIX, /SCAFFOLD_COPY_EXCLUDE\+=\("--exclude=aoi_apps\/"\)/)
  assert.match(POSIX, /profile_excludes_relative_path "\$file" && continue/)
  assert.match(WINDOWS, /function Test-InstallationProfileExcludedPath/)
  assert.match(WINDOWS, /-ExcludedRelativePrefixes \$ProfileExcludedRelativePrefixes/)

  // The safety property is directional: a Core selection may skip future AOI
  // copies but must never clean a dashboard an owner already has.
  assert.doesNotMatch(POSIX, /rm -rf "\$PROJECT_PATH\/aoi_apps/)
  assert.doesNotMatch(WINDOWS, /Remove-Item[^\n]*aoi_apps\\agentic-ops-dashboard/)
})

test('BIC-2026-005: Advanced is the sole path that installs its integrations', () => {
  assert.match(POSIX, /elif \[\[ -f "\$SCRIPT_DIR\/scripts\/install-codebase-memory\.sh" \]\]; then[\s\S]*if ! bash "\$SCRIPT_DIR\/scripts\/install-codebase-memory\.sh"[\s\S]*exit 1/)
  assert.match(WINDOWS, /if \(\$ProfileIncludesAdvanced\) \{[\s\S]*\$codebaseMemoryInstall[\s\S]*catch \{[\s\S]*exit 1/)
  assert.match(POSIX, /Core profile: Codebase Memory MCP is not installed/)
  assert.match(WINDOWS, /Core profile: advanced Headroom integration and Codebase Memory MCP are not installed/)
})

test('BIC-2026-005: profile persists before dashboard-safe commands inspect it', () => {
  assert.match(SNAPSHOT, /"installation_profile": "\$INSTALLATION_PROFILE"/)
  assert.match(POSIX, /"0\.1\.x" "\$INSTALLATION_PROFILE"/)
  assert.match(WINDOWS, /\$confAction "0\.1\.x" \$Profile/)
  for (const name of ['dev:dashboard', 'build:dashboard', 'preview:dashboard', 'prepare:dashboard', 'test:dashboard']) {
    assert.match(PACKAGE.scripts[name], /dashboard-command\.mjs/)
    assert.doesNotMatch(PACKAGE.scripts[name], /cd aoi_apps/)
  }
})

test('BIC-2026-005: install and external-smoke guidance preserve the Core-default contract', () => {
  assert.match(README, /`core` es el perfil predeterminado/)
  assert.match(README, /--profile advanced/)
  assert.match(README, /--profile dashboard/)
  assert.match(README, /Está incluido en los perfiles `advanced` y `dashboard`/)

  for (const smokePlan of [EXTERNAL_SMOKE_ES, EXTERNAL_SMOKE_EN]) {
    assert.match(smokePlan, /setup\.sh" --profile core/)
    assert.match(smokePlan, /-Profile core/)
    assert.match(smokePlan, /--profile dashboard/)
    assert.match(smokePlan, /-Profile dashboard/)
  }
})
