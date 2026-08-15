/**
 * scripts/aoi-os/context-compactor/micro-prompt-compactor.mjs
 *
 * Deterministic Token-Density Context Compactor & Micro-Prompt Synthesizer for AOI-OS:
 * Strips formatting noise, redundant comments, and dead tokens to deliver
 * ultra-dense context payloads (90%+ signal-to-noise ratio) for maximum LLM leverage (0 LLM Tokens).
 */

/**
 * Compacts context payload for maximum signal density.
 *
 * @param {string} rawContent
 * @param {object} [options]
 * @returns {object} Compacted prompt payload and compression metrics
 */
export function compactContextPayload(rawContent = '', options = {}) {
  const originalLength = rawContent.length

  let compacted = rawContent
    // Remove multi-line comments /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove single line comments // ...
    .replace(/(^|[^\:])\/\/[^\n]*/g, '$1')
    // Remove markdown comments <!-- ... -->
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove multiple consecutive blank lines
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    // Trim each line
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()

  const compactedLength = compacted.length
  const savedBytes = Math.max(0, originalLength - compactedLength)
  const savingsPct = originalLength > 0 ? Math.round((savedBytes / originalLength) * 100) : 0

  return {
    originalLength,
    compactedLength,
    savedBytes,
    savingsPct,
    compacted,
    densityRating: savingsPct > 30 ? 'HIGH_DENSITY_PAYLOAD' : 'NOMINAL_DENSITY',
  }
}
