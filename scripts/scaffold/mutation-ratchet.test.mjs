/**
 * scripts/scaffold/mutation-ratchet.test.mjs
 *
 * The ratchet decides whether a suite is allowed to constrain less than it
 * did yesterday, and it was the last file in `scripts/` that no test reached
 * — declared as an exemption because running it takes twenty minutes.
 *
 * That reasoning covered `main()`, which orchestrates the probe. It did not
 * cover `judge()`, which is where the decision actually lives and is a pure
 * function of three numbers. A ratchet whose comparison is wrong either
 * blocks every branch or ratchets nothing, and both look the same from
 * outside: no output.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { judge, MUTATION_FLOOR, RUNNERS, SHELL_AREAS, TEST_GLOB } from './mutation-ratchet.mjs'

const FLOOR = { 'scripts/demo': 60 }

describe('judge compares a measurement against its floor', () => {
  it('holds when the score equals the floor exactly', () => {
    const v = judge('scripts/demo', 60, 100, FLOOR)
    assert.equal(v.score, 60)
    assert.equal(v.verdict, 'held')
  })

  it('regresses below the floor, by a single point', () => {
    // One point matters: the floor is the measured value, so any drop means
    // something that used to be constrained no longer is.
    assert.equal(judge('scripts/demo', 59, 100, FLOOR).verdict, 'regressed')
  })

  it('improves above the floor', () => {
    const v = judge('scripts/demo', 75, 100, FLOOR)
    assert.equal(v.verdict, 'improved')
    assert.equal(v.expected, 60)
  })

  it('rounds the score rather than truncating it', () => {
    // 2/3 is 66.67%. Truncating would report 66 and, against a floor of 67,
    // manufacture a regression out of arithmetic.
    assert.equal(judge('scripts/demo', 2, 3, FLOOR).score, 67)
  })

  it('reports zero for an area with no mutants instead of dividing by zero', () => {
    // A source set that produced nothing to mutate is not a perfect score.
    const v = judge('scripts/demo', 0, 0, FLOOR)
    assert.equal(v.score, 0)
    assert.equal(v.verdict, 'regressed')
  })

  it('calls an area with no declared floor undeclared, not regressed', () => {
    // A new area must be recorded deliberately; treating it as a failure
    // would push someone to add a floor without measuring it.
    const v = judge('scripts/nueva', 10, 100, FLOOR)
    assert.equal(v.verdict, 'undeclared')
    assert.equal(v.expected, undefined)
  })

  it('treats a floor of zero as a real floor, not as absent', () => {
    assert.equal(judge('scripts/cero', 0, 10, { 'scripts/cero': 0 }).verdict, 'held')
  })
})

describe('the shipped configuration', () => {
  it('declares a floor for every area between 0 and 100', () => {
    const areas = Object.entries(MUTATION_FLOOR)
    assert.ok(areas.length >= 12, `sólo ${areas.length} áreas declaradas`)
    for (const [area, floor] of areas) {
      assert.ok(Number.isInteger(floor), `${area}: el piso no es entero`)
      assert.ok(floor >= 0 && floor <= 100, `${area}: piso fuera de rango (${floor})`)
    }
  })

  it('builds a test glob from the area path', () => {
    assert.equal(TEST_GLOB('scripts/demo'), 'scripts/demo/*.test.mjs')
  })

  it('gives every custom runner a command and a working directory', () => {
    // A runner missing its cwd runs vitest from the repository root, where
    // it finds no config and reports zero tests — a clean baseline failure
    // that looks like a broken suite.
    for (const [area, runner] of Object.entries(RUNNERS)) {
      assert.ok(MUTATION_FLOOR[area] !== undefined, `${area} tiene runner y no tiene piso`)
      assert.equal(typeof runner.command, 'string')
      assert.ok(Array.isArray(runner.args) && runner.args.length > 0)
      assert.equal(typeof runner.cwd, 'string')
    }
  })

  it('declares the shell areas it knows about', () => {
    for (const area of SHELL_AREAS) {
      assert.ok(MUTATION_FLOOR[area] !== undefined, `${area} figura como shell y no tiene piso`)
    }
  })
})
