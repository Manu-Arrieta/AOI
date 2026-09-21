import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

async function withUnregisteredWorkspace(testFn) {
  await withFixture(async (versionsRoot) => {
    // Estado de fabrica: el indice existe y no registra ningun workspace. Es lo
    // que AOI instala en cada proyecto, y hasta este arreglo NINGUN camino del
    // ciclo podia salir de el: `prepareVersionManifest` y `activateVersion`
    // exigian un predecesor, asi que un workspace nuevo era inarrancable.
    await writeFile(
      join(versionsRoot, 'active.json'),
      `${JSON.stringify({ formatVersion: 1, workspaceStates: {} }, null, 2)}\n`,
      'utf8',
    )

    await testFn(versionsRoot)
  })
}

test('the first version of an unregistered workspace can be prepared and activated', async () => {
  await withUnregisteredWorkspace(async (versionsRoot) => {
    const prepared = await prepareVersionManifest({
      workspace: 'fresh-workspace',
      versionId: 'fresh-v1',
      sourceWorkspace: 'fresh-workspace',
      sourceVersionId: 'fresh-v1',
      ownerContext: 'Primera version de un workspace sin historia.',
      decisions: { retain: [], complement: [], discard: [] },
      versionsRoot,
    })

    // Sin predecesor, y explicito: `validateActiveVersionIndex` usa
    // `assertNullableString`, que acepta null pero NO acepta que la clave falte.
    assert.equal(prepared.previousVersionId, null)
    assert.equal(prepared.manifest.previousVersionId, null)

    const activation = await activateVersion({
      workspace: 'fresh-workspace',
      versionId: 'fresh-v1',
      versionsRoot,
      activatedAt: '2026-05-27T00:10:00.000Z',
    })

    assert.equal(activation.previousVersionId, null)
    assert.equal(activation.supersededManifest, null)

    const activeIndex = JSON.parse(await readFile(join(versionsRoot, 'active.json'), 'utf8'))
    assert.equal(activeIndex.workspaceStates['fresh-workspace'].activeVersionId, 'fresh-v1')
    assert.equal(activeIndex.workspaceStates['fresh-workspace'].previousVersionId, null)

    const activatedManifest = JSON.parse(
      await readFile(join(versionsRoot, 'manifests', 'fresh-workspace', 'fresh-v1.json'), 'utf8'),
    )
    assert.equal(activatedManifest.status, 'active')
    assert.equal(activatedManifest.previousVersionId, null)
  })
})

// Control negativo del camino nuevo. Sin esto, "el bootstrap funciona" tambien
// seria cierto si el arreglo hubiera aflojado la precondicion en vez de
// reconocer el estado inicial: cualquier candidato entraria sin predecesor y el
// paso de supersede se saltaria en silencio.
test('the bootstrap path refuses a candidate that declares a predecessor', async () => {
  await withUnregisteredWorkspace(async (versionsRoot) => {
    const orphanManifest = {
      versionId: 'orphan-v1',
      workspace: 'fresh-workspace',
      status: 'candidate',
      previousVersionId: 'ghost-v1',
      sourceWorkspace: 'fresh-workspace',
      sourceVersionId: 'fresh-v1',
      sourceTransport: 'workspace-sync',
      bundleMetadata: null,
      selectedScopes: ['memories'],
      ownerContext: 'Candidato con predecesor declarado pero sin version activa.',
      decisions: { retain: [], complement: [], discard: [] },
      dynamicConstitutionPath: '.specify/memory/versions/constitutions/fresh-workspace/orphan-v1.md',
      createdAt: '2026-05-27T00:00:00.000Z',
      activatedAt: null,
    }

    const orphanDirectory = join(versionsRoot, 'manifests', 'fresh-workspace')
    await mkdir(orphanDirectory, { recursive: true })
    await writeFile(join(orphanDirectory, 'orphan-v1.json'), `${JSON.stringify(orphanManifest, null, 2)}\n`, 'utf8')

    await assert.rejects(
      () => activateVersion({ workspace: 'fresh-workspace', versionId: 'orphan-v1', versionsRoot }),
      /Cannot bootstrap workspace/,
    )
  })
})