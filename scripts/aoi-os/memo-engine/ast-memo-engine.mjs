/**
 * scripts/aoi-os/memo-engine/ast-memo-engine.mjs
 *
 * Deterministic Content-Addressable AST Symbol Memoization Engine for AOI-OS:
 * Tracks cryptographic SHA-256 hashes per symbol to isolate mutated AST nodes
 * and freeze untouched sub-graphs during wave execution (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Computes deterministic SHA-256 hash of a string slice.
 *
 * @param {string} text
 * @returns {string} 64-char hex digest
 */
function computeHash(text) {
  return crypto.createHash('sha256').update(text.trim()).digest('hex')
}

/**
 * Extracts and hashes top-level symbols from source code.
 *
 * @param {string} sourceCode
 * @returns {Map<string, { symbol: string, hash: string, body: string }>}
 */
export function extractSymbolHashMap(sourceCode = '') {
  const symbolMap = new Map()
  if (!sourceCode || typeof sourceCode !== 'string') return symbolMap

  // 1. Match functions: (export )?(async )?function name(...) { ... }
  const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)[^{]*\{[\s\S]*?\n\}/g
  let match
  while ((match = fnRegex.exec(sourceCode)) !== null) {
    const sym = match[1]
    const body = match[0]
    symbolMap.set(sym, {
      symbol: sym,
      hash: computeHash(body),
      body,
    })
  }

  // 2. Match interfaces / types
  const typeRegex = /(?:export\s+)?(?:interface|type)\s+([A-Za-z0-9_$]+)\s*[={][\s\S]*?\n\}/g
  while ((match = typeRegex.exec(sourceCode)) !== null) {
    const sym = match[1]
    const body = match[0]
    if (!symbolMap.has(sym)) {
      symbolMap.set(sym, {
        symbol: sym,
        hash: computeHash(body),
        body,
      })
    }
  }

  return symbolMap
}

/**
 * Creates an in-memory AST Symbol Memoization Cache instance.
 *
 * @returns {object} Memo engine instance
 */
export function createAstMemoEngine() {
  const cache = new Map() // filePath -> Map<symbolName, hash>

  /**
   * Compares a proposed file against the cache to identify mutated vs untouched symbols.
   *
   * @param {string} filePath
   * @param {string} currentCode
   * @returns {{ mutatedSymbols: string[], untouchedSymbols: string[], cacheHitRatio: number }}
   */
  function diffSymbolCache(filePath, currentCode) {
    const currentSymbols = extractSymbolHashMap(currentCode)
    const cachedSymbols = cache.get(filePath) || new Map()

    const mutatedSymbols = []
    const untouchedSymbols = []

    for (const [sym, data] of currentSymbols.entries()) {
      if (cachedSymbols.has(sym) && cachedSymbols.get(sym) === data.hash) {
        untouchedSymbols.push(sym)
      } else {
        mutatedSymbols.push(sym)
      }
    }

    const total = currentSymbols.size || 1
    const cacheHitRatio = Math.round((untouchedSymbols.length / total) * 100)

    // Update cache with current state
    const newCacheMap = new Map()
    for (const [sym, data] of currentSymbols.entries()) {
      newCacheMap.set(sym, data.hash)
    }
    cache.set(filePath, newCacheMap)

    return {
      mutatedSymbols,
      untouchedSymbols,
      cacheHitRatio,
    }
  }

  return {
    diffSymbolCache,
    extractSymbolHashMap,
  }
}
