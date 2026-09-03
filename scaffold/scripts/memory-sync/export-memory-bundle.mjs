import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import {
  computeSha256Hex,
  defaultVersionsRoot,
  getExportsRoot,
  getManifestPath,
  loadManifestAtPath,
  resolveExportArtifactPath,
  writeGzipJsonFile,
} from './store-utils.mjs'

const execFileAsync = promisify(execFile)
const allowedScopes = ['memories', 'memoir', 'feedback']
const defaultMemoirNames = ['architecture', 'domain-model', 'api-contracts']

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizeSelectedScopes(selectedScopes) {
  const scopes = selectedScopes?.length ? [...selectedScopes] : [...allowedScopes]

  assert(Array.isArray(scopes) && scopes.length > 0, 'selectedScopes must be a non-empty array.')

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

function splitCliBlocks(raw) {
  const normalized = raw.trim()

  if (!normalized) {
    return []
  }

  return normalized
    .split(/\n(?=--- )/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function extractTopicFromBlock(block) {
  const topicMatch = block.match(/^\s*topic:\s+(.*)$/m)
  return topicMatch ? topicMatch[1].trim() : null
}

function isWorkspaceScopedTopic(topic, workspace) {
  return topic === `${workspace}-context`
    || topic === `${workspace}-session-summaries`
    || topic === `${workspace}-errors-resolved`
    || topic.startsWith(`${workspace}-`)
    || topic.startsWith(`sdd-${workspace}-`)
    || topic.startsWith(`sandbox-${workspace}-`)
}

async function runIcmCommand(args, options = {}) {
  const { allowFailure = false } = options

  try {
    const { stdout, stderr } = await execFileAsync('icm', args, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    })

    return {
      ok: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('icm CLI is required to export memory bundles.')
    }

    if (allowFailure) {
      return {
        ok: false,
        stdout: `${error.stdout ?? ''}`.trim(),
        stderr: `${error.stderr ?? error.message ?? ''}`.trim(),
      }
    }

    const errorDetails = `${error.stderr ?? error.message ?? 'Unknown icm error.'}`.trim()
    throw new Error(`icm ${args.join(' ')} failed: ${errorDetails}`)
  }
}

async function loadMemoriesScopePayload({ workspace }) {
  const result = await runIcmCommand(['list', '--all', '--no-embeddings'])
  const blocks = splitCliBlocks(result.stdout)
  const matchedBlocks = blocks.filter((block) => isWorkspaceScopedTopic(extractTopicFromBlock(block) ?? '', workspace))

  return {
    format: 'icm-list-text',
    matchedEntryCount: matchedBlocks.length,
    topics: matchedBlocks
      .map((block) => extractTopicFromBlock(block))
      .filter(Boolean),
    raw: matchedBlocks.join('\n\n'),
  }
}

async function loadMemoirScopePayload({ workspace, memoirNames = defaultMemoirNames }) {
  const exportedMemoirs = []

  for (const memoirSuffix of memoirNames) {
    const memoirName = `${workspace}-${memoirSuffix}`
    const result = await runIcmCommand(['memoir', 'export', '--memoir', memoirName], { allowFailure: true })

    if (!result.ok || !result.stdout) {
      continue
    }

    exportedMemoirs.push(JSON.parse(result.stdout))
  }

  return {
    format: 'icm-memoir-json',
    memoirCount: exportedMemoirs.length,
    memoirs: exportedMemoirs,
  }
}

async function loadFeedbackScopePayload({ workspace }) {
  const result = await runIcmCommand(['feedback', 'search', workspace, '--no-embeddings', '--limit', '100'], { allowFailure: true })

  return {
    format: 'icm-feedback-search-text',
    query: workspace,
    raw: result.stdout,
  }
}

async function defaultScopePayloadLoader({ scope, workspace, versionId, manifest, versionsRoot }) {
  if (scope === 'memories') {
    return loadMemoriesScopePayload({ workspace, versionId, manifest, versionsRoot })
  }

  if (scope === 'memoir') {
    return loadMemoirScopePayload({ workspace, versionId, manifest, versionsRoot })
  }

  if (scope === 'feedback') {
    return loadFeedbackScopePayload({ workspace, versionId, manifest, versionsRoot })
  }

  throw new Error(`Unsupported export scope "${scope}".`)
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

  const manifestPath = getManifestPath(versionsRoot, workspace.trim(), versionId.trim())
  const manifest = await loadManifestAtPath(manifestPath)
  const normalizedScopes = normalizeSelectedScopes(selectedScopes)

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
  const [workspace, versionId, relativeArtifactPath, ...rest] = argv
  const selectedScopes = []
  let versionsRoot
  let exportsRoot
  let exportedAt
  let formatVersion

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]

    if (token === '--scope') {
      selectedScopes.push(rest[index + 1])
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
      continue
    }

    if (token === '--exported-at') {
      exportedAt = rest[index + 1]
      index += 1
      continue
    }

    if (token === '--format-version') {
      formatVersion = rest[index + 1]
      index += 1
    }
  }

  return {
    workspace,
    versionId,
    relativeArtifactPath,
    selectedScopes,
    versionsRoot,
    exportsRoot,
    exportedAt,
    formatVersion,
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

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}