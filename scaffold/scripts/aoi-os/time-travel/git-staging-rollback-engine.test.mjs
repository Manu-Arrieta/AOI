import test from 'node:test'
import assert from 'node:assert/strict'
import { createGitStagingRollbackEngine } from './git-staging-rollback-engine.mjs'

test('createGitStagingRollbackEngine captures checkpoint and plans clean restoration', () => {
  const engine = createGitStagingRollbackEngine()
  const initialFiles = {
    'server/api/tasks.ts': 'export const tasks = [];',
    'package.json': '{"name":"test"}',
  }

  const digest = engine.captureCheckpoint('wave-1', initialFiles)
  assert.equal(digest.length, 64)
  assert.equal(engine.hasCheckpoint('wave-1'), true)

  // Mutate one file and add a rogue file
  const mutatedFiles = {
    'server/api/tasks.ts': 'export const tasks = [1, 2, 3]; // broken mutation',
    'package.json': '{"name":"test"}',
    'temp/rogue.js': 'console.log("leak");',
  }

  const plan = engine.planRollback('wave-1', mutatedFiles)
  assert.equal(plan.restoreCount, 1)
  assert.equal(plan.removeCount, 1)
  assert.equal(plan.restoreFiles[0].filePath, 'server/api/tasks.ts')
  assert.equal(plan.restoreFiles[0].targetContent, 'export const tasks = [];')
  assert.equal(plan.removeFiles[0], 'temp/rogue.js')
})

test('createGitStagingRollbackEngine reports isClean when files match checkpoint', () => {
  const engine = createGitStagingRollbackEngine()
  const files = { 'a.js': 'const a = 1;' }
  engine.captureCheckpoint('wave-0', files)

  const plan = engine.planRollback('wave-0', files)
  assert.equal(plan.isClean, true)
  assert.equal(plan.restoreCount, 0)
  assert.equal(plan.removeCount, 0)
})
