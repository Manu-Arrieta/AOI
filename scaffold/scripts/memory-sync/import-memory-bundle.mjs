import {
  computeSha256Hex,
  defaultVersionsRoot,
  getExportsRoot,
  loadMemoryBundleAtPath,
  resolveExportArtifactPath,
} from './store-utils.mjs'
import { prepareVersionManifest } from './prepare-version-manifest.mjs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { parseBundleArgs } from './cli-args.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizeDecisionList(values, fieldName) {
  assert(Array.isArray(values), `${fieldName} must be an array.`)

  return values.map((value) => {
    assert(typeof value === 'string' && value.trim().length > 0, `${fieldName} must only contain non-empty strings.`)
    return value.trim()
  })
}

function serializePayloadForIntegrity(payload) {
  return JSON.stringify(payload)
}

export async function importMemoryBundle({
  workspace,
  versionId,
  relativeArtifactPath,
  ownerContext,
  decisions = { retain: [], complement: [], discard: [] },
  versionsRoot = defaultVersionsRoot(),
  exportsRoot = getExportsRoot(versionsRoot),
}) {
  assert(typeof workspace === 'string' && workspace.trim().length > 0, 'workspace is required.')
  assert(typeof versionId === 'string' && versionId.trim().length > 0, 'versionId is required.')
  assert(typeof relativeArtifactPath === 'string' && relativeArtifactPath.trim().length > 0, 'relativeArtifactPath is required.')
  assert(relativeArtifactPath.endsWith('.memory-bundle.json.gz'), 'relativeArtifactPath must end with ".memory-bundle.json.gz".')
  assert(typeof ownerContext === 'string' && ownerContext.trim().length > 0, 'ownerContext is required.')

  const retain = normalizeDecisionList(decisions.retain ?? [], 'decisions.retain')
  const complement = normalizeDecisionList(decisions.complement ?? [], 'decisions.complement')
  const discard = normalizeDecisionList(decisions.discard ?? [], 'decisions.discard')

  const bundlePath = resolveExportArtifactPath(exportsRoot, relativeArtifactPath)
  const bundle = await loadMemoryBundleAtPath(bundlePath)

  assert(bundle.metadata.formatVersion === '1', `Unsupported bundle format version "${bundle.metadata.formatVersion}".`)
  assert(bundle.metadata.integrity.algorithm === 'sha256', `Unsupported bundle integrity algorithm "${bundle.metadata.integrity.algorithm}".`)

  const computedDigest = computeSha256Hex(serializePayloadForIntegrity(bundle.payload))
  assert(computedDigest === bundle.metadata.integrity.digest, 'Bundle payload digest mismatch.')

  const result = await prepareVersionManifest({
    workspace: workspace.trim(),
    versionId: versionId.trim(),
    sourceWorkspace: bundle.metadata.sourceWorkspace,
    sourceVersionId: bundle.metadata.sourceVersionId,
    sourceTransport: 'bundle',
    bundleMetadata: bundle.metadata,
    selectedScopes: bundle.metadata.includedScopes,
    ownerContext: ownerContext.trim(),
    decisions: {
      retain,
      complement,
      discard,
    },
    versionsRoot,
  })

  return {
    ...result,
    bundle,
    bundlePath,
    computedDigest,
  }
}

function parseArgs(argv) {
  const { workspace, versionId, relativeArtifactPath, flags } = parseBundleArgs(argv, {
    lists: ['retain', 'complement', 'discard'],
  })

  return {
    workspace,
    versionId,
    relativeArtifactPath,
    ownerContext: flags['owner-context'],
    decisions: {
      retain: flags.retain,
      complement: flags.complement,
      discard: flags.discard,
    },
    versionsRoot: flags['versions-root'],
    exportsRoot: flags['exports-root'],
  }
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2))
  const result = await importMemoryBundle(args)

  process.stdout.write(`${JSON.stringify({
    workspace: result.manifest.workspace,
    versionId: result.manifest.versionId,
    sourceWorkspace: result.bundle.metadata.sourceWorkspace,
    sourceVersionId: result.bundle.metadata.sourceVersionId,
    sourceTransport: result.manifest.sourceTransport,
    manifestPath: result.manifestPath,
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