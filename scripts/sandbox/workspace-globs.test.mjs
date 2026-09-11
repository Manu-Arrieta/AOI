/**
 * scripts/sandbox/workspace-globs.test.mjs
 *
 * Reading a pnpm workspace declaration without a YAML parser.
 *
 * This is the code that decides WHICH directories AOI will treat as the
 * Owner's packages, so getting it wrong points the sandbox at the wrong
 * tree — or at none, which looks like an empty project rather than a
 * misread file. It was measured at 57% by mutation inside
 * `detect-base-project.mjs`, and the survivors were in the line-state
 * machine: what counts as the `packages:` key, when the list ends, and which
 * entries are exclusions.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { expandWorkspaceGlob, isDirectory, parsePnpmWorkspacePackages } from './workspace-globs.mjs'

describe('parsePnpmWorkspacePackages', () => {
  const parse = parsePnpmWorkspacePackages

  it('reads a plain packages list', () => {
    assert.deepEqual(parse('packages:\n  - "apps/*"\n  - "libs/*"\n'), ['apps/*', 'libs/*'])
  })

  it('accepts entries with and without quotes', () => {
    assert.deepEqual(parse("packages:\n  - apps/*\n  - 'libs/*'\n"), ['apps/*', 'libs/*'])
  })

  it('returns nothing for input that is not a string or is blank', () => {
    // A missing pnpm-workspace.yaml is normal; answering with `[]` is the
    // difference between "no workspace declared" and a crash mid-detection.
    for (const input of [undefined, null, 42, '', '   \n\t\n']) {
      assert.deepEqual(parse(input), [], String(input))
    }
  })

  it('returns nothing when there is no packages key at all', () => {
    assert.deepEqual(parse('onlyBuiltDependencies:\n  - esbuild\n'), [])
  })

  it('skips comments and blank lines inside the list', () => {
    assert.deepEqual(parse('packages:\n\n  # los apps\n  - "apps/*"\n\n  - "libs/*"\n'), ['apps/*', 'libs/*'])
  })

  it('drops `!` exclusions instead of treating them as packages', () => {
    // An exclusion read as an inclusion would add a directory the Owner
    // explicitly removed — the one entry whose meaning is inverted.
    assert.deepEqual(parse('packages:\n  - "apps/*"\n  - "!apps/legacy"\n'), ['apps/*'])
  })

  it('stops at the next top-level key', () => {
    // Without a terminator the parser swallows the rest of the file and
    // turns unrelated values into package globs.
    const yaml = 'packages:\n  - "apps/*"\nonlyBuiltDependencies:\n  - esbuild\n  - sharp\n'
    assert.deepEqual(parse(yaml), ['apps/*'])
  })

  it('ignores anything before the packages key', () => {
    assert.deepEqual(parse('otra: cosa\npackages:\n  - "apps/*"\n'), ['apps/*'])
  })

  it('treats tabs as indentation rather than choking on them', () => {
    assert.deepEqual(parse('packages:\n\t- "apps/*"\n'), ['apps/*'])
  })

  it('returns an empty list for a declared but empty packages key', () => {
    assert.deepEqual(parse('packages:\nonlyBuiltDependencies:\n  - esbuild\n'), [])
  })
})

describe('expandWorkspaceGlob', () => {
  /** A tree of directories to expand globs against. */
  function tree(dirs) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-globs-'))
    for (const d of dirs) fs.mkdirSync(path.join(root, d), { recursive: true })
    return root
  }
  const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

  it('expands `*` to the immediate child directories', () => {
    const root = tree(['apps/web', 'apps/api'])
    assert.deepEqual(expandWorkspaceGlob('apps/*', root).sort(), ['apps/api', 'apps/web'])
    clean(root)
  })

  it('resolves an exact path that exists, and drops one that does not', () => {
    const root = tree(['apps/web'])
    assert.deepEqual(expandWorkspaceGlob('apps/web', root), ['apps/web'])
    assert.deepEqual(expandWorkspaceGlob('apps/fantasma', root), [])
    clean(root)
  })

  it('returns nothing rather than throwing when the parent does not exist', () => {
    const root = tree([])
    assert.deepEqual(expandWorkspaceGlob('apps/*', root), [])
    clean(root)
  })

  it('skips hidden directories', () => {
    // `.git` and friends are not packages, and including them would send the
    // detector walking into version-control internals.
    const root = tree(['apps/web', 'apps/.cache'])
    assert.deepEqual(expandWorkspaceGlob('apps/*', root), ['apps/web'])
    clean(root)
  })

  it('does not match a file where a directory is expected', () => {
    const root = tree(['apps/web'])
    fs.writeFileSync(path.join(root, 'apps/README.md'), '# x\n')
    assert.deepEqual(expandWorkspaceGlob('apps/*', root), ['apps/web'])
    clean(root)
  })

  it('expands several segments in sequence', () => {
    const root = tree(['grupo/uno/pkg', 'grupo/dos/pkg'])
    assert.deepEqual(expandWorkspaceGlob('grupo/*/pkg', root).sort(), ['grupo/dos/pkg', 'grupo/uno/pkg'])
    clean(root)
  })

  it('tolerates a leading "./" and a trailing slash', () => {
    const root = tree(['apps/web'])
    for (const glob of ['./apps/*', 'apps/*/']) {
      assert.deepEqual(expandWorkspaceGlob(glob, root), ['apps/web'], glob)
    }
    clean(root)
  })
})

describe('isDirectory', () => {
  it('distinguishes a directory from a file and from nothing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-isdir-'))
    fs.mkdirSync(path.join(root, 'carpeta'))
    fs.writeFileSync(path.join(root, 'archivo.txt'), 'x')

    assert.equal(isDirectory(path.join(root, 'carpeta')), true)
    assert.equal(isDirectory(path.join(root, 'archivo.txt')), false)
    assert.equal(isDirectory(path.join(root, 'nada')), false)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
