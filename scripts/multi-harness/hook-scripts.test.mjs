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

const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
const stdinOf = (event) => sampleEvents(REPO).find((e) => e.event === event).stdin
const run = (script, args, event, cwd = REPO) =>
  spawnSync('bash', [path.join(SCRIPTS, script), ...args], { cwd, env, input: stdinOf(event), encoding: 'utf8' })
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
