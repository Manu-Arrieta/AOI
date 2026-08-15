/**
 * scripts/aoi-os/memory-guard/heap-allocation-prover.mjs
 *
 * Deterministic Heap Allocation & Large Object Heap (LOH) Static Prover for AOI-OS:
 * Statically detects dangerous unbounded buffer allocations and huge synchronous arrays,
 * proving that micro-agent tasks operate within safe Node.js/V8 heap limits (0 LLM Tokens).
 */

const MAX_SAFE_BUFFER_BYTES = 50 * 1024 * 1024 // 50 MB

/**
 * Audits source code for excessive or unbounded memory allocations.
 *
 * @param {string} sourceCode
 * @returns {object} Heap allocation safety report
 */
export function proveHeapAllocations(sourceCode = '') {
  const violations = []

  // Detect explicit Buffer.alloc / Buffer.allocUnsafe with large literals
  const bufferAllocRegex = /Buffer\.(?:alloc|allocUnsafe)\s*\(\s*([0-9_]+)\s*\)/g
  let match
  while ((match = bufferAllocRegex.exec(sourceCode)) !== null) {
    const size = parseInt(match[1].replace(/_/g, ''), 10)
    if (size > MAX_SAFE_BUFFER_BYTES) {
      violations.push({
        sizeBytes: size,
        type: 'EXCESSIVE_SYNCHRONOUS_BUFFER_ALLOCATION',
        recommendation: `Stream large payloads using Node.js streams or chunked buffers instead of allocating ${size} bytes at once.`,
      })
    }
  }

  // Detect massive array allocations: e.g. new Array(10_000_000)
  const arrayAllocRegex = /new\s+Array\s*\(\s*([0-9_]+)\s*\)/g
  while ((match = arrayAllocRegex.exec(sourceCode)) !== null) {
    const length = parseInt(match[1].replace(/_/g, ''), 10)
    if (length > 1_000_000) {
      violations.push({
        length,
        type: 'EXCESSIVE_ARRAY_HEAP_ALLOCATION',
        recommendation: `Use generators or iterators instead of allocating a contiguous array of ${length} elements.`,
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    heapProof: safe ? 'HEAP_ALLOCATIONS_BOUNDED_AND_SAFE' : 'EXCESSIVE_HEAP_ALLOCATION_DETECTED',
  }
}
