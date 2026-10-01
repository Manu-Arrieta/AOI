import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { auditHookWiring, installClaudeHooks, readDeclarations, toClaudeSettings } from './install-hooks.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CLI = path.join(REPO, 'scripts/multi-harness/install-hooks.mjs')

function workspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-hooks-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })
const decl = (event, command) => JSON.stringify({ hooks: { [event]: [{ type: 'command', command }] } })

describe('the shipped hooks reach a harness', () => {
  it('every declaration is loaded by something', () => {
    assert.deepEqual(auditHookWiring(REPO, { userHooks: {} }).orphaned, [])
  })

  it('there are declarations to wire in the first place', () => {
    // An empty hooks directory would make the audit vacuously green.
    assert.ok(readDeclarations(REPO).length > 0, 'no hay declaraciones en .github/hooks/')
  })

  it('every script a shipped hook invokes exists and is executable', () => {
    assert.deepEqual(auditHookWiring(REPO, { userHooks: {} }).broken, [])
  })
})

describe('a hook whose script cannot run is as bad as one nobody loads', () => {
  // Different failure, same outcome: the rule looks enforced. A registered
  // hook pointing at a missing or non-executable script fires on every single
  // tool call and fails there, and nothing in the wiring audit saw it.

  it('flags a hook pointing at a script that does not exist', () => {
    const root = workspace({
      '.github/hooks/h.json': decl('PreToolUse', 'bash .github/scripts/fantasma.sh'),
      '.claude/settings.json': JSON.stringify({
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ command: 'bash "${CLAUDE_PROJECT_DIR:-.}/.github/scripts/fantasma.sh"' }] }] },
      }),
    })

    const r = auditHookWiring(root, { userHooks: {} })

    assert.deepEqual(r.orphaned, [], 'está cableado; el problema es otro')
    assert.equal(r.broken.length, 1)
    assert.match(r.broken[0], /no existe/)
    clean(root)
  })

  it('flags a script that exists but is not executable', () => {
    const root = workspace({
      '.github/hooks/h.json': decl('PreToolUse', 'bash .github/scripts/inerte.sh'),
      '.github/scripts/inerte.sh': '#!/usr/bin/env bash\nexit 0\n',
      '.claude/settings.json': JSON.stringify({
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ command: 'bash "${CLAUDE_PROJECT_DIR:-.}/.github/scripts/inerte.sh"' }] }] },
      }),
    })
    fs.chmodSync(path.join(root, '.github/scripts/inerte.sh'), 0o644)

    assert.match(auditHookWiring(root, { userHooks: {} }).broken[0], /no es ejecutable/)
    clean(root)
  })
})

describe('translation into the harness shape', () => {
  it('nests PreToolUse under a Bash matcher, which Claude Code requires', () => {
    // The declarations use Copilot's shape — hooks.<Event>[] = {type, command}.
    // Writing that verbatim into settings.json produces a file Claude Code
    // silently ignores, which is the failure this whole module exists to end.
    const out = toClaudeSettings([{ source: 'x', hooks: JSON.parse(decl('PreToolUse', 'bash a.sh')).hooks }])
    assert.equal(out.hooks.PreToolUse[0].matcher, 'Bash')
    assert.equal(out.hooks.PreToolUse[0].hooks[0].command, 'bash "${CLAUDE_PROJECT_DIR:-.}/a.sh"')
  })

  it('groups several declarations of the same event under one matcher', () => {
    const out = toClaudeSettings([
      { source: 'a', hooks: JSON.parse(decl('PreToolUse', 'bash a.sh')).hooks },
      { source: 'b', hooks: JSON.parse(decl('PreToolUse', 'bash b.sh')).hooks },
    ])
    assert.equal(out.hooks.PreToolUse.length, 1)
    assert.equal(out.hooks.PreToolUse[0].hooks.length, 2)
  })

  it('survives a declaration that will not parse', () => {
    const root = workspace({ '.github/hooks/broken.json': '{ not json' })
    assert.equal(readDeclarations(root)[0].hooks, null)
    clean(root)
  })
})

describe('the installer keeps what belongs to the Owner', () => {
  it('replaces only the hooks key of an existing settings file', () => {
    // Rewriting settings.json wholesale would be the same mistake as deleting
    // a customised CLAUDE.md: permissions, env and model are the Owner's.
    const root = workspace({
      '.github/hooks/h.json': decl('PreToolUse', 'bash h.sh'),
      '.claude/settings.json': JSON.stringify({ permissions: { allow: ['Bash(ls:*)'] }, model: 'opus' }),
    })

    installClaudeHooks(root, readDeclarations(root))
    const written = JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8'))

    assert.deepEqual(written.permissions, { allow: ['Bash(ls:*)'] })
    assert.equal(written.model, 'opus')
    assert.ok(written.hooks.PreToolUse)
    clean(root)
  })
})

