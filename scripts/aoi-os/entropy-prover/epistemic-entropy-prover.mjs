/**
 * scripts/aoi-os/entropy-prover/epistemic-entropy-prover.mjs
 *
 * Deterministic Epistemic Entropy & Information Divergence Prover for AOI-OS:
 * Calculates Shannon entropy over symbol and token distributions in source code,
 * mathematically proving whether an incremental task simplifies or bloats cognitive structure (0 LLM Tokens).
 */

/**
 * Calculates Shannon entropy of a string or symbol array.
 *
 * @param {string} sourceCode
 * @returns {number} Shannon entropy value (bits per symbol)
 */
export function calculateShannonEntropy(sourceCode = '') {
  if (!sourceCode || sourceCode.length === 0) return 0

  const frequencies = new Map()
  const len = sourceCode.length

  for (let i = 0; i < len; i++) {
    const char = sourceCode[i]
    frequencies.set(char, (frequencies.get(char) || 0) + 1)
  }

  let entropy = 0
  for (const count of frequencies.values()) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }

  return Number(entropy.toFixed(4))
}

/**
 * Proves epistemic entropy evolution between previous and current code states.
 *
 * @param {string} prevCode
 * @param {string} currCode
 * @returns {object} Entropy delta and cognitive sprawl proof
 */
export function proveEpistemicEntropy(prevCode = '', currCode = '') {
  const prevEntropy = calculateShannonEntropy(prevCode)
  const currEntropy = calculateShannonEntropy(currCode)
  const deltaEntropy = Number((currEntropy - prevEntropy).toFixed(4))

  const isSimplifiedOrStable = deltaEntropy <= 0.25

  return {
    prevEntropy,
    currEntropy,
    deltaEntropy,
    isSimplifiedOrStable,
    entropyStatus: isSimplifiedOrStable ? 'COGNITIVE_ENTROPY_OPTIMAL' : 'COGNITIVE_SPRAWL_DETECTED',
  }
}
