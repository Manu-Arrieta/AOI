import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigCheckJs } from './dead-tsconfig-checkjs-pruner.mjs'

test('auditDeadTsconfigCheckJs approves valid allowJs and checkJs configuration', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      allowJs: true,
      checkJs: true,
    },
  }
  const result = auditDeadTsconfigCheckJs(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.checkJsProof, 'TSCONFIG_CHECK_JS_CONSISTENT')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigCheckJs detects inert checkJs: true without allowJs', () => {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      checkJs: true,
    },
  }
  const result = auditDeadTsconfigCheckJs(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.checkJsProof, 'INERT_CHECK_JS_DETECTED')
  assert.equal(result.deadCount, 1)
})