describe('the audit detects an unwired declaration', () => {
  it('flags a hook no harness config names', () => {
    // Negative control: the exact state the audit found in the repository —
    // five declarations, five scripts on disk, nobody loading any of them.
    const root = workspace({ '.github/hooks/h.json': decl('PreToolUse', 'bash orphan.sh') })
    assert.deepEqual(auditHookWiring(root, { userHooks: {} }).orphaned, ['.github/hooks/h.json'])
    clean(root)
  })

  it('a declaration that commands nothing is orphaned, not vacuously wired', () => {
    // A mutation survived here: with zero commands, `every` on an empty array
    // is true, so an empty declaration would report as wired. An empty hook
    // file is a mistake, and reporting it green is the exact shape of failure
    // this audit exists to catch.
    const root = workspace({
      '.github/hooks/empty.json': JSON.stringify({ hooks: { PreToolUse: [] } }),
      '.claude/settings.json': '{"hooks":{}}',
    })

    assert.deepEqual(auditHookWiring(root, { userHooks: {} }).orphaned, ['.github/hooks/empty.json'])
    clean(root)
  })

  it('keeps events apart instead of collapsing them under one matcher', () => {
    // The grouping lookup matches on `matcher`; inverting that comparison
    // would file every hook under the wrong event, and the harness would run
    // a PreToolUse script after the tool instead of before it.
    const out = toClaudeSettings([
      { source: 'a', hooks: JSON.parse(decl('PreToolUse', 'bash pre.sh')).hooks },
      { source: 'b', hooks: JSON.parse(decl('PostToolUse', 'bash post.sh')).hooks },
    ])

    assert.equal(out.hooks.PreToolUse[0].hooks[0].command, 'bash "${CLAUDE_PROJECT_DIR:-.}/pre.sh"')
    assert.equal(out.hooks.PostToolUse[0].hooks[0].command, 'bash "${CLAUDE_PROJECT_DIR:-.}/post.sh"')
    assert.equal(out.hooks.PreToolUse[0].hooks.length, 1)
    clean(workspace({}))
  })

  it('treats a partially wired declaration as orphaned', () => {
    // Half a hook chain is a rule that fires sometimes, which is worse than
    // one that never fires: it looks enforced and is not.
    const root = workspace({
      '.github/hooks/h.json': JSON.stringify({
        hooks: { PreToolUse: [{ type: 'command', command: 'bash a.sh' }, { type: 'command', command: 'bash b.sh' }] },
      }),
      '.claude/settings.json': JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ command: 'bash "${CLAUDE_PROJECT_DIR:-.}/a.sh"' }] }] } }),
    })

    assert.deepEqual(auditHookWiring(root, { userHooks: {} }).orphaned, ['.github/hooks/h.json'])
    clean(root)
  })
})

describe('the tracked .claude/settings.json is the same on every machine', () => {
  it('install-hooks writes the same bytes whatever the user scope fires', () => {
    // Regresión: install-hooks dejaba fuera los modos de ICM que el settings
    // de usuario de ESTA máquina disparaba. El archivo versionado salió sin
    // ningún hook de ICM y, en otra máquina, correrlo cambiaba el archivo.
    const write = (userSettings) => {
      const root = workspace({ 'user/settings.json': JSON.stringify(userSettings) })
      fs.cpSync(path.join(REPO, '.github/hooks'), path.join(root, '.github/hooks'), { recursive: true })
      const r = spawnSync(process.execPath, [CLI, '--user-settings', path.join(root, 'user/settings.json')], {
        cwd: root,
        env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, 'user') },
        encoding: 'utf8',
      })
      assert.equal(r.status, 0, r.stderr)
      const out = fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8')
      clean(root)
      return out
    }
    const icmUser = { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'icm hook prompt' }] }] } }
    const clean1 = write({})
    assert.equal(write(icmUser), clean1)
    assert.match(clean1, /icm-hook\.sh\\" prompt claude/)
  })
})

describe('the CLI refuses an argument it does not know', () => {
  // Regresión de D1: con `argv.includes('--audit')`, `--audti` corría la rama
  // que ESCRIBE `.claude/settings.json` y salía con 0.
  for (const args of [['--audti'], ['--audit', '--bogus'], ['--user-settings']]) {
    it(`exits 2 and writes nothing for ${args.join(' ')}`, () => {
      const root = workspace({ '.github/hooks/h.json': decl('PreToolUse', 'bash h.sh') })
      const r = spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8' })
      assert.equal(r.status, 2, r.stderr)
      assert.ok(!fs.existsSync(path.join(root, '.claude/settings.json')), 'no tiene que escribir nada')
      clean(root)
    })
  }
})
