import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isTurnSuperseded, createTombstone, shrinkTurns, buildTombstoneIcmRecord } from './context-tombstone.mjs'

test('isTurnSuperseded detects older test run superseded by newer test run', () => {
  const t1 = { id: '1', tool: 'test', summary: 'vitest failed (1 test)' }
  const t2 = { id: '2', tool: 'test', summary: 'vitest passed (1 test)' }
  assert.equal(isTurnSuperseded(t1, t2), true)
})

test('isTurnSuperseded detects file read superseded by write to same target', () => {
  const read = { id: '1', tool: 'view_file', target: 'app.ts', content: 'huge content' }
  const write = { id: '2', tool: 'write_file', target: 'app.ts', content: 'new code' }
  assert.equal(isTurnSuperseded(read, write), true)
})

test('shrinkTurns replaces superseded items with 1-line tombstones', () => {
  const turns = [
    { id: '1', turnNumber: 1, tool: 'test', summary: 'test failed', content: 'long 500 line stack trace' },
    { id: '2', turnNumber: 2, tool: 'edit_file', target: 'app.ts', content: 'patch' },
    { id: '3', turnNumber: 3, tool: 'test', summary: 'test passed', content: '1 passed' }
  ]
  const shrunk = shrinkTurns(turns)
  assert.equal(shrunk[0].isTombstone, true)
  assert.match(shrunk[0].content, /\[Turn 1: test failed — SUPERSEDED by Turn 3\]/)
  assert.equal(shrunk[2].isTombstone, undefined)
  assert.equal(shrunk[2].content, '1 passed')
})

test('buildTombstoneIcmRecord prepares clean ICM storage record', () => {
  const oldTurn = { error: 'TypeError in evaluateFiberHealth', summary: 'RED test failure' }
  const newTurn = { turnNumber: 2 }
  const record = buildTombstoneIcmRecord(oldTurn, newTurn)
  assert.ok(record)
  assert.equal(record.topic, 'errors-resolved')
  assert.match(record.content, /Resolved RED test failure/)
})

/**
 * The rules below were all unconstrained: a mutation probe flipped each
 * comparison and operator in `isTurnSuperseded`, `shrinkTurns` and
 * `buildTombstoneIcmRecord` and the suite stayed green for 17 of them.
 *
 * That matters more here than almost anywhere else in the repository.
 * context-tombstone is one of the mandatory savings tools and the benchmark
 * credits it tokens per cycle; if its supersede rule is wrong, the cycle
 * either keeps turns it should have collapsed — losing the saving the
 * benchmark reports — or collapses turns it must keep, which loses context
 * the agent needed. Neither failure announces itself.
 */
describe('isTurnSuperseded, rule by rule', () => {
  const view = (id, target) => ({ id, tool: 'view_file', target })

  it('never supersedes a turn with itself', () => {
    // `older.id === newer.id` guards a self-comparison; without it a single
    // turn would tombstone itself and its content would vanish.
    assert.equal(isTurnSuperseded(view('t1', 'a.ts'), view('t1', 'a.ts')), false)
  })

  it('needs BOTH turns to exist', () => {
    assert.equal(isTurnSuperseded(null, view('t2', 'a.ts')), false)
    assert.equal(isTurnSuperseded(view('t1', 'a.ts'), null), false)
    assert.equal(isTurnSuperseded(null, null), false)
    assert.equal(isTurnSuperseded(undefined, undefined), false)
  })

  it('collapses one test run into a later one', () => {
    assert.equal(
      isTurnSuperseded({ id: 't1', tool: 'test' }, { id: 't2', tool: 'test' }),
      true
    )
  })

  it('does not collapse a test run into a different kind of turn', () => {
    assert.equal(isTurnSuperseded({ id: 't1', tool: 'test' }, { id: 't2', tool: 'view_file' }), false)
    assert.equal(isTurnSuperseded({ id: 't1', tool: 'view_file' }, { id: 't2', tool: 'test' }), false)
  })

  it('supersedes a read by a later write of the SAME file', () => {
    for (const writer of ['write_file', 'edit_file']) {
      assert.equal(
        isTurnSuperseded(view('t1', 'a.ts'), { id: 't2', tool: writer, target: 'a.ts' }),
        true,
        `${writer} sobre el mismo archivo debería reemplazar la lectura`
      )
    }
  })

  it('keeps a read when the later write touches a DIFFERENT file', () => {
    // The target comparison is what makes this safe; dropping it would
    // tombstone a read the agent still needs.
    assert.equal(
      isTurnSuperseded(view('t1', 'a.ts'), { id: 't2', tool: 'write_file', target: 'b.ts' }),
      false
    )
  })

  it('supersedes a read by a later read of the same file, and only the same file', () => {
    assert.equal(isTurnSuperseded(view('t1', 'a.ts'), view('t2', 'a.ts')), true)
    assert.equal(isTurnSuperseded(view('t1', 'a.ts'), view('t2', 'b.ts')), false)
  })

  it('does not supersede a write by a later read', () => {
    assert.equal(
      isTurnSuperseded({ id: 't1', tool: 'write_file', target: 'a.ts' }, view('t2', 'a.ts')),
      false
    )
  })
})

