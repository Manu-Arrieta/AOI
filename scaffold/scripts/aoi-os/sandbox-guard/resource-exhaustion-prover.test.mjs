import test from 'node:test'
import assert from 'node:assert/strict'
import { proveResourceContainment } from './resource-exhaustion-prover.mjs'

test('proveResourceContainment proves hermetic cleanup for safe code', () => {
  const safeCode = `
export function setupWatcher(emitter: any) {
  const handler = () => {};
  emitter.on('data', handler);
  return () => emitter.off('data', handler);
}
`
  const result = proveResourceContainment(safeCode)
  assert.equal(result.hermetic, true)
  assert.equal(result.containmentProof, 'PROVEN_HERMETIC_CLEANUP')
  assert.equal(result.totalLeaksDetected, 0)
})

test('proveResourceContainment flags unclosed intervals and unhandled streams', () => {
  const leakyCode = `
import fs from 'node:fs'
export function streamFile() {
  const stream = fs.createReadStream('data.csv');
  setInterval(() => { console.log('tick'); }, 1000);
}
`
  const result = proveResourceContainment(leakyCode)
  assert.equal(result.hermetic, false)
  assert.equal(result.containmentProof, 'RESOURCE_LEAKS_DETECTED')
  assert.equal(result.totalLeaksDetected, 2)
  assert.ok(result.leaks.some((l) => l.resource === 'TIMER_HANDLE'))
  assert.ok(result.leaks.some((l) => l.resource === 'FILE_STREAM_DESCRIPTOR'))
})
