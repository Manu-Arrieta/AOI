import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  collectFilePaths,
  validateScaffoldParity,
} from './validate-scaffold-parity.mjs'

test('collectFilePaths finds files recursively while ignoring DS_Store', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'))
  fs.mkdirSync(path.join(tmpDir, 'sub'), { recursive: true })
  fs.writeFileSync(path.join(tmpDir, 'sub', 'file1.txt'), 'hello')
  fs.writeFileSync(path.join(tmpDir, '.DS_Store'), 'junk')

  const files = collectFilePaths(tmpDir)
  assert.equal(files.length, 1)
  assert.equal(files[0], path.join('sub', 'file1.txt'))

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('validateScaffoldParity detects missing files and content mismatches', () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-test-'))
  const rootDir = path.join(tmpRepo, 'tested-dir')
  const scaffoldDir = path.join(tmpRepo, 'scaffold', 'tested-dir')

  fs.mkdirSync(rootDir, { recursive: true })
  fs.mkdirSync(scaffoldDir, { recursive: true })

  fs.writeFileSync(path.join(rootDir, 'a.txt'), 'matching')
  fs.writeFileSync(path.join(scaffoldDir, 'a.txt'), 'matching')

  // Case 1: 100% match
  const passRes = validateScaffoldParity(tmpRepo, ['tested-dir'])
  assert.equal(passRes.valid, true)
  assert.equal(passRes.checkedFilesCount, 1)

  // Case 2: Content mismatch
  fs.writeFileSync(path.join(scaffoldDir, 'a.txt'), 'different')
  const diffRes = validateScaffoldParity(tmpRepo, ['tested-dir'])
  assert.equal(diffRes.valid, false)
  assert.ok(diffRes.errors[0].includes('CONTENT_MISMATCH'))

  // Case 3: Missing in scaffold
  fs.writeFileSync(path.join(scaffoldDir, 'a.txt'), 'matching')
  fs.writeFileSync(path.join(rootDir, 'b.txt'), 'only-in-root')
  const missingRes = validateScaffoldParity(tmpRepo, ['tested-dir'])
  assert.equal(missingRes.valid, false)
  assert.ok(missingRes.errors[0].includes('MISSING_IN_SCAFFOLD'))

  fs.rmSync(tmpRepo, { recursive: true, force: true })
})
