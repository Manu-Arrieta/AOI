// copilot-cli-icm-hooks.mjs, siempre contra un HOME desechable: nada acá lee ni
// escribe el ~/.copilot real. Defecto que cubre: sin `icm init --mode hook`,
// una instalación nueva dejaba a Copilot CLI sin ICM (sus hooks de usuario son
// los únicos que disparan en `copilot -p`).

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { COPILOT_CLI_HOOKS, copilotSettingsPath, ensureCopilotHooks, mergeCopilotHooks } from './copilot-cli-icm-hooks.mjs'

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'copilot-cli-icm-hooks.mjs')
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi copilot home '))
after(() => fs.rmSync(ROOT, { recursive: true, force: true }))
const ICM = '/Users/x/.local/bin/icm'
let n = 0
const home = () => {
  const h = path.join(ROOT, `h ${n++}`)
  fs.mkdirSync(h, { recursive: true })
  return h
}
const settingsIn = (h) => path.join(h, '.copilot', 'settings.json')
// Sin AOI_ICM_DB heredado: la cadena de tests puede correr aislada.
const ENV = (h, extra = {}) => {
  const e = { ...process.env, HOME: h, ...extra }
  delete e.COPILOT_HOME
  if (!('AOI_ICM_DB' in extra)) delete e.AOI_ICM_DB
  return e
}
const cli = (h, args, extra) => spawnSync(process.execPath, [CLI, ...args], { env: ENV(h, extra), encoding: 'utf8' })

// Lo que `icm init --mode hook` dejó en ~/.copilot/settings.json en esta máquina.
const ICM_INIT = {
  hooks: {
    sessionStart: [{ type: 'command', bash: `${ICM} hook start`, timeoutSec: 10 }],
    preToolUse: [{ type: 'command', bash: `${ICM} hook pre`, timeoutSec: 5 }],
    postToolUse: [{ type: 'command', bash: `${ICM} hook post`, timeoutSec: 10 }],
    userPromptSubmitted: [{ type: 'command', bash: `${ICM} hook prompt`, timeoutSec: 10 }],
  },
}

describe('los hooks de ICM de Copilot CLI, como los escribía icm init', () => {
  it('archivo ausente → se crea con los cuatro, idénticos a los de icm init', () => {
    const h = home()
    const r = cli(h, ['--icm', ICM])
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsIn(h), 'utf8')), ICM_INIT)
  })

  it('otras claves y entradas se conservan; los hooks de ICM se agregan al final', () => {
    const h = home()
    const mine = { theme: 'dark', trustedFolders: ['/w'], hooks: { sessionStart: [{ type: 'command', bash: 'echo hola' }], agentStop: [{ type: 'command', bash: 'x' }] } }
    fs.mkdirSync(path.dirname(settingsIn(h)), { recursive: true })
    fs.writeFileSync(settingsIn(h), JSON.stringify(mine))
    assert.equal(cli(h, ['--icm', ICM]).status, 0)
    const s = JSON.parse(fs.readFileSync(settingsIn(h), 'utf8'))
    assert.equal(s.theme, 'dark')
    assert.deepEqual(s.trustedFolders, ['/w'])
    assert.deepEqual(s.hooks.agentStop, mine.hooks.agentStop)
    assert.deepEqual(s.hooks.sessionStart, [mine.hooks.sessionStart[0], ICM_INIT.hooks.sessionStart[0]])
  })

  it('ya presentes → no-op: ni duplica ni reescribe el archivo', () => {
    const h = home()
    fs.mkdirSync(path.dirname(settingsIn(h)), { recursive: true })
    const body = JSON.stringify(ICM_INIT)
    fs.writeFileSync(settingsIn(h), body)
    const r = cli(h, ['--icm', '/otro/icm'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /ya tenía/)
    assert.equal(fs.readFileSync(settingsIn(h), 'utf8'), body)
  })

  it('un evento con su modo ya cableado (otro binario, con --db) se saltea; los demás se agregan', () => {
    const cur = { hooks: { preToolUse: [{ type: 'command', bash: '"/a b/icm" --db /x.db hook pre' }] } }
    const r = mergeCopilotHooks(cur, ICM)
    assert.deepEqual(r.skipped, ['preToolUse'])
    assert.deepEqual(r.added, ['sessionStart', 'postToolUse', 'userPromptSubmitted'])
    assert.equal(r.settings.hooks.preToolUse.length, 1)
  })

  it('no confunde otro modo ni otro programa con el que falta', () => {
    const cur = { hooks: { sessionStart: [{ bash: `${ICM} hook prompt` }, { bash: 'myicm hook start' }] } }
    assert.ok(mergeCopilotHooks(cur, ICM).added.includes('sessionStart'))
  })

  it('JSON ilegible → no se toca y avisa (exit 1)', () => {
    const h = home()
    fs.mkdirSync(path.dirname(settingsIn(h)), { recursive: true })
    fs.writeFileSync(settingsIn(h), '{ roto')
    const r = cli(h, ['--icm', ICM])
    assert.equal(r.status, 1)
    assert.match(r.stdout, /no es JSON válido/)
    assert.equal(fs.readFileSync(settingsIn(h), 'utf8'), '{ roto')
  })

  it('una forma que no es la esperada (hooks lista, evento objeto) tampoco se toca', () => {
    assert.match(mergeCopilotHooks({ hooks: [] }, ICM).error, /no es un objeto/)
    assert.match(mergeCopilotHooks({ hooks: { sessionStart: {} } }, ICM).error, /no es una lista/)
    assert.match(mergeCopilotHooks([], ICM).error, /no es un objeto JSON/)
  })

  it('ICM aislado (AOI_ICM_DB) → no escribe nada', () => {
    const h = home()
    const r = cli(h, ['--icm', ICM], { AOI_ICM_DB: path.join(h, 'x.db') })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /aislado/)
    assert.ok(!fs.existsSync(path.join(h, '.copilot')))
  })

  it('una ruta de icm relativa o ausente se rechaza; un flag desconocido sale 2', () => {
    const h = home()
    assert.equal(cli(h, ['--icm', 'icm']).status, 1)
    assert.equal(cli(h, []).status, 1)
    assert.equal(cli(h, ['--icn', ICM]).status, 2)
    assert.ok(!fs.existsSync(path.join(h, '.copilot')))
  })

  it('un binario con espacios va citado', () => {
    const file = path.join(home(), 's.json')
    assert.equal(ensureCopilotHooks({ file, icmBin: '/a b/icm', env: {} }).status, 'written')
    const s = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.deepEqual(COPILOT_CLI_HOOKS.map(([ev, mode]) => s.hooks[ev][0].bash), COPILOT_CLI_HOOKS.map(([, m]) => `"/a b/icm" hook ${m}`))
  })

  it('COPILOT_HOME mueve el archivo; sin ella es ~/.copilot', () => {
    assert.equal(copilotSettingsPath({ HOME: '/h' }), path.join('/h', '.copilot', 'settings.json'))
    assert.equal(copilotSettingsPath({ HOME: '/h', COPILOT_HOME: '/c' }), path.join('/c', 'settings.json'))
  })
})

describe('setup.sh cablea Copilot CLI sin icm init --mode hook', () => {
  const live = fs
    .readFileSync(path.join(path.dirname(CLI), '../../setup.sh'), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
  it('invoca este módulo con el icm resuelto', () => {
    assert.ok(live.some((l) => /copilot-cli-icm-hooks\.mjs/.test(l)))
    assert.ok(live.some((l) => /--icm\s+"\$\(command -v icm\)"/.test(l)))
  })
})
