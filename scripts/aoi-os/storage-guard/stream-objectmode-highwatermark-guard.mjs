/**
 * scripts/aoi-os/storage-guard/stream-objectmode-highwatermark-guard.mjs
 *
 * Deterministic Atomic Stream objectMode & HighWaterMark Scale Guard for AOI-OS:
 * Statically audits stream instantiation options (Readable, Writable, Transform) when objectMode: true is set
 * to verify that highWaterMark does not exceed object-scale bounds (<= 1024), preventing catastrophic heap bloat
 * caused by accidentally applying binary byte-scale numbers (e.g. 16384, 65536) to object streams (0 LLM Tokens).
 */

/**
 * Audits stream instantiation source code for objectMode and highWaterMark scale compatibility.
 *
 * @param {string} sourceCode - Stream instantiation source code
 * @returns {object} objectMode highWaterMark scale audit report
 */
export function auditStreamObjectModeHighWaterMarkSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasObjectMode = /objectMode\s*:\s*true/i.test(cleanCode)

  if (hasObjectMode) {
    const hwmMatch = cleanCode.match(/highWaterMark\s*:\s*(\d+)/i)
    if (hwmMatch) {
      const hwmValue = parseInt(hwmMatch[1], 10)
      if (hwmValue > 1024) {
        violations.push({
          type: 'OBJECT_MODE_BYTE_SCALE_HIGHWATERMARK',
          highWaterMark: hwmValue,
          recommendation: `Stream configured with 'objectMode: true' has 'highWaterMark: ${hwmValue}'. In objectMode, highWaterMark counts JavaScript objects rather than bytes. Limit highWaterMark to <= 1024 (e.g. 16 or 64) to prevent severe V8 heap exhaustion.`,
        })
      }
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasObjectMode,
    violationsCount: violations.length,
    violations,
    objectModeProof: safe ? 'OBJECT_MODE_HIGHWATERMARK_SCALED' : 'EXCESSIVE_OBJECT_BUFFERING_RISK',
  }
}
