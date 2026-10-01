import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { auditHookWiring, claudeViolations, duplicateInjections } from './hook-wiring-audit.mjs'
import { installClaudeHooks } from './install-hooks.mjs'
import { readDeclarations } from './claude-hook-plan.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function workspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi hook audit '))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body, { mode: rel.endsWith('.sh') ? 0o755 : 0o644 })
  }
  return root
}
const clean = (root) => fs.rmSync(root, { recursive: true, force: true })
const settings = (hooks) => JSON.stringify({ hooks })
const group = (command, matcher) => [{ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command }] }]

// La forma exacta que `install-hooks.mjs` escribía en main hasta este cambio.
const LEGACY = {
  SessionStart: group('bash .github/scripts/icm-hook.sh start'),
  PreToolUse: group('bash .github/scripts/rtk-hook.sh', 'Bash'),
  UserPromptSubmit: group('bash .github/scripts/icm-hook.sh prompt'),
  Stop: group('bash .github/scripts/session-close-hook.sh'),
}

describe('claudeViolations refuses the three measured defects', () => {
  const v = claudeViolations(
    Object.entries(LEGACY).map(([event, g]) => ({ event, matcher: g[0].matcher, command: g[0].hooks[0].command })),
    REPO,
  )

  it('a relative script path, which breaks as soon as the cwd leaves the root', () => {
    assert.equal(v.filter((s) => /ruta relativa/.test(s)).length, 4)
  })

  it('the Copilot dialect of RTK wired into Claude Code', () => {
    assert.equal(v.filter((s) => /dialecto de Copilot/.test(s)).length, 1)
    assert.equal(claudeViolations([{ event: 'PreToolUse', command: 'rtk hook copilot' }], REPO).length, 1)
  })

  it('session close wired to Stop, which fires every turn', () => {
    assert.equal(v.filter((s) => /Stop corre en cada turno/.test(s)).length, 1)
  })

  it('an anchored script that does not exist', () => {
    const r = claudeViolations([{ event: 'SessionStart', command: 'bash "${CLAUDE_PROJECT_DIR}/.github/scripts/fantasma.sh"' }], REPO)
    assert.match(r[0], /no existe/)
  })

  it('fails the audit even when every declaration is also wired correctly', () => {
    // Un settings editado a mano puede tener la entrada buena Y la vieja: la
    // vieja sigue disparando, fallando fuera de la raíz y pidiendo permiso.
    const good = 'bash "${CLAUDE_PROJECT_DIR:-.}/.github/scripts/rtk-hook.sh" claude'
    const root = workspace({
      '.github/hooks/rtk.json': JSON.stringify({ hooks: { PreToolUse: [{ command: 'bash .github/scripts/rtk-hook.sh' }] } }),
      '.github/scripts/rtk-hook.sh': '#!/usr/bin/env bash\n',
      '.claude/settings.json': settings({
        PreToolUse: [{ matcher: 'Bash', hooks: [{ command: good }, { command: 'bash .github/scripts/rtk-hook.sh' }] }],
      }),
    })
    const r = auditHookWiring(root, { userHooks: {} })
    assert.deepEqual(r.orphaned, [])
    assert.equal(r.violations.length, 2)
    const cli = path.join(REPO, 'scripts/multi-harness/install-hooks.mjs')
    const res = spawnSync(process.execPath, [cli, '--audit', '--user-settings', path.join(root, 'none.json')], { cwd: root })
    assert.equal(res.status, 1)
    clean(root)
  })

  it('accepts what install-hooks writes now', () => {
    const ok = [
      { event: 'PreToolUse', command: 'bash "${CLAUDE_PROJECT_DIR:-.}/.github/scripts/rtk-hook.sh" claude' },
      { event: 'SessionEnd', command: 'bash "${CLAUDE_PROJECT_DIR:-.}/.github/scripts/session-close-hook.sh"' },
      { event: 'SessionStart', command: '/abs/icm hook start' },
    ]
    assert.deepEqual(claudeViolations(ok, REPO), [])
  })
})

describe('the shipped .claude/settings.json', () => {
  it('has no violation and every declaration reaches Claude Code', () => {
    // `userHooks: {}` es lo que ve CI: sin `icm init --mode hook`.
    const r = auditHookWiring(REPO, { userHooks: {} })
    assert.deepEqual(r.violations, [])
    assert.deepEqual(r.orphaned, [])
    assert.deepEqual(r.broken, [])
    assert.ok(r.wired.length > 0)
  })

  it('is exactly what install-hooks writes from the declarations', () => {
    // El archivo versionado no se edita a mano ni depende de la máquina: la
    // versión anterior lo comparaba "módulo ICM", y así pasó un settings sin
    // ningún hook de ICM.
    const root = workspace({})
    fs.cpSync(path.join(REPO, '.github/hooks'), path.join(root, '.github/hooks'), { recursive: true })
    installClaudeHooks(root, readDeclarations(root))
    const fresh = fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8')
    assert.equal(fs.readFileSync(path.join(REPO, '.claude/settings.json'), 'utf8'), fresh)
    clean(root)
  })
})

