import { loadActiveIndex, getActiveIndexPath, getManifestPath, loadManifestAtPath, writeJsonFile, defaultVersionsRoot } from './store-utils.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export async function activateVersion({ workspace, versionId, versionsRoot = defaultVersionsRoot(), activatedAt = new Date().toISOString() }) {
  assert(typeof workspace === 'string' && workspace.trim().length > 0, 'workspace is required.')
  assert(typeof versionId === 'string' && versionId.trim().length > 0, 'versionId is required.')

  const activeIndex = await loadActiveIndex(versionsRoot)
  const workspaceState = activeIndex.workspaceStates[workspace]

  assert(workspaceState, `No active memory version registered for workspace "${workspace}".`)
  assert(workspaceState.activeVersionId !== versionId, `Memory version "${versionId}" is already active for workspace "${workspace}".`)

  const currentActiveManifestPath = getManifestPath(versionsRoot, workspace, workspaceState.activeVersionId)
  const nextManifestPath = getManifestPath(versionsRoot, workspace, versionId)
  const currentActiveManifest = await loadManifestAtPath(currentActiveManifestPath)
  const nextManifest = await loadManifestAtPath(nextManifestPath)

  assert(nextManifest.status === 'candidate' || nextManifest.status === 'active', `Memory version "${versionId}" cannot be activated from status "${nextManifest.status}".`)

  const nextActiveManifest = {
    ...nextManifest,
    status: 'active',
    previousVersionId: workspaceState.activeVersionId,
    activatedAt,
  }

  const supersededManifest = {
    ...currentActiveManifest,
    status: 'superseded',
  }

  const nextActiveIndex = {
    ...activeIndex,
    workspaceStates: {
      ...activeIndex.workspaceStates,
      [workspace]: {
        activeVersionId: versionId,
        previousVersionId: workspaceState.activeVersionId,
        updatedAt: activatedAt,
      },
    },
  }

  await writeJsonFile(nextManifestPath, nextActiveManifest)
  await writeJsonFile(currentActiveManifestPath, supersededManifest)
  await writeJsonFile(getActiveIndexPath(versionsRoot), nextActiveIndex)

  return {
    nextActiveIndex,
    nextActiveManifest,
    supersededManifest,
    previousVersionId: workspaceState.activeVersionId,
  }
}