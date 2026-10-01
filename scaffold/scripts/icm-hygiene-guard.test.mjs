// Cada muestra de basura es una memoria real de la base de esta máquina
// (2026-10-01); las curadas también. Nada acá llama al icm real: `execFn` es falso.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { checkIcmHygiene, classifyMemories, junkKind, mainCheckoutRoot, stalePaths, workspaceTopics } from './icm-hygiene-guard.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

describe('junkKind: the measured shapes of extractor junk', () => {
  const JUNK = [
    ['refusal', 'The tool outputs contain routine build/test status, file listings, code snippets, and configuration details, but no durable facts emerge'],
    ['refusal', 'The provided tool outputs contain routine operational noise: build progress logs, deployment status'],
    ['refusal', 'These outputs are transient command results'],
    ['fragment', '66     // comentario de código'],
    ['fragment', '✖ test failed: expected 3 got 4'],
    ['fragment', 'Structured output provided successfully'],
    ['cliHelp', '--keep-originals  Keep original memories after consolidation'],
    ['cliHelp', '--db <DB>        Path to the SQLite database (overrides config and ICM_DB env var).'],
    ['chatter', "Let me know what you're working on and I'll jump in."],
    ['chatter', 'Is there a specific task you would like help with in migarajeapp?'],
  ]
  for (const [kind, summary] of JUNK) {
    it(`${kind}: ${summary.slice(0, 40)}`, () => assert.equal(junkKind(summary), kind))
  }

  const CURATED = [
    'AOI enforces Single Responsibility Principle with a hard limit of 300 lines of code per file as an invariant gate.',
    'RESUELTO 2026-10-01 rama fix/stress-ledger-truth dd25220: token-accounting.mjs mide lo que reporta',
    'Nuxt UI v4.x uses `:items` instead of `:options` on USelect',
    'PURGA ICM 2026-10-01 autorizada por el Owner: 193 memorias eliminadas',
    // Falsos positivos del verificador: prosa curada que empieza nombrando código.
    '`set` on an existing key supersedes the previous row and keeps its history',
    '`assemblePhaseContext.mjs` materializa el contrato de entrada de cada fase',
    // Una cita al principio no hace fragmento a una memoria larga.
    `"Nunca por largo" fue la regla del Owner para los prompts de continuación: ${'x'.repeat(140)}`,
  ]
  for (const summary of CURATED) {
    it(`curated is not junk: ${summary.slice(0, 40)}`, () => assert.equal(junkKind(summary), null))
  }
})

describe('stalePaths: only paths this tree could have', () => {
  const tree = new Set(['/r/scripts', '/r/scripts/aoi-doctor.mjs', '/r/.github', '/r/.github/scripts/icm-hook.sh'])
  const exists = (p) => tree.has(p)

  it('a missing file under a top-level directory that exists is stale', () => {
    assert.deepEqual(stalePaths('Implementado en scripts/aoi-os/aoi-os-cli.mjs con waves', '/r', exists), ['scripts/aoi-os/aoi-os-cli.mjs'])
  })

  it('a present file is not stale, quoted or not', () => {
    assert.deepEqual(stalePaths('ver `scripts/aoi-doctor.mjs` y .github/scripts/icm-hook.sh.', '/r', exists), [])
  })

  it("another project's path (top-level directory absent here) is not judged", () => {
    assert.deepEqual(stalePaths('Kanban board at app/pages/tasks/board.vue implements drag-and-drop', '/r', exists), [])
  })

  it('an elided example is not a path', () => {
    assert.deepEqual(stalePaths('el guard de scripts/....mjs no corría', '/r', exists), [])
  })

  for (const said of ['eliminado', 'se borró: quedó borrado', 'was removed', 'deleted in 3eba0b6', 'ya no existe']) {
    it(`a memory that records the removal ("${said}") is not stale`, () => {
      assert.deepEqual(stalePaths(`scripts/nvidia-vscode-setup.sh ${said}`, '/r', exists), [])
    })
  }

  it('"a.md/b.md" is two files, judged one by one', () => {
    const t = new Set(['/r/README.md', '/r/README.es.md', '/r/docs', '/r/docs/a.md'])
    assert.deepEqual(stalePaths('ver README.md/README.es.md', '/r', (p) => t.has(p)), [])
    assert.deepEqual(stalePaths('ver docs/a.md/b.md', '/r', (p) => t.has(p)), ['docs/b.md'])
  })

  it('a file the worktree lacks but the main checkout has is not stale', () => {
    const t = new Set(['/wt/docs', '/main/docs', '/main/docs/internal/proposals/p.md'])
    assert.deepEqual(stalePaths('docs/internal/proposals/p.md', ['/wt', '/main'], (p) => t.has(p)), [])
    assert.deepEqual(stalePaths('docs/internal/proposals/p.md', ['/wt'], (p) => t.has(p)), ['docs/internal/proposals/p.md'])
  })
})

