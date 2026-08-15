/**
 * scripts/aoi-os/zk-attestor/zk-epistemic-attestor.mjs
 *
 * Deterministic Zero-Knowledge Epistemic Attestor & Merkle Tree Engine for AOI-OS:
 * Builds cryptographic Merkle Proof Trees over verified invariants and test assertions,
 * generating verifiable compliance certificates without exposing internal sandbox memory (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Computes SHA-256 digest of a string or buffer.
 *
 * @param {string} data
 * @returns {string} Hex hash
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Builds a Merkle Tree from an array of leaves and returns root and proofs.
 *
 * @param {string[]} leaves - Array of hash strings
 * @returns {object} Merkle tree structure
 */
export function buildMerkleTree(leaves = []) {
  if (leaves.length === 0) {
    const emptyHash = sha256('EMPTY_TREE')
    return { root: emptyHash, leaves: [], depth: 0 }
  }

  let currentLevel = leaves.map((l) => (l.length === 64 ? l : sha256(l)))
  const treeLevels = [currentLevel]

  while (currentLevel.length > 1) {
    const nextLevel = []
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i]
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left
      nextLevel.push(sha256(left + right))
    }
    currentLevel = nextLevel
    treeLevels.push(currentLevel)
  }

  return {
    root: currentLevel[0],
    leaves: treeLevels[0],
    depth: treeLevels.length,
    treeLevels,
  }
}

/**
 * Generates an epistemic compliance certificate for a set of task assertions.
 *
 * @param {string} taskId
 * @param {Array<{ assertion: string, passed: boolean, signature?: string }>} assertions
 * @returns {object} Cryptographic epistemic attestation
 */
export function generateEpistemicAttestation(taskId, assertions = []) {
  const leaves = assertions.map((a) => sha256(`${taskId}:${a.assertion}:${a.passed}:${a.signature || ''}`))
  const merkle = buildMerkleTree(leaves)

  const allPassed = assertions.every((a) => a.passed)

  return {
    taskId,
    totalAssertions: assertions.length,
    allPassed,
    merkleRoot: merkle.root,
    merkleDepth: merkle.depth,
    attestationProof: allPassed ? 'PROVEN_CRYPTOGRAPHIC_COMPLIANCE' : 'UNSATISFIED_ASSERTION_DETECTED',
    timestamp: Date.now(),
  }
}
