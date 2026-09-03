import { access } from 'node:fs/promises'
import { constants } from 'node:fs'

import { validateMemoryVersionManifest } from './schema.mjs'
import { resolveActiveVersion } from './resolve-active-version.mjs'
import {
  defaultVersionsRoot,
  getManifestPath,
  getTemplatePath,
  renderTemplate,
  resolveVersionStorePath,
  writeJsonFile,
  writeTextFile,
} from './store-utils.mjs'

const defaultSelectedScopes = ['memories', 'memoir', 'feedback']
const allowedSourceTransports = new Set(['workspace-sync', 'bundle'])

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}


function normalizeDecisionList(values, fieldName) {
  assert(Array.isArray(values), `${fieldName} must be an array.`)
  return values.map((value) => {
    assert(typeof value === 'string' && value.trim().length > 0, `${fieldName} must contain non-empty strings.`)
    return value.trim()
  })
}

function normalizeSelectedScopes(selectedScopes) {
  const scopes = selectedScopes?.length ? selectedScopes : defaultSelectedScopes
  assert(Array.isArray(scopes) && scopes.length > 0, 'selectedScopes must be a non-empty array.')
  return scopes
}

async function ensureManifestDoesNotExist(manifestPath) {
  try {
    await access(manifestPath, constants.F_OK)
    throw new Error(`Memory version manifest already exists: ${manifestPath}`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Memory version manifest already exists')) {
      throw error
    }
  }
}

function buildDynamicConstitutionPath(workspace, versionId) {
  return `.specify/memory/versions/constitutions/${workspace}/${versionId}.md`
}

export async function prepareVersionManifest({
  workspace,
  versionId,
  sourceWorkspace,
  sourceVersionId,
  sourceTransport = 'workspace-sync',
  bundleMetadata = null,
  selectedScopes = defaultSelectedScopes,
  ownerContext,
  decisions,
  versionsRoot = defaultVersionsRoot(),
}) {
  assert(typeof workspace === 'string' && workspace.trim().length > 0, 'workspace is required.')
  assert(typeof versionId === 'string' && versionId.trim().length > 0, 'versionId is required.')
  assert(typeof sourceWorkspace === 'string' && sourceWorkspace.trim().length > 0, 'sourceWorkspace is required.')
  assert(typeof sourceVersionId === 'string' && sourceVersionId.trim().length > 0, 'sourceVersionId is required.')
  assert(typeof sourceTransport === 'string' && allowedSourceTransports.has(sourceTransport.trim()), `sourceTransport must be one of ${[...allowedSourceTransports].join(', ')}.`)
  assert(typeof ownerContext === 'string' && ownerContext.trim().length > 0, 'ownerContext is required.')
  assert(bundleMetadata === null || isPlainObject(bundleMetadata), 'bundleMetadata must be an object or null.')

  const normalizedSourceTransport = sourceTransport.trim()

  if (normalizedSourceTransport === 'bundle') {
    assert(bundleMetadata !== null, 'bundleMetadata is required when sourceTransport is "bundle".')
  }

  const retain = normalizeDecisionList(decisions?.retain ?? [], 'decisions.retain')
  const complement = normalizeDecisionList(decisions?.complement ?? [], 'decisions.complement')
  const discard = normalizeDecisionList(decisions?.discard ?? [], 'decisions.discard')
  const scopes = normalizeSelectedScopes(selectedScopes)

  const activeResolution = await resolveActiveVersion({ workspace, versionsRoot })
  const previousVersionId = activeResolution.workspaceState.activeVersionId
  const createdAt = new Date().toISOString()
  const dynamicConstitutionPath = buildDynamicConstitutionPath(workspace, versionId)
  const manifestPath = getManifestPath(versionsRoot, workspace, versionId)

  await ensureManifestDoesNotExist(manifestPath)

  const manifestTemplatePath = getTemplatePath(versionsRoot, 'memory-version.template.json')
  const manifestRaw = await renderTemplate(manifestTemplatePath, {
    '__VERSION_ID_JSON__': JSON.stringify(versionId),
    '__WORKSPACE_JSON__': JSON.stringify(workspace),
    '__PREVIOUS_VERSION_ID_JSON__': JSON.stringify(previousVersionId),
    '__SOURCE_WORKSPACE_JSON__': JSON.stringify(sourceWorkspace),
    '__SOURCE_VERSION_ID_JSON__': JSON.stringify(sourceVersionId),
    '__SOURCE_TRANSPORT_JSON__': JSON.stringify(normalizedSourceTransport),
    '__SELECTED_SCOPES_JSON__': JSON.stringify(scopes, null, 2),
    '__OWNER_CONTEXT_JSON__': JSON.stringify(ownerContext.trim()),
    '__RETAIN_JSON__': JSON.stringify(retain, null, 2),
    '__COMPLEMENT_JSON__': JSON.stringify(complement, null, 2),
    '__DISCARD_JSON__': JSON.stringify(discard, null, 2),
    '__BUNDLE_METADATA_JSON__': JSON.stringify(bundleMetadata, null, 2),
    '__DYNAMIC_CONSTITUTION_PATH_JSON__': JSON.stringify(dynamicConstitutionPath),
    '__CREATED_AT_JSON__': JSON.stringify(createdAt),
    '__ACTIVATED_AT_JSON__': 'null',
  })

  const manifest = validateMemoryVersionManifest(JSON.parse(manifestRaw), { filePath: manifestPath })
  await writeJsonFile(manifestPath, manifest)

  const dynamicTemplatePath = getTemplatePath(versionsRoot, 'dynamic-constitution.template.md')
  const dynamicConstitutionRaw = await renderTemplate(dynamicTemplatePath, {
    '__WORKSPACE__': workspace,
    '__VERSION_ID__': versionId,
    '__STATUS__': 'candidate',
    '__PREVIOUS_VERSION_ID_OR_NONE__': previousVersionId ?? 'None',
    '__OWNER_CONTEXT__': ownerContext.trim(),
    '__SCOPES__': scopes.map((scope) => `- \`${scope}\``).join('\n'),
    '__RETAIN__': retain.length ? retain.join('; ') : 'none',
    '__COMPLEMENT__': complement.length ? complement.join('; ') : 'none',
    '__DISCARD__': discard.length ? discard.join('; ') : 'none',
    '__ROLLBACK_RULE__': `If activated, ${previousVersionId} becomes the immediate rollback target until a later activation supersedes it.`,
  })

  const dynamicConstitutionAbsolutePath = resolveVersionStorePath(versionsRoot, dynamicConstitutionPath)
  await writeTextFile(dynamicConstitutionAbsolutePath, dynamicConstitutionRaw)

  return {
    manifest,
    manifestPath,
    dynamicConstitutionPath,
    dynamicConstitutionAbsolutePath,
    previousVersionId,
  }
}