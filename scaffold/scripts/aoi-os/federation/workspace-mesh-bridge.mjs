/**
 * scripts/aoi-os/federation/workspace-mesh-bridge.mjs
 *
 * Deterministic Multi-Workspace Federation & Memory Bridge for AOI-OS:
 * Validates cross-repository memory version bundles and verifies contract invariants
 * across distributed services with SHA-256 cryptographic proof (0 LLM Tokens).
 */

import crypto from 'node:crypto'

/**
 * Computes deterministic SHA-256 digest of an object or string payload.
 *
 * @param {any} payload
 * @returns {string} 64-char hex digest
 */
export function computeMeshDigest(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return crypto.createHash('sha256').update(serialized).digest('hex')
}

/**
 * Creates a federated workspace mesh node.
 *
 * @param {object} options
 * @param {string} options.workspaceId
 * @param {string[]} [options.peers=[]]
 * @returns {object} Mesh node instance
 */
export function createWorkspaceMeshNode(options) {
  const { workspaceId, peers = [] } = options
  const registeredPeers = new Set(peers)
  const bundleLedger = new Map()

  /**
   * Registers a peer workspace in the federation.
   *
   * @param {string} peerWorkspaceId
   */
  function registerPeer(peerWorkspaceId) {
    if (!peerWorkspaceId || peerWorkspaceId === workspaceId) return false
    registeredPeers.add(peerWorkspaceId)
    return true
  }

  /**
   * Stages a memory bundle from a peer workspace and verifies digest integrity.
   *
   * @param {object} bundleEnvelope
   * @param {string} bundleEnvelope.sourceWorkspace
   * @param {string} bundleEnvelope.version
   * @param {object} bundleEnvelope.payload
   * @param {string} bundleEnvelope.digest
   */
  function stagePeerBundle(bundleEnvelope) {
    const { sourceWorkspace, version, payload, digest } = bundleEnvelope

    if (!registeredPeers.has(sourceWorkspace)) {
      return {
        accepted: false,
        reason: `Unregistered peer workspace: ${sourceWorkspace}`,
      }
    }

    const calculatedDigest = computeMeshDigest(payload)
    if (calculatedDigest !== digest) {
      return {
        accepted: false,
        reason: `Cryptographic digest mismatch: expected ${digest}, computed ${calculatedDigest}`,
      }
    }

    const key = `${sourceWorkspace}@${version}`
    bundleLedger.set(key, {
      ...bundleEnvelope,
      receivedAt: new Date().toISOString(),
    })

    return {
      accepted: true,
      bundleKey: key,
      sourceWorkspace,
      version,
    }
  }

  /**
   * Retrieves all verified peer bundles.
   */
  function getVerifiedBundles() {
    return Array.from(bundleLedger.values())
  }

  return {
    workspaceId,
    registerPeer,
    stagePeerBundle,
    getVerifiedBundles,
  }
}
