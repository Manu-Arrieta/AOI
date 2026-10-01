// Los hooks del proyecto como ÚNICO inyector de ICM en una instalación nueva.
//
// Defecto medido: setup.sh corría `icm init --mode hook`, que registra
// `icm hook start|pre|post|prompt|compact|end` en el settings de usuario de
// Claude Code. Con eso, `icm-hook.sh <modo> claude` se hacía a un lado en toda
// máquina instalada y su filtro de recall por sesión —el 82,2 % de las líneas
// de recall de 110 sesiones reales ya estaba en el contexto— no corría nunca.
// Quitar el init sin más dejaba a Claude Code sin `compact` ni `end`, que
// procesan la cola que `post` llena: el proyecto nunca los llamaba.
//
// Dos `icm` falsos: el del scope de usuario y el que el proyecto encuentra por
// PATH escriben en registros distintos, así se ve QUIÉN llamó a cada modo.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { planClaude, readDeclarations } from './claude-hook-plan.mjs'
import { installClaudeHooks } from './install-hooks.mjs'
import { sampleEvents, simulate } from './hook-simulation.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi icm owner '))
after(() => fs.rmSync(ROOT, { recursive: true, force: true }))

const MODES = ['start', 'pre', 'post', 'prompt', 'compact', 'end']
const EVENT = { start: 'SessionStart', pre: 'PreToolUse', post: 'PostToolUse', prompt: 'UserPromptSubmit', compact: 'PreCompact', end: 'SessionEnd' }

function fakeIcm(name) {
  const dir = path.join(ROOT, `${name} bin`)
  fs.mkdirSync(dir, { recursive: true })
  const log = path.join(dir, 'calls.log')
  fs.writeFileSync(
    path.join(dir, 'icm'),
    `#!/usr/bin/env bash\ncat >/dev/null 2>&1 || true\necho "$*" >> "${log}"\n[ "$*" = "hook prompt" ] && printf 'ctx\\n\\n- uno\\n- dos\\n'\nexit 0\n`,
    { mode: 0o755 },
  )
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter((l) => l.startsWith('hook ')) : [])
  return { dir, bin: path.join(dir, 'icm'), log, calls, reset: () => fs.rmSync(log, { force: true }) }
}

const project = fakeIcm('project')
// Un rtk que no reescribe nada: la prueba no depende del rtk de la máquina.
fs.writeFileSync(path.join(project.dir, 'rtk'), '#!/usr/bin/env bash\ncat >/dev/null\nexit 0\n', { mode: 0o755 })
const user = fakeIcm('user')
// Lo que `icm init --mode hook` escribe en ~/.claude/settings.json (leído de esta máquina).
const ALL_SIX = {
  hooks: Object.fromEntries(MODES.map((m) => [EVENT[m], [{ hooks: [{ type: 'command', command: `"${user.bin}" hook ${m}` }] }]])),
}

const tree = path.join(ROOT, 'ws one')
fs.cpSync(path.join(REPO, '.github/hooks'), path.join(tree, '.github/hooks'), { recursive: true })
fs.cpSync(path.join(REPO, '.github/scripts'), path.join(tree, '.github/scripts'), { recursive: true })
installClaudeHooks(tree, readDeclarations(tree))
const claudeSettings = JSON.parse(fs.readFileSync(path.join(tree, '.claude/settings.json'), 'utf8'))
const tmp = path.join(ROOT, 'tmp')
const env = { ...process.env, PATH: `${project.dir}${path.delimiter}${process.env.PATH}`, TMPDIR: tmp }
const seenDir = path.join(tmp, 'aoi-recall-seen')

function runClaude(userScope) {
  project.reset()
  user.reset()
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp)
  const marks = {}
  const scopes = [{ name: 'user', settings: userScope }, { name: 'project', settings: claudeSettings }]
  for (const e of sampleEvents(tree)) {
    simulate({ scopes, events: [e], cwd: tree, env, projectDir: tree })
    marks[e.event] = fs.existsSync(seenDir) ? fs.readdirSync(seenDir).length : 0
  }
  return marks
}

// Copilot (VS Code) corre las declaraciones de `.github/hooks/` tal cual.
function runCopilot() {
  project.reset()
  for (const e of sampleEvents(tree)) {
    for (const { hooks } of readDeclarations(tree)) {
      for (const entry of hooks?.[e.event] ?? []) {
        spawnSync('bash', ['-c', entry.command], { cwd: tree, env, input: e.stdin, encoding: 'utf8' })
      }
    }
  }
}

