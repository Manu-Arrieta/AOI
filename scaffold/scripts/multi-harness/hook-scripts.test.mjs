// Los scripts de `.github/scripts/` que los hooks disparan, corridos de verdad
// con un `icm` y un `rtk` falsos primeros en el PATH: nada acá toca la base
// real de ICM. Cada caso es un defecto medido sobre los scripts de main.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, beforeEach, describe, it } from 'node:test'
import { readDeclarations } from './claude-hook-plan.mjs'
import { classifyStdout, sampleEvents } from './hook-simulation.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SCRIPTS = path.join(REPO, '.github/scripts')
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-hookscripts-'))
const log = path.join(bin, 'calls.log')
after(() => fs.rmSync(bin, { recursive: true, force: true }))
beforeEach(() => fs.rmSync(log, { force: true }))

fs.writeFileSync(
  path.join(bin, 'icm'),
  `#!/usr/bin/env bash
input=$(cat 2>/dev/null || true)
echo "icm $* stdin=\${#input}" >> "${log}"
case "$*" in
  "hook start") echo "WAKE-UP PACK" ;;
  health) printf 'H%.0s' $(seq 1 3000) ;;
  "hook stop") exit 2 ;;
esac
exit 0
`,
  { mode: 0o755 },
)
fs.writeFileSync(
  path.join(bin, 'rtk'),
  `#!/usr/bin/env bash
cat >/dev/null
echo "rtk $*" >> "${log}"
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"command":"rtk git status"}}}'
`,
  { mode: 0o755 },
)

// Un CLAUDE_CONFIG_DIR propio: icm-hook.sh lee el settings de usuario, y el de
// esta máquina dispara `icm hook <modo>` (icm init --mode hook).
const config = (name, hooks) => {
  const dir = path.join(bin, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ hooks }))
  return dir
}
const EMPTY = config('empty user', {})
const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, CLAUDE_CONFIG_DIR: EMPTY }
const stdinOf = (event) => sampleEvents(REPO).find((e) => e.event === event).stdin
const run = (script, args, event, cwd = REPO, extra = {}) =>
  spawnSync('bash', [path.join(SCRIPTS, script), ...args], { cwd, env: { ...env, ...extra }, input: stdinOf(event), encoding: 'utf8' })
const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [])

describe('session-init-hook.sh', () => {
  it('does not inject the wake-up pack a second time, and stdout is only valid JSON', () => {
    // main: llamaba a `icm hook start` —tercera copia del pack— e imprimía
    // `{"continue":true}` DESPUÉS de ese texto, que llegaba al modelo como basura.
    const r = run('session-init-hook.sh', [], 'SessionStart')
    assert.equal(r.status, 0)
    assert.equal(classifyStdout(r.stdout), 'json')
    assert.deepEqual(JSON.parse(r.stdout), { continue: true })
    assert.deepEqual(calls(), [])
  })
})

describe('session-close-hook.sh', () => {
  it('prints nothing but its JSON on stdout; the health report goes to stderr', () => {
    // main: ~35 KB de `icm health` delante del JSON, así que el stdout era
    // texto y el `systemMessage` nunca se aplicaba.
    const r = run('session-close-hook.sh', [], 'SessionEnd')
    assert.equal(r.status, 0)
    assert.equal(classifyStdout(r.stdout), 'json')
    assert.match(JSON.parse(r.stdout).systemMessage, /aoi-hook-simulation closed/)
    assert.ok(r.stderr.includes('HHHH'), 'el informe de health va a stderr')
  })

  it('calls only icm subcommands that exist', () => {
    // main: `icm hook stop`, que no existe (`icm hook --help`): exit 2, silenciado.
    run('session-close-hook.sh', [], 'SessionEnd')
    assert.deepEqual(calls().map((c) => c.replace(/ stdin=\d+$/, '')), ['icm health'])
  })
})

describe('rtk-hook.sh speaks the dialect of the harness that runs it', () => {
  it('claude → rtk hook claude, which does not ask for permission', () => {
    // `rtk hook copilot` responde permissionDecision "ask": en Claude Code,
    // fuera del modo bypass, un pedido de permiso por comando reescrito.
    const r = run('rtk-hook.sh', ['claude'], 'PreToolUse')
    assert.equal(r.status, 0)
    assert.deepEqual(calls(), ['rtk hook claude'])
  })

  it('no argument keeps Copilot on its own dialect', () => {
    run('rtk-hook.sh', [], 'PreToolUse')
    assert.deepEqual(calls(), ['rtk hook copilot'])
  })

  it('an unknown dialect fails without blocking the tool (exit 1, never 2)', () => {
    const r = run('rtk-hook.sh', ['claud'], 'PreToolUse')
    assert.equal(r.status, 1)
    assert.deepEqual(calls(), [])
  })
})

describe('PostToolUse reaches icm hook post once per tool call, with the event', () => {
  it('five tool calls through the declared commands → five `hook post`, none with empty stdin', () => {
    // main: además de `icm-hook.sh post`, post-tool-learning-hook.sh se comía
    // el stdin con `cat` y cada 5 llamadas corría `icm hook post` VACÍO. Medido
    // con una copia de la base: con stdin vacío `icm hook post` sale 0 en 0 ms
    // sin encolar nada, y `icm hook post` ya limita solo (extract_every = 3).
    const post = readDeclarations(REPO).flatMap((d) => d.hooks?.PostToolUse ?? []).map((e) => e.command)
    for (let i = 0; i < 5; i++) {
      for (const command of post) {
        spawnSync('bash', ['-c', command], { cwd: REPO, env, input: stdinOf('PostToolUse'), encoding: 'utf8' })
      }
    }
    const hookPost = calls().filter((c) => c.startsWith('icm hook post'))
    assert.equal(hookPost.length, 5)
    assert.ok(hookPost.every((c) => !c.endsWith(' stdin=0')), hookPost.join('\n'))
  })
})

