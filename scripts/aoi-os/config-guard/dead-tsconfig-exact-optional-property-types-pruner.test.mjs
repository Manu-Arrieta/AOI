import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigExactOptionalPropertyTypes } from './dead-tsconfig-exact-optional-property-types-pruner.mjs'

test('auditDeadTsconfigExactOptionalPropertyTypes approves valid configuration with strict: true', () => {
  const tsconfig = {
    compilerOptions: {
      exactOptionalPropertyTypes: true,
      strict: true,
    },
  }
  const result = auditDeadTsconfigExactOptionalPropertyTypes(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.isInvalid, false)
  assert.equal(result.exactOptionalProof, 'TSCONFIG_EXACT_OPTIONAL_PROPERTY_TYPES_VALID')
})

test('auditDeadTsconfigExactOptionalPropertyTypes detects and repairs invalid non-strict configuration with deprecated flag', () => {
  const tsconfig = {
    compilerOptions: {
      exactOptionalPropertyTypes: true,
      strict: false,
      suppressImplicitAnyIndexErrors: true,
    },
  }
  const result = auditDeadTsconfigExactOptionalPropertyTypes(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.isInvalid, true)
  assert.equal(result.exactOptionalProof, 'EXACT_OPTIONAL_PROPERTY_TYPES_REPAIRED')
  assert.equal(result.prunedTsconfig.compilerOptions.strict, true)
  assert.equal(result.prunedTsconfig.compilerOptions.suppressImplicitAnyIndexErrors, undefined)
})
