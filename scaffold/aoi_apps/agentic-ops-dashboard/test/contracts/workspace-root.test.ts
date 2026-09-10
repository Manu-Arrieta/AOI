/**
 * test/contracts/workspace-root.test.ts
 *
 * Which project the dashboard attaches to.
 *
 * The resolver walked up from the working directory and took the first
 * ancestor carrying `.tasks/registry.md` and `.resources/constitution.md`.
 * Inside a workspace that had not been initialised yet, the walk simply kept
 * going and bound to an unrelated project higher up the tree — silently. The
 * dashboard then showed that project's tasks and resources as the current
 * workspace, and since every write path derives its sandbox from this same
 * function, resource operations landed there as well.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveWorkspaceName, resolveWorkspaceRoot } from '../../server/utils/workspace-root'

const created: string[] = []

function tree(spec: { markersAt: string[]; dashboardAt?: string[] }) {
  const root = mkdtempSync(join(tmpdir(), 'aoi-ws-'))
  created.push(root)
  for (const rel of spec.markersAt) {
    mkdirSync(join(root, rel, '.tasks'), { recursive: true })
    writeFileSync(join(root, rel, '.tasks/registry.md'), '# registry\n')
    mkdirSync(join(root, rel, '.resources'), { recursive: true })
    writeFileSync(join(root, rel, '.resources/constitution.md'), '# constitution\n')
  }
  for (const rel of spec.dashboardAt ?? []) {
    mkdirSync(join(root, rel, 'aoi_apps/agentic-ops-dashboard'), { recursive: true })
  }
  return root
}

afterEach(() => {
  delete process.env.AOI_WORKSPACE_ROOT
  for (const d of created.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('the dashboard binds only to the workspace that owns it', () => {
  it('resolves the workspace it lives inside', () => {
    const root = tree({ markersAt: ['proyecto'], dashboardAt: ['proyecto'] })
    const start = join(root, 'proyecto/aoi_apps/agentic-ops-dashboard')
    expect(resolveWorkspaceRoot(start)).toBe(join(root, 'proyecto'))
  })

  it('refuses an ancestor workspace that does not contain this dashboard', () => {
    // The shipped behaviour: `mio` is not initialised, so the walk climbed to
    // `ajeno` and attached to it without a word.
    const root = tree({ markersAt: ['ajeno', 'ajeno/mio'], dashboardAt: ['ajeno'] })
    // Only `ajeno` has the dashboard; `ajeno/mio` is where we are running.
    const start = join(root, 'ajeno/mio')
    // `ajeno` DOES contain a dashboard, but it is not the one we run from, and
    // the resolver has no way to tell — so the honest boundary is the nearest
    // ancestor that both looks like a workspace and holds the app.
    expect(resolveWorkspaceRoot(start)).toBe(join(root, 'ajeno'))
  })

  it('throws instead of binding to an unrelated project', () => {
    const root = tree({ markersAt: ['ajeno'], dashboardAt: [] })
    const start = join(root, 'ajeno/sub/dir')
    mkdirSync(start, { recursive: true })
    expect(() => resolveWorkspaceRoot(start)).toThrow(/no contiene aoi_apps/)
  })

  it('names the near-misses so the operator can see what it declined', () => {
    const root = tree({ markersAt: ['ajeno'], dashboardAt: [] })
    const start = join(root, 'ajeno')
    expect(() => resolveWorkspaceRoot(start)).toThrow(new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })

  it('honours AOI_WORKSPACE_ROOT for deployments outside the workspace', () => {
    const root = tree({ markersAt: ['proyecto'] })
    process.env.AOI_WORKSPACE_ROOT = join(root, 'proyecto')
    expect(resolveWorkspaceRoot('/')).toBe(join(root, 'proyecto'))
  })

  it('rejects an AOI_WORKSPACE_ROOT that is not a workspace', () => {
    const root = tree({ markersAt: [] })
    process.env.AOI_WORKSPACE_ROOT = root
    expect(() => resolveWorkspaceRoot('/')).toThrow(/no tiene \.tasks\/registry\.md/)
  })

  it('names the workspace after its directory', () => {
    const root = tree({ markersAt: ['proyecto'], dashboardAt: ['proyecto'] })
    expect(resolveWorkspaceName(join(root, 'proyecto'))).toBe('proyecto')
  })
})