const count = (calls) => Object.fromEntries(MODES.map((m) => [m, calls.filter((c) => c === `hook ${m}`).length]))
const once = Object.fromEntries(MODES.map((m) => [m, 1]))
const none = Object.fromEntries(MODES.map((m) => [m, 0]))

describe('instalación nueva (scope de usuario vacío): el proyecto es el único inyector', () => {
  it('Claude: cada uno de los seis modos se llama exactamente una vez, desde el proyecto', () => {
    runClaude({})
    assert.deepEqual(count(project.calls()), once)
    assert.deepEqual(user.calls(), [])
  })

  it('Claude: el registro del recall se crea en el prompt, compact lo vacía y end no deja nada', () => {
    const marks = runClaude({})
    assert.equal(marks.UserPromptSubmit, 1)
    assert.equal(marks.SessionEnd, 0)
  })

  it('Copilot: start, pre, post y prompt una vez; compact y end nunca (ICM no se los cableó)', () => {
    runCopilot()
    assert.deepEqual(count(project.calls()), { ...once, compact: 0, end: 0 })
  })
})

describe('esta máquina (el scope de usuario ya dispara los seis): el proyecto no llama a icm', () => {
  it('Claude: los seis los corre el scope de usuario, ninguno el proyecto', () => {
    const marks = runClaude(ALL_SIX)
    assert.deepEqual(count(project.calls()), none)
    assert.deepEqual(count(user.calls()), once)
    // El proyecto sigue manteniendo el registro aunque no llame a icm.
    assert.equal(marks.SessionEnd, 0)
  })

  it('un scope de usuario sin compact ni end (la instalación de Copilot de ICM): el proyecto los cubre', () => {
    const fourOnly = { hooks: Object.fromEntries(Object.entries(ALL_SIX.hooks).filter(([ev]) => !['PreCompact', 'SessionEnd'].includes(ev))) }
    runClaude(fourOnly)
    assert.deepEqual(count(project.calls()), { ...none, compact: 1, end: 1 })
    assert.deepEqual(count(user.calls()), { ...once, compact: 0, end: 0 })
  })
})

describe('la traducción a Claude Code', () => {
  const plan = planClaude(readDeclarations(REPO)).filter((p) => p.icmMode)

  it('lleva los seis modos, uno por evento, todos en el dialecto que se omite al disparar', () => {
    assert.deepEqual(Object.fromEntries(plan.map((p) => [p.icmMode, p.event])), EVENT)
    assert.equal(plan.length, MODES.length)
    assert.ok(plan.every((p) => / claude$/.test(p.command)))
  })

  it('compact y end sin timeout, como los registraba icm init; los demás conservan el declarado', () => {
    for (const p of plan) assert.equal(p.timeout === undefined, ['compact', 'end'].includes(p.icmMode), p.command)
  })

  it('Copilot no gana end: .github/hooks/ no lo declara', () => {
    const declared = readDeclarations(REPO).flatMap((d) => Object.values(d.hooks ?? {}).flat())
    assert.ok(!declared.some((e) => /icm-hook\.sh\s+end\b/.test(e.command)))
  })

  it('el .claude/settings.json versionado está regenerado con end en SessionEnd', () => {
    const s = JSON.parse(fs.readFileSync(path.join(REPO, '.claude/settings.json'), 'utf8'))
    assert.ok(s.hooks.SessionEnd?.some((g) => g.hooks.some((h) => /icm-hook\.sh" end claude$/.test(h.command))))
  })
})

describe('setup.sh ya no registra hooks de ICM en el scope de usuario', () => {
  const live = fs
    .readFileSync(path.join(REPO, 'setup.sh'), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
  // `icm init` sin modo es `standard` = cli + skill + HOOK; `all` también lo incluye.
  const inits = live.filter((l) => /^\s*icm(\s+-\S+)*\s+init\b/.test(l))

  it('cada icm init que corre nombra skill o cli, nunca hook ni un modo que lo incluya', () => {
    assert.ok(inits.length >= 2, inits.join('\n'))
    for (const l of inits) assert.match(l, /--mode\s+(skill|cli)\b/, l)
  })

  it('skill y cli siguen corriendo', () => {
    assert.ok(inits.some((l) => /--mode\s+skill\b/.test(l)))
    assert.ok(inits.some((l) => /--mode\s+cli\b/.test(l)))
  })
})
