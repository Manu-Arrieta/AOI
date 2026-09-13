import { defaultVersionsRoot, getActiveIndexPath, getManifestPath, loadActiveIndex, loadManifestAtPath, writeJsonFile } from './store-utils.mjs'
import { refuseDirectExecution } from './library-only.mjs'

// Sin esto el archivo sale 0 sin hacer nada y el protocolo dice que es la única
// vía para mutar `active.json`. Ver `library-only.mjs`.
refuseDirectExecution(import.meta.url, "import { rollbackVersion } from './scripts/memory-sync/rollback-version.mjs'")

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export async function rollbackVersion({
  workspace,
  targetVersionId,
  reason,
  versionsRoot = defaultVersionsRoot(),
  rolledBackAt = new Date().toISOString(),
}) {
  assert(typeof workspace === 'string' && workspace.trim().length > 0, 'workspace is required.')
  assert(typeof targetVersionId === 'string' && targetVersionId.trim().length > 0, 'targetVersionId is required.')
  // El protocolo pide `reason` explícito desde siempre y la función no lo tenía:
  // `rollbackVersion({..., reason: 'porque X'})` lo DESCARTABA en silencio, así
  // que el rastro de auditoría que el protocolo promete no existía. Ahora es
  // obligatorio —un rollback sin motivo escrito es indistinguible de un error—
  // y queda persistido en el índice.
  assert(typeof reason === 'string' && reason.trim().length > 0, 'reason is required.')

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
        rollbackReason: reason,
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
    reason,
  }
}