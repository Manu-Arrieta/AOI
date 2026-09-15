
import {
  computeSha256Hex,
  defaultVersionsRoot,
  getExportsRoot,
  getManifestPath,
  loadManifestAtPath,
  resolveExportArtifactPath,
  writeGzipJsonFile,
} from './store-utils.mjs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { parseBundleArgs } from './cli-args.mjs'

import { defaultScopePayloadLoader, isWorkspaceScopedTopic } from './icm-scope-loaders.mjs'

// Se re-exporta para que la superficie publica no cambie: los tests de scope
// la importan de aca, y moverla de archivo no deberia obligarlos a enterarse.
export { isWorkspaceScopedTopic }
const allowedScopes = ['memories', 'memoir', 'feedback']

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizeSelectedScopes(selectedScopes) {
  // La guardia vieja estaba DESPUÉS del ternario: `scopes` ya era un array no
  // vacío, así que era inalcanzable. Se valida la entrada CRUDA. Ver el test.
  assert(
    selectedScopes === undefined || Array.isArray(selectedScopes),
    'selectedScopes must be an array.',
  )

  const scopes = selectedScopes?.length ? [...selectedScopes] : [...allowedScopes]

  if (scopes.includes('all')) {
    assert(scopes.length === 1, 'selectedScopes cannot combine "all" with other scopes.')
    return [...allowedScopes]
  }

  const normalizedScopes = scopes.map((scope) => {
    assert(typeof scope === 'string' && scope.trim().length > 0, 'selectedScopes must only contain non-empty strings.')
    return scope.trim()
  })

  const seenScopes = new Set()

  for (const scope of normalizedScopes) {
    assert(allowedScopes.includes(scope), `selectedScopes contains unsupported scope "${scope}".`)
    assert(!seenScopes.has(scope), `selectedScopes contains duplicate scope "${scope}".`)
    seenScopes.add(scope)
  }

  return normalizedScopes
}

function serializePayloadForIntegrity(payload) {
  return JSON.stringify(payload)
}


export async function exportMemoryBundle({
  workspace,
  versionId,
  selectedScopes,
  relativeArtifactPath,
  versionsRoot = defaultVersionsRoot(),
  exportsRoot = getExportsRoot(versionsRoot),
  exportedAt = new Date().toISOString(),
  formatVersion = '1',
  loadScopePayload = defaultScopePayloadLoader,
}) {
  assert(typeof workspace === 'string' && workspace.trim().length > 0, 'workspace is required.')
  assert(typeof versionId === 'string' && versionId.trim().length > 0, 'versionId is required.')
  assert(typeof relativeArtifactPath === 'string' && relativeArtifactPath.trim().length > 0, 'relativeArtifactPath is required.')
  assert(relativeArtifactPath.endsWith('.memory-bundle.json.gz'), 'relativeArtifactPath must end with ".memory-bundle.json.gz".')
  assert(typeof exportedAt === 'string' && !Number.isNaN(Date.parse(exportedAt)), 'exportedAt must be a valid ISO date string.')
  assert(typeof formatVersion === 'string' && formatVersion.trim().length > 0, 'formatVersion must be a non-empty string.')
  assert(typeof loadScopePayload === 'function', 'loadScopePayload must be a function.')

  // Antes de tocar el disco: vivía más abajo y un argumento inválido se
  // reportaba como un ENOENT del manifiesto.
  const normalizedScopes = normalizeSelectedScopes(selectedScopes)

  const manifestPath = getManifestPath(versionsRoot, workspace.trim(), versionId.trim())
  const manifest = await loadManifestAtPath(manifestPath)

  assert(manifest.workspace === workspace.trim(), `Manifest workspace mismatch for "${workspace}".`)

  for (const scope of normalizedScopes) {
    assert(manifest.selectedScopes.includes(scope), `Memory version "${versionId}" does not include scope "${scope}".`)
  }

  const payload = {}

  for (const scope of normalizedScopes) {
    payload[scope] = await loadScopePayload({
      scope,
      workspace: workspace.trim(),
      versionId: versionId.trim(),
      manifest,
      versionsRoot,
    })
  }

  const omittedScopes = allowedScopes.filter((scope) => !normalizedScopes.includes(scope))
  const bundle = {
    metadata: {
      sourceWorkspace: workspace.trim(),
      sourceVersionId: versionId.trim(),
      exportedAt,
      formatVersion: formatVersion.trim(),
      includedScopes: normalizedScopes,
      omittedScopes,
      integrity: {
        algorithm: 'sha256',
        digest: computeSha256Hex(serializePayloadForIntegrity(payload)),
      },
    },
    payload,
  }

  const bundlePath = resolveExportArtifactPath(exportsRoot, relativeArtifactPath)
  await writeGzipJsonFile(bundlePath, bundle)

  return {
    bundle,
    bundlePath,
    exportsRoot,
    manifest,
    manifestPath,
  }
}

function parseArgs(argv) {
  const { workspace, versionId, relativeArtifactPath, flags } = parseBundleArgs(argv, {
    lists: ['scope'],
  })

  return {
    workspace,
    versionId,
    relativeArtifactPath,
    selectedScopes: flags.scope,
    versionsRoot: flags['versions-root'],
    exportsRoot: flags['exports-root'],
    exportedAt: flags['exported-at'],
    formatVersion: flags['format-version'],
  }
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2))
  const result = await exportMemoryBundle(args)

  process.stdout.write(`${JSON.stringify({
    sourceWorkspace: result.bundle.metadata.sourceWorkspace,
    sourceVersionId: result.bundle.metadata.sourceVersionId,
    includedScopes: result.bundle.metadata.includedScopes,
    omittedScopes: result.bundle.metadata.omittedScopes,
    bundlePath: result.bundlePath,
  }, null, 2)}\n`)
}

// `pathToFileURL`, not string concatenation: a space in the path made the old
// `file://${process.argv[1]}` guard never match, so the CLI exited 0 in
// silence. Explained in full in cli-surface.test.mjs.
const entryFile = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null

if (entryFile === import.meta.url) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}