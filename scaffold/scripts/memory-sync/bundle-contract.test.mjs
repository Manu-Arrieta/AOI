import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateMemoryBundle } from './schema.mjs'
import { defaultExportsRoot, getExportsRoot, loadMemoryBundleAtPath, resolveExportArtifactPath, writeGzipJsonFile } from './store-utils.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const fixturesRoot = join(scriptDirectory, 'fixtures')

async function loadFixture(relativePath) {
  return JSON.parse(await readFile(join(fixturesRoot, relativePath), 'utf8'))
}

test('validateMemoryBundle accepts complete and partial bundle fixtures', async () => {
  const completeBundle = await loadFixture(join('valid', 'bundles', 'complete-bundle.json'))
  const partialBundle = await loadFixture(join('valid', 'bundles', 'partial-bundle.json'))

  assert.deepEqual(validateMemoryBundle(completeBundle).metadata.includedScopes, ['memories', 'memoir', 'feedback'])
  assert.deepEqual(validateMemoryBundle(partialBundle).metadata.omittedScopes, ['memoir'])
})

test('validateMemoryBundle rejects invalid bundle fixtures', async () => {
  const missingIntegrityBundle = await loadFixture(join('invalid', 'bundles', 'missing-integrity-bundle.json'))
  const overlappingScopesBundle = await loadFixture(join('invalid', 'bundles', 'overlapping-scopes-bundle.json'))

  assert.throws(() => validateMemoryBundle(missingIntegrityBundle), /integrity/)
  assert.throws(() => validateMemoryBundle(overlappingScopesBundle), /already present in includedScopes/)
})

test('writeGzipJsonFile and loadMemoryBundleAtPath round-trip a bundle envelope', async () => {
  const bundle = await loadFixture(join('valid', 'bundles', 'complete-bundle.json'))
  const tempRoot = await mkdtemp(join(tmpdir(), 'memory-bundle-'))
  const exportsRoot = join(tempRoot, '.exportsmemories')
  const bundlePath = resolveExportArtifactPath(exportsRoot, 'fixture/complete.memory-bundle.json.gz')

  try {
    await writeGzipJsonFile(bundlePath, bundle)

    const loadedBundle = await loadMemoryBundleAtPath(bundlePath)
    assert.equal(loadedBundle.metadata.sourceWorkspace, 'fixture-source')
    assert.equal(loadedBundle.payload.memoir.memoir, 'fixture-architecture')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('exports roots resolve predictably and prevent path traversal', () => {
  assert.equal(defaultExportsRoot('/tmp/workspace'), '/tmp/workspace/.exportsmemories')
  assert.equal(getExportsRoot('/tmp/workspace/.specify/memory/versions'), '/tmp/workspace/.exportsmemories')
  assert.throws(
    () => resolveExportArtifactPath('/tmp/workspace/.exportsmemories', '../outside.memory-bundle.json.gz'),
    /must stay within the exports root/,
  )
})