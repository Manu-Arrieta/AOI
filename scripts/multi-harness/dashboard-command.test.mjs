import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { DASHBOARD_DIRECTORY, resolveDashboardCommand, runDashboardCommand } from './dashboard-command.mjs'

function workspace(profile, withDashboard = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-dashboard-command-'))
  fs.mkdirSync(path.join(root, '.conf'), { recursive: true })
  fs.writeFileSync(path.join(root, '.conf', 'manifest.json'), JSON.stringify({ installation_profile: profile }))
  if (withDashboard) {
    const packagePath = path.join(root, DASHBOARD_DIRECTORY, 'package.json')
    fs.mkdirSync(path.dirname(packagePath), { recursive: true })
    fs.writeFileSync(packagePath, '{}\n')
  }
  return root
}

test('BIC-2026-005: Core test does not fail merely because the optional dashboard is absent', () => {
  const root = workspace('core')
  try {
    assert.deepEqual(resolveDashboardCommand(root, 'test'), {
      mode: 'skip', profile: 'core', reason: 'el perfil core no instala el dashboard auxiliar',
    })
    assert.equal(runDashboardCommand(root, 'test', () => { throw new Error('no debe ejecutar pnpm') }), 0)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('BIC-2026-005: Dashboard profile exposes a missing app instead of reporting a false skip', () => {
  const root = workspace('dashboard')
  try {
    assert.equal(resolveDashboardCommand(root, 'test').mode, 'error')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('BIC-2026-005: a selected dashboard runs preparation before its test', () => {
  const root = workspace('dashboard', true)
  const calls = []
  try {
    const result = runDashboardCommand(root, 'test', (command, args) => {
      calls.push([command, args])
      return { status: 0 }
    })
    assert.equal(result, 0)
    assert.deepEqual(calls.map(([, args]) => args.at(-1)), ['prepare', 'test'])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
