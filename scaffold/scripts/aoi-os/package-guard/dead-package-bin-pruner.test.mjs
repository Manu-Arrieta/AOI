import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadPackageBinaries } from './dead-package-bin-pruner.mjs'

test('auditDeadPackageBinaries approves valid CLI binary entrypoints', () => {
  const pkg = {
    bin: {
      'aoi-cli': './dist/cli.mjs',
    },
  }
  const files = ['dist/cli.mjs']
  const result = auditDeadPackageBinaries(pkg, files)
  assert.equal(result.clean, true)
  assert.equal(result.binaryProof, 'PACKAGE_BINARIES_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadPackageBinaries detects dead binary entrypoint pointing to missing file', () => {
  const pkg = {
    bin: {
      'aoi-cli': './dist/cli.mjs',
      'aoi-daemon': './dist/daemon.mjs',
    },
  }
  const files = ['dist/cli.mjs']
  const result = auditDeadPackageBinaries(pkg, files)
  assert.equal(result.clean, false)
  assert.equal(result.binaryProof, 'DEAD_PACKAGE_BINARIES_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadBinaries[0].binName, 'aoi-daemon')
})
