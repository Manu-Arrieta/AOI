import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigTypes } from './dead-tsconfig-types-pruner.mjs'

test('auditDeadTsconfigTypes approves valid installed types in tsconfig.json', () => {
  const tsconfig = {
    compilerOptions: {
      types: ['node', 'vitest'],
    },
  }
  const installedTypes = ['@types/node', 'vitest']
  const result = auditDeadTsconfigTypes(tsconfig, installedTypes)
  assert.equal(result.clean, true)
  assert.equal(result.typesProof, 'TSCONFIG_TYPES_ARRAY_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigTypes detects uninstalled type package in tsconfig.json', () => {
  const tsconfig = {
    compilerOptions: {
      types: ['node', 'mocha-legacy'],
    },
  }
  const installedTypes = ['@types/node', 'vitest']
  const result = auditDeadTsconfigTypes(tsconfig, installedTypes)
  assert.equal(result.clean, false)
  assert.equal(result.typesProof, 'DEAD_TSCONFIG_TYPES_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadTypes[0].type, 'mocha-legacy')
})
