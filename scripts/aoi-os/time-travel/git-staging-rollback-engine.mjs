/**
 * scripts/aoi-os/time-travel/git-staging-rollback-engine.mjs
 *
 * Deterministic Git-Staging & Memory Rollback Engine for AOI-OS:
 * Captures atomic file checkpoints before DAG wave execution, calculates cryptographic diffs,
 * and executes deterministic zero-residual rollback restoration upon task failure or consensus rejection (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Creates an atomic snapshot checkpoint manager for tasks.
 *
 * @returns {object} Rollback engine
 */
export function createGitStagingRollbackEngine() {
  const checkpoints = new Map()

  /**
   * Captures a pre-execution checkpoint for a list of files.
   *
   * @param {string} waveId - Wave or task identifier
   * @param {Map<string, string>|Record<string, string>} fileMap - Map of filePath -> content
   * @returns {string} Checkpoint cryptographic signature
   */
  function captureCheckpoint(waveId, fileMap) {
    const entries = fileMap instanceof Map ? Array.from(fileMap.entries()) : Object.entries(fileMap)
    const files = new Map()

    const hasher = crypto.createHash('sha256')
    for (const [filePath, content] of entries) {
      const fileHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex')
      files.set(filePath, { content, hash: fileHash })
      hasher.update(`${filePath}:${fileHash}`)
    }

    const checkpointDigest = hasher.digest('hex')
    checkpoints.set(waveId, {
      waveId,
      digest: checkpointDigest,
      timestamp: Date.now(),
      files,
    })

    return checkpointDigest
  }

  /**
   * Generates a rollback restoration plan comparing current files against checkpoint.
   *
   * @param {string} waveId
   * @param {Map<string, string>|Record<string, string>} currentFiles
   * @returns {object} Rollback plan
   */
  function planRollback(waveId, currentFiles) {
    const checkpoint = checkpoints.get(waveId)
    if (!checkpoint) {
      throw new Error(`Checkpoint for wave '${waveId}' not found.`)
    }

    const currentEntries = currentFiles instanceof Map ? Array.from(currentFiles.entries()) : Object.entries(currentFiles)
    const currentMap = new Map(currentEntries)

    const restoreFiles = []
    const removeFiles = []

    // 1. Files to restore to pre-wave content
    for (const [filePath, { content, hash }] of checkpoint.files.entries()) {
      const currentContent = currentMap.get(filePath)
      if (currentContent === undefined || currentContent !== content) {
        restoreFiles.push({ filePath, targetContent: content, targetHash: hash })
      }
    }

    // 2. Newly created files that did not exist in checkpoint
    for (const [filePath] of currentMap.entries()) {
      if (!checkpoint.files.has(filePath)) {
        removeFiles.push(filePath)
      }
    }

    return {
      waveId,
      checkpointDigest: checkpoint.digest,
      restoreCount: restoreFiles.length,
      removeCount: removeFiles.length,
      restoreFiles,
      removeFiles,
      isClean: restoreFiles.length === 0 && removeFiles.length === 0,
    }
  }

  return {
    captureCheckpoint,
    planRollback,
    hasCheckpoint: (waveId) => checkpoints.has(waveId),
    clear: () => checkpoints.clear(),
  }
}
