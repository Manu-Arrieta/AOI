import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { isDevelopmentRepo } from './claude-project-guide.mjs'
import {
  COMMAND_TARGETS,
  PROMPTS_DIR,
  listPromptNames,
  readPromptDescription,
  renderCommandPointer,
  syncHarnessCommands,
} from './harness-commands.mjs'

function fixture(prompts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cmd-'))
  fs.mkdirSync(path.join(root, PROMPTS_DIR), { recursive: true })
  for (const [name, body] of Object.entries(prompts)) {
    fs.writeFileSync(path.join(root, PROMPTS_DIR, `${name}.prompt.md`), body)
  }
  return root
}

/** Collects what a compile would write, without touching a real tree. */
function recorder() {
  const written = new Map()
  return { written, write: (relPath, content) => written.set(relPath, content) }
}

describe('harness command registration', () => {
  it('lists the prompt names, suffix stripped and sorted', () => {
    const root = fixture({ 'sdd-new': '# new', init: '# init' })

    assert.deepEqual(listPromptNames(root), ['init', 'sdd-new'])
  })

  it('returns nothing when the tree has no prompts directory', () => {
    assert.deepEqual(listPromptNames(fs.mkdtempSync(path.join(os.tmpdir(), 'bare-'))), [])
  })

  it('reads the description out of the prompt frontmatter', () => {
    const root = fixture({ init: '---\ndescription: "Bootstrap the workspace."\nagent: "agent"\n---\n\n# /init\n' })

    assert.equal(readPromptDescription(root, 'init'), 'Bootstrap the workspace.')
  })

  it('tolerates a prompt with no frontmatter and one that does not exist', () => {
    const root = fixture({ bare: '# just a body\n' })

    assert.equal(readPromptDescription(root, 'bare'), '')
    assert.equal(readPromptDescription(root, 'absent'), '')
  })

  it('points at the canonical prompt instead of copying it', () => {
    // A copy would put the same instructions in two files nothing keeps equal —
    // the drift Principle I refuses, one directory over.
    const body = renderCommandPointer({ name: 'init', description: 'Bootstrap.', withFrontmatter: true })

    assert.ok(body.includes('.github/prompts/init.prompt.md'))
    assert.ok(body.startsWith('---\ndescription: "Bootstrap."'))
    assert.ok(body.includes('Do not edit'))
    assert.ok(body.length < 800, 'un puntero no carga el cuerpo del prompt')
  })

  it('omits frontmatter for a harness that rejects it', () => {
    const body = renderCommandPointer({ name: 'init', description: 'Bootstrap.', withFrontmatter: false })

    assert.ok(!body.startsWith('---'))
    assert.ok(body.includes('.github/prompts/init.prompt.md'))
  })

  it('writes one command per prompt into the harness directory', () => {
    const root = fixture({ init: '---\ndescription: "Bootstrap."\n---\n', 'sdd-new': '# new\n' })
    const rec = recorder()

    const written = syncHarnessCommands(root, rec.write, 'claude')

    assert.deepEqual(written, ['.claude/commands/init.md', '.claude/commands/sdd-new.md'])
    assert.ok(rec.written.get('.claude/commands/init.md').includes('description: "Bootstrap."'))
  })

  it('shadows the bundled /init, which is the whole point', () => {
    // Claude Code's bundled `/init` writes CLAUDE.md by hand — the file AOI
    // compiles with an unconditional write and the commit-msg guard refuses.
    // A project command outranks a bundled one, so this file is what makes
    // `/init` mean AOI's flow in Claude Code, as it already does in Copilot.
    const root = fixture({ init: '---\ndescription: "Bootstrap."\n---\n' })
    const rec = recorder()

    syncHarnessCommands(root, rec.write, 'claude')

    assert.ok(rec.written.has('.claude/commands/init.md'))
  })

  it('writes nothing for a harness with no verified command directory', () => {
    // Cline reads `.clinerules/workflows/`, but AOI writes `.clinerules` as a
    // file; Antigravity has no convention checked against its docs. Guessing
    // either would ship dead files.
    const root = fixture({ init: '# init\n' })
    const rec = recorder()

    assert.deepEqual(syncHarnessCommands(root, rec.write, 'cline'), [])
    assert.deepEqual(syncHarnessCommands(root, rec.write, 'antigravity'), [])
    assert.deepEqual(syncHarnessCommands(root, rec.write, 'copilot'), [])
    assert.equal(rec.written.size, 0)
  })

  it('targets only harnesses whose command directory is verified', () => {
    assert.deepEqual(Object.keys(COMMAND_TARGETS).sort(), ['claude', 'cursor'])
    assert.equal(COMMAND_TARGETS.claude.frontmatter, true)
    assert.equal(COMMAND_TARGETS.cursor.frontmatter, false)
  })

  it('registers every prompt this repository actually ships', () => {
    // The two directories used to be named literally and required
    // unconditionally. That reads as a stronger assertion than it is, and it
    // was wrong in both directions at once.
    //
    // Too strict downstream: a workspace materialises only the harnesses it was
    // installed with — migarajeapp chose copilot, claude and antigravity, so it
    // has no `.cursor/commands/` and the test demanded a directory the operator
    // deliberately did not ask for. `pnpm test` was red in that installation
    // over a harness nobody selected.
    //
    // Too lax upstream: a third entry added to COMMAND_TARGETS would have gone
    // unchecked forever, because the loop never read the table it is meant to
    // protect. Driving it from COMMAND_TARGETS fixes that at the same time.
    const repoRoot = path.resolve(import.meta.dirname, '..', '..')
    const names = listPromptNames(repoRoot)

    assert.ok(names.includes('init'))

    const targets = Object.entries(COMMAND_TARGETS)
      .map(([harness, target]) => ({ harness, dir: path.join(repoRoot, target.dir) }))

    // Upstream every harness ships, so a missing directory is a defect rather
    // than a choice. Without this, an installed tree's leniency would leak back
    // here and the assertion below could pass over nothing at all.
    if (isDevelopmentRepo(repoRoot)) {
      const missing = targets.filter((t) => !fs.existsSync(t.dir)).map((t) => t.harness)
      assert.deepEqual(missing, [], `el repo de desarrollo no registra comandos para: ${missing.join(', ')}`)
    }

    for (const { harness, dir } of targets.filter((t) => fs.existsSync(t.dir))) {
      for (const name of names) {
        assert.ok(fs.existsSync(path.join(dir, `${name}.md`)), `falta /${name} en ${harness}`)
      }
    }
  })
})
