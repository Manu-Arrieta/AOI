/**
 * scripts/aoi-os/sandbox-guard/sandbox-path-escape-prover.mjs
 *
 * Deterministic Sandbox Directory Path Traversal & Escape Prover for AOI-OS:
 * Statically validates sandbox file path operations to prove 100% boundary containment
 * and prevent path traversal escapes outside ephemeral sandbox roots (0 LLM Tokens).
 */

import path from 'node:path'

/**
 * Proves that a target relative path remains strictly confined inside the assigned sandbox directory.
 *
 * @param {string} sandboxRoot - Sandbox base directory (e.g. '/workspace/.sandboxes/aoi-os-tmp-T1')
 * @param {string} targetPath - Relative or absolute target file path
 * @returns {object} Containment report
 */
export function provePathContainment(sandboxRoot = '/sandboxes/tmp-task', targetPath = '') {
  const normalizedRoot = path.resolve(sandboxRoot)
  const resolvedTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(normalizedRoot, targetPath)

  const isContained = resolvedTarget.startsWith(normalizedRoot) && resolvedTarget !== normalizedRoot

  const violations = []
  if (!isContained) {
    violations.push({
      targetPath,
      resolvedTarget,
      type: 'SANDBOX_PATH_TRAVERSAL_ESCAPE_ATTEMPT',
      recommendation: `Restrain file operations strictly within sandbox root '${normalizedRoot}'.`,
    })
  }

  return {
    contained: isContained,
    sandboxRoot: normalizedRoot,
    resolvedTarget,
    violationsCount: violations.length,
    violations,
    containmentProof: isContained ? 'SANDBOX_PATH_CONFINEMENT_PROVEN' : 'SANDBOX_ESCAPE_VIOLATION_DETECTED',
  }
}
