import test from 'node:test'
import assert from 'node:assert/strict'
import { traceTaintFlows } from './ast-taint-tracer.mjs'

test('traceTaintFlows detects dangerous unsanitized sinks', () => {
  const unsafeCode = `
import { exec } from 'node:child_process'
export function runCommand(req: any) {
  const userCmd = req.query.cmd;
  exec(userCmd);
}
`
  const result = traceTaintFlows(unsafeCode, 'api.ts')
  assert.equal(result.safe, false)
  assert.ok(result.violations.some((v) => v.sink === 'command_injection_exec'))
})

test('traceTaintFlows passes clean and sanitized code', () => {
  const safeCode = `
import path from 'node:path'
export function getSafeFilePath(fileName: string) {
  const safeName = path.resolve('/var/data', fileName);
  return safeName;
}
`
  const result = traceTaintFlows(safeCode, 'file-utils.ts')
  assert.equal(result.safe, true)
  assert.equal(result.violations.length, 0)
})
