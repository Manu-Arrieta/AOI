import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadJsonFile, validateActiveVersionIndex, validateMemoryVersionManifest } from './schema.mjs'

function defaultVersionsRoot(cwd = process.cwd()) {
  return resolve(cwd, '.specify', 'memory', 'versions')
}

function getRepositoryRoot(versionsRoot) {
  return resolve(versionsRoot, '..', '..', '..')
}

async function assertFileExists(filePath, label) {
  try {
    await access(filePath, constants.F_OK)
  } catch {
    throw new Error(`${label} not found: ${filePath}`)
  }
}

async function findExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.F_OK)
      return candidate
    } catch {
      // Try the next candidate.
    }
  }

  return null
}

async function loadManifest(manifestPath) {
  await assertFileExists(manifestPath, 'Memory version manifest')
  return validateMemoryVersionManifest(await loadJsonFile(manifestPath), { filePath: manifestPath })
}

export async function resolveActiveVersion({ workspace, versionsRoot = defaultVersionsRoot() }) {
  if (!workspace || typeof workspace !== 'string') {
    throw new Error('workspace is required to resolve an active memory version.')
  }

  const activeIndexPath = join(versionsRoot, 'active.json')
  await assertFileExists(activeIndexPath, 'Active memory version index')

  const activeIndex = validateActiveVersionIndex(await loadJsonFile(activeIndexPath), { filePath: activeIndexPath })
  const workspaceState = activeIndex.workspaceStates[workspace]

  if (!workspaceState) {
    throw new Error(`No active memory version registered for workspace "${workspace}".`)
  }

  const activeManifestPath = join(versionsRoot, 'manifests', workspace, `${workspaceState.activeVersionId}.json`)
  const activeManifest = await loadManifest(activeManifestPath)

  if (activeManifest.workspace !== workspace) {
    throw new Error(`Active manifest workspace mismatch for "${workspace}".`)
  }

  if (activeManifest.versionId !== workspaceState.activeVersionId) {
    throw new Error(`Active manifest version mismatch for workspace "${workspace}".`)
  }

  const repositoryRoot = getRepositoryRoot(versionsRoot)
  const constitutionCandidates = [resolve(repositoryRoot, activeManifest.dynamicConstitutionPath)]

  if (activeManifest.dynamicConstitutionPath.startsWith('.specify/memory/versions/')) {
    constitutionCandidates.push(join(
      versionsRoot,
      activeManifest.dynamicConstitutionPath.replace('.specify/memory/versions/', ''),
    ))
  }

  const dynamicConstitutionAbsolutePath = await findExistingPath(constitutionCandidates)

  if (!dynamicConstitutionAbsolutePath) {
    throw new Error(`Dynamic memory constitution snapshot not found: ${constitutionCandidates[0]}`)
  }

  let previousManifest = null
  let previousManifestPath = null

  if (workspaceState.previousVersionId) {
    previousManifestPath = join(versionsRoot, 'manifests', workspace, `${workspaceState.previousVersionId}.json`)
    previousManifest = await loadManifest(previousManifestPath)
  }

  return {
    repositoryRoot,
    versionsRoot,
    activeIndexPath,
    workspace,
    workspaceState,
    activeManifestPath,
    activeManifest,
    dynamicConstitutionAbsolutePath,
    previousManifestPath,
    previousManifest,
  }
}

/**
 * Resuelve la version activa SIN tratar como error el caso del workspace nuevo.
 *
 * Por que existe, y es un defecto medido. `resolveActiveVersion` exige una
 * entrada en `active.json` para el workspace y tira "No active memory version
 * registered" cuando no la hay. Ese estado NO es corrupcion: es el estado de
 * fabrica que AOI instala en cada proyecto (`workspaceStates: {}`). El schema ya
 * lo anticipaba --`previousVersionId` es nullable-- pero ningun camino del
 * ciclo podia producir una primera version: `prepareVersionManifest` y
 * `activateVersion` exigian un predecesor, asi que un workspace nuevo era
 * inarrancable, y el protocolo ICM prohibe el unico workaround (mutar
 * `active.json` a mano). Medido 2026-09-21: `prepareVersionManifest` contra el
 * estado de fabrica tiraba ese mismo error, y un `rg` del arbol entero
 * confirmaba que no existe ningun `bootstrap`/`createFirstVersion` y que ningun
 * modulo fuera de `activate` y `rollback` escribe `workspaceStates` --los dos
 * exigen predecesor.
 *
 * La tolerancia es UNA sola: la falta de entrada para ESE workspace. Todo lo
 * demas sigue siendo error y se delega tal cual a `resolveActiveVersion`: indice
 * ausente, manifiesto declarado que no existe, y discrepancias de workspace o de
 * version. Distinguir "nuevo" de "roto" es todo el punto.
 *
 * @returns la resolucion completa, o `null` si el workspace no esta registrado.
 */
export async function tryResolveActiveVersion({ workspace, versionsRoot = defaultVersionsRoot() }) {
  if (!workspace || typeof workspace !== 'string') {
    throw new Error('workspace is required to resolve an active memory version.')
  }

  const activeIndexPath = join(versionsRoot, 'active.json')

  try {
    await access(activeIndexPath, constants.F_OK)
  } catch {
    // Indice ausente: un store a medias, no un workspace nuevo. Se delega para
    // que el error conserve el mensaje de `resolveActiveVersion` en vez de un
    // ENOENT crudo de `readFile`.
    return resolveActiveVersion({ workspace, versionsRoot })
  }

  const activeIndex = validateActiveVersionIndex(await loadJsonFile(activeIndexPath), { filePath: activeIndexPath })

  if (!activeIndex.workspaceStates[workspace]) {
    return null
  }

  return resolveActiveVersion({ workspace, versionsRoot })
}

function parseArgs(argv) {
  const [workspace, ...rest] = argv
  let versionsRoot

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]

    if (token === '--versions-root') {
      versionsRoot = rest[index + 1]
      index += 1
    }
  }

  return {
    workspace,
    versionsRoot: versionsRoot ? resolve(process.cwd(), versionsRoot) : undefined,
  }
}

async function runCli() {
  const { workspace, versionsRoot } = parseArgs(process.argv.slice(2))
  const resolution = await resolveActiveVersion({ workspace, versionsRoot })

  process.stdout.write(`${JSON.stringify({
    workspace: resolution.workspace,
    activeVersionId: resolution.activeManifest.versionId,
    previousVersionId: resolution.workspaceState.previousVersionId,
    activeManifestPath: resolution.activeManifestPath,
    dynamicConstitutionPath: resolution.activeManifest.dynamicConstitutionPath,
  }, null, 2)}\n`)
}

const entryFile = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null

if (entryFile === import.meta.url) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}

export function locateVersionsRootFromScript() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url))
  return resolve(scriptDirectory, '..', '..', '.specify', 'memory', 'versions')
}