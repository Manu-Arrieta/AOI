import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { classifyStdout, handlersFor, sampleEvents, simulate, validFor, withIcm } from './hook-simulation.mjs'
import { readDeclarations } from './claude-hook-plan.mjs'
import { installClaudeHooks } from './install-hooks.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const created = []
after(() => created.forEach((d) => fs.rmSync(d, { recursive: true, force: true })))
const mk = (prefix) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  created.push(d)
  return d
}

describe('how Claude Code reads a hook stdout', () => {
  it('JSON only when it starts with { and ends with }', () => {
    assert.equal(classifyStdout(''), 'empty')
    assert.equal(classifyStdout('{"continue":true}\n'), 'json')
    assert.equal(classifyStdout('texto'), 'text')
    // Lo que imprimían session-init y session-close: texto y después JSON.
    assert.equal(classifyStdout('pack de memoria\n{"continue":true}'), 'text+json')
    assert.equal(classifyStdout('{ roto }'), 'text')
  })

  it('plain text is legitimate only where Claude Code adds it to context', () => {
    assert.ok(validFor('UserPromptSubmit', 'text'))
    assert.ok(validFor('SessionStart', 'text'))
    assert.ok(!validFor('Stop', 'text+json'))
    assert.ok(!validFor('SessionStart', 'text+json'))
    assert.ok(validFor('SessionEnd', 'json'))
  })
})

describe('which handlers fire', () => {
  it('an identical command string in two scopes runs once; a different string does not', () => {
    const scopes = [
      { name: 'user', settings: { hooks: { UserPromptSubmit: [{ hooks: [{ command: 'icm hook prompt' }] }] } } },
      {
        name: 'project',
        settings: { hooks: { UserPromptSubmit: [{ hooks: [{ command: 'icm hook prompt' }, { command: 'bash x/icm-hook.sh prompt' }] }] } },
      },
    ]
    assert.deepEqual(
      handlersFor(scopes, 'UserPromptSubmit').map((h) => h.scope),
      ['user', 'project'],
    )
  })

  it('a tool matcher filters PreToolUse', () => {
    const scopes = [{ name: 'p', settings: { hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ command: 'a' }] }] } } }]
    assert.equal(handlersFor(scopes, 'PreToolUse', 'Bash').length, 0)
    assert.equal(handlersFor(scopes, 'PreToolUse', 'Edit').length, 1)
  })

  it('withIcm swaps only a leading icm binary', () => {
    assert.equal(withIcm('/u/bin/icm hook start', '/s/icm'), '"/s/icm" hook start')
    assert.equal(withIcm('bash x.sh', '/s/icm'), 'bash x.sh')
    assert.equal(withIcm('/u/bin/icm hook start', null), '/u/bin/icm hook start')
  })

  it('sample events carry the stdin shape of each event', () => {
    const ev = Object.fromEntries(sampleEvents('/w').map((e) => [e.event, JSON.parse(e.stdin)]))
    assert.equal(ev.PreToolUse.tool_name, 'Bash')
    assert.equal(ev.UserPromptSubmit.hook_event_name, 'UserPromptSubmit')
    assert.equal(ev.SessionEnd.cwd, '/w')
  })
})

/**
 * Simulación determinista del antes y el después: los scripts reales del
 * repositorio, en un proyecto con espacios en la ruta, con un `icm` y un `rtk`
 * falsos de salida fija. "Antes" es la forma que `install-hooks.mjs` escribía
 * en main: comandos copiados tal cual. "Después" es lo que escribe ahora.
 */
