import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDirectoryTraversalBoundarySafety } from './directory-traversal-boundary-guard.mjs'

test('auditDirectoryTraversalBoundarySafety approves anchored realpath filesystem read', () => {
  const code = `
function readScopedFile(root, relativePath) {
  const resolved = fs.realpathSync(path.resolve(root, relativePath));
  if (!resolved.startsWith(root)) {
    throw new Error('Path escapes root boundary');
  }
  return fs.readFileSync(resolved, 'utf8');
}
`
  const result = auditDirectoryTraversalBoundarySafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.boundaryProof, 'CANONICAL_WORKSPACE_BOUNDARY_ANCHORED')
  assert.equal(result.violationsCount, 0)
})

test('auditDirectoryTraversalBoundarySafety detects unanchored path resolution and read', () => {
  const code = `
function readScopedFile(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  return fs.readFileSync(resolved, 'utf8');
}
`
  const result = auditDirectoryTraversalBoundarySafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.boundaryProof, 'UNANCHORED_DIRECTORY_TRAVERSAL_RISK')
  assert.equal(result.violationsCount, 1)
})
