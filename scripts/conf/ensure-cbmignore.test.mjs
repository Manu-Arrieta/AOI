import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { CBM_BOUNDARIES, ensureCbmIgnoreBoundary, renderedBoundary, withManagedCbmBoundary } from './ensure-cbmignore.mjs'

test('BIC-2026-007: añade la frontera control-plane sin reemplazar reglas del Owner', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-cbmignore-'))
  try {
    const target = path.join(root, '.cbmignore')
    const ownerSource = 'dist/\n!aoi_apps/\n'
    fs.writeFileSync(target, ownerSource)

    const first = ensureCbmIgnoreBoundary(target, 'control-plane')
    const updated = fs.readFileSync(target, 'utf8')
    assert.equal(first.changed, true)
    assert.match(updated, /^dist\/\n!aoi_apps\/\n/m)
    assert.ok(updated.endsWith(renderedBoundary('control-plane')))

    const second = ensureCbmIgnoreBoundary(target, 'control-plane')
    assert.equal(second.changed, false)
    assert.equal(fs.readFileSync(target, 'utf8'), updated)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('BIC-2026-007: la última regla administrada revoca una negación anterior', () => {
  const result = withManagedCbmBoundary('!scaffold/\n!aoi_apps/\n', 'control-plane')
  assert.equal(result.changed, true)
  assert.ok(result.text.endsWith(renderedBoundary('control-plane')))
  assert.deepEqual(CBM_BOUNDARIES['control-plane'].patterns, ['scaffold/', 'aoi_apps/'])
})

test('BIC-2026-007: conserva CRLF del Owner y delimita el bundle Nuxt separado', () => {
  const result = withManagedCbmBoundary('coverage/\r\n', 'dashboard')
  assert.match(result.text, /coverage\/\r\n\r\n# AOI managed Codebase Memory boundary: dashboard\r\n\.output\/\r\n$/)
  assert.throws(() => withManagedCbmBoundary('', 'unknown'), /Unknown Codebase Memory boundary/)
})
