import test from 'node:test'
import assert from 'node:assert/strict'
import { filterStackFrames, distillTestOutput, distillTscOutput } from './diagnostic-distiller.mjs'

test('filterStackFrames strips node_modules and node:internal frames', () => {
  const stack = `Error: expected stable
    at evaluateFiberHealth (server/utils/fiber-health.ts:15:9)
    at runTest (node_modules/vitest/dist/runner.js:12:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`

  const filtered = filterStackFrames(stack)
  assert.match(filtered, /server\/utils\/fiber-health\.ts:15:9/)
  assert.doesNotMatch(filtered, /node_modules\/vitest/)
  assert.doesNotMatch(filtered, /node:internal/)
})

test('distillTestOutput removes banners and retains root assertion', () => {
  const raw = `
RUN v4.1.7 /Users/equinox/Desktop/AOI
FAIL test/server/fiber-health.test.ts
  AssertionError: expected 'stable' to equal 'degraded'
    at test/server/fiber-health.test.ts:10:5
    at node_modules/vitest/index.js:5:1
Test Files 1 failed
Duration 120ms
`
  const distilled = distillTestOutput(raw)
  assert.match(distilled, /AssertionError: expected 'stable' to equal 'degraded'/)
  assert.match(distilled, /test\/server\/fiber-health\.test\.ts:10:5/)
  assert.doesNotMatch(distilled, /node_modules\/vitest/)
  assert.doesNotMatch(distilled, /RUN v4\.1\.7/)
})

test('distillTscOutput suppresses cascading TS2304 when TS2307 is present', () => {
  const tsc = `
src/index.ts:1:25 - error TS2307: Cannot find module './missing' or its corresponding type declarations.
src/index.ts:5:10 - error TS2304: Cannot find name 'MissingType'.
src/other.ts:12:8 - error TS2304: Cannot find name 'MissingType'.
`
  const distilled = distillTscOutput(tsc)
  assert.match(distilled, /TS2307: Cannot find module '\.\/missing'/)
  assert.doesNotMatch(distilled, /TS2304: Cannot find name 'MissingType'/)
})
