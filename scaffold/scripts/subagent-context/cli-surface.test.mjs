/**
 * scripts/subagent-context/cli-surface.test.mjs
 *
 * The command line of the TOON payload builder.
 *
 * `sanitize-subagent-payload` is the seam that enforces Invariant 2: a
 * subagent gets a payload assembled from the task's artifacts and NOTHING
 * from the conversation. That payload is produced by running this script, and
 * its `main()` — the argument loop and the exit code — had no test at all.
 *
 * Twenty-one of the area's mutants survived inside it. The loop that reads
 * `--task-dir`, `--role` and `--format` could be inverted in several places
 * and the suite stayed green, which means the payload could have been built
 * for the wrong directory, the wrong role or the wrong format without
 * anything noticing — and a payload built for the wrong task is worse than no
 * payload, because it looks right.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.join(HERE, 'sanitize-subagent-payload.mjs')

function run(args, cwd = HERE) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }
  }
}

/**
 * A tasks.md in the shape the extractor expects: one `### Task <id>` block per
 * task, each naming the role it belongs to.
 */
const TASKS_MD = [
  '# Tareas',
  '',
  '### Task T1 — @backend',
  'Crear el endpoint de cobro.',
  '',
  '### Task T2 — @frontend',
  'Construir el formulario de pago.',
  '',
].join('\n')

/** A task directory shaped the way the SDD cycle leaves one. */
function taskDir({ id = 'TASK-2026-001', feature = 'pagos', files = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-toon-'))
  const dir = path.join(root, '.tasks', feature, id)
  fs.mkdirSync(dir, { recursive: true })
  const defaults = {
    'tasks.md': TASKS_MD,
    'spec.md': '# Spec\n\nEl cobro no se repite.\n',
    'design.md': '# Design\n\nUn servicio de cobros.\n',
  }
  for (const [name, body] of Object.entries({ ...defaults, ...files })) {
    fs.writeFileSync(path.join(dir, name), body)
  }
  return { root, dir }
}

describe('the payload CLI builds for the directory it was given', () => {
  it('uses --task-dir instead of the working directory', () => {
    // The default is `.`; if the flag were dropped the payload would describe
    // whatever directory the agent happened to be standing in.
    const { root, dir } = taskDir()
    const r = run(['--task-dir', dir])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /TASK-2026-001/)
    assert.match(r.stdout, /pagos/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('reads the task id and feature from the path, not from a default', () => {
    const { root, dir } = taskDir({ id: 'TASK-2026-777', feature: 'inventario' })
    const out = run(['--task-dir', dir]).stdout
    assert.match(out, /TASK-2026-777/)
    assert.match(out, /inventario/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('honours --role', () => {
    const { root, dir } = taskDir()
    const backend = run(['--task-dir', dir, '--role', 'backend']).stdout
    const frontend = run(['--task-dir', dir, '--role', 'frontend']).stdout
    assert.notEqual(backend, frontend, 'el rol no cambió el payload, así que la bandera no se leyó')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('honours --format', () => {
    const { root, dir } = taskDir()
    const markdown = run(['--task-dir', dir, '--format', 'markdown']).stdout
    const toon = run(['--task-dir', dir, '--format', 'toon']).stdout
    assert.notEqual(markdown, toon, 'el formato no cambió la salida')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('advances past each flag value, so a value is never read as the next flag', () => {
    // The loop does `args[++i]`. Without the increment, 'backend' would be
    // examined as if it were a flag on the next pass — silently, because an
    // unrecognised token is ignored.
    const { root, dir } = taskDir()
    const r = run(['--role', 'backend', '--task-dir', dir, '--format', 'toon'])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /TASK-2026-001/, 'no aplicó --task-dir cuando venía después de otra bandera')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('ignores a flag given without a value instead of consuming the next one', () => {
    const { root, dir } = taskDir()
    const r = run(['--task-dir', dir, '--role'])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /TASK-2026-001/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('carries the design contracts and nothing from a conversation — Invariant 2', () => {
    // The payload is assembled from disk alone, and deliberately narrowly:
    // the architecture contracts travel, the spec does not. Pinning both
    // halves matters — widening it later would be a silent cost increase on
    // every delegation, and narrowing it would starve the subagent.
    const { root, dir } = taskDir({
      files: {
        'design.md': '# Design\n\nMARCADOR-DEL-DESIGN\n',
        'spec.md': '# Spec\n\nMARCADOR-DEL-SPEC\n',
      },
    })
    const out = run(['--task-dir', dir]).stdout
    assert.match(out, /MARCADOR-DEL-DESIGN/)
    assert.doesNotMatch(out, /MARCADOR-DEL-SPEC/, 'el spec entero viajó en el payload')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('gives the subagent only the tasks assigned to its role', () => {
    // The saving and the isolation are the same mechanism: a frontend agent
    // that receives the backend breakdown pays for context it must not act on.
    const { root, dir } = taskDir()
    const frontend = run(['--task-dir', dir, '--role', 'frontend']).stdout
    assert.match(frontend, /formulario de pago/)
    assert.doesNotMatch(frontend, /endpoint de cobro/, 'le pasó la tarea de backend al frontend')

    const backend = run(['--task-dir', dir, '--role', 'backend']).stdout
    assert.match(backend, /endpoint de cobro/)
    assert.doesNotMatch(backend, /formulario de pago/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('produces a payload for a task directory with no artifacts rather than crashing', () => {
    // Missing files are read as empty by design; the phase that runs first
    // has no spec yet, and refusing there would block the cycle.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-toon-vacio-'))
    const dir = path.join(root, '.tasks/feat/TASK-2026-002')
    fs.mkdirSync(dir, { recursive: true })
    const r = run(['--task-dir', dir])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /TASK-2026-002/)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
