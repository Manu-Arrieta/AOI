import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { prepareVersionManifest } from './prepare-version-manifest.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const validFixtureRoot = join(scriptDirectory, 'fixtures', 'valid')

async function withFixture(testFn) {
  const fixtureCopyRoot = await mkdtemp(join(tmpdir(), 'memory-sync-prepare-'))

  try {
    await cp(validFixtureRoot, fixtureCopyRoot, { recursive: true })
    await testFn(fixtureCopyRoot)
  } finally {
    await rm(fixtureCopyRoot, { recursive: true, force: true })
  }
}

test('prepareVersionManifest writes a candidate manifest and dynamic constitution snapshot', async () => {
  await withFixture(async (versionsRoot) => {
    const result = await prepareVersionManifest({
      workspace: 'fixture-workspace',
      versionId: 'fixture-v3',
      sourceWorkspace: 'source-workspace',
      sourceVersionId: 'source-v8',
      selectedScopes: ['memories', 'feedback'],
      ownerContext: 'Import only trusted episodic memory and feedback.',
      decisions: {
        retain: ['trusted local facts'],
        complement: ['source feedback'],
        discard: ['stale source notes'],
      },
      versionsRoot,
    })

    assert.equal(result.manifest.status, 'candidate')
    assert.equal(result.manifest.previousVersionId, 'fixture-v2')
    assert.equal(result.manifest.sourceTransport, 'workspace-sync')
    assert.equal(result.manifest.bundleMetadata, null)
    assert.deepEqual(result.manifest.selectedScopes, ['memories', 'feedback'])

    const writtenManifest = JSON.parse(await readFile(result.manifestPath, 'utf8'))
    assert.equal(writtenManifest.versionId, 'fixture-v3')
    assert.equal(writtenManifest.sourceTransport, 'workspace-sync')

    const constitutionRaw = await readFile(result.dynamicConstitutionAbsolutePath, 'utf8')
    assert.match(constitutionRaw, /fixture-v3/)
    assert.match(constitutionRaw, /trusted local facts/)
  })
})

test('prepareVersionManifest rejects duplicate version identifiers', async () => {
  await withFixture(async (versionsRoot) => {
    await assert.rejects(
      () => prepareVersionManifest({
        workspace: 'fixture-workspace',
        versionId: 'fixture-v2',
        sourceWorkspace: 'source-workspace',
        sourceVersionId: 'source-v8',
        ownerContext: 'Duplicate version should fail.',
        decisions: { retain: [], complement: [], discard: [] },
        versionsRoot,
      }),
      /already exists/,
    )
  })
})