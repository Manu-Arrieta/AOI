import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxUlimitSafety } from './sandbox-ulimit-prover.mjs'

test('proveSandboxUlimitSafety approves batch I/O with sequential iteration', () => {
  const code = `
async function readAll(files) {
  const results = [];
  for (const file of files) {
    results.push(await fs.readFile(file, 'utf8'));
  }
  return results;
}
`
  const result = proveSandboxUlimitSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.ulimitProof, 'BOUNDED_DESCRIPTOR_CONCURRENCY_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxUlimitSafety detects unbounded Promise.all map I/O', () => {
  const code = `
async function readAll(files) {
  return Promise.all(files.map(async (f) => await fs.readFile(f, 'utf8')));
}
`
  const result = proveSandboxUlimitSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.ulimitProof, 'UNBOUNDED_IO_CONCURRENCY_DETECTED')
  assert.equal(result.violationsCount, 1)
})
