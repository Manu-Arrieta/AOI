import test from 'node:test'
import assert from 'node:assert/strict'
import { auditHardlinkRecursionSafety } from './hardlink-recursion-guard.mjs'

test('auditHardlinkRecursionSafety approves recursive crawler with visitedInodes tracking', () => {
  const code = `
function walkDir(dir, visitedInodes = new Set()) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (visitedInodes.has(stat.ino)) continue;
      visitedInodes.add(stat.ino);
      walkDir(full, visitedInodes);
    }
  }
}
`
  const result = auditHardlinkRecursionSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.recursionProof, 'BOUNDED_INODE_RECURSION_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditHardlinkRecursionSafety detects unbounded recursive walker without inode tracking', () => {
  const code = `
function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full);
    }
  }
}
`
  const result = auditHardlinkRecursionSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.recursionProof, 'CYCLIC_HARDLINK_RECURSION_RISK')
  assert.equal(result.violationsCount, 1)
})
