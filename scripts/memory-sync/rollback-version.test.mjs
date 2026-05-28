import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { activateVersion } from './activate-version.mjs'
import { prepareVersionManifest } from './prepare-version-manifest.mjs'
import { rollbackVersion } from './rollback-version.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const validFixtureRoot = join(scriptDirectory, 'fixtures', 'valid')

async function withFixture(testFn) {
  const fixtureCopyRoot = await mkdtemp(join(tmpdir(), 'memory-sync-rollback-'))

  try {
    await cp(validFixtureRoot, fixtureCopyRoot, { recursive: true })
    await testFn(fixtureCopyRoot)
  } finally {
    await rm(fixtureCopyRoot, { recursive: true, force: true })
  }
}

async function activateCandidateVersion(versionsRoot) {
  await prepareVersionManifest({
    workspace: 'fixture-workspace',
    versionId: 'fixture-v3',
    sourceWorkspace: 'source-workspace',
    sourceVersionId: 'source-v8',
    ownerContext: 'Candidate to test rollback behavior.',
    decisions: {
      retain: ['trusted local facts'],
      complement: ['source feedback'],
      discard: ['stale notes'],
    },
    versionsRoot,
  })

  await activateVersion({ workspace: 'fixture-workspace', versionId: 'fixture-v3', versionsRoot, activatedAt: '2026-05-27T00:10:00.000Z' })
}

test('rollbackVersion restores the previous version and marks the reverted one', async () => {
  await withFixture(async (versionsRoot) => {
    await activateCandidateVersion(versionsRoot)

    const rollback = await rollbackVersion({
      workspace: 'fixture-workspace',
      targetVersionId: 'fixture-v2',
      versionsRoot,
      rolledBackAt: '2026-05-27T00:20:00.000Z',
    })

    assert.equal(rollback.nextActiveIndex.workspaceStates['fixture-workspace'].activeVersionId, 'fixture-v2')
    assert.equal(rollback.nextActiveIndex.workspaceStates['fixture-workspace'].previousVersionId, 'fixture-v3')

    const activeIndex = JSON.parse(await readFile(join(versionsRoot, 'active.json'), 'utf8'))
    const restoredManifest = JSON.parse(await readFile(join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v2.json'), 'utf8'))
    const rolledBackManifest = JSON.parse(await readFile(join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v3.json'), 'utf8'))

    assert.equal(activeIndex.workspaceStates['fixture-workspace'].activeVersionId, 'fixture-v2')
    assert.equal(restoredManifest.status, 'active')
    assert.equal(rolledBackManifest.status, 'rolled-back')
    assert.equal(restoredManifest.dynamicConstitutionPath, '.specify/memory/versions/constitutions/fixture-workspace/fixture-v2.md')
  })
})

test('rollbackVersion rejects an invalid target version', async () => {
  await withFixture(async (versionsRoot) => {
    await activateCandidateVersion(versionsRoot)

    await assert.rejects(
      () => rollbackVersion({ workspace: 'fixture-workspace', targetVersionId: 'fixture-v1', versionsRoot }),
      /not the registered previous version/,
    )
  })
})

test('rollbackVersion rejects workspaces without a registered previous version', async () => {
  await withFixture(async (versionsRoot) => {
    const activeIndexPath = join(versionsRoot, 'active.json')
    const activeIndex = JSON.parse(await readFile(activeIndexPath, 'utf8'))
    activeIndex.workspaceStates['fixture-workspace'].previousVersionId = null
    await writeFile(activeIndexPath, `${JSON.stringify(activeIndex, null, 2)}\n`, 'utf8')

    await assert.rejects(
      () => rollbackVersion({ workspace: 'fixture-workspace', targetVersionId: 'fixture-v1', versionsRoot }),
      /No previous memory version registered/,
    )
  })
})