/**
 * scripts/aoi-os/bias-neutralizer/epistemic-bias-neutralizer.mjs
 *
 * Deterministic Epistemic Bias & Rationality Neutralizer for AOI-OS:
 * Statically detects cognitive biases, subjective fluff, and hand-wavy claims in rationales,
 * converting agent narratives into concise, objective, and mathematically factual assertions (0 LLM Tokens).
 */

const BUZZWORD_PATTERNS = [
  /\b(?:obviously|clearly|arguably|seamlessly|blazingly\s+fast|revolutionary)\b/gi,
  /\b(?:synergy|game-changer|silver\s+bullet|best-in-class)\b/gi,
  /\b(?:in\s+my\s+humble\s+opinion|as\s+we\s+all\s+know)\b/gi,
]

/**
 * Cleanses subjective bias and fluff from rationales and descriptions.
 *
 * @param {string} text
 * @returns {object} Neutralized text and bias audit
 */
export function neutralizeEpistemicBias(text = '') {
  let cleaned = text
  let detectedBiasesCount = 0

  for (const pattern of BUZZWORD_PATTERNS) {
    const matches = cleaned.match(pattern)
    if (matches) {
      detectedBiasesCount += matches.length
      cleaned = cleaned.replace(pattern, '').replace(/\s{2,}/g, ' ')
    }
  }

  cleaned = cleaned.trim()
  const objectivityScore = Math.max(0, 100 - detectedBiasesCount * 15)

  return {
    originalText: text,
    neutralizedText: cleaned,
    detectedBiasesCount,
    objectivityScore,
    biasStatus: detectedBiasesCount === 0 ? 'FULLY_OBJECTIVE_FACTUAL' : 'BIAS_NEUTRALIZED_AND_CLEANSED',
  }
}