describe('measured gain of the wiring: every configured hook per event, user + project scope', () => {
  const bin = mk('aoi-fakebin-')
  const log = path.join(bin, 'calls.log')
  fs.writeFileSync(
    path.join(bin, 'icm'),
    `#!/usr/bin/env bash
echo "$*" >> "${log}"
cat >/dev/null 2>&1 || true
case "$*" in
  "hook prompt") printf 'P%.0s' $(seq 1 1000) ;;
  "hook start") printf 'S%.0s' $(seq 1 500) ;;
  health) printf 'H%.0s' $(seq 1 3000) ;;
esac
exit 0
`,
    { mode: 0o755 },
  )
  fs.writeFileSync(
    path.join(bin, 'rtk'),
    `#!/usr/bin/env bash
cat >/dev/null
ask=''; [ "$2" = copilot ] && ask='"permissionDecision":"ask",'
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse",%s"updatedInput":{"command":"rtk git status"}}}' "$ask"
`,
    { mode: 0o755 },
  )
  const icm = path.join(bin, 'icm')
  const user = {
    hooks: Object.fromEntries(
      [
        ['SessionStart', 'start'],
        ['UserPromptSubmit', 'prompt'],
        ['PreToolUse', 'pre', 'Bash'],
        ['PostToolUse', 'post'],
        ['SessionEnd', 'end'],
      ].map(([event, mode, matcher]) => [event, [{ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: `${icm} hook ${mode}` }] }]]),
    ),
  }

  const project = mk('aoi sim project ')
  fs.cpSync(path.join(REPO, '.github/hooks'), path.join(project, '.github/hooks'), { recursive: true })
  fs.cpSync(path.join(REPO, '.github/scripts'), path.join(project, '.github/scripts'), { recursive: true })
  const declarations = readDeclarations(project)

  // La traducción de main: mismo comando, mismo evento, sin mirar el scope de usuario.
  const legacy = { hooks: {} }
  for (const { hooks } of declarations) {
    for (const [event, entries] of Object.entries(hooks)) {
      for (const e of entries) {
        legacy.hooks[event] ??= [{ ...(event.endsWith('ToolUse') ? { matcher: 'Bash' } : {}), hooks: [] }]
        legacy.hooks[event][0].hooks.push({ type: 'command', command: e.command })
      }
    }
  }
  installClaudeHooks(project, declarations)
  const current = JSON.parse(fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8'))
  // La primera versión de este arreglo: los modos que el scope de usuario de
  // la máquina que corrió install-hooks ya disparaba, fuera del proyecto.
  const machineDependent = {
    hooks: Object.fromEntries(
      Object.entries(current.hooks).map(([event, groups]) => [event, groups.map((g) => ({ ...g, hooks: g.hooks.filter((h) => !/icm-hook/.test(h.command)) }))]),
    ),
  }

  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
  const run = (settings, cwd, userScope = user) =>
    Object.fromEntries(
      simulate({
        scopes: [
          { name: 'user', settings: userScope },
          { name: 'project', settings },
        ],
        events: sampleEvents(cwd),
        cwd,
        env,
        projectDir: project,
        icmBin: icm,
      }).map((e) => [e.event, e]),
    )

  const before = run(legacy, project)
  const now = run(current, project)
  const beforeSub = run(legacy, path.join(project, '.github'))
  const nowSub = run(current, path.join(project, '.github'))
  // Un clon sin `icm init --mode hook`: scope de usuario vacío.
  const beforeClean = run(legacy, project, {})
  const nowClean = run(current, project, {})
  const machineDependentClean = run(machineDependent, project, {})

  it('UserPromptSubmit injects the recall once instead of twice', () => {
    assert.equal(before.UserPromptSubmit.stdoutBytes, 2000)
    assert.equal(now.UserPromptSubmit.stdoutBytes, 1000)
  })

  it('a clean machine (no user-scope icm hooks) still gets every injection exactly once', () => {
    // Regresión: con los modos de ICM fuera del settings versionado, este
    // perfil no recibía NINGUNA inyección de ICM.
    assert.equal(machineDependentClean.UserPromptSubmit.stdoutBytes, 0)
    assert.equal(machineDependentClean.SessionStart.stdoutBytes, '{"continue":true}\n'.length)
    assert.equal(nowClean.UserPromptSubmit.stdoutBytes, 1000)
    assert.equal(nowClean.SessionStart.stdoutBytes, 500 + '{"continue":true}\n'.length)
    assert.equal(beforeClean.UserPromptSubmit.stdoutBytes, 1000)
  })

  it('both machine profiles inject the same bytes from the same tracked settings', () => {
    const bytes = (r) => Object.fromEntries(Object.values(r).map((e) => [e.event, e.stdoutBytes]))
    assert.deepEqual(bytes(nowClean), bytes(now))
  })

  it('SessionStart injects the wake-up pack once', () => {
    // Antes: usuario + `icm-hook.sh start`, dos cadenas distintas para el
    // mismo `icm hook start`. (El tercer start, el de session-init-hook.sh, lo
    // cubre hook-scripts.test.mjs: aquí los scripts ya son los arreglados.)
    assert.equal(before.SessionStart.stdoutBytes, 500 + 500 + '{"continue":true}\n'.length)
    assert.equal(now.SessionStart.stdoutBytes, 500 + '{"continue":true}\n'.length)
    assert.equal(now.SessionStart.invalid, 0)
  })

  it('session close fires at SessionEnd, not on every turn, and answers valid JSON', () => {
    assert.equal(before.Stop.handlers, 1)
    assert.equal(now.Stop.handlers, 0)
    const close = now.SessionEnd.runs.find((r) => r.scope === 'project' && /session-close/.test(r.command))
    assert.equal(close.kind, 'json')
    assert.ok(close.valid)
  })

  it('RTK answers in the Claude dialect: no permissionDecision ask', () => {
    const rtkBefore = before.PreToolUse.runs.find((r) => /rtk-hook/.test(r.command))
    const rtkNow = now.PreToolUse.runs.find((r) => /rtk-hook/.test(r.command))
    assert.equal(rtkBefore.stdoutBytes - rtkNow.stdoutBytes, '"permissionDecision":"ask",'.length)
  })

  it('no hook fails when the shell cwd is not the project root', () => {
    // main: los comandos relativos salían 127 desde un subdirectorio.
    const failed = (r) => Object.values(r).reduce((n, e) => n + e.failures, 0)
    assert.ok(failed(beforeSub) >= 4, `antes fallaban ${failed(beforeSub)}`)
    assert.equal(failed(nowSub), 0)
    assert.deepEqual(
      Object.fromEntries(Object.values(nowSub).map((e) => [e.event, e.stdoutBytes])),
      Object.fromEntries(Object.values(now).map((e) => [e.event, e.stdoutBytes])),
    )
  })

  it('no hook calls an icm subcommand that does not exist', () => {
    const modes = new Set(['pre', 'post', 'compact', 'prompt', 'start', 'end', 'disable'])
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n')
    const bogus = calls.filter((c) => c.startsWith('hook ') && !modes.has(c.split(' ')[1]))
    // `hook stop` lo llamaba session-close-hook.sh en main: exit 2, silenciado.
    assert.deepEqual(bogus, [])
  })
})