describe('mainCheckoutRoot', () => {
  it("a worktree resolves to the main checkout, from git's common dir", async () => {
    const main = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi main '))
    fs.mkdirSync(path.join(main, '.git'))
    const r = await mainCheckoutRoot('/some/worktree', async () => ({ stdout: `${path.join(main, '.git')}\n` }))
    assert.equal(r, main)
  })

  it('the main checkout itself, a bare answer or no git → null', async () => {
    const main = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi main '))
    assert.equal(await mainCheckoutRoot(main, async () => ({ stdout: path.join(main, '.git') })), null)
    assert.equal(await mainCheckoutRoot(main, async () => ({ stdout: 'All 15 ICM hook entries are healthy.' })), null)
    assert.equal(await mainCheckoutRoot(main, async () => { throw new Error('no git') }), null)
  })
})

describe('workspaceTopics: both conventions that coexist in the database', () => {
  it("AOI's protocol topics and ICM's extractor topic", () => {
    const t = workspaceTopics('AOI')
    for (const topic of ['AOI-context', 'AOI-decisions', 'AOI-errors-resolved', 'AOI-preferences', 'context-AOI', 'decisions-AOI']) {
      assert.ok(t.includes(topic), topic)
    }
  })

  it('the directory name is covered when it differs from the remote name', () => {
    assert.ok(workspaceTopics('AOI', 'icm hygiene wt').includes('context-icm hygiene wt'))
  })
})

describe('checkIcmHygiene', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi hygiene '))
  fs.mkdirSync(path.join(root, 'scripts'))
  const fake = (byTopic) => async (cmd, args) => {
    if (cmd === 'git') throw new Error('no remote')
    assert.deepEqual(args.slice(0, 2), ['--read-only', 'list'], 'only ever reads')
    return { stdout: JSON.stringify(byTopic[args[3]] ?? []) }
  }
  const ws = path.basename(root)

  it('clean memories → PASSED', async () => {
    const r = await checkIcmHygiene(root, fake({ [`${ws}-context`]: [{ id: 'a', topic: `${ws}-context`, summary: 'Decisión: pnpm workspaces.' }] }))
    assert.equal(r.status, 'PASSED')
  })

  it('junk and stale paths → WARNING naming both counts', async () => {
    const r = await checkIcmHygiene(
      root,
      fake({
        [`context-${ws}`]: [
          { id: 'j', topic: `context-${ws}`, summary: 'Structured output provided successfully' },
          { id: 's', topic: `context-${ws}`, summary: 'Ver scripts/aoi-os/x.mjs' },
        ],
      }),
    )
    assert.equal(r.status, 'WARNING')
    assert.match(r.details, /1 basura del extractor \(1 fragment\)/)
    assert.match(r.details, /1 citan rutas que ya no existen/)
    assert.deepEqual(r.junk.map((j) => j.id), ['j'])
    assert.deepEqual(r.stale.map((s) => s.id), ['s'])
  })

  it('an unreadable ICM is a WARNING, never a clean bill of health', async () => {
    const r = await checkIcmHygiene(root, async (cmd) => {
      if (cmd === 'git') throw new Error('no remote')
      throw new Error('icm: command not found')
    })
    assert.equal(r.status, 'WARNING')
    assert.match(r.details, /no se pudo leer ICM/)
  })

  it('output that is not JSON counts as unreadable', async () => {
    const r = await checkIcmHygiene(root, async (cmd) => {
      if (cmd === 'git') throw new Error('no remote')
      return { stdout: 'All 15 ICM hook entries are healthy.' }
    })
    assert.equal(r.status, 'WARNING')
  })

  it('classifyMemories: junk wins over a path, so nothing is counted twice', () => {
    const r = classifyMemories([{ id: 'x', topic: 't', summary: '// scripts/aoi-os/x.mjs' }], root)
    assert.equal(r.junk.length, 1)
    assert.equal(r.stale.length, 0)
  })
})

describe('CLI', () => {
  it('an unknown flag exits 2 instead of running', () => {
    const r = spawnSync(process.execPath, [path.join(HERE, 'icm-hygiene-guard.mjs'), '--lsit'], { encoding: 'utf8' })
    assert.equal(r.status, 2)
    assert.match(r.stderr, /flag desconocido/)
  })
})
