import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  auditMidCycleRewrites,
  auditRepeatedMass,
  cacheEconomics,
  partitionSurface,
  surfaceDigest,
  surfaceLoadMap,
} from './cache-prefix.mjs'
import { auditContextBudget, SDD_PHASES } from './context-budget.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('the repeated mass of the shipped cycle', () => {
  it('reconciles exactly with the context budget', () => {
    // Two instruments that describe the same surface must agree to the token,
    // or one of them is measuring a fiction. This is the cross-check: the
    // partition is built from the assembler, the floor from the budget, and
    // they were written to be independent.
    const part = partitionSurface(surfaceLoadMap(REPO))
    assert.equal(part.floor, auditContextBudget(REPO).floor)
  })

  it('splits the floor into bands that add back up', () => {
    const p = partitionSurface(surfaceLoadMap(REPO))
    assert.equal(p.universalCycle + p.repeatedCycle + p.onceCycle, p.floor)
  })

  it('charges the universal band once per phase, not once per cycle', () => {
    const p = partitionSurface(surfaceLoadMap(REPO))
    assert.equal(p.universalCycle, p.universalPerPhase * SDD_PHASES.length)
    assert.ok(p.universal.length > 0, 'ninguna superficie se carga en las seis fases')
  })

  it('holds no volatile content where it would be paid six times', () => {
    const p = partitionSurface(surfaceLoadMap(REPO))
    assert.deepEqual(auditRepeatedMass(REPO, p.universal), [])
  })

  it('is never rewritten by a phase that a later phase reloads', () => {
    // The only failure mode that actually destroys a warm cache. Free today,
    // and free is exactly when a guard is worth installing.
    const p = partitionSurface(surfaceLoadMap(REPO))
    const all = [...p.universal, ...p.repeated, ...p.once]
    assert.deepEqual(auditMidCycleRewrites(REPO, all), [])
  })
})

describe('the economics', () => {
  it('leaves the first phase paying full price and the rest paying the read rate', () => {
    assert.deepEqual(cacheEconomics(1000, 6, 0.1), {
      uncached: 6000,
      cached: 1500,
      recoverable: 4500,
    })
  })

  it('recovers nothing when a surface is loaded by a single phase', () => {
    const e = cacheEconomics(1000, 1, 0.1)
    assert.equal(e.recoverable, 0)
  })
})

/** A throwaway workspace whose surface the assembler can walk. */
function workspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-cache-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

describe('the gates detect what they claim to detect', () => {
  it('flags a buster in the repeated band', () => {
    // Negative control for the green above: a passing gate proves nothing
    // until the same gate has been shown to fail on a real violation.
    const root = workspace({ '.github/skills/x/SKILL.md': 'Fecha: 2026-09-08T10:00:00 y nada mas' })
    const rows = [{ source: '.github/skills/x/SKILL.md', tokens: 10, multiplier: 6 }]
    const v = auditRepeatedMass(root, rows)

    assert.equal(v.length, 1)
    assert.match(v[0], /x6 por ciclo/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('catches the buster that cache-guard misses past its 1500-char window', () => {
    // The concrete blind spot this module was built around: cache-guard reads
    // a prefix, so a subshell deep in a long file reads as clean.
    const root = workspace({
      '.github/skills/x/SKILL.md': `${'a'.repeat(4000)}\nBIC_ID="BIC-$(date +%Y)-NNN"`,
    })
    const rows = [{ source: '.github/skills/x/SKILL.md', tokens: 10, multiplier: 6 }]

    assert.equal(auditRepeatedMass(root, rows).length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('flags a phase that rewrites an always-injected surface', () => {
    const root = workspace({
      '.github/prompts/p.prompt.md': 'Then update .github/instructions/foo.instructions.md',
    })
    const rows = [{ source: '.github/prompts/p.prompt.md', tokens: 10, multiplier: 1 }]

    assert.equal(auditMidCycleRewrites(root, rows).length, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does not flag a surface that merely reads an injected path', () => {
    const root = workspace({ '.github/prompts/p.prompt.md': 'Read .github/instructions/foo.md' })
    const rows = [{ source: '.github/prompts/p.prompt.md', tokens: 10, multiplier: 1 }]

    assert.deepEqual(auditMidCycleRewrites(root, rows), [])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('the digest', () => {
  it('is stable for the same surface and moves when a file changes size', () => {
    // What AOI TESTS takes before and after a real cycle. A digest that did
    // not move on a rewrite would be worse than no digest at all.
    const rows = [{ source: 'a', tokens: 10 }, { source: 'b', tokens: 20 }]
    assert.equal(surfaceDigest(REPO, rows), surfaceDigest(REPO, [...rows].reverse()))
    assert.notEqual(surfaceDigest(REPO, rows), surfaceDigest(REPO, [{ source: 'a', tokens: 11 }, { source: 'b', tokens: 20 }]))
  })
})
