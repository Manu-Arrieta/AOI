import {
  computeSha256Hex,
  defaultVersionsRoot,
  getExportsRoot,
  loadMemoryBundleAtPath,
  resolveExportArtifactPath,
} from './store-utils.mjs'
import { prepareVersionManifest } from './prepare-version-manifest.mjs'

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
  const [workspace, versionId, relativeArtifactPath, ...rest] = argv
  const decisions = {
    retain: [],
    complement: [],
    discard: [],
  }
  let ownerContext
  let versionsRoot
  let exportsRoot

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]

    if (token === '--owner-context') {
      ownerContext = rest[index + 1]
      index += 1
      continue
    }

    if (token === '--retain') {
      decisions.retain.push(rest[index + 1])
      index += 1
      continue
    }

    if (token === '--complement') {
      decisions.complement.push(rest[index + 1])
      index += 1
      continue
    }

    if (token === '--discard') {
      decisions.discard.push(rest[index + 1])
      index += 1
      continue
    }

    if (token === '--versions-root') {
      versionsRoot = rest[index + 1]
      index += 1
      continue
    }

    if (token === '--exports-root') {
      exportsRoot = rest[index + 1]
      index += 1
    }
  }

  return {
    workspace,
    versionId,
    relativeArtifactPath,
    ownerContext,
    decisions,
    versionsRoot,
    exportsRoot,
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

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}