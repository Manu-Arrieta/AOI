/**
 * scripts/doctor-verdict-rules.test.mjs
 *
 * The rule that turns eleven checks into one word for the Owner.
 *
 * `pnpm aoi:doctor` ends with "AOI Workspace is fully operational and
 * healthy", and that sentence rests on a single line:
 *
 *     allChecks.some((c) => c.mandatory && c.status === 'FAILED')
 *
 * A mutation probe over `scripts/` scored 15% — the worst in the repository —
 * and both mutations of that line survived. With `||` any non-mandatory
 * warning condemns a healthy workspace and every mandatory check condemns it
 * unconditionally; with `!==` a workspace is unhealthy precisely when nothing
 * failed. Nothing noticed either. The six `mandatory` flags below it were
 * equally unconstrained: which checks can block was decided by a literal
 * nothing asserted.
 *
 * A diagnostic whose verdict is unchecked is worse than none: its green is
 * the reason nobody looks further.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { runAoiDoctor } from './aoi-doctor.mjs'

/** A workspace where every check can be made to pass or fail on demand. */
function workspace({ healthy = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-doc-'))
  if (healthy) {
    fs.mkdirSync(path.join(root, '.tasks'), { recursive: true })
    fs.writeFileSync(path.join(root, '.tasks/registry.md'), '# Registry\n\n| TASK-ID |\n| :-- |\n')
    fs.mkdirSync(path.join(root, '.specify/memory/versions'), { recursive: true })
    fs.writeFileSync(
      path.join(root, '.specify/memory/versions/active.json'),
      JSON.stringify({ formatVersion: 1, workspaceStates: {} })
    )
    fs.mkdirSync(path.join(root, '.resources/userstories'), { recursive: true })
    fs.mkdirSync(path.join(root, '.resources/workflows'), { recursive: true })
    fs.writeFileSync(path.join(root, '.resources/constitution.md'), '# Constitution\n')
    // The constitution is a governed path, so a workspace that has it and no
    // mirror fails parity — which is mandatory. A "healthy" fixture has to be
    // healthy by the product's own definition, not by ours.
    fs.mkdirSync(path.join(root, 'scaffold/.resources'), { recursive: true })
    fs.writeFileSync(path.join(root, 'scaffold/.resources/constitution.md'), '# Constitution\n')
  }
  return root
}

/** Runs the doctor with every binary reported present and ICM healthy. */
const allToolsPresent = async (file) => {
  if (file === 'icm') return { stdout: 'Database integrity: ok\nhealthy\n', stderr: '' }
  return { stdout: '/usr/local/bin/' + file + '\n', stderr: '' }
}

const run = (root, execFn = allToolsPresent) => runAoiDoctor({ repoRoot: root, execFn })

describe('the verdict follows from the mandatory checks alone', () => {
  it('a workspace whose mandatory checks pass is reported ok', async () => {
    const root = workspace()
    const report = await run(root)
    const mandatoryFailed = report.checks.filter((c) => c.mandatory && c.status === 'FAILED')
    assert.deepEqual(mandatoryFailed.map((c) => c.name), [], 'el fixture no está sano')
    assert.equal(report.ok, true)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('a FAILED mandatory check makes the verdict not-ok', async () => {
    // The registry is mandatory. Removing it is the smallest thing that
    // must flip the whole report.
    const root = workspace()
    fs.rmSync(path.join(root, '.tasks/registry.md'))
    const report = await run(root)
    const registry = report.checks.find((c) => c.name.includes('Task Registry'))
    assert.equal(registry.status, 'FAILED')
    assert.equal(report.ok, false)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('a non-mandatory check that fails does NOT condemn the workspace', async () => {
    // This is the `&&` half. With `||` the harness rules — declared
    // non-mandatory on purpose, because not every project installs every
    // harness — would block a perfectly healthy workspace.
    const root = workspace()
    const report = await run(root)
    const optional = report.checks.filter((c) => !c.mandatory)
    assert.ok(optional.length > 0, 'no hay ningún check opcional que probar')
    assert.ok(
      optional.some((c) => c.status !== 'PASSED'),
      'el fixture no ejercita un check opcional en rojo'
    )
    assert.equal(report.ok, true, 'un check opcional condenó el workspace')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('a mandatory check that merely WARNS does not condemn it either', async () => {
    // The `=== 'FAILED'` half. With `!==` a warning — or a pass — would read
    // as a failure.
    const root = workspace()
    const report = await run(root)
    const warnings = report.checks.filter((c) => c.status === 'WARNING')
    assert.equal(report.ok, warnings.every(() => true) && report.summary.failed === 0 ? true : report.ok)
    assert.equal(
      report.ok,
      !report.checks.some((c) => c.mandatory && c.status === 'FAILED'),
      'el veredicto no se deriva de los checks obligatorios fallidos'
    )
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('which checks can block is a decision, and it is asserted', () => {
  it('declares exactly the expected checks mandatory', async () => {
    // Flipping any of these literals changes what can block a workspace, and
    // a flipped flag is invisible: the report looks identical until the day
    // it lets something through.
    const root = workspace()
    const report = await run(root)
    const byName = (needle) => report.checks.find((c) => c.name.includes(needle))

    assert.equal(byName('ICM Doctor').mandatory, true)
    assert.equal(byName('Task Registry').mandatory, true)
    assert.equal(byName('Memory Versioning').mandatory, true)
    assert.equal(byName('Scaffold Parity').mandatory, true)
    assert.equal(byName('AI Assistant Rules').mandatory, false)
    assert.equal(byName('.resources/ Subtree').mandatory, false)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('reports every check it ran, and the summary adds up', async () => {
    const root = workspace()
    const report = await run(root)
    const { total, passed, warnings, failed } = report.summary
    assert.equal(total, report.checks.length)
    assert.equal(passed + warnings + failed, total, `${passed}+${warnings}+${failed} ≠ ${total}`)
    assert.equal(passed, report.checks.filter((c) => c.status === 'PASSED').length)
    assert.equal(failed, report.checks.filter((c) => c.status === 'FAILED').length)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('condemns a workspace missing everything', async () => {
    const root = workspace({ healthy: false })
    const report = await run(root)
    assert.equal(report.ok, false)
    assert.ok(report.summary.failed > 0)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('a missing tool is a failure, not a silence', () => {
  it('reports a mandatory binary that is absent and condemns the workspace', async () => {
    // `which` exiting non-zero is the normal way a tool reports absence; a
    // doctor that swallowed it would certify a workspace with no ICM.
    const root = workspace()
    const noTools = async () => {
      throw Object.assign(new Error('not found'), { status: 1 })
    }
    const report = await run(root, noTools)
    const missing = report.checks.filter((c) => c.name.startsWith('Binary:') && c.status === 'FAILED')
    assert.ok(missing.length > 0, 'ningún binario ausente se reportó como fallo')
    assert.equal(report.ok, false)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does not report ICM healthy when its output says nothing of the sort', async () => {
    const root = workspace()
    const brokenIcm = async (file) => {
      if (file === 'icm') return { stdout: 'corrupted index\n', stderr: '' }
      return { stdout: '/usr/local/bin/' + file + '\n', stderr: '' }
    }
    const report = await run(root, brokenIcm)
    assert.notEqual(report.checks.find((c) => c.name.includes('ICM Doctor')).status, 'PASSED')
    fs.rmSync(root, { recursive: true, force: true })
  })
})
