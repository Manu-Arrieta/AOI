import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadEnvFlags } from './dead-env-pruner.mjs'

test('auditDeadEnvFlags approves fully referenced environment variables', () => {
  const flags = ['DATABASE_URL', 'PORT']
  const code = `
const dbUrl = process.env.DATABASE_URL;
const port = process.env.PORT || 3000;
`
  const result = auditDeadEnvFlags(flags, code)
  assert.equal(result.allReferenced, true)
  assert.equal(result.envProof, 'ALL_ENV_FLAGS_REFERENCED')
  assert.equal(result.deadFlagsCount, 0)
})

test('auditDeadEnvFlags detects unreferenced dead environment variables', () => {
  const flags = ['DATABASE_URL', 'OBSOLETE_REDIS_FLAG']
  const code = `
const dbUrl = process.env.DATABASE_URL;
`
  const result = auditDeadEnvFlags(flags, code)
  assert.equal(result.allReferenced, false)
  assert.equal(result.envProof, 'DEAD_ENV_FLAGS_DETECTED')
  assert.equal(result.deadFlagsCount, 1)
  assert.equal(result.deadFlags[0].key, 'OBSOLETE_REDIS_FLAG')
})
