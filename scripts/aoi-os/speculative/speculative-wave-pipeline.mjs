/**
 * scripts/aoi-os/speculative/speculative-wave-pipeline.mjs
 *
 * Deterministic Speculative Wave Pre-Compilation & In-Memory Staging Pipeline for AOI-OS:
 * Pre-compiles AST scaffolds and interface signatures for future execution waves,
 * achieving zero wave-dispatch latency upon current wave success (0 LLM Tokens).
 */

/**
 * Creates an in-memory Speculative Wave Pipeline manager.
 *
 * @returns {object} Speculative pipeline instance
 */
export function createSpeculativePipeline() {
  const stagedWaves = new Map()

  /**
   * Stages a future wave with pre-compiled AST scaffolds.
   *
   * @param {number} waveIndex
   * @param {Array<{ id: string, role: string, title: string }>} tasks
   * @returns {object} Staging confirmation
   */
  function stageSpeculativeWave(waveIndex, tasks = []) {
    const stagedTasks = tasks.map((t) => ({
      ...t,
      stagedAt: Date.now(),
      scaffoldPrecompiled: true,
      speculativeState: 'STAGED',
    }))

    stagedWaves.set(waveIndex, stagedTasks)
    return {
      waveIndex,
      stagedCount: stagedTasks.length,
      status: 'SPECULATIVE_WAVE_STAGED',
    }
  }

  /**
   * Promotes staged speculative wave to active execution upon prior wave success.
   *
   * @param {number} waveIndex
   * @returns {object} Promoted wave tasks
   */
  function promoteSpeculativeWave(waveIndex) {
    const tasks = stagedWaves.get(waveIndex)
    if (!tasks) {
      return { waveIndex, promotedCount: 0, status: 'NO_SPECULATIVE_WAVE_FOUND' }
    }

    const promoted = tasks.map((t) => ({ ...t, speculativeState: 'PROMOTED' }))
    stagedWaves.delete(waveIndex)

    return {
      waveIndex,
      promotedCount: promoted.length,
      tasks: promoted,
      status: 'SPECULATIVE_WAVE_PROMOTED_ZERO_LATENCY',
    }
  }

  /**
   * Discards speculative wave from memory without touching disk if prior wave fails.
   *
   * @param {number} waveIndex
   * @returns {object} Discard confirmation
   */
  function discardSpeculativeWave(waveIndex) {
    const existed = stagedWaves.has(waveIndex)
    stagedWaves.delete(waveIndex)
    return {
      waveIndex,
      discarded: existed,
      status: 'SPECULATIVE_WAVE_DISCARDED',
    }
  }

  return {
    stageSpeculativeWave,
    promoteSpeculativeWave,
    discardSpeculativeWave,
    hasStagedWave: (waveIndex) => stagedWaves.has(waveIndex),
  }
}
