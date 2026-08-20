/**
 * scripts/aoi-os/cache-optimizer/incremental-audit-cache.mjs
 *
 * Deterministic Content-Hash Incremental Audit Cache for AOI-OS:
 * Calculates SHA-256 digests of source files to cache and retrieve audit results in O(1) time,
 * eliminating redundant static analysis on unchanged files across task execution waves (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Computes deterministic SHA-256 hash for content.
 *
 * @param {string} content
 * @returns {string} Hexadecimal hash
 */
export function computeContentHash(content = '') {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
}

/**
 * Creates an in-memory or persisted incremental audit cache instance.
 *
 * @param {object} options
 * @returns {object} Audit cache manager
 */
export function createIncrementalAuditCache(options = {}) {
  const cache = new Map(options.initialEntries ? Object.entries(options.initialEntries) : [])
  let hits = 0
  let misses = 0

  /**
   * Generates a composite cache key from file path, rule name, and content hash.
   *
   * @param {string} filePath
   * @param {string} ruleName
   * @param {string} content
   * @returns {string} Composite key
   */
  function makeKey(filePath, ruleName, content) {
    const hash = computeContentHash(content)
    return `${filePath}::${ruleName}::${hash}`
  }

  /**
   * Retrieves cached audit result if available.
   *
   * @param {string} filePath
   * @param {string} ruleName
   * @param {string} content
   * @returns {object|null} Cached result or null
   */
  function get(filePath, ruleName, content) {
    const key = makeKey(filePath, ruleName, content)
    if (cache.has(key)) {
      hits++
      return {
        cached: true,
        result: cache.get(key),
        key,
      }
    }
    misses++
    return null
  }

  /**
   * Stores an audit result in cache.
   *
   * @param {string} filePath
   * @param {string} ruleName
   * @param {string} content
   * @param {object} result
   */
  function set(filePath, ruleName, content, result) {
    const key = makeKey(filePath, ruleName, content)
    cache.set(key, result)
  }

  /**
   * Wraps an audit function with automatic caching.
   *
   * @param {string} ruleName
   * @param {Function} auditFn
   * @returns {Function} Cached audit function
   */
  function wrapAudit(ruleName, auditFn) {
    return (filePath, content, ...args) => {
      const cachedEntry = get(filePath, ruleName, content)
      if (cachedEntry) {
        return cachedEntry.result
      }
      const freshResult = auditFn(content, ...args)
      set(filePath, ruleName, content, freshResult)
      return freshResult
    }
  }

  /**
   * Returns cache performance statistics.
   *
   * @returns {object} Cache statistics
   */
  function getStats() {
    const total = hits + misses
    const hitRate = total > 0 ? (hits / total) * 100 : 0
    return {
      size: cache.size,
      hits,
      misses,
      hitRatePercentage: Math.round(hitRate * 100) / 100,
    }
  }

  return {
    get,
    set,
    wrapAudit,
    getStats,
    clear: () => cache.clear(),
  }
}
