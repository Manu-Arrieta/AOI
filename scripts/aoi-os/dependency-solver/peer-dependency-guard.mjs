/**
 * scripts/aoi-os/dependency-solver/peer-dependency-guard.mjs
 *
 * Deterministic Monorepo Package Peer-Dependency Convergence Guard for AOI-OS:
 * Statically audits package.json manifests across workspaces to prove version convergence
 * and prevent duplicate runtime singleton instantiations (0 LLM Tokens).
 */

/**
 * Audits a collection of package manifests for peer-dependency version convergence.
 *
 * @param {Array<{ name: string, peerDependencies?: Record<string, string>, dependencies?: Record<string, string> }>} packages
 * @returns {object} Peer dependency audit report
 */
export function auditPeerDependencyConvergence(packages = []) {
  const versionMap = new Map()
  const conflicts = []

  for (const pkg of packages) {
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.peerDependencies || {}) }
    for (const [depName, versionRange] of Object.entries(allDeps)) {
      if (!versionMap.has(depName)) {
        versionMap.set(depName, new Map())
      }
      versionMap.get(depName).set(pkg.name, versionRange)
    }
  }

  for (const [depName, usages] of versionMap.entries()) {
    const distinctVersions = new Set(usages.values())
    if (distinctVersions.size > 1) {
      conflicts.push({
        dependency: depName,
        usages: Object.fromEntries(usages.entries()),
        recommendation: `Align version of '${depName}' across all monorepo workspaces to ensure singleton safety.`,
      })
    }
  }

  const convergent = conflicts.length === 0

  return {
    convergent,
    conflictsCount: conflicts.length,
    conflicts,
    convergenceProof: convergent ? 'ALL_PEER_DEPENDENCIES_CONVERGENT_AND_UNIFIED' : 'PEER_DEPENDENCY_DRIFT_DETECTED',
  }
}
