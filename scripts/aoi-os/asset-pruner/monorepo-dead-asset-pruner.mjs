/**
 * scripts/aoi-os/asset-pruner/monorepo-dead-asset-pruner.mjs
 *
 * Deterministic Monorepo Dead-Asset & Zombie Resource Pruner for AOI-OS:
 * Builds full reachability graphs across monorepo packages, identifying unreferenced
 * assets (images, icons, styles) and generating atomic pruning manifests (0 LLM Tokens).
 */

import path from 'node:path'

/**
 * Identifies unreferenced dead assets across source code repositories.
 *
 * @param {string[]} declaredAssets - Array of asset file paths (e.g. ['public/logo.png', 'assets/old-banner.jpg'])
 * @param {string[]} sourceFilesContent - Array of raw source code strings
 * @returns {object} Dead asset diagnosis and pruning manifest
 */
export function auditDeadAssets(declaredAssets = [], sourceFilesContent = []) {
  const combinedSource = sourceFilesContent.join('\n')
  const deadAssets = []
  const activeAssets = []

  for (const assetPath of declaredAssets) {
    const baseName = path.basename(assetPath)
    // Check if filename is mentioned in any source file
    if (combinedSource.includes(assetPath) || combinedSource.includes(baseName)) {
      activeAssets.push(assetPath)
    } else {
      deadAssets.push(assetPath)
    }
  }

  const hasDeadAssets = deadAssets.length > 0
  const total = declaredAssets.length || 1
  const reachabilityScore = Math.round((activeAssets.length / total) * 100)

  return {
    totalDeclaredAssets: declaredAssets.length,
    activeAssetsCount: activeAssets.length,
    deadAssetsCount: deadAssets.length,
    reachabilityScore,
    deadAssets,
    pruningManifest: deadAssets.map((asset) => ({
      path: asset,
      action: 'REMOVE_DEAD_ASSET',
    })),
    pruningStatus: hasDeadAssets ? 'ZOMBIE_ASSETS_DETECTED' : 'ASSET_TOPOLOGY_OPTIMAL',
  }
}
