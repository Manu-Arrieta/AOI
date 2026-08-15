import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateBftQuorum } from './bft-quorum-engine.mjs'

test('evaluateBftQuorum approves clean, safe, and test-verified code with supermajority', () => {
  const cleanCode = `
export interface Task {
  id: string;
}

export function getTask(id: string): Task {
  return { id };
}
`
  const result = evaluateBftQuorum({
    sourceCode: cleanCode,
    filePath: 'task.ts',
    testsPassed: true,
  })

  assert.equal(result.quorumApproved, true)
  assert.equal(result.consensusScore, 100)
  assert.equal(result.dissentsCount, 0)
})

test('evaluateBftQuorum vetoes code with critical taint security violations', () => {
  const unsafeCode = `
import { exec } from 'node:child_process'
export function run(req: any) {
  exec(req.query.cmd);
}
`
  const result = evaluateBftQuorum({
    sourceCode: unsafeCode,
    filePath: 'api.ts',
    testsPassed: true,
  })

  assert.equal(result.quorumApproved, false)
  assert.ok(result.dissents.some((d) => d.verifier === 'Taint_Security_Verifier'))
})
