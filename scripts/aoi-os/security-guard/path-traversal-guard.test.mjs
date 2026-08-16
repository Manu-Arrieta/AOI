import test from 'node:test'
import assert from 'node:assert/strict'
import { auditPathTraversalSafety } from './path-traversal-guard.mjs'

test('auditPathTraversalSafety approves sanitized path reads', () => {
  const code = `
export function readConfig(fileName) {
  const safePath = path.resolve('/var/data', path.normalize(fileName));
  return fs.readFileSync(safePath, 'utf8');
}
`
  const result = auditPathTraversalSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.traversalProof, 'FILE_READS_SANITIZED_AND_CONTAINED')
  assert.equal(result.violationsCount, 0)
})

test('auditPathTraversalSafety detects unsanitized dynamic path reads', () => {
  const code = `
export function getReport(req) {
  return fs.readFileSync(req.query.file, 'utf8');
}
`
  const result = auditPathTraversalSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.traversalProof, 'POTENTIAL_PATH_TRAVERSAL_DETECTED')
  assert.equal(result.violationsCount, 1)
  assert.equal(result.violations[0].type, 'UNSANITIZED_DYNAMIC_PATH_READ')
})