describe('icm-hook.sh <modo> claude: one injection per event on every machine', () => {
  // Regresión: con los modos de ICM fuera del settings versionado, un clon
  // sin `icm init --mode hook` no inyectaba nada; con ellos adentro y sin
  // omitirse, esta máquina inyectaba dos veces (~67k tokens en 155 prompts).
  const icm = path.join(bin, 'icm')
  const MODES = [
    ['start', 'SessionStart'],
    ['pre', 'PreToolUse', 'Bash'],
    ['post', 'PostToolUse'],
    ['prompt', 'UserPromptSubmit'],
  ]
  const userScope = (command) =>
    Object.fromEntries(MODES.map(([mode, event, matcher]) => [event, [{ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: command(mode) }] }]]))
  // HOME con espacios y la ruta citada, como la escribe `icm init`.
  const ICM_USER = config('user with icm', userScope((m) => `"${icm}" hook ${m}`))
  const hookCalls = () => calls().filter((c) => c.startsWith('icm hook ')).map((c) => c.replace(/ stdin=\d+$/, ''))
  const fire = (mode, configDir, dialect = ['claude'], extra = {}) =>
    run('icm-hook.sh', [mode, ...dialect], MODES.find((m) => m[0] === mode)[1], REPO, { CLAUDE_CONFIG_DIR: configDir, ...extra })

  for (const [mode] of MODES) {
    it(`clean machine (empty user scope): the project fires icm hook ${mode}`, () => {
      assert.equal(fire(mode, EMPTY).status, 0)
      assert.deepEqual(hookCalls(), [`icm hook ${mode}`])
    })

    it(`this machine (user scope fires icm hook ${mode}): the project skips it`, () => {
      const r = fire(mode, ICM_USER)
      assert.equal(r.status, 0)
      assert.equal(r.stdout, '')
      assert.deepEqual(hookCalls(), [])
    })
  }

  it('no user settings file at all is a clean machine', () => {
    fire('prompt', path.join(bin, 'no such dir'))
    assert.deepEqual(hookCalls(), ['icm hook prompt'])
  })

  it('Copilot (no dialect) always fires: the Claude user scope does not run under Copilot', () => {
    fire('prompt', ICM_USER, [])
    assert.deepEqual(hookCalls(), ['icm hook prompt'])
  })

  it('a user entry whose binary is gone covers nothing', () => {
    fire('prompt', config('dead icm', userScope((m) => `/no/existe/icm hook ${m}`)))
    assert.deepEqual(hookCalls(), ['icm hook prompt'])
  })

  it('a user matcher that does not cover Bash does not cover PreToolUse', () => {
    fire('pre', config('edit only', { PreToolUse: [{ matcher: 'Edit', hooks: [{ command: `${icm} hook pre` }] }] }))
    assert.deepEqual(hookCalls(), ['icm hook pre'])
  })

  it('another copy of this wrapper in the user scope does not count (it would skip too)', () => {
    fire('prompt', config('wrapper', userScope((m) => `bash /x/.github/scripts/icm-hook.sh ${m} claude`)))
    assert.deepEqual(hookCalls(), ['icm hook prompt'])
  })

  it('an unreadable user settings file fires (twice is the old defect; zero would be worse)', () => {
    const dir = path.join(bin, 'broken user')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'settings.json'), '{ roto')
    fire('prompt', dir)
    assert.deepEqual(hookCalls(), ['icm hook prompt'])
  })

  it('without jq, the node fallback decides the same', () => {
    // PATH sin jq: sólo icm, node, y bash y cat (que usa el icm falso).
    const which = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).stdout.trim()
    const bash = which('bash')
    const nojq = path.join(bin, 'nojq')
    fs.mkdirSync(nojq, { recursive: true })
    for (const [name, target] of [['icm', icm], ['cat', which('cat')], ['bash', bash], ['node', process.execPath]]) {
      fs.rmSync(path.join(nojq, name), { force: true })
      fs.symlinkSync(target, path.join(nojq, name))
    }
    const go = (mode, dir) =>
      spawnSync(bash, [path.join(SCRIPTS, 'icm-hook.sh'), mode, 'claude'], { env: { PATH: nojq, HOME: bin, CLAUDE_CONFIG_DIR: dir }, input: '{}', encoding: 'utf8' })
    assert.equal(spawnSync(bash, ['-c', 'command -v jq'], { env: { PATH: nojq } }).status, 1)
    assert.equal(go('prompt', ICM_USER).status, 0)
    assert.deepEqual(hookCalls(), [])
    go('prompt', EMPTY)
    assert.deepEqual(hookCalls(), ['icm hook prompt'])
  })

  it('an unknown dialect fails without blocking the tool (exit 1, never 2)', () => {
    const r = fire('pre', EMPTY, ['claud'])
    assert.equal(r.status, 1)
    assert.deepEqual(hookCalls(), [])
  })
})
