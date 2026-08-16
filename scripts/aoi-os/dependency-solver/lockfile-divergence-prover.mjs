/**
 * scripts/aoi-os/dependency-solver/lockfile-divergence-prover.mjs
 *
 * Deterministic Package Lockfile Version Divergence Prover for AOI-OS:
 * Statically audits lockfile entries to detect multi-version resolution drifts on critical monorepo dependencies (0 LLM Tokens).
 */

/**
 * Audits lockfile entries for duplicate or divergent resolved versions of critical packages.
 *
 * @param {Record<string, string[]>} lockfilePackageVersions - Map of package names to list of resolved versions
 * @param {string[]} [criticalPackages=[]] - List of critical packages that must have exactly 1 resolved version
 * @returns {object} Lockfile audit report
 */
export function proveLockfileConvergence(lockfilePackageVersions = {}, criticalPackages = []) {
  const drifts = []

  for (const pkgName of criticalPackages) {
    const versions = lockfilePackageVersions[pkgName] || []
    const uniqueVersions = [...new Set(versions)]

    if (uniqueVersions.length > 1) {
      drifts.push({
        package: pkgName,
        versions: uniqueVersions,
        type: 'DUPLICATE_VERSION_RESOLUTION_IN_LOCKFILE',
        recommendation: `Deduplicate '${pkgName}' in pnpm-lock.yaml to a single unified version.`,
      })
    }
  }

  const convergent = drifts.length === 0

  return {
    convergent,
    driftsCount: drifts.length,
    drifts,
    lockfileProof: convergent ? 'LOCKFILE_CRITICAL_PACKAGES_UNIFIED' : 'LOCKFILE_VERSION_DIVERGENCE_DETECTED',
  }
}
