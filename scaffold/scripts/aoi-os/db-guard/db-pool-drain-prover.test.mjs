import test from 'node:test'
import assert from 'node:assert/strict'
import { proveDbPoolDrainSafety } from './db-pool-drain-prover.mjs'

test('proveDbPoolDrainSafety approves database pool with explicit teardown in afterAll', () => {
  const code = `
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => {
  await pool.end();
});
`
  const result = proveDbPoolDrainSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.drainProof, 'DATABASE_POOL_DRAIN_GUARANTEED')
  assert.equal(result.violationsCount, 0)
})

test('proveDbPoolDrainSafety detects database pool missing teardown closure', () => {
  const code = `
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export async function getUsers() {
  return pool.query('SELECT * FROM users');
}
`
  const result = proveDbPoolDrainSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.drainProof, 'UNCLOSED_DATABASE_POOL_DETECTED')
  assert.equal(result.violationsCount, 1)
})
