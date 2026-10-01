import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  claudeEntry,
  dedupsAtRuntime,
  findIcm,
  icmMode,
  matcherCovers,
  planClaude,
  readUserHooks,
  scriptOf,
  settingsHandlers,
  userIcmModes,
  userSettingsPath,
} from './claude-hook-plan.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aoi hook plan '))
const userScope = (bin, modes) =>
  Object.fromEntries(
    Object.entries(modes).map(([event, [mode, matcher]]) => [
      event,
      [{ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: `${bin} hook ${mode}` }] }],
    ]),
  )

describe('icmMode reconoce el modo que un comando termina corriendo', () => {
  it('directo, con flags globales, por el wrapper y con la ruta citada', () => {
    assert.equal(icmMode('/Users/x/.local/bin/icm hook prompt'), 'prompt')
    assert.equal(icmMode('icm --db /tmp/x.db hook post'), 'post')
    assert.equal(icmMode('bash .github/scripts/icm-hook.sh start'), 'start')
    assert.equal(icmMode('bash "${CLAUDE_PROJECT_DIR:-.}/.github/scripts/icm-hook.sh" pre'), 'pre')
  })

  it('no confunde otros hooks con ICM', () => {
    assert.equal(icmMode('bash .github/scripts/rtk-hook.sh claude'), null)
    assert.equal(icmMode('rtk hook claude'), null)
    assert.equal(icmMode('bash .github/scripts/session-init-hook.sh'), null)
  })
})

describe('claudeEntry: lo que se escribe para Claude Code', () => {
  it('ancla el script al proyecto con CLAUDE_PROJECT_DIR, citado por los espacios', () => {
    // Regresión: 42-43 disparos × 4 hooks fallaron con "No such file or
    // directory" porque `bash .github/...` resolvía contra el cwd del shell.
    const c = claudeEntry('SessionStart', { command: 'bash .github/scripts/icm-hook.sh start', timeout: 10 })
    assert.equal(c.command, 'bash "${CLAUDE_PROJECT_DIR:-.}/.github/scripts/icm-hook.sh" start claude')
    assert.equal(c.timeout, 10)
    assert.equal(scriptOf(c.command).script, '${CLAUDE_PROJECT_DIR:-.}/.github/scripts/icm-hook.sh')
  })

  it('pone a rtk-hook.sh en el dialecto de Claude', () => {
    const c = claudeEntry('PreToolUse', { command: 'bash .github/scripts/rtk-hook.sh' })
    assert.match(c.command, /rtk-hook\.sh" claude$/)
    assert.equal(c.matcher, 'Bash')
  })

  it('lleva el cierre de sesión a SessionEnd, no a Stop (que corre cada turno)', () => {
    const c = claudeEntry('Stop', { command: 'bash .github/scripts/session-close-hook.sh' })
    assert.equal(c.event, 'SessionEnd')
    assert.equal(c.matcher, undefined)
  })

  it('no toca un comando absoluto ni uno que no es bash', () => {
    assert.equal(claudeEntry('PreToolUse', { command: '/bin/foo --x' }).command, '/bin/foo --x')
    assert.equal(claudeEntry('PreToolUse', { command: 'bash /abs/x.sh' }).command, 'bash /abs/x.sh')
  })
})

describe('el scope de usuario se lee y nunca se escribe', () => {
  it('CLAUDE_CONFIG_DIR mueve el settings de usuario, como en Claude Code', () => {
    assert.equal(userSettingsPath({ CLAUDE_CONFIG_DIR: '/c' }), path.join('/c', 'settings.json'))
    assert.equal(userSettingsPath({}), path.join(os.homedir(), '.claude', 'settings.json'))
  })

  it('un settings ilegible o ausente es un scope vacío, y leerlo no lo modifica', () => {
    const dir = tmp()
    const file = path.join(dir, 'settings.json')
    assert.deepEqual(readUserHooks(file), {})
    fs.writeFileSync(file, '{ roto')
    assert.deepEqual(readUserHooks(file), {})
    const body = JSON.stringify({ hooks: { SessionStart: [] }, theme: 'dark' })
    fs.writeFileSync(file, body)
    assert.deepEqual(readUserHooks(file), { SessionStart: [] })
    assert.equal(fs.readFileSync(file, 'utf8'), body)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('un matcher ausente o * cubre todo; uno distinto, no', () => {
    assert.ok(matcherCovers(undefined, 'Bash'))
    assert.ok(matcherCovers('*', 'Bash'))
    assert.ok(matcherCovers('Bash|Edit', 'Bash'))
    assert.ok(!matcherCovers('Edit', 'Bash'))
    assert.ok(!matcherCovers('Bash', undefined))
  })

  it('una entrada de usuario con el binario borrado no cubre al proyecto', () => {
    // `icm init --force` existe por esto: una entrada vieja no inyecta nada.
    const dead = userScope('/no/existe/icm', { SessionStart: ['start'] })
    assert.equal(userIcmModes(dead, 'SessionStart').size, 0)
    // Sin ruta absoluta no hay qué comprobar: se resuelve por PATH y cuenta.
    assert.deepEqual([...userIcmModes(userScope('icm', { SessionStart: ['start'] }), 'SessionStart')], ['start'])
  })
})

describe('planClaude no depende de la máquina que lo corre', () => {
  const icmJson = {
    source: '.github/hooks/icm.json',
    hooks: {
      SessionStart: [{ command: 'bash .github/scripts/icm-hook.sh start' }],
      PostToolUse: [{ command: 'bash .github/scripts/icm-hook.sh post' }],
      UserPromptSubmit: [{ command: 'bash .github/scripts/icm-hook.sh prompt' }],
    },
  }

  it('lleva cada modo de ICM al proyecto, con el dialecto que se omite solo al disparar', () => {
    // Regresión: el plan dejaba fuera los modos que el scope de usuario de la
    // máquina disparaba, y el settings versionado salía sin ICM. En un clon
    // sin `icm init --mode hook`, Claude Code corría sin ninguna inyección.
    const plan = planClaude([icmJson])
    assert.deepEqual(
      plan.map((p) => p.icmMode),
      ['start', 'post', 'prompt'],
    )
    assert.ok(plan.every((p) => dedupsAtRuntime(p.command)), plan.map((p) => p.command).join('\n'))
  })

  it('una declaración ilegible no aporta entradas', () => {
    assert.deepEqual(planClaude([{ source: 'x', hooks: null }]), [])
  })

  it('sólo el wrapper con `claude` se omite solo; el de Copilot y el binario directo, no', () => {
    assert.ok(dedupsAtRuntime('bash "${CLAUDE_PROJECT_DIR:-.}/.github/scripts/icm-hook.sh" prompt claude'))
    assert.ok(!dedupsAtRuntime('bash .github/scripts/icm-hook.sh prompt'))
    assert.ok(!dedupsAtRuntime('/u/bin/icm hook prompt'))
  })
})

describe('settingsHandlers y findIcm', () => {
  it('aplana grupos con y sin matcher', () => {
    const h = settingsHandlers({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ command: 'a' }, {}] }], X: 'roto' } })
    assert.deepEqual(h, [{ event: 'PreToolUse', matcher: 'Bash', command: 'a' }])
  })

  it('encuentra el primer icm ejecutable del PATH', () => {
    const dir = tmp()
    const bin = path.join(dir, 'icm')
    fs.writeFileSync(bin, '#!/bin/sh\n', { mode: 0o755 })
    assert.equal(findIcm({ PATH: dir }), bin)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
