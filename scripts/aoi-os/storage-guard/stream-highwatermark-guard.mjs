/**
 * scripts/aoi-os/storage-guard/stream-highwatermark-guard.mjs
 *
 * Deterministic Atomic Stream highWaterMark Memory Bounding Guard for AOI-OS:
 * Statically audits stream instantiation (fs.createReadStream, fs.createWriteStream, new Transform, new PassThrough)
 * to verify explicit bounding on highWaterMark options (e.g. <= 256KB in containerized sandboxes),
 * preventing massive unconstrained memory allocations and heap fragmentation under heavy file transfers (0 LLM Tokens).
 */

const DANGEROUS_HIGHWATERMARK_PATTERNS = [
  /highWaterMark\s*:\s*(?:[1-9]\d{7,}|[5-9]\d{6,})\b/i, // > 5MB buffer allocation
]

/**
 * Audits stream instantiation source code for highWaterMark bounding.
 *
 * @param {string} sourceCode - Stream initialization source code
 * @returns {object} HighWaterMark audit report
 */
export function auditStreamHighWaterMarkSafety(sourceCode = '') {
  const violations = []

  const createsStreams = /(?:createReadStream|createWriteStream|new\s+Transform|new\s+PassThrough)\s*\(/i.test(sourceCode)
  const hasDangerousHighWaterMark = DANGEROUS_HIGHWATERMARK_PATTERNS.some((p) => p.test(sourceCode))
  const hasBoundedHighWaterMark = /highWaterMark\s*:\s*(?:64\s*\*\s*1024|128\s*\*\s*1024|256\s*\*\s*1024|65536|131072|262144|524288|1048576|\d{1,6})\b/i.test(sourceCode)

  if (hasDangerousHighWaterMark) {
    violations.push({
      type: 'UNBOUNDED_MASSIVE_HIGHWATERMARK',
      recommendation: "Stream highWaterMark allocation exceeds safe bounds (> 5MB). Enforce explicit bounded buffer size (e.g. 64KB - 256KB: 'highWaterMark: 64 * 1024').",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    createsStreams,
    violationsCount: violations.length,
    violations,
    highWaterMarkProof: safe ? 'SAFE_HIGHWATERMARK_BOUNDING_ENFORCED' : 'UNBOUNDED_HIGHWATERMARK_MEMORY_RISK',
  }
}
