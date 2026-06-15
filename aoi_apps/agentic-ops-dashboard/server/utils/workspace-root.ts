import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

export function resolveWorkspaceRoot(startDir = process.cwd()): string {
  let current = resolve(startDir)

  while (true) {
    const hasRegistry = existsSync(join(current, '.tasks', 'registry.md'))
    const hasResources = existsSync(join(current, '.resources', 'constitution.md'))

    if (hasRegistry && hasResources) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      throw new Error('Unable to locate workspace root from the current runtime.')
    }

    current = parent
  }
}

export function resolveWorkspaceName(workspaceRoot = resolveWorkspaceRoot()): string {
  return basename(workspaceRoot)
}