import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

/** Where the dashboard sits relative to the workspace that owns it. */
const DASHBOARD_PATH = join('aoi_apps', 'agentic-ops-dashboard')

/** A directory is a workspace when it carries both AOI markers. */
function looksLikeWorkspace(dir: string): boolean {
  return existsSync(join(dir, '.tasks', 'registry.md')) && existsSync(join(dir, '.resources', 'constitution.md'))
}

/**
 * Finds the workspace this dashboard belongs to.
 *
 * The search walks up from the working directory, and it used to accept the
 * first ancestor carrying the two markers — which is wrong whenever the
 * workspace it is running inside has not been initialised yet. The walk then
 * kept climbing and attached to SOMEONE ELSE'S project: the dashboard rendered
 * that project's tasks and resources as if they were yours, and because every
 * write path derives its sandbox from this same function, the resource
 * operations — deletes included — landed there too. The sandbox was doing its
 * job; it was confining writes to the wrong tree.
 *
 * Two things fix it. `AOI_WORKSPACE_ROOT` is honoured first, for deployments
 * that run the dashboard from outside the workspace. Otherwise a candidate
 * must not only carry the markers but also CONTAIN this dashboard — the
 * workspace that owns the app is the only one it may bind to, and an
 * unrelated ancestor cannot satisfy that.
 */
export function resolveWorkspaceRoot(startDir = process.cwd()): string {
  const declared = process.env.AOI_WORKSPACE_ROOT
  if (declared) {
    const root = resolve(declared)
    if (!looksLikeWorkspace(root)) {
      throw new Error(
        `AOI_WORKSPACE_ROOT apunta a ${root}, que no tiene .tasks/registry.md y .resources/constitution.md.`
      )
    }
    return root
  }

  let current = resolve(startDir)
  const visited: string[] = []

  while (true) {
    visited.push(current)
    if (looksLikeWorkspace(current) && existsSync(join(current, DASHBOARD_PATH))) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  // Naming the near-misses matters: binding to one of them silently is the
  // failure this replaced, so the operator gets to see which they were.
  const nearMisses = visited.filter(looksLikeWorkspace)
  const detail = nearMisses.length
    ? ` Se encontraron workspaces en ${nearMisses.join(', ')}, pero ninguno contiene ${DASHBOARD_PATH}, así que no son el que corre este dashboard.`
    : ''
  throw new Error(
    `No se pudo ubicar el workspace de este dashboard desde ${resolve(startDir)}.${detail}` +
      ' Corré el dashboard dentro de su workspace o definí AOI_WORKSPACE_ROOT.'
  )
}

export function resolveWorkspaceName(workspaceRoot = resolveWorkspaceRoot()): string {
  return basename(workspaceRoot)
}
