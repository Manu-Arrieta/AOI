import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { activateVersion } from './activate-version.mjs'
import { prepareVersionManifest } from './prepare-version-manifest.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const validFixtureRoot = join(scriptDirectory, 'fixtures', 'valid')

async function withFixture(testFn) {
  const fixtureCopyRoot = await mkdtemp(join(tmpdir(), 'memory-sync-activate-'))

  try {
    await cp(validFixtureRoot, fixtureCopyRoot, { recursive: true })
    await testFn(fixtureCopyRoot)
  } finally {
    await rm(fixtureCopyRoot, { recursive: true, force: true })
  }
}

test('activateVersion promotes a candidate and updates the active index', async () => {
  await withFixture(async (versionsRoot) => {
    await prepareVersionManifest({
      workspace: 'fixture-workspace',
      versionId: 'fixture-v3',
      sourceWorkspace: 'source-workspace',
      sourceVersionId: 'source-v8',
      ownerContext: 'Candidate for activation.',
      decisions: {
        retain: ['trusted local facts'],
        complement: ['source feedback'],
        discard: ['stale notes'],
      },
      versionsRoot,
    })

    const activation = await activateVersion({ workspace: 'fixture-workspace', versionId: 'fixture-v3', versionsRoot, activatedAt: '2026-05-27T00:10:00.000Z' })

    assert.equal(activation.nextActiveIndex.workspaceStates['fixture-workspace'].activeVersionId, 'fixture-v3')
    assert.equal(activation.nextActiveIndex.workspaceStates['fixture-workspace'].previousVersionId, 'fixture-v2')

    const activeIndex = JSON.parse(await readFile(join(versionsRoot, 'active.json'), 'utf8'))
    assert.equal(activeIndex.workspaceStates['fixture-workspace'].activeVersionId, 'fixture-v3')

    const promotedManifest = JSON.parse(await readFile(join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v3.json'), 'utf8'))
    const supersededManifest = JSON.parse(await readFile(join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v2.json'), 'utf8'))

    assert.equal(promotedManifest.status, 'active')
    assert.equal(promotedManifest.previousVersionId, 'fixture-v2')
    assert.equal(supersededManifest.status, 'superseded')
  })
})

test('activateVersion rejects unknown candidate versions', async () => {
  await withFixture(async (versionsRoot) => {
    await assert.rejects(
      () => activateVersion({ workspace: 'fixture-workspace', versionId: 'missing-version', versionsRoot }),
      /ENOENT|manifest must be an object/,
    )
  })
})