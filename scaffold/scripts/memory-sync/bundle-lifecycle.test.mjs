import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { activateVersion } from './activate-version.mjs'
import { exportMemoryBundle } from './export-memory-bundle.mjs'
import { importMemoryBundle } from './import-memory-bundle.mjs'
import { rollbackVersion } from './rollback-version.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const validFixtureRoot = join(scriptDirectory, 'fixtures', 'valid')

async function withFixture(testFn) {
  const fixtureCopyRoot = await mkdtemp(join(tmpdir(), 'memory-sync-bundle-lifecycle-'))

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

test('bundle-sourced candidate preserves transport metadata through activation and rollback', async () => {
  await withFixture(async (versionsRoot) => {
    const exportsRoot = join(versionsRoot, '.exportsmemories')

    await exportMemoryBundle({
      workspace: 'fixture-workspace',
      versionId: 'fixture-v2',
      selectedScopes: ['memories', 'feedback'],
      relativeArtifactPath: 'fixture/lifecycle.memory-bundle.json.gz',
      versionsRoot,
      exportsRoot,
      exportedAt: '2026-05-28T00:00:00.000Z',
      loadScopePayload: createScopePayloadLoader(),
    })

    const imported = await importMemoryBundle({
      workspace: 'fixture-workspace',
      versionId: 'fixture-v3',
      relativeArtifactPath: 'fixture/lifecycle.memory-bundle.json.gz',
      ownerContext: 'Validate lifecycle preservation for bundle metadata.',
      decisions: {
        retain: ['trusted local facts'],
        complement: ['bundle feedback'],
        discard: ['stale notes'],
      },
      versionsRoot,
      exportsRoot,
    })

    await activateVersion({
      workspace: 'fixture-workspace',
      versionId: 'fixture-v3',
      versionsRoot,
      activatedAt: '2026-05-28T00:10:00.000Z',
    })

    const activeBundleManifest = JSON.parse(await readFile(join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v3.json'), 'utf8'))
    assert.equal(activeBundleManifest.status, 'active')
    assert.equal(activeBundleManifest.sourceTransport, 'bundle')
    assert.equal(activeBundleManifest.bundleMetadata.integrity.digest, imported.bundle.metadata.integrity.digest)

    await rollbackVersion({
      workspace: 'fixture-workspace',
      targetVersionId: 'fixture-v2',
      versionsRoot,
      rolledBackAt: '2026-05-28T00:20:00.000Z',
    })

    const rolledBackBundleManifest = JSON.parse(await readFile(join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v3.json'), 'utf8'))
    const restoredManifest = JSON.parse(await readFile(join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v2.json'), 'utf8'))

    assert.equal(rolledBackBundleManifest.status, 'rolled-back')
    assert.equal(rolledBackBundleManifest.sourceTransport, 'bundle')
    assert.equal(rolledBackBundleManifest.bundleMetadata.integrity.digest, imported.bundle.metadata.integrity.digest)
    assert.equal(restoredManifest.status, 'active')
    assert.equal(restoredManifest.sourceTransport, 'workspace-sync')
  })
})