/**
 * scripts/aoi-os/package-guard/dead-workspace-protocol-pruner.mjs
 *
 * Deterministic Dead Workspace Protocol Dependency Pruner for AOI-OS:
 * Statically audits package.json dependencies declared with the workspace: protocol (workspace:*, workspace:^)
 * against actual registered monorepo packages to detect dead or broken workspace references (0 LLM Tokens).
 */

/**
 * Audits package.json dependencies against registered monorepo packages.
 *
 * @param {object} packageJson - Parsed package.json object
 * @param {string[]} registeredWorkspacePackages - Array of valid workspace package names
 * @returns {object} Workspace dependency audit report
 */
export function auditDeadWorkspaceProtocols(packageJson = {}, registeredWorkspacePackages = []) {
  const deadWorkspaceDeps = []
  const allDeps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
    ...(packageJson.peerDependencies || {}),
  }

  const validSet = new Set(registeredWorkspacePackages)

  for (const [depName, versionSpec] of Object.entries(allDeps)) {
    if (typeof versionSpec === 'string' && versionSpec.startsWith('workspace:')) {
      if (!validSet.has(depName)) {
        deadWorkspaceDeps.push({
          dependency: depName,
          versionSpec,
          error: 'ORPHAN_WORKSPACE_PROTOCOL_DEPENDENCY',
          recommendation: `Workspace dependency '${depName}' (${versionSpec}) is not registered in the monorepo. Remove or update reference.`,
        })
      }
    }
  }

  const clean = deadWorkspaceDeps.length === 0

  return {
    clean,
    totalWorkspaceDepsCount: Object.values(allDeps).filter((v) => typeof v === 'string' && v.startsWith('workspace:')).length,
    deadCount: deadWorkspaceDeps.length,
    deadWorkspaceDeps,
    protocolProof: clean ? 'WORKSPACE_PROTOCOLS_CANONICAL' : 'DEAD_WORKSPACE_PROTOCOLS_DETECTED',
  }
}
