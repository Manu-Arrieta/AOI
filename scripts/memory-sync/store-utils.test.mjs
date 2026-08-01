import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  computeSha256Hex,
  defaultExportsRoot,
  defaultVersionsRoot,
  getActiveIndexPath,
  getExportsRoot,
  getManifestPath,
  getRepositoryRoot,
  getTemplatePath,
  resolveExportArtifactPath,
  resolveVersionStorePath,
} from './store-utils.mjs'

// ── defaultVersionsRoot ─────────────────────────────────────────────────────

describe('defaultVersionsRoot', () => {
  it('resolves from a given cwd path', () => {
    const root = defaultVersionsRoot('/home/user/projects/my-app')
    assert.match(root, /\.specify\/memory\/versions$/)
  })
})

// ── getRepositoryRoot ──────────────────────────────────────────────────────

describe('getRepositoryRoot', () => {
  it('resolves three levels up from versions root', () => {
    const versionsRoot = '/home/user/projects/my-app/.specify/memory/versions'
    const repo = getRepositoryRoot(versionsRoot)
    assert.strictEqual(repo, '/home/user/projects/my-app')
  })
})

// ── getActiveIndexPath ─────────────────────────────────────────────────────

describe('getActiveIndexPath', () => {
  it('returns active.json in the versions root', () => {
    const path = getActiveIndexPath('/home/user/.specify/memory/versions')
    assert.strictEqual(path, '/home/user/.specify/memory/versions/active.json')
  })
})

// ── getManifestPath ────────────────────────────────────────────────────────

describe('getManifestPath', () => {
  it('returns the manifest path for a workspace and version', () => {
    const path = getManifestPath('/root/.specify/memory/versions', 'my-project', 'v1.0.0')
    assert.strictEqual(path, '/root/.specify/memory/versions/manifests/my-project/v1.0.0.json')
  })
})

// ── getTemplatePath ────────────────────────────────────────────────────────

describe('getTemplatePath', () => {
  it('returns the template path', () => {
    const path = getTemplatePath('/root/.specify/memory/versions', 'memory-bundle.template.json')
    assert.strictEqual(path, '/root/.specify/memory/versions/templates/memory-bundle.template.json')
  })
})

// ── resolveVersionStorePath ─────────────────────────────────────────────────

describe('resolveVersionStorePath', () => {
  it('strips .specify/memory/versions/ prefix', () => {
    const path = resolveVersionStorePath('/root/.specify/memory/versions', '.specify/memory/versions/manifests/x/v1.json')
    assert.strictEqual(path, '/root/.specify/memory/versions/manifests/x/v1.json')
  })

  it('resolves relative paths from repo root', () => {
    const path = resolveVersionStorePath('/root/.specify/memory/versions', 'some/other/file.json')
    assert.strictEqual(path, '/root/some/other/file.json')
  })
})

// ── resolveExportArtifactPath ──────────────────────────────────────────────

describe('resolveExportArtifactPath', () => {
  const exportsRoot = '/tmp/aoi-test-exports'

  it('resolves a path inside the exports root', () => {
    const path = resolveExportArtifactPath(exportsRoot, 'bundle.json')
    assert.strictEqual(path, '/tmp/aoi-test-exports/bundle.json')
  })

  it('throws when the path escapes the exports root', () => {
    assert.throws(
      () => resolveExportArtifactPath(exportsRoot, '../outside.json'),
      /must stay within/,
    )
  })

  it('throws for an absolute path outside the root', () => {
    assert.throws(
      () => resolveExportArtifactPath(exportsRoot, '/etc/passwd'),
      /must stay within/,
    )
  })

  it('throws for empty path', () => {
    assert.throws(
      () => resolveExportArtifactPath(exportsRoot, ''),
      /required/,
    )
  })
})

// ── defaultExportsRoot ─────────────────────────────────────────────────────

describe('defaultExportsRoot', () => {
  it('resolves .exportsmemories from cwd', () => {
    const root = defaultExportsRoot('/home/user/project')
    assert.match(root, /\.exportsmemories$/)
  })
})

// ── getExportsRoot ─────────────────────────────────────────────────────────

describe('getExportsRoot', () => {
  it('resolves .exportsmemories from repo root via versions root', () => {
    const versionsRoot = '/home/user/project/.specify/memory/versions'
    const exportsR = getExportsRoot(versionsRoot)
    assert.strictEqual(exportsR, '/home/user/project/.exportsmemories')
  })
})

// ── computeSha256Hex ───────────────────────────────────────────────────────

describe('computeSha256Hex', () => {
  it('produces a 64-char hex string', () => {
    const hash = computeSha256Hex('hello world')
    assert.strictEqual(typeof hash, 'string')
    assert.strictEqual(hash.length, 64)
    assert.match(hash, /^[a-f0-9]{64}$/)
  })

  it('is deterministic', () => {
    const a = computeSha256Hex('same input')
    const b = computeSha256Hex('same input')
    assert.strictEqual(a, b)
  })

  it('differs for different inputs', () => {
    const a = computeSha256Hex('input A')
    const b = computeSha256Hex('input B')
    assert.notStrictEqual(a, b)
  })

  it('accepts Buffer as input', () => {
    const hash = computeSha256Hex(Buffer.from('test', 'utf8'))
    assert.strictEqual(hash.length, 64)
  })
})
