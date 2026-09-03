import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { exportMemoryBundle } from './export-memory-bundle.mjs'
import { importMemoryBundle } from './import-memory-bundle.mjs'
import { writeGzipJsonFile } from './store-utils.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const validFixtureRoot = join(scriptDirectory, 'fixtures', 'valid')

async function withFixture(testFn) {
  const fixtureCopyRoot = await mkdtemp(join(tmpdir(), 'memory-sync-import-'))

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

async function createValidBundleArtifact({ versionsRoot, exportsRoot, relativeArtifactPath }) {
  return exportMemoryBundle({
    workspace: 'fixture-workspace',
    versionId: 'fixture-v2',
    selectedScopes: ['memories', 'feedback'],
    relativeArtifactPath,
    versionsRoot,
    exportsRoot,
    exportedAt: '2026-05-28T00:00:00.000Z',
    loadScopePayload: createScopePayloadLoader(),
  })
}

test('importMemoryBundle prepares a candidate manifest from a valid bundle without mutating active.json', async () => {
  await withFixture(async (versionsRoot) => {
    const exportsRoot = join(versionsRoot, '.exportsmemories')
    await createValidBundleArtifact({
      versionsRoot,
      exportsRoot,
      relativeArtifactPath: 'fixture/valid.memory-bundle.json.gz',
    })

    const result = await importMemoryBundle({
      workspace: 'fixture-workspace',
      versionId: 'fixture-v3',
      relativeArtifactPath: 'fixture/valid.memory-bundle.json.gz',
      ownerContext: 'Import offline bundle for review.',
      decisions: {
        retain: ['trusted local facts'],
        complement: ['bundle feedback'],
        discard: ['stale notes'],
      },
      versionsRoot,
      exportsRoot,
    })

    const activeIndex = JSON.parse(await readFile(join(versionsRoot, 'active.json'), 'utf8'))
    const candidateManifest = JSON.parse(await readFile(result.manifestPath, 'utf8'))

    assert.equal(activeIndex.workspaceStates['fixture-workspace'].activeVersionId, 'fixture-v2')
    assert.equal(candidateManifest.status, 'candidate')
    assert.equal(candidateManifest.sourceTransport, 'bundle')
    assert.equal(candidateManifest.sourceWorkspace, 'fixture-workspace')
    assert.equal(candidateManifest.sourceVersionId, 'fixture-v2')
    assert.deepEqual(candidateManifest.selectedScopes, ['memories', 'feedback'])
    assert.equal(candidateManifest.bundleMetadata.integrity.digest, result.bundle.metadata.integrity.digest)
  })
})

test('importMemoryBundle rejects a tampered bundle digest without creating a candidate', async () => {
  await withFixture(async (versionsRoot) => {
    const exportsRoot = join(versionsRoot, '.exportsmemories')
    const exported = await createValidBundleArtifact({
      versionsRoot,
      exportsRoot,
      relativeArtifactPath: 'fixture/tampered.memory-bundle.json.gz',
    })

    const tamperedBundle = JSON.parse(JSON.stringify(exported.bundle))
    tamperedBundle.metadata.integrity.digest = '0'.repeat(64)
    await writeGzipJsonFile(exported.bundlePath, tamperedBundle)

    await assert.rejects(
      () => importMemoryBundle({
        workspace: 'fixture-workspace',
        versionId: 'fixture-v3',
        relativeArtifactPath: 'fixture/tampered.memory-bundle.json.gz',
        ownerContext: 'Import tampered bundle.',
        decisions: {
          retain: [],
          complement: [],
          discard: [],
        },
        versionsRoot,
        exportsRoot,
      }),
      /Bundle payload digest mismatch/,
    )

    await assert.rejects(
      () => readFile(join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v3.json'), 'utf8'),
      /ENOENT/,
    )
  })
})

test('importMemoryBundle rejects bundles without provenance metadata', async () => {
  await withFixture(async (versionsRoot) => {
    const exportsRoot = join(versionsRoot, '.exportsmemories')
    const exported = await createValidBundleArtifact({
      versionsRoot,
      exportsRoot,
      relativeArtifactPath: 'fixture/missing-provenance.memory-bundle.json.gz',
    })

    const tamperedBundle = JSON.parse(JSON.stringify(exported.bundle))
    tamperedBundle.metadata.sourceWorkspace = ''
    await writeGzipJsonFile(exported.bundlePath, tamperedBundle)

    await assert.rejects(
      () => importMemoryBundle({
        workspace: 'fixture-workspace',
        versionId: 'fixture-v3',
        relativeArtifactPath: 'fixture/missing-provenance.memory-bundle.json.gz',
        ownerContext: 'Import bundle without provenance.',
        decisions: {
          retain: [],
          complement: [],
          discard: [],
        },
        versionsRoot,
        exportsRoot,
      }),
      /sourceWorkspace must be a non-empty string/,
    )
  })
})