describe('ICM injected from two scopes', () => {
  const user = { UserPromptSubmit: group('icm hook prompt'), PostToolUse: group('icm hook post') }

  it('is reported per event and mode', () => {
    const d = duplicateInjections(user, [
      { event: 'UserPromptSubmit', command: 'bash .github/scripts/icm-hook.sh prompt' },
      { event: 'PostToolUse', matcher: 'Bash', command: 'bash .github/scripts/icm-hook.sh post' },
      { event: 'SessionStart', command: 'bash .github/scripts/icm-hook.sh start' },
    ])
    assert.deepEqual(
      d.map((x) => `${x.event}:${x.mode}`),
      ['UserPromptSubmit:prompt', 'PostToolUse:post'],
    )
  })

  it('is not reported for the wrapper that skips itself when the user scope fires the mode', () => {
    const d = duplicateInjections(user, [
      { event: 'UserPromptSubmit', command: 'bash "${CLAUDE_PROJECT_DIR:-.}/.github/scripts/icm-hook.sh" prompt claude' },
    ])
    assert.deepEqual(d, [])
  })

  describe('an ICM declaration the project settings do not carry is never green', () => {
    // Regresión: el settings versionado se generó en una máquina con
    // `icm init --mode hook` y no llevaba ningún hook de ICM. La auditoría
    // guardaba esas entradas aparte sin marcarlas faltantes: con un scope de
    // usuario VACÍO imprimía ✅ icm.json, "Cada declaración llega..." y exit 0,
    // mientras Claude Code no recibía ninguna inyección de ICM.
    const decl = JSON.stringify({ hooks: { UserPromptSubmit: [{ command: 'bash .github/scripts/icm-hook.sh prompt' }] } })
    const files = (projectSettings) => ({
      '.github/hooks/icm.json': decl,
      '.github/scripts/icm-hook.sh': '#!/usr/bin/env bash\n',
      '.claude/settings.json': settings(projectSettings),
      'empty-user.json': '{}',
    })
    const cli = path.join(REPO, 'scripts/multi-harness/install-hooks.mjs')
    const audit = (root, userFile) =>
      spawnSync(process.execPath, [cli, '--audit', '--user-settings', userFile], { cwd: root, encoding: 'utf8' })

    it('neither scope wires it: orphaned, the CLI exits 1 and prints no ✅ for it', () => {
      const root = workspace(files({}))
      const r = auditHookWiring(root, { userHooks: {} })
      assert.deepEqual(r.orphaned, ['.github/hooks/icm.json'])
      assert.equal(r.missing.length, 1)
      const res = audit(root, path.join(root, 'empty-user.json'))
      assert.equal(res.status, 1)
      assert.doesNotMatch(res.stdout, /✅ \.github\/hooks\/icm\.json/)
      assert.doesNotMatch(res.stdout, /Cada declaración llega/)
      clean(root)
    })

    it('only this machine\'s user scope wires it: still orphaned, named as machine-dependent', () => {
      const root = workspace(files({}))
      const r = auditHookWiring(root, { userHooks: user })
      assert.deepEqual(r.orphaned, ['.github/hooks/icm.json'])
      assert.equal(r.userScopeOnly.length, 1)
      clean(root)
    })

    it('the project carries it: wired in both machine profiles, skipped at runtime where the user scope fires it', () => {
      const root = workspace({})
      fs.writeFileSync(path.join(root, 'empty-user.json'), '{}')
      fs.mkdirSync(path.join(root, '.github/hooks'), { recursive: true })
      fs.writeFileSync(path.join(root, '.github/hooks/icm.json'), decl)
      fs.mkdirSync(path.join(root, '.github/scripts'), { recursive: true })
      fs.writeFileSync(path.join(root, '.github/scripts/icm-hook.sh'), '#!/usr/bin/env bash\n', { mode: 0o755 })
      installClaudeHooks(root, readDeclarations(root))
      const cleanMachine = auditHookWiring(root, { userHooks: {} })
      const thisMachine = auditHookWiring(root, { userHooks: user })
      assert.deepEqual(cleanMachine.wired, ['.github/hooks/icm.json'])
      assert.deepEqual(thisMachine.wired, ['.github/hooks/icm.json'])
      assert.deepEqual(cleanMachine.skippedAtRuntime, [])
      assert.equal(thisMachine.skippedAtRuntime.length, 1)
      assert.deepEqual(thisMachine.duplicates, [])
      assert.equal(audit(root, path.join(root, 'empty-user.json')).status, 0)
      clean(root)
    })
  })

  it('the audit CLI exits 1 on the legacy settings and 0 after install-hooks rewrites them', () => {
    const root = workspace({
      '.github/hooks/rtk.json': JSON.stringify({ hooks: { PreToolUse: [{ command: 'bash .github/scripts/rtk-hook.sh' }] } }),
      '.github/scripts/rtk-hook.sh': '#!/usr/bin/env bash\n',
      '.claude/settings.json': settings({ PreToolUse: LEGACY.PreToolUse }),
      'empty-user.json': '{}',
    })
    const cli = path.join(REPO, 'scripts/multi-harness/install-hooks.mjs')
    const run = (...args) => {
      try {
        execFileSync(process.execPath, [cli, ...args, '--user-settings', path.join(root, 'empty-user.json')], { cwd: root, stdio: 'pipe' })
        return 0
      } catch (e) {
        return e.status
      }
    }
    assert.equal(run('--audit'), 1)
    assert.equal(run(), 0)
    assert.equal(run('--audit'), 0)
    clean(root)
  })
})
