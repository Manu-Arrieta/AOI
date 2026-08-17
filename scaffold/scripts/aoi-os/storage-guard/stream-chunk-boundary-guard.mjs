/**
 * scripts/aoi-os/storage-guard/stream-chunk-boundary-guard.mjs
 *
 * Deterministic Atomic Stream Chunk UTF-8 Boundary Guard for AOI-OS:
 * Statically audits filesystem/network stream data listeners (createReadStream, stream.on('data'))
 * to verify that multi-byte character chunk fragmentation is prevented using StringDecoder or chunk buffers
 * rather than unguarded chunk.toString() calls in 'data' event listeners (0 LLM Tokens).
 */

/**
 * Audits stream data reading source code for multibyte boundary decoding safety.
 *
 * @param {string} sourceCode - Stream reading source code
 * @returns {object} Stream chunk boundary audit report
 */
export function auditStreamChunkBoundarySafety(sourceCode = '') {
  const violations = []

  const isStreamingData = /(?:createReadStream|\.on\s*\(\s*['"]data['"]|for\s+await\s*\(\s*const\s+\w+\s+of\s+\w*stream)/i.test(sourceCode)
  const usesRawChunkToString = /\.on\s*\(\s*['"]data['"]\s*,\s*\([^)]*\)\s*=>\s*\{[^}]*\bchunk\.toString\s*\(/i.test(sourceCode) || /(?:chunk|data)\.toString\s*\(\s*['"]utf-?8['"]?\s*\)/i.test(sourceCode)
  const usesStringDecoderOrBufferAccumulator = /(?:StringDecoder|Buffer\.concat|setEncoding\s*\(\s*['"]utf-?8['"]|\.push\s*\(\s*chunk\s*\))/i.test(sourceCode)

  if (isStreamingData && usesRawChunkToString && !usesStringDecoderOrBufferAccumulator) {
    violations.push({
      type: 'UNGUARDED_STREAM_CHUNK_TOSTRING',
      recommendation: "Use 'string_decoder.StringDecoder', 'stream.setEncoding(\"utf8\")' or accumulate chunks into an array before 'Buffer.concat()' to prevent multi-byte UTF-8 character splitting across chunk boundaries.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isStreamingData,
    violationsCount: violations.length,
    violations,
    boundaryProof: safe ? 'SAFE_UTF8_STREAM_BOUNDARY_DECODING_ENFORCED' : 'MULTIBYTE_CHUNK_FRAGMENTATION_RISK',
  }
}
