import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigLibs } from './dead-tsconfig-lib-pruner.mjs'

test('auditDeadTsconfigLibs approves canonical ESNext lib in node project', () => {
  const tsconfig = {
    compilerOptions: {
      lib: ['ESNext'],
    },
  }
  const result = auditDeadTsconfigLibs(tsconfig, { isNodeOnly: true })
  assert.equal(result.clean, true)
  assert.equal(result.libProof, 'TSCONFIG_LIBS_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigLibs detects duplicate and incompatible DOM libs in node project', () => {
  const tsconfig = {
    compilerOptions: {
      lib: ['ESNext', 'DOM', 'esnext'],
    },
  }
  const result = auditDeadTsconfigLibs(tsconfig, { isNodeOnly: true })
  assert.equal(result.clean, false)
  assert.equal(result.libProof, 'DEAD_OR_INCOMPATIBLE_TSCONFIG_LIBS_DETECTED')
  assert.equal(result.deadCount, 2)
})
