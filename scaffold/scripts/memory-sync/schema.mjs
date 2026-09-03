import { readFile } from 'node:fs/promises'

const allowedManifestStatuses = new Set(['candidate', 'active', 'rolled-back', 'superseded'])
const allowedScopes = new Set(['memories', 'memoir', 'feedback'])
const allowedSourceTransports = new Set(['workspace-sync', 'bundle'])
const allowedIntegrityAlgorithms = new Set(['sha256'])

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertString(value, fieldName) {
  assert(typeof value === 'string' && value.trim().length > 0, `${fieldName} must be a non-empty string.`)
}

function assertNullableString(value, fieldName) {
  assert(value === null || typeof value === 'string', `${fieldName} must be a string or null.`)
}

function assertIsoDateString(value, fieldName) {
  assertString(value, fieldName)
  assert(!Number.isNaN(Date.parse(value)), `${fieldName} must be a valid ISO date string.`)
}

function assertStringArray(values, fieldName, options = {}) {
  const { allowEmpty = true } = options

  assert(Array.isArray(values), `${fieldName} must be an array.`)
  if (!allowEmpty) {
    assert(values.length > 0, `${fieldName} must be a non-empty array.`)
  }

  for (const value of values) {
    assertString(value, `${fieldName}[]`)
  }
}

function assertScopeArray(values, fieldName, options = {}) {
  assertStringArray(values, fieldName, options)

  for (const value of values) {
    assert(allowedScopes.has(value), `${fieldName} contains unsupported scope "${value}".`)
  }
}

function assertUniqueStrings(values, fieldName) {
  const seen = new Set()

  for (const value of values) {
    assert(!seen.has(value), `${fieldName} contains duplicate value "${value}".`)
    seen.add(value)
  }
}

function validateIntegrityDescriptor(raw, options = {}) {
  const prefix = options.prefix ?? ''

  assert(isPlainObject(raw), `${prefix}integrity must be an object.`)
  assertString(raw.algorithm, `${prefix}algorithm`)
  assert(allowedIntegrityAlgorithms.has(raw.algorithm), `${prefix}algorithm must be one of ${[...allowedIntegrityAlgorithms].join(', ')}.`)
  assertString(raw.digest, `${prefix}digest`)
  assert(/^[a-f0-9]{64}$/i.test(raw.digest), `${prefix}digest must be a 64-character SHA-256 hex string.`)

  return raw
}

