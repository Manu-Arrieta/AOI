import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeSandboxDescriptors } from './descriptor-sanitizer.mjs'

test('sanitizeSandboxDescriptors passes clean file lists with proof of sanitization', () => {
  const cleanFiles = ['src/index.ts', 'package.json']
  const result = sanitizeSandboxDescriptors(cleanFiles)

  assert.equal(result.clean, true)
  assert.equal(result.sanitizerProof, 'SANDBOX_100PCT_SANITIZED')
  assert.equal(result.dirtyInodesCount, 0)
})

test('sanitizeSandboxDescriptors detects lingering lock files and temp directories', () => {
  const dirtyFiles = ['src/index.ts', '.sandboxes/aoi-os-tmp-T1/process.pid', 'file.lock']
  const result = sanitizeSandboxDescriptors(dirtyFiles)

  assert.equal(result.clean, false)
  assert.equal(result.sanitizerProof, 'DIRTY_DESCRIPTORS_OR_INODES_DETECTED')
  assert.equal(result.dirtyInodesCount, 2)
})
