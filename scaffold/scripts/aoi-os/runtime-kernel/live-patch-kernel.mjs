/**
 * scripts/aoi-os/runtime-kernel/live-patch-kernel.mjs
 *
 * Deterministic In-Memory Hot-Patching Kernel for AOI-OS:
 * Allows dynamic function and module symbol swapping during DAG wave execution
 * without losing in-memory state or restarting the orchestrator (0 LLM Tokens).
 */

/**
 * Creates an in-memory hot-patching kernel instance.
 *
 * @returns {object} Kernel instance
 */
export function createLivePatchKernel() {
  const symbolRegistry = new Map()
  const patchHistory = []

  /**
   * Registers a hot-patchable symbol.
   *
   * @param {string} symbolKey - E.g. 'auth:verifyToken'
   * @param {Function} implementation
   */
  function registerSymbol(symbolKey, implementation) {
    if (typeof implementation !== 'function') {
      throw new Error(`Symbol [${symbolKey}] implementation must be a function.`)
    }

    symbolRegistry.set(symbolKey, {
      current: implementation,
      version: 1,
      registeredAt: new Date().toISOString(),
    })

    return true
  }

  /**
   * Applies an atomic hot-patch to an existing registered symbol.
   *
   * @param {string} symbolKey
   * @param {Function} newImplementation
   * @param {string} [patchReason='self-healing']
   */
  function applyHotPatch(symbolKey, newImplementation, patchReason = 'self-healing') {
    if (!symbolRegistry.has(symbolKey)) {
      throw new Error(`Cannot patch unregistered symbol: ${symbolKey}`)
    }
    if (typeof newImplementation !== 'function') {
      throw new Error(`Patched implementation for [${symbolKey}] must be a function.`)
    }

    const currentEntry = symbolRegistry.get(symbolKey)
    const newVersion = currentEntry.version + 1

    patchHistory.push({
      symbolKey,
      previousVersion: currentEntry.version,
      newVersion,
      patchReason,
      appliedAt: new Date().toISOString(),
    })

    symbolRegistry.set(symbolKey, {
      current: newImplementation,
      version: newVersion,
      patchedAt: new Date().toISOString(),
    })

    return {
      success: true,
      symbolKey,
      newVersion,
    }
  }

  /**
   * Invokes a registered hot-patchable symbol.
   *
   * @param {string} symbolKey
   * @param {...any} args
   */
  function invokeSymbol(symbolKey, ...args) {
    const entry = symbolRegistry.get(symbolKey)
    if (!entry) {
      throw new Error(`Symbol [${symbolKey}] not found in kernel registry.`)
    }
    return entry.current(...args)
  }

  /**
   * Retrieves all applied patch records.
   */
  function getPatchHistory() {
    return [...patchHistory]
  }

  return {
    registerSymbol,
    applyHotPatch,
    invokeSymbol,
    getPatchHistory,
  }
}
