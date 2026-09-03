import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveActiveVersion } from './resolve-active-version.mjs'
import { validateActiveVersionIndex, validateMemoryVersionManifest } from './schema.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const validFixtureRoot = join(scriptDirectory, 'fixtures', 'valid')

async function withFixture(testFn) {
  const fixtureCopyRoot = await mkdtemp(join(tmpdir(), 'memory-sync-'))

  try {
    await cp(validFixtureRoot, fixtureCopyRoot, { recursive: true })
    await testFn(fixtureCopyRoot)
  } finally {
    await rm(fixtureCopyRoot, { recursive: true, force: true })
  }
}

test('validateActiveVersionIndex rejects a missing workspaceStates object', () => {
  assert.throws(
    () => validateActiveVersionIndex({ formatVersion: 1 }, { filePath: 'active.json' }),
    /workspaceStates must be an object/,
  )
})

test('validateMemoryVersionManifest rejects unsupported scopes', () => {
  assert.throws(
    () => validateMemoryVersionManifest({
      versionId: 'v1',
      workspace: 'demo',
      status: 'candidate',
      previousVersionId: null,
      sourceWorkspace: 'demo',
      sourceVersionId: null,
      selectedScopes: ['unknown-scope'],
      ownerContext: 'bad fixture',
      decisions: { retain: [], complement: [], discard: [] },
      dynamicConstitutionPath: '.specify/memory/versions/constitutions/demo/v1.md',
      createdAt: '2026-05-27T00:00:00.000Z',
      activatedAt: null,
    }, { filePath: 'manifest.json' }),
    /unsupported scope/,
  )
})

test('resolveActiveVersion loads the active and previous manifests from fixtures', async () => {
  await withFixture(async (versionsRoot) => {
    const resolution = await resolveActiveVersion({ workspace: 'fixture-workspace', versionsRoot })

    assert.equal(resolution.activeManifest.versionId, 'fixture-v2')
    assert.equal(resolution.previousManifest?.versionId, 'fixture-v1')
    assert.equal(resolution.workspaceState.activeVersionId, 'fixture-v2')
  })
})

test('resolveActiveVersion fails when the workspace is not registered', async () => {
  await withFixture(async (versionsRoot) => {
    await assert.rejects(
      () => resolveActiveVersion({ workspace: 'missing-workspace', versionsRoot }),
      /No active memory version registered/,
    )
  })
})

test('resolveActiveVersion fails when the active manifest is missing', async () => {
  await withFixture(async (versionsRoot) => {
    await unlink(join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v2.json'))

    await assert.rejects(
      () => resolveActiveVersion({ workspace: 'fixture-workspace', versionsRoot }),
      /Memory version manifest not found/,
    )
  })
})

test('resolveActiveVersion fails when the active manifest points to a missing constitution snapshot', async () => {
  await withFixture(async (versionsRoot) => {
    const manifestPath = join(versionsRoot, 'manifests', 'fixture-workspace', 'fixture-v2.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.dynamicConstitutionPath = '.specify/memory/versions/constitutions/fixture-workspace/missing.md'
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    await assert.rejects(
      () => resolveActiveVersion({ workspace: 'fixture-workspace', versionsRoot }),
      /Dynamic memory constitution snapshot not found/,
    )
  })
})