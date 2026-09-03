import { defaultVersionsRoot, getActiveIndexPath, getManifestPath, loadActiveIndex, loadManifestAtPath, writeJsonFile } from './store-utils.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export async function rollbackVersion({
  workspace,
  targetVersionId,
  versionsRoot = defaultVersionsRoot(),
  rolledBackAt = new Date().toISOString(),
}) {
  assert(typeof workspace === 'string' && workspace.trim().length > 0, 'workspace is required.')
  assert(typeof targetVersionId === 'string' && targetVersionId.trim().length > 0, 'targetVersionId is required.')

  const activeIndex = await loadActiveIndex(versionsRoot)
  const workspaceState = activeIndex.workspaceStates[workspace]

  assert(workspaceState, `No active memory version registered for workspace "${workspace}".`)
  assert(workspaceState.previousVersionId, `No previous memory version registered for workspace "${workspace}".`)
  assert(
    workspaceState.previousVersionId === targetVersionId,
    `Rollback target "${targetVersionId}" is not the registered previous version for workspace "${workspace}".`,
  )
  assert(
    workspaceState.activeVersionId !== targetVersionId,
    `Memory version "${targetVersionId}" is already active for workspace "${workspace}".`,
  )

  const currentActiveManifestPath = getManifestPath(versionsRoot, workspace, workspaceState.activeVersionId)
  const targetManifestPath = getManifestPath(versionsRoot, workspace, targetVersionId)
  const currentActiveManifest = await loadManifestAtPath(currentActiveManifestPath)
  const targetManifest = await loadManifestAtPath(targetManifestPath)

  assert(currentActiveManifest.status === 'active', `Current manifest "${currentActiveManifest.versionId}" is not active.`)
  assert(
    targetManifest.status === 'superseded' || targetManifest.status === 'rolled-back' || targetManifest.status === 'active',
    `Rollback target "${targetVersionId}" cannot be restored from status "${targetManifest.status}".`,
  )

  const restoredManifest = {
    ...targetManifest,
    status: 'active',
  }

  const rolledBackManifest = {
    ...currentActiveManifest,
    status: 'rolled-back',
  }

  const nextActiveIndex = {
    ...activeIndex,
    workspaceStates: {
      ...activeIndex.workspaceStates,
      [workspace]: {
        activeVersionId: targetVersionId,
        previousVersionId: currentActiveManifest.versionId,
        updatedAt: rolledBackAt,
      },
    },
  }

  await writeJsonFile(targetManifestPath, restoredManifest)
  await writeJsonFile(currentActiveManifestPath, rolledBackManifest)
  await writeJsonFile(getActiveIndexPath(versionsRoot), nextActiveIndex)

  return {
    restoredManifest,
    rolledBackManifest,
    nextActiveIndex,
  }
}