/**
 * scripts/aoi-os/context-compactor/prompt-cache-optimizer.mjs
 *
 * Deterministic Prompt Cache Prefix Optimizer for AOI-OS:
 * Segregates immutable system constitution, shared AST contracts, and static schemas into
 * deterministic prefix blocks to maximize LLM provider prompt-caching hit rates (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Optimizes prompt payload layout for prefix caching.
 *
 * @param {object} options
 * @param {string} options.systemConstitution - Immutable system rules
 * @param {Array<string>} options.sharedContracts - Static schema and interface contracts
 * @param {string} options.taskContext - Dynamic task-specific instruction
 * @returns {object} Structured prompt payload with prefix hash and cache boundaries
 */
export function optimizePromptCachePrefix(options = {}) {
  const constitution = (options.systemConstitution || '').trim()
  const contracts = (options.sharedContracts || []).map((c) => c.trim()).filter(Boolean)
  const taskContext = (options.taskContext || '').trim()

  // Build deterministic invariant prefix block
  const prefixParts = []
  if (constitution.length > 0) {
    prefixParts.push(`<!-- SYSTEM_CONSTITUTION_START -->\n${constitution}\n<!-- SYSTEM_CONSTITUTION_END -->`)
  }

  if (contracts.length > 0) {
    prefixParts.push(`<!-- SHARED_CONTRACTS_START -->\n${contracts.sort().join('\n\n')}\n<!-- SHARED_CONTRACTS_END -->`)
  }

  const prefixBlock = prefixParts.join('\n\n')
  const prefixHash = crypto.createHash('sha256').update(prefixBlock, 'utf8').digest('hex')

  const fullPrompt = [
    prefixBlock,
    `<!-- DYNAMIC_TASK_CONTEXT_START -->\n${taskContext}\n<!-- DYNAMIC_TASK_CONTEXT_END -->`,
  ].filter(Boolean).join('\n\n')

  return {
    prefixHash,
    prefixLength: prefixBlock.length,
    dynamicLength: taskContext.length,
    totalLength: fullPrompt.length,
    prefixBlock,
    fullPrompt,
    cacheOptimizationProof: 'PROMPT_PREFIX_CACHE_BOUNDARY_ALIGNED',
  }
}