describe('shrinkTurns boundaries', () => {
  it('returns a copy for zero and one turn, never the same array', () => {
    // `turns.length <= 1` — with `<` a single turn would fall through to the
    // loop, and with a shared reference a caller could mutate the input.
    for (const input of [[], [{ id: 'solo', tool: 'test' }]]) {
      const out = shrinkTurns(input)
      assert.deepEqual(out, input)
      assert.notEqual(out, input, 'devolvió el mismo array, no una copia')
    }
  })

  it('tolerates a non-array', () => {
    assert.deepEqual(shrinkTurns(null), [])
    assert.deepEqual(shrinkTurns(undefined), [])
    assert.deepEqual(shrinkTurns('no soy un array'), [])
  })

  it('tombstones every turn a later one supersedes, and keeps the last', () => {
    const turns = [
      { id: 't1', tool: 'test', turnNumber: 1, content: 'salida larga 1' },
      { id: 't2', tool: 'test', turnNumber: 2, content: 'salida larga 2' },
      { id: 't3', tool: 'test', turnNumber: 3, content: 'salida larga 3' },
    ]
    const out = shrinkTurns(turns)
    assert.deepEqual(out.map((t) => Boolean(t.isTombstone)), [true, true, false])
    assert.equal(out[2].content, 'salida larga 3')
  })

  it('records the original length so the saving can be counted', () => {
    const out = shrinkTurns([
      { id: 't1', tool: 'test', turnNumber: 1, content: '0123456789' },
      { id: 't2', tool: 'test', turnNumber: 2, content: 'x' },
    ])
    assert.equal(out[0].originalLength, 10)
  })

  it('counts a missing content as zero rather than throwing', () => {
    const out = shrinkTurns([
      { id: 't1', tool: 'test', turnNumber: 1 },
      { id: 't2', tool: 'test', turnNumber: 2 },
    ])
    assert.equal(out[0].originalLength, 0)
  })

  it('names the superseding turn in the tombstone, taking the FIRST that supersedes', () => {
    const out = shrinkTurns([
      { id: 't1', tool: 'test', turnNumber: 1, content: 'a' },
      { id: 't2', tool: 'test', turnNumber: 2, content: 'b' },
      { id: 't3', tool: 'test', turnNumber: 3, content: 'c' },
    ])
    assert.match(out[0].content, /SUPERSEDED by Turn 2/)
  })
})

describe('buildTombstoneIcmRecord', () => {
  it('produces nothing when the superseded turn carries no error', () => {
    assert.equal(buildTombstoneIcmRecord({ id: 't1', summary: 'algo' }, { turnNumber: 2 }), null)
    assert.equal(buildTombstoneIcmRecord(null, { turnNumber: 2 }), null)
  })

  it('records a resolved error under the errors-resolved topic', () => {
    const record = buildTombstoneIcmRecord(
      { id: 't1', summary: 'suite roja', error: 'TypeError x' },
      { turnNumber: 7 }
    )
    assert.equal(record.topic, 'errors-resolved')
    assert.equal(record.importance, 'high')
    assert.match(record.content, /TypeError x/)
    assert.match(record.content, /Turn 7/)
  })

  it('says "later" when no resolution turn is given', () => {
    const record = buildTombstoneIcmRecord({ error: 'boom' }, undefined)
    assert.match(record.content, /Turn later/)
  })
})
