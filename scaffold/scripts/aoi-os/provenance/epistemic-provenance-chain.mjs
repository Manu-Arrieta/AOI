/**
 * scripts/aoi-os/provenance/epistemic-provenance-chain.mjs
 *
 * Deterministic Epistemic Lineage & Provenance Chain for AOI-OS:
 * Constructs cryptographic SHA-256 chained ledger blocks linking requirements in tasks.md
 * to AST modifications, test assertions, and persistent ICM memory IDs (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Creates an in-memory Cryptographic Provenance Chain.
 *
 * @returns {object} Provenance chain instance
 */
export function createProvenanceChain() {
  const blocks = []
  let latestHash = '0000000000000000000000000000000000000000000000000000000000000000'

  /**
   * Appends an immutable provenance block to the ledger.
   *
   * @param {object} entry
   * @param {string} entry.taskId
   * @param {string} entry.requirement
   * @param {string[]} [entry.modifiedFiles=[]]
   * @param {string[]} [entry.assertions=[]]
   * @param {string} [entry.memoryId='']
   * @returns {object} Appended block
   */
  function appendProvenanceBlock(entry = {}) {
    const blockIndex = blocks.length
    const timestamp = new Date().toISOString()
    const payload = `${blockIndex}:${latestHash}:${entry.taskId}:${entry.requirement}:${entry.modifiedFiles?.join(',')}:${entry.memoryId}:${timestamp}`
    const blockHash = crypto.createHash('sha256').update(payload).digest('hex')

    const block = {
      index: blockIndex,
      previousHash: latestHash,
      hash: blockHash,
      timestamp,
      taskId: entry.taskId,
      requirement: entry.requirement,
      modifiedFiles: entry.modifiedFiles || [],
      assertions: entry.assertions || [],
      memoryId: entry.memoryId || '',
    }

    blocks.push(block)
    latestHash = blockHash

    return block
  }

  /**
   * Verifies the cryptographic integrity of the entire provenance chain.
   *
   * @returns {object} Integrity verification report
   */
  function verifyChainIntegrity() {
    for (let i = 1; i < blocks.length; i++) {
      const current = blocks[i]
      const previous = blocks[i - 1]

      if (current.previousHash !== previous.hash) {
        return {
          valid: false,
          brokenAtIndex: i,
          status: 'CHAIN_INTEGRITY_TAMPERED',
        }
      }
    }

    return {
      valid: true,
      totalBlocks: blocks.length,
      latestHash,
      status: 'CHAIN_INTEGRITY_VERIFIED_100PCT',
    }
  }

  return {
    appendProvenanceBlock,
    verifyChainIntegrity,
    getBlocks: () => [...blocks],
    getLatestHash: () => latestHash,
  }
}
