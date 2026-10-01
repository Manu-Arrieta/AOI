import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
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

// C1 de la auditoría 2026-09-30. La guarda de entrada concatenaba
// `'file://' + argv[1]` y la comparaba con `import.meta.url`, que lleva `%20`
// donde la ruta lleva un espacio. Este repositorio vive bajo "GITHUB MIGRATION":
// `pnpm test:dashboard` salía 0 sin imprimir nada y la cadena daba verde sin
// haber corrido un solo test del dashboard. Los casos de arriba importan el
// módulo y nunca pasan por la guarda; éste corre el CLI desde una ruta con
// espacio, que es la única forma de ver el defecto.
test('C1: el CLI responde cuando su ruta lleva un espacio', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi dashboard guard-'))
  const here = path.dirname(fileURLToPath(import.meta.url))
  const root = workspace('core')
  try {
    const cli = path.join(base, 'scripts', 'multi-harness', 'dashboard-command.mjs')
    fs.mkdirSync(path.dirname(cli), { recursive: true })
    fs.copyFileSync(path.join(here, 'dashboard-command.mjs'), cli)
    fs.copyFileSync(path.join(here, '..', 'installation-profiles.mjs'), path.join(base, 'scripts', 'installation-profiles.mjs'))

    const ran = spawnSync('node', [cli, 'test'], { cwd: root, encoding: 'utf8' })
    assert.equal(ran.status, 0, ran.stderr)
    assert.match(ran.stdout, /Dashboard test omitido/, 'la guarda no disparó: el CLI salió sin imprimir nada')

    // Un comando desconocido tampoco puede leerse como éxito.
    const bogus = spawnSync('node', [cli, 'bogus'], { cwd: root, encoding: 'utf8' })
    assert.equal(bogus.status, 2, `un comando desconocido salió ${bogus.status}`)
    assert.match(bogus.stderr, /recibido: "bogus"/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(base, { recursive: true, force: true })
  }
})
