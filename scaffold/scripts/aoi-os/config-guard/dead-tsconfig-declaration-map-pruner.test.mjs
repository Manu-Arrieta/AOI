import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigDeclarationMap } from './dead-tsconfig-declaration-map-pruner.mjs'

test('auditDeadTsconfigDeclarationMap approves tsconfig with declaration and declarationMap enabled', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      declaration: true,
      declarationMap: true,
    },
  }
  const result = auditDeadTsconfigDeclarationMap(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.declarationMapProof, 'TSCONFIG_DECLARATION_MAP_CONSISTENT')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigDeclarationMap detects orphan declarationMap without declaration', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      declarationMap: true,
    },
  }
  const result = auditDeadTsconfigDeclarationMap(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.declarationMapProof, 'ORPHAN_DECLARATION_MAP_DETECTED')
  assert.equal(result.deadCount, 1)
})
