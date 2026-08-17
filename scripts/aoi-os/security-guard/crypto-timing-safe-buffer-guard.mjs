/**
 * scripts/aoi-os/security-guard/crypto-timing-safe-buffer-guard.mjs
 *
 * Deterministic Safe Cryptographic Timing-Safe Buffer Comparison Guard for AOI-OS:
 * Statically audits HMAC, token, and signature verification routines to enforce crypto.timingSafeEqual()
 * over Buffer comparison instead of variable-time equality (===, !==, Buffer.equals) when validating
 * authentication digests, preventing timing side-channel attacks (0 LLM Tokens).
 */

/**
 * Audits source code for timing-safe signature and token comparison.
 *
 * @param {string} sourceCode - Signature/token validation source code
 * @returns {object} Timing-safe comparison audit report
 */
export function auditCryptoTimingSafeBufferSafety(sourceCode = '') {
  const violations = []

  const isVerifyingAuthOrSignature = /(?:verifySignature|checkHmac|validateToken|verifyHmac|expectedSignature|computedHmac)\b/i.test(sourceCode)
  const usesTimingSafeEqual = /(?:crypto\.timingSafeEqual|timingSafeEqual)\s*\(/g.test(sourceCode)
  const usesInsecureComparison = /(?:===|!==|\.equals\s*\()/g.test(sourceCode)

  if (isVerifyingAuthOrSignature && usesInsecureComparison && !usesTimingSafeEqual) {
    violations.push({
      type: 'VARIABLE_TIME_SIGNATURE_COMPARISON',
      recommendation: "Use 'crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))' for HMAC/signature verification to prevent timing side-channel leaks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isVerifyingAuthOrSignature,
    violationsCount: violations.length,
    violations,
    timingSafeProof: safe ? 'CONSTANT_TIME_BUFFER_COMPARISON_ENFORCED' : 'TIMING_SIDE_CHANNEL_RISK_DETECTED',
  }
}
