/**
 * scripts/conf/managed-guard.test.mjs
 *
 * The guard that keeps `headroom learn --apply` from silently rewriting AOI's
 * managed instruction surface, exercised against real git repositories.
 *
 * It shipped wired as `pre-commit`, which is the one hook that cannot read the
 * commit message: git writes COMMIT_EDITMSG only after pre-commit succeeds. So
 * the `[aoi-managed-ok]` override the guard's own error text told the operator
 * to use never applied to the commit it was written for, and the `git log -1`
 * fallback made the failure dangerous rather than merely useless — a marker
 * left on the previous commit authorised the next one, whatever was in it.
 *
 * Every case below runs a real `git commit`, because the defect lived entirely
 * in when git runs what.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const GUARD = path.join(REPO, '.githooks/pre-commit-aoi-guard.sh')
const MANAGED = 'CLAUDE.md'

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** A repository with the guard wired the way the installer wires it. */
function repoWithGuard(hookName) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-guard-'))
  git(root, 'init', '-q', '.')
  fs.mkdirSync(path.join(root, '.githooks'), { recursive: true })
  fs.copyFileSync(GUARD, path.join(root, '.githooks/pre-commit-aoi-guard.sh'))
  fs.chmodSync(path.join(root, '.githooks/pre-commit-aoi-guard.sh'), 0o755)

  const hook = path.join(root, '.git/hooks', hookName)
  fs.mkdirSync(path.dirname(hook), { recursive: true })
  fs.copyFileSync(GUARD, hook)
  fs.chmodSync(hook, 0o755)

  // An unmanaged first commit, so HEAD exists and the guard has a baseline.
  fs.writeFileSync(path.join(root, 'readme.md'), 'inicial\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'inicial')
  return root
}

/** Attempts a commit touching the managed file. @returns {boolean} allowed */
function commitManaged(root, message, body = String(Math.random())) {
  fs.writeFileSync(path.join(root, MANAGED), body + '\n')
  git(root, 'add', '-A')
  try {
    git(root, 'commit', '-q', '-m', message)
    return true
  } catch {
    return false
  }
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

describe('the managed-file guard, wired as commit-msg', () => {
  it('blocks an unmarked change to a managed file', () => {
    const root = repoWithGuard('commit-msg')
    assert.equal(commitManaged(root, 'chore: toco CLAUDE.md'), false)
    clean(root)
  })

  it('lets the marker through on the very commit that carries it', () => {
    // This is the case that could not work before: the override was read from
    // a file git had not written yet.
    const root = repoWithGuard('commit-msg')
    assert.equal(commitManaged(root, 'chore: revisado [aoi-managed-ok]'), true)
    clean(root)
  })

  it("does not let the previous commit's marker authorise the next one", () => {
    // The dangerous half of the old behaviour. An override is a statement
    // about one reviewed diff; carrying it forward approves a diff nobody saw.
    const root = repoWithGuard('commit-msg')
    assert.equal(commitManaged(root, 'chore: revisado [aoi-managed-ok]'), true)
    assert.equal(commitManaged(root, 'chore: otro cambio sin revisar'), false)
    clean(root)
  })

  it('ignores files it does not manage', () => {
    const root = repoWithGuard('commit-msg')
    fs.writeFileSync(path.join(root, 'src.txt'), 'algo\n')
    git(root, 'add', '-A')
    git(root, 'commit', '-q', '-m', 'feat: archivo del Owner')
    clean(root)
  })
})

describe('wired as pre-commit, the override is unreachable — which is why it moved', () => {
  it('blocks even with the marker, and says so instead of pretending', () => {
    const root = repoWithGuard('pre-commit')
    fs.writeFileSync(path.join(root, MANAGED), 'x\n')
    git(root, 'add', '-A')
    let stderr = ''
    try {
      git(root, 'commit', '-q', '-m', 'chore: revisado [aoi-managed-ok]')
      assert.fail('pre-commit no puede leer el mensaje y aun así dejó pasar el marcador')
    } catch (e) {
      stderr = String(e.stderr || '')
    }
    // The guard must name the real cause rather than repeat an instruction
    // that cannot work from where it is running.
    assert.match(stderr, /commit-msg/, `no explicó el cableado correcto:\n${stderr}`)
    clean(root)
  })
})

describe('the installer wires the guard where the marker can be read', () => {
  const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')
  const TEARDOWN = fs.readFileSync(path.join(REPO, 'teardown.sh'), 'utf8')

  it('installs it as commit-msg', () => {
    assert.match(SETUP, /PROJECT_GITHOOK="\$HOOKS_DIR\/commit-msg"/)
  })

  it('retires a pre-commit wiring an older AOI left behind', () => {
    // Left in place it runs first and blocks, so the override stays
    // unreachable no matter how correct the new hook is.
    assert.match(SETUP, /OLD_PRECOMMIT="\$HOOKS_DIR\/pre-commit"/)
    assert.match(SETUP, /grep -q "pre-commit-aoi-guard\.sh" "\$OLD_PRECOMMIT"/)
  })

  it('teardown sweeps both hook names', () => {
    // A teardown that only knows the current name leaves an old hook pointing
    // at a .githooks directory it just deleted, and every commit then fails.
    assert.match(TEARDOWN, /for hook in commit-msg pre-commit/)
  })
})