export async function loadJsonFile(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

export function validateBundleMetadata(raw, options = {}) {
  const prefix = options.prefix ?? (options.filePath ? `${options.filePath}: ` : '')

  assert(isPlainObject(raw), `${prefix}bundle metadata must be an object.`)
  assertString(raw.sourceWorkspace, `${prefix}sourceWorkspace`)
  assertString(raw.sourceVersionId, `${prefix}sourceVersionId`)
  assertIsoDateString(raw.exportedAt, `${prefix}exportedAt`)
  assertString(raw.formatVersion, `${prefix}formatVersion`)
  assertScopeArray(raw.includedScopes, `${prefix}includedScopes`, { allowEmpty: false })
  assertUniqueStrings(raw.includedScopes, `${prefix}includedScopes`)

  const omittedScopes = raw.omittedScopes ?? []
  assertScopeArray(omittedScopes, `${prefix}omittedScopes`)
  assertUniqueStrings(omittedScopes, `${prefix}omittedScopes`)

  for (const scope of omittedScopes) {
    assert(!raw.includedScopes.includes(scope), `${prefix}omittedScopes contains scope "${scope}" already present in includedScopes.`)
  }

  validateIntegrityDescriptor(raw.integrity, { prefix: `${prefix}integrity.` })

  return raw
}

export function validateMemoryBundle(raw, options = {}) {
  const prefix = options.filePath ? `${options.filePath}: ` : ''

  assert(isPlainObject(raw), `${prefix}bundle must be an object.`)

  const metadata = validateBundleMetadata(raw.metadata, { prefix: `${prefix}metadata.` })

  assert(isPlainObject(raw.payload), `${prefix}payload must be an object.`)

  const payloadScopes = Object.keys(raw.payload)
  assert(payloadScopes.length > 0, `${prefix}payload must include at least one exported scope.`)

  for (const scope of payloadScopes) {
    assert(allowedScopes.has(scope), `${prefix}payload contains unsupported scope "${scope}".`)
    assert(metadata.includedScopes.includes(scope), `${prefix}payload scope "${scope}" must appear in metadata.includedScopes.`)
  }

  for (const scope of metadata.includedScopes) {
    assert(Object.hasOwn(raw.payload, scope), `${prefix}payload is missing included scope "${scope}".`)
  }

  for (const scope of metadata.omittedScopes ?? []) {
    assert(!Object.hasOwn(raw.payload, scope), `${prefix}payload must not include omitted scope "${scope}".`)
  }

  return raw
}

export function validateActiveVersionIndex(raw, options = {}) {
  const prefix = options.filePath ? `${options.filePath}: ` : ''

  assert(isPlainObject(raw), `${prefix}active.json must be an object.`)
  assert(raw.formatVersion === 1, `${prefix}formatVersion must be 1.`)
  assert(isPlainObject(raw.workspaceStates), `${prefix}workspaceStates must be an object.`)

  for (const [workspace, state] of Object.entries(raw.workspaceStates)) {
    assertString(workspace, `${prefix}workspace key`)
    assert(isPlainObject(state), `${prefix}workspace state for ${workspace} must be an object.`)
    assertString(state.activeVersionId, `${prefix}${workspace}.activeVersionId`)
    assertNullableString(state.previousVersionId, `${prefix}${workspace}.previousVersionId`)
    assertIsoDateString(state.updatedAt, `${prefix}${workspace}.updatedAt`)
  }

  return raw
}

export function validateMemoryVersionManifest(raw, options = {}) {
  const prefix = options.filePath ? `${options.filePath}: ` : ''

  assert(isPlainObject(raw), `${prefix}manifest must be an object.`)
  assertString(raw.versionId, `${prefix}versionId`)
  assertString(raw.workspace, `${prefix}workspace`)
  assert(allowedManifestStatuses.has(raw.status), `${prefix}status must be one of ${[...allowedManifestStatuses].join(', ')}.`)
  assertNullableString(raw.previousVersionId, `${prefix}previousVersionId`)
  assertString(raw.sourceWorkspace, `${prefix}sourceWorkspace`)
  assertNullableString(raw.sourceVersionId, `${prefix}sourceVersionId`)

  if (raw.sourceTransport !== undefined) {
    assertString(raw.sourceTransport, `${prefix}sourceTransport`)
  }

  const sourceTransport = raw.sourceTransport ?? 'workspace-sync'
  assert(allowedSourceTransports.has(sourceTransport), `${prefix}sourceTransport must be one of ${[...allowedSourceTransports].join(', ')}.`)

  assert(Array.isArray(raw.selectedScopes) && raw.selectedScopes.length > 0, `${prefix}selectedScopes must be a non-empty array.`)
  for (const scope of raw.selectedScopes) {
    assert(allowedScopes.has(scope), `${prefix}selectedScopes contains unsupported scope "${scope}".`)
  }

  assertString(raw.ownerContext, `${prefix}ownerContext`)
  assert(isPlainObject(raw.decisions), `${prefix}decisions must be an object.`)
  assertStringArray(raw.decisions.retain ?? [], `${prefix}decisions.retain`)
  assertStringArray(raw.decisions.complement ?? [], `${prefix}decisions.complement`)
  assertStringArray(raw.decisions.discard ?? [], `${prefix}decisions.discard`)
  assertString(raw.dynamicConstitutionPath, `${prefix}dynamicConstitutionPath`)
  assertIsoDateString(raw.createdAt, `${prefix}createdAt`)

  if (raw.bundleMetadata !== undefined && raw.bundleMetadata !== null) {
    assert(sourceTransport === 'bundle', `${prefix}bundleMetadata is only valid when sourceTransport is "bundle".`)
    const bundleMetadata = validateBundleMetadata(raw.bundleMetadata, { prefix: `${prefix}bundleMetadata.` })

    for (const scope of raw.selectedScopes) {
      assert(bundleMetadata.includedScopes.includes(scope), `${prefix}selectedScopes contains scope "${scope}" not present in bundleMetadata.includedScopes.`)
    }
  }

  if (sourceTransport === 'bundle') {
    assert(raw.bundleMetadata !== undefined && raw.bundleMetadata !== null, `${prefix}bundleMetadata is required when sourceTransport is "bundle".`)
  }

  if (raw.activatedAt !== null) {
    assertIsoDateString(raw.activatedAt, `${prefix}activatedAt`)
  }

  return raw
}