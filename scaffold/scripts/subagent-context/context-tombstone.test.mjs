import test from 'node:test'
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
