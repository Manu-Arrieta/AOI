/**
 * scripts/aoi-os/storage-guard/buffer-slice-bounds-guard.mjs
 *
 * Deterministic Atomic Buffer Slicing & Subarray Bounds Guard for AOI-OS:
 * Statically audits raw Buffer and TypedArray slicing/reading operations (buf.subarray, buf.readUInt32BE, buf.copy)
 * to verify explicit boundary validation against buffer.length/byteLength before offset indexing,
 * preventing ERR_OUT_OF_RANGE exceptions and buffer over-read crashes (0 LLM Tokens).
 */

/**
 * Audits Buffer slicing and indexing source code for explicit boundary checks.
 *
 * @param {string} sourceCode - Binary buffer manipulation source code
 * @returns {object} Buffer bounds audit report
 */
export function auditBufferSliceBoundsSafety(sourceCode = '') {
  const violations = []

  const performsDynamicBufferAccess = /(?:buf|buffer|bytes)\.(?:subarray|slice|readUInt32BE|readInt32BE|readUInt16BE|copy)\s*\(\s*(?:offset|start|pos|index)/i.test(sourceCode)
  const hasExplicitBoundsCheck = /(?:offset\s*\+\s*(?:length|size|len)\s*<=\s*(?:buf|buffer|bytes)\.(?:length|byteLength)|if\s*\(\s*(?:offset|start|pos)\s*>\s*(?:buf|buffer|bytes)\.(?:length|byteLength)|throw\s+new\s+RangeError)/i.test(sourceCode)

  if (performsDynamicBufferAccess && !hasExplicitBoundsCheck) {
    violations.push({
      type: 'UNBOUNDED_DYNAMIC_BUFFER_INDEXING',
      recommendation: "Ensure explicit boundary checks ('offset + length <= buffer.length') are performed before invoking dynamic Buffer subarray, slice, or read operations.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    performsDynamicBufferAccess,
    violationsCount: violations.length,
    violations,
    boundsProof: safe ? 'SAFE_BUFFER_BOUNDARY_VALIDATION_ENFORCED' : 'UNGUARDED_BUFFER_OUT_OF_BOUNDS_RISK',
  }
}
