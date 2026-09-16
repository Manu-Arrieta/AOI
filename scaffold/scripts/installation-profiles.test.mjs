import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  DEFAULT_INSTALLATION_PROFILE,
  INSTALLATION_PROFILE_NAMES,
  normalizeInstallationProfile,
  profileExcludesRelativePath,
  readInstalledProfile,
  syncPathsForProfile,
} from './installation-profiles.mjs'

test('BIC-2026-005: Core is the default and the three profile names are closed', () => {
  assert.equal(DEFAULT_INSTALLATION_PROFILE, 'core')
  assert.deepEqual(INSTALLATION_PROFILE_NAMES, ['core', 'advanced', 'dashboard'])
  assert.throws(() => normalizeInstallationProfile('experimental'), /Unknown AOI installation profile/)
})

test('BIC-2026-005: only Dashboard owns every aoi_apps artifact', () => {
  for (const profile of ['core', 'advanced']) {
    assert.equal(profileExcludesRelativePath(profile, 'aoi_apps/agentic-ops-dashboard/app.vue'), true)
    assert.equal(profileExcludesRelativePath(profile, 'aoi_apps/pnpm-workspace.yaml'), true)
    assert.equal(profileExcludesRelativePath(profile, 'scripts/aoi-doctor.mjs'), false)
  }
  assert.equal(profileExcludesRelativePath('dashboard', 'aoi_apps/agentic-ops-dashboard/app.vue'), false)

  const paths = ['scripts/aoi-doctor.mjs', 'aoi_apps/pnpm-workspace.yaml', 'aoi_apps/agentic-ops-dashboard/app']
  assert.deepEqual(syncPathsForProfile(paths, 'core'), ['scripts/aoi-doctor.mjs'])
  assert.deepEqual(syncPathsForProfile(paths, 'dashboard'), paths)
})

test('BIC-2026-005: profile evidence keeps legacy Dashboard but lets no-manifest Core stay headless', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-profile-'))
  try {
    assert.equal(readInstalledProfile(root), 'core', 'a new Core install without Git Bash must not invent a dashboard')
    const legacyPackage = path.join(root, 'aoi_apps', 'agentic-ops-dashboard', 'package.json')
    fs.mkdirSync(path.dirname(legacyPackage), { recursive: true })
    fs.writeFileSync(legacyPackage, '{}\n')
    assert.equal(readInstalledProfile(root), 'dashboard', 'legacy workspace with its dashboard package must retain the app contract')
    fs.mkdirSync(path.join(root, '.conf'))
    fs.writeFileSync(path.join(root, '.conf', 'manifest.json'), JSON.stringify({ installation_profile: 'core' }))
    assert.equal(readInstalledProfile(root), 'core')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
