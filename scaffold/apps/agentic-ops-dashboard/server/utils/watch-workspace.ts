import { randomUUID } from 'node:crypto'
import { relative } from 'node:path'

import chokidar, { type FSWatcher } from 'chokidar'

import type { WorkspaceEventPayload } from '~/shared/types'

import { resolveWorkspaceRoot } from './workspace-root'

type Listener = (payload: WorkspaceEventPayload) => void | Promise<void>

const listeners = new Set<Listener>()

let watcher: FSWatcher | null = null
let watchedRoot: string | null = null

function emitWorkspaceEvent(payload: WorkspaceEventPayload) {
  for (const listener of listeners) {
    void listener(payload)
  }
}

export async function ensureWorkspaceWatcher(workspaceRoot = resolveWorkspaceRoot()) {
  if (watcher && watchedRoot === workspaceRoot) {
    return
  }

  await watcher?.close()

  watcher = chokidar.watch(
    [
      `${workspaceRoot}/.tasks/registry.md`,
      `${workspaceRoot}/.tasks/**/*`,
      `${workspaceRoot}/.resources/**/*`,
    ],
    {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 180,
        pollInterval: 40,
      },
      ignored: ['**/.DS_Store', '**/node_modules/**', '**/.nuxt/**', '**/.output/**'],
    },
  )

  watchedRoot = workspaceRoot

  watcher.on('all', (reason, changedPath) => {
    emitWorkspaceEvent({
      id: randomUUID(),
      type: 'workspace:refresh',
      changedPath: relative(workspaceRoot, changedPath).replaceAll('\\', '/'),
      reason,
      generatedAt: new Date().toISOString(),
    })
  })
}

export function subscribeWorkspaceEvents(listener: Listener): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function buildReadyEvent(): WorkspaceEventPayload {
  return {
    id: randomUUID(),
    type: 'workspace:ready',
    changedPath: null,
    reason: 'connected',
    generatedAt: new Date().toISOString(),
  }
}