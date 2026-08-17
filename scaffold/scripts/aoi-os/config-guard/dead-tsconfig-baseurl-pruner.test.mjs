import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigBaseUrl } from './dead-tsconfig-baseurl-pruner.mjs'

test('auditDeadTsconfigBaseUrl approves baseUrl when paired with paths mapping under modern resolution', () => {
  const tsconfig = {
    compilerOptions: {
      moduleResolution: 'bundler',
      baseUrl: '.',
      paths: {
        '@/*': ['./src/*'],
      },
    },
  }
  const result = auditDeadTsconfigBaseUrl(tsconfig)
  assert.equal(result.clean, true)
  assert.equal(result.baseUrlProof, 'TSCONFIG_BASE_URL_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigBaseUrl detects redundant baseUrl . without paths under bundler resolution', () => {
  const tsconfig = {
    compilerOptions: {
      moduleResolution: 'bundler',
      baseUrl: '.',
    },
  }
  const result = auditDeadTsconfigBaseUrl(tsconfig)
  assert.equal(result.clean, false)
  assert.equal(result.baseUrlProof, 'REDUNDANT_TSCONFIG_BASE_URL_DETECTED')
  assert.equal(result.deadCount, 1)
})
