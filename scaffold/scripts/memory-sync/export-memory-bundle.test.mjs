import assert from 'node:assert/strict'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { exportMemoryBundle } from './export-memory-bundle.mjs'
import { loadMemoryBundleAtPath } from './store-utils.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const validFixtureRoot = join(scriptDirectory, 'fixtures', 'valid')

async function withFixture(testFn) {
  const fixtureCopyRoot = await mkdtemp(join(tmpdir(), 'memory-sync-export-'))

  try {
    await cp(validFixtureRoot, fixtureCopyRoot, { recursive: true })
    await testFn(fixtureCopyRoot)
  } finally {
    await rm(fixtureCopyRoot, { recursive: true, force: true })
  }
}

function createScopePayloadLoader() {
  return async ({ scope, workspace, versionId }) => ({
    scope,
    workspace,
    versionId,
    capturedAt: '2026-05-28T00:00:00.000Z',
  })
}

test('exportMemoryBundle writes a full bundle inside the governed exports root', async () => {
  await withFixture(async (versionsRoot) => {
    const exportsRoot = join(dirname(versionsRoot), '.exportsmemories')
    const result = await exportMemoryBundle({
      workspace: 'fixture-workspace',
      versionId: 'fixture-v2',
      relativeArtifactPath: 'fixture/full.memory-bundle.json.gz',
      versionsRoot,
      exportsRoot,
      exportedAt: '2026-05-28T00:00:00.000Z',
      loadScopePayload: createScopePayloadLoader(),
    })

    const loadedBundle = await loadMemoryBundleAtPath(result.bundlePath)
    assert.equal(loadedBundle.metadata.sourceWorkspace, 'fixture-workspace')
    assert.equal(loadedBundle.metadata.sourceVersionId, 'fixture-v2')
    assert.deepEqual(loadedBundle.metadata.includedScopes, ['memories', 'memoir', 'feedback'])
    assert.deepEqual(loadedBundle.metadata.omittedScopes, [])
    assert.equal(loadedBundle.payload.memoir.scope, 'memoir')
    assert.match(result.bundlePath, /\.exportsmemories\/fixture\/full\.memory-bundle\.json\.gz$/)
  })
})

test('exportMemoryBundle writes a partial bundle with declared omitted scopes', async () => {
  await withFixture(async (versionsRoot) => {
    const exportsRoot = join(dirname(versionsRoot), '.exportsmemories')
    const result = await exportMemoryBundle({
      workspace: 'fixture-workspace',
      versionId: 'fixture-v2',
      selectedScopes: ['memories', 'feedback'],
      relativeArtifactPath: 'fixture/partial.memory-bundle.json.gz',
      versionsRoot,
      exportsRoot,
      exportedAt: '2026-05-28T00:00:00.000Z',
      loadScopePayload: createScopePayloadLoader(),
    })

    const loadedBundle = await loadMemoryBundleAtPath(result.bundlePath)
    assert.deepEqual(loadedBundle.metadata.includedScopes, ['memories', 'feedback'])
    assert.deepEqual(loadedBundle.metadata.omittedScopes, ['memoir'])
    assert.equal(Object.hasOwn(loadedBundle.payload, 'memoir'), false)
    assert.equal(loadedBundle.payload.feedback.scope, 'feedback')
  })
})

test('exportMemoryBundle rejects invalid scope selection for the source version', async () => {
  await withFixture(async (versionsRoot) => {
    const exportsRoot = join(dirname(versionsRoot), '.exportsmemories')

    await assert.rejects(
      () => exportMemoryBundle({
        workspace: 'fixture-workspace',
        versionId: 'fixture-v1',
        selectedScopes: ['memoir'],
        relativeArtifactPath: 'fixture/invalid.memory-bundle.json.gz',
        versionsRoot,
        exportsRoot,
        loadScopePayload: createScopePayloadLoader(),
      }),
      /does not include scope "memoir"/,
    )
  })
})