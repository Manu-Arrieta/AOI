/**
 * scripts/aoi-os/subagent-synthesizer/contract-kv-cache.mjs
 *
 * Semantic Contract KV-Cache & Deduplicator for AOI-OS:
 * Caches shared interfaces, schemas, and constitution rules across tasks in the same wave,
 * replacing bulky repeated contract definitions with compact reference signatures.
 */

import crypto from 'node:crypto'

/**
 * Creates an in-memory Contract KV-Cache for an execution wave/session.
 *
 * @returns {object} Cache manager
 */
export function createContractKvCache() {
  const cache = new Map()

  /**
   * Registers or retrieves a cached contract reference.
   *
   * @param {string} contractId - Logical name of contract (e.g. "IAuthService", "UserSchema")
   * @param {string} rawContent - Full text/code of contract
   * @returns {{ refKey: string, isCached: boolean, compactSnippet: string }}
   */
  function registerContract(contractId, rawContent = '') {
    const hash = crypto.createHash('sha256').update(rawContent).digest('hex').slice(0, 8)
    const refKey = `@contract:${contractId}#${hash}`

    if (cache.has(refKey)) {
      return {
        refKey,
        isCached: true,
        compactSnippet: `[REF: ${refKey}] (pre-cached in wave)`,
      }
    }

    cache.set(refKey, {
      contractId,
      rawContent,
      registeredAt: new Date().toISOString(),
    })

    return {
      refKey,
      isCached: false,
      compactSnippet: rawContent,
    }
  }

  /**
   * Clears the cache between execution sessions.
   */
  function clear() {
    cache.clear()
  }

  /**
   * Retrieves the number of registered contracts.
   */
  function size() {
    return cache.size
  }

  return {
    registerContract,
    clear,
    size,
  }
}
