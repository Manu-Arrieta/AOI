import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigCheckJsAllowJsDependency } from './dead-tsconfig-check-js-allow-js-dependency-pruner.mjs'

test('auditDeadTsconfigCheckJsAllowJsDependency approves valid checkJs with allowJs: true', () => {
  const tsconfig = {
    compilerOptions: {
      checkJs: true,
      allowJs: true,
      strict: true,
    },
  }
  const result = auditDeadTsconfigCheckJsAllowJsDependency(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.isInvalid, false)
  assert.equal(result.checkJsAllowJsProof, 'TSCONFIG_CHECK_JS_ALLOW_JS_DEPENDENCY_VALID')
})

test('auditDeadTsconfigCheckJsAllowJsDependency detects and repairs checkJs: true missing allowJs: true', () => {
  const tsconfig = {
    compilerOptions: {
      checkJs: true,
      strict: true,
    },
  }
  const result = auditDeadTsconfigCheckJsAllowJsDependency(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.isInvalid, true)
  assert.equal(result.checkJsAllowJsProof, 'INVALID_CHECK_JS_WITHOUT_ALLOW_JS_REPAIRED')
  assert.equal(result.prunedTsconfig.compilerOptions.allowJs, true)
})
