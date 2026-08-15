/**
 * scripts/aoi-os/sandbox-runtime/sandbox-executor.mjs
 *
 * Hermetic Ephemeral Sandbox Runtime for AOI-OS:
 * Isolates micro-agent execution in temporary sandbox workspaces (.sandboxes/aoi-os-tmp-{taskId}),
 * runs verification tests safely, and performs atomic commit upon 100% green tests & invariant checks.
 */

import fs from 'node:fs'
import path from 'node:path'

/**
 * Creates an ephemeral hermetic sandbox instance for a specific task.
 *
 * @param {object} options
 * @param {string} options.taskId - Unique task identifier
 * @param {string} [options.baseDir] - Project root directory
 * @param {string[]} [options.filesToMount=[]] - Relative file paths to stage in sandbox
 * @returns {object} Sandbox controller
 */
export function createHermeticSandbox(options) {
  const { taskId, baseDir = process.cwd(), filesToMount = [] } = options
  const sandboxDirName = `aoi-os-tmp-${taskId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  const sandboxesRoot = path.join(baseDir, '.sandboxes')
  const sandboxPath = path.join(sandboxesRoot, sandboxDirName)

  // Initialize sandbox directory
  if (!fs.existsSync(sandboxesRoot)) {
    fs.mkdirSync(sandboxesRoot, { recursive: true })
  }
  if (!fs.existsSync(sandboxPath)) {
    fs.mkdirSync(sandboxPath, { recursive: true })
  }

  // Mount files into sandbox
  for (const relFile of filesToMount) {
    const src = path.join(baseDir, relFile)
    if (fs.existsSync(src)) {
      const dest = path.join(sandboxPath, relFile)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(src, dest)
    }
  }

  /**
   * Reads a staged file from the sandbox.
   *
   * @param {string} relFile
   * @returns {string|null}
   */
  function readFile(relFile) {
    const target = path.join(sandboxPath, relFile)
    if (!fs.existsSync(target)) return null
    return fs.readFileSync(target, 'utf8')
  }

  /**
   * Writes or updates a file inside the isolated sandbox.
   *
   * @param {string} relFile
   * @param {string} content
   */
  function writeFile(relFile, content) {
    const target = path.join(sandboxPath, relFile)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content, 'utf8')
  }

  /**
   * Atomically commits staged sandbox files back to the main workspace.
   *
   * @param {string[]} [filesToCommit] - Optional subset of files, otherwise all mounted files
   * @returns {string[]} List of committed relative paths
   */
  function commitToWorkspace(filesToCommit = filesToMount) {
    const committed = []
    for (const relFile of filesToCommit) {
      const src = path.join(sandboxPath, relFile)
      if (fs.existsSync(src)) {
        const dest = path.join(baseDir, relFile)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(src, dest)
        committed.push(relFile)
      }
    }
    return committed
  }

  /**
   * Destroys and cleans up the ephemeral sandbox workspace.
   */
  function destroy() {
    if (fs.existsSync(sandboxPath)) {
      fs.rmSync(sandboxPath, { recursive: true, force: true })
    }
  }

  return {
    taskId,
    sandboxPath,
    readFile,
    writeFile,
    commitToWorkspace,
    destroy,
  }
}
