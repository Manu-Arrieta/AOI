import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  classifyRoots,
  detectFromDisk,
  expandWorkspaceGlob,
  parsePnpmWorkspacePackages,
} from './detect-base-project.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

test('frontend-only workspace classifies the app as a frontend root', () => {
  const roots = classifyRoots({
    pnpmWorkspace: 'packages:\n  - apps/*\n',
    packageJsons: [
      {
        dir: 'apps/web',
        packageJson: { dependencies: { nuxt: '4.0.0', vue: '3.5.0' } },
        hasServerDir: false,
      },
    ],
  })

  assert.deepEqual(roots, {
    frontend: ['apps/web'],
    backend: [],
    sharedLibs: [],
  })
})

test('frontend app with a server/ dir plus a standalone backend package', () => {
  const roots = classifyRoots({
    packageJsons: [
      {
        dir: 'apps/dashboard',
        packageJson: { dependencies: { nuxt: '4.0.0' } },
        hasServerDir: true,
      },
      {
        dir: 'apps/api',
        packageJson: { dependencies: { express: '4.19.0' } },
        hasServerDir: false,
      },
    ],
  })

  assert.deepEqual(roots, {
    frontend: ['apps/dashboard'],
    backend: ['apps/api', 'apps/dashboard/server'],
    sharedLibs: [],
  })
})

test('packages/* without an app entry are classified as sharedLibs', () => {
  const roots = classifyRoots({
    packageJsons: [
      {
        dir: 'apps/web',
        packageJson: { dependencies: { react: '19.0.0' } },
        hasServerDir: false,
      },
      {
        dir: 'packages/ui-kit',
        packageJson: { dependencies: { lodash: '4.17.21' } },
        hasServerDir: false,
      },
      {
        dir: 'packages/utils',
        packageJson: {},
        hasServerDir: false,
      },
    ],
  })

  assert.deepEqual(roots, {
    frontend: ['apps/web'],
    backend: [],
    sharedLibs: ['packages/ui-kit', 'packages/utils'],
  })
})

test('@nestjs scoped deps classify a package as backend', () => {
  const roots = classifyRoots({
    packageJsons: [
      {
        dir: 'services/auth',
        packageJson: { dependencies: { '@nestjs/core': '10.0.0', '@nestjs/common': '10.0.0' } },
        hasServerDir: false,
      },
    ],
  })

  assert.deepEqual(roots, {
    frontend: [],
    backend: ['services/auth'],
    sharedLibs: [],
  })
})

test('ambiguous package under apps/ falls back to frontend', () => {
  const roots = classifyRoots({
    packageJsons: [
      {
        dir: 'apps/marketing',
        packageJson: { dependencies: { 'some-unknown-lib': '1.0.0' } },
        hasServerDir: false,
      },
    ],
  })

  assert.deepEqual(roots, {
    frontend: ['apps/marketing'],
    backend: [],
    sharedLibs: [],
  })
})

test('parsePnpmWorkspacePackages reads the packages list and skips exclusions', () => {
  const globs = parsePnpmWorkspacePackages(
    [
      '# AOI workspace',
      'packages:',
      '  - apps/*',
      "  - 'packages/*'",
      '  - "!**/test/**"',
      'allowBuilds:',
      '  esbuild: true',
    ].join('\n'),
  )

  assert.deepEqual(globs, ['apps/*', 'packages/*'])
})

test('expandWorkspaceGlob resolves apps/* against this repo', () => {
  const dirs = expandWorkspaceGlob('apps/*', repoRoot)
  assert.ok(dirs.includes('apps/agentic-ops-dashboard'), `expected apps/agentic-ops-dashboard in ${dirs.join(', ')}`)
})

test('detectFromDisk proposes the AOI dashboard as the frontend root', () => {
  const proposal = detectFromDisk(repoRoot)

  assert.equal(proposal.$schemaVersion, 1)
  assert.equal(proposal.baseRoot, '.')
  assert.equal(proposal.confirmedBy, null)
  assert.equal(proposal.workspaceManager, 'pnpm')

  assert.deepEqual(proposal.roots.frontend, ['apps/agentic-ops-dashboard'])
  assert.deepEqual(proposal.roots.backend, ['apps/agentic-ops-dashboard/server'])
  assert.deepEqual(proposal.roots.sharedLibs, [])
})
