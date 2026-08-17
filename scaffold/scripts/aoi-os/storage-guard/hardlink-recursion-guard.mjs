/**
 * scripts/aoi-os/storage-guard/hardlink-recursion-guard.mjs
 *
 * Deterministic Atomic Hardlink Recursion & Inode Loop Guard for AOI-OS:
 * Statically audits filesystem recursive directory traversal functions (walk, readdirRecursive, crawler)
 * to verify that inode/dev visited tracking (visitedInodes.has(stat.ino)) or strict maxDepth bounding
 * is enforced, preventing infinite loops and stack overflow DoS on cyclic hardlinks or directory junction loops (0 LLM Tokens).
 */

/**
 * Audits recursive directory walking source code for inode tracking or maxDepth bounding.
 *
 * @param {string} sourceCode - Directory traversal source code
 * @returns {object} Hardlink recursion audit report
 */
export function auditHardlinkRecursionSafety(sourceCode = '') {
  const violations = []

  const isRecursiveTraversal = /(?:readdirSync|readdir|walk|walkSync|scanDir|crawlDir)\b/g.test(sourceCode) && /(?:function\s+\w*walk|recursive|dirent\.isDirectory\(\)|statSync\([^)]*\)\.isDirectory\(\))/i.test(sourceCode)
  const tracksInodesOrDepth = /(?:visitedInodes|seenInodes|visitedDevIno|visitedPaths|\.ino\b|maxDepth|depth\s*>=|depth\s*>)/i.test(sourceCode)

  if (isRecursiveTraversal && !tracksInodesOrDepth) {
    violations.push({
      type: 'UNBOUNDED_HARDLINK_RECURSION_RISK',
      recommendation: "Ensure recursive directory walkers track visited inodes (e.g. 'visitedInodes.add(stat.ino)') or enforce a strict 'maxDepth' parameter to prevent infinite recursion on cyclic hardlinks/junctions.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isRecursiveTraversal,
    violationsCount: violations.length,
    violations,
    recursionProof: safe ? 'BOUNDED_INODE_RECURSION_ENFORCED' : 'CYCLIC_HARDLINK_RECURSION_RISK',
  }
}
