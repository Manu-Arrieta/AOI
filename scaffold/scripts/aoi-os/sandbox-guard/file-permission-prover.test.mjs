import test from 'node:test'
import assert from 'node:assert/strict'
import { proveFilePermissions } from './file-permission-prover.mjs'

test('proveFilePermissions approves strict least-privilege permission masks', () => {
  const safeCode = `
import fs from 'node:fs';
fs.writeFileSync('output.txt', data, { mode: 0o644 });
`
  const result = proveFilePermissions(safeCode)
  assert.equal(result.secure, true)
  assert.equal(result.permissionProof, 'LEAST_PRIVILEGE_PERMISSIONS_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('proveFilePermissions detects dangerous world-writable chmod masks', () => {
  const insecureCode = `
import fs from 'node:fs';
fs.chmodSync('script.sh', '0777');
`
  const result = proveFilePermissions(insecureCode)
  assert.equal(result.secure, false)
  assert.equal(result.permissionProof, 'DANGEROUS_PERMISSIONS_DETECTED')
  assert.equal(result.violationsCount, 1)
  assert.equal(result.violations[0].mask, '0777')
})
