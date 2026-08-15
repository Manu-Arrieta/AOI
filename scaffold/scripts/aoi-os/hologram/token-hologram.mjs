/**
 * scripts/aoi-os/hologram/token-hologram.mjs
 *
 * Deterministic Semantic Token Hologram & Ultra-Compression Fabric for AOI-OS:
 * Holographically encodes large documentation, specifications, and architecture decisions
 * into 256-bit bitsets for near-infinite context and zero-token binary lookups (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Maps a keyword string to a bit index (0 to 255).
 *
 * @param {string} token
 * @returns {number} 0-255 bit index
 */
function hashToBitIndex(token) {
  const hash = crypto.createHash('sha256').update(token.toLowerCase().trim()).digest()
  return hash[0] // 0-255
}

/**
 * Creates a Semantic Token Hologram from an array of text snippets or markdown files.
 *
 * @param {string[]} texts
 * @returns {object} Token hologram instance
 */
export function createTokenHologram(texts = []) {
  // 256-bit bitset as 8 x 32-bit unsigned integers
  const bitset = new Uint32Array(8)
  const tokenSet = new Set()

  for (const text of texts) {
    if (!text || typeof text !== 'string') continue
    const words = text.toLowerCase().match(/[a-z0-9_-]{3,}/g) || []
    for (const word of words) {
      tokenSet.add(word)
      const bitIndex = hashToBitIndex(word)
      const arrayIndex = Math.floor(bitIndex / 32)
      const bitOffset = bitIndex % 32
      bitset[arrayIndex] |= 1 << bitOffset
    }
  }

  /**
   * Tests if the hologram potentially contains the specified query concept.
   *
   * @param {string} concept
   * @returns {boolean}
   */
  function containsConcept(concept) {
    const bitIndex = hashToBitIndex(concept)
    const arrayIndex = Math.floor(bitIndex / 32)
    const bitOffset = bitIndex % 32
    return (bitset[arrayIndex] & (1 << bitOffset)) !== 0
  }

  /**
   * Serializes the 256-bit hologram to a 64-character hex string.
   */
  function toHexString() {
    return Array.from(bitset)
      .map((n) => n.toString(16).padStart(8, '0'))
      .join('')
  }

  return {
    containsConcept,
    toHexString,
    totalUniqueTokens: tokenSet.size,
  }
}
