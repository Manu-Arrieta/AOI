import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadAssets } from './monorepo-dead-asset-pruner.mjs'

test('auditDeadAssets identifies active referenced assets and unreferenced zombies', () => {
  const declaredAssets = [
    'public/icons/logo.svg',
    'public/images/hero-banner.png',
    'public/images/deprecated-v1-promo.jpg',
  ]

  const sourceFiles = [
    'import logo from "@/public/icons/logo.svg";',
    'const banner = "/images/hero-banner.png";',
  ]

  const result = auditDeadAssets(declaredAssets, sourceFiles)
  assert.equal(result.activeAssetsCount, 2)
  assert.equal(result.deadAssetsCount, 1)
  assert.deepEqual(result.deadAssets, ['public/images/deprecated-v1-promo.jpg'])
  assert.equal(result.pruningStatus, 'ZOMBIE_ASSETS_DETECTED')
  assert.equal(result.pruningManifest[0].action, 'REMOVE_DEAD_ASSET')
})

test('auditDeadAssets passes when all assets are fully reached', () => {
  const assets = ['logo.png']
  const source = ['<img src="logo.png" />']

  const result = auditDeadAssets(assets, source)
  assert.equal(result.deadAssetsCount, 0)
  assert.equal(result.reachabilityScore, 100)
  assert.equal(result.pruningStatus, 'ASSET_TOPOLOGY_OPTIMAL')
})
