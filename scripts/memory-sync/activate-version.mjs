import { loadActiveIndex, getActiveIndexPath, getManifestPath, loadManifestAtPath, writeJsonFile, defaultVersionsRoot } from './store-utils.mjs'
import { refuseDirectExecution } from './library-only.mjs'

// Mismo motivo que en `rollback-version.mjs`: sin runner, `node` sobre este
// archivo sale 0 sin mutar nada. Ver `library-only.mjs`.
refuseDirectExecution(import.meta.url, "import { activateVersion } from './scripts/memory-sync/activate-version.mjs'")

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

  if (workspaceState) {
    assert(workspaceState.activeVersionId !== versionId, `Memory version "${versionId}" is already active for workspace "${workspace}".`)
  }

  const currentActiveManifestPath = workspaceState
    ? getManifestPath(versionsRoot, workspace, workspaceState.activeVersionId)
    : null
  const nextManifestPath = getManifestPath(versionsRoot, workspace, versionId)
  const nextManifest = await loadManifestAtPath(nextManifestPath)

  assert(nextManifest.status === 'candidate' || nextManifest.status === 'active', `Memory version "${versionId}" cannot be activated from status "${nextManifest.status}".`)

  if (!workspaceState) {
    // PRIMERA activacion: un workspace sin historia. Antes esto tiraba "No active
    // memory version registered for workspace", asi que el estado de fabrica que
    // AOI instala era inarrancable y el ciclo entero no tenia punto de entrada.
    //
    // El candidato no puede declarar un predecesor aca. Sin esta asercion, el
    // camino de bootstrap seria un BYPASS que activa saltandose el paso de
    // supersede en vez de reconocer el estado inicial: es la diferencia entre
    // "el workspace es nuevo" y "el manifiesto miente".
    assert(
      nextManifest.previousVersionId === null,
      `Cannot bootstrap workspace "${workspace}": version "${versionId}" declares predecessor "${nextManifest.previousVersionId}" but no active memory version is registered.`,
    )

    // `previousVersionId` explicito y no omitido: `validateActiveVersionIndex`
    // usa `assertNullableString`, que acepta null pero no que la clave falte.
    const bootstrappedManifest = { ...nextManifest, status: 'active', previousVersionId: null, activatedAt }
    const bootstrappedIndex = {
      ...activeIndex,
      workspaceStates: {
        ...activeIndex.workspaceStates,
        [workspace]: { activeVersionId: versionId, previousVersionId: null, updatedAt: activatedAt },
      },
    }

    await writeJsonFile(nextManifestPath, bootstrappedManifest)
    await writeJsonFile(getActiveIndexPath(versionsRoot), bootstrappedIndex)

    return {
      nextActiveIndex: bootstrappedIndex,
      nextActiveManifest: bootstrappedManifest,
      supersededManifest: null,
      previousVersionId: null,
    }
  }

  const currentActiveManifest = await loadManifestAtPath(currentActiveManifestPath)

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