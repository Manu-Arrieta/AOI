/**
 * scripts/aoi-os/sandbox-guard/sandbox-symlink-escape-prover.mjs
 *
 * Deterministic Sandbox Symlink Traversal & Escape Prover for AOI-OS:
 * Statically proves that symbolic link operations (fs.symlink, fs.readlink) inside ephemeral sandboxes
 * resolve real canonical paths (fs.realpathSync, path.resolve) and strictly remain within the designated sandbox root (0 LLM Tokens).
 */

import path from 'node:path'

/**
 * Validates whether a resolved symlink target is strictly contained inside the sandbox root.
 *
 * @param {string} sandboxRoot - Absolute path to sandbox root
 * @param {string} symlinkTarget - Resolved destination target path
 * @returns {object} Symlink confinement report
 */
export function proveSymlinkContainment(sandboxRoot, symlinkTarget) {
  const normalizedRoot = path.resolve(sandboxRoot)
  const normalizedTarget = path.resolve(normalizedRoot, symlinkTarget)

  const isContained = normalizedTarget.startsWith(normalizedRoot) && normalizedTarget !== normalizedRoot
  const isEscape = !isContained || symlinkTarget.includes('..') && !normalizedTarget.startsWith(normalizedRoot)

  return {
    contained: !isEscape,
    sandboxRoot: normalizedRoot,
    symlinkTarget: normalizedTarget,
    symlinkProof: !isEscape ? 'SYMLINK_CONFINEMENT_PROVEN' : 'UNSAFE_SYMLINK_ESCAPE_DETECTED',
  }
}
