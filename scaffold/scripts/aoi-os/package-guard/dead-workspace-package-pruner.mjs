/**
 * scripts/aoi-os/package-guard/dead-workspace-package-pruner.mjs
 *
 * Deterministic Dead Monorepo Workspace Package Pruner for AOI-OS:
 * Statically audits declared monorepo packages against root manifests, CI workflows, and consumer projects
 * to detect unreferenced orphan or zombie packages (0 LLM Tokens).
 */

/**
 * Audits workspace package list against consumer codebase references.
 *
 * @param {string[]} declaredPackages - Array of workspace package names
 * @param {string} consumerReferences - Root package.json scripts or CI workflow definitions
 * @returns {object} Workspace packages audit report
 */
export function auditDeadWorkspacePackages(declaredPackages = [], consumerReferences = '') {
  const deadPackages = []

  for (const pkg of declaredPackages) {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')

    if (!regex.test(consumerReferences)) {
      deadPackages.push({
        package: pkg,
        error: 'ORPHAN_WORKSPACE_PACKAGE',
        recommendation: `Workspace package '${pkg}' has no references in root scripts or CI pipelines. Consider archiving or pruning.`,
      })
    }
  }

  const clean = deadPackages.length === 0

  return {
    clean,
    totalDeclared: declaredPackages.length,
    deadCount: deadPackages.length,
    deadPackages,
    packageProof: clean ? 'WORKSPACE_PACKAGES_GOVERNED' : 'DEAD_WORKSPACE_PACKAGES_DETECTED',
  }
}
