import test from 'node:test'
import assert from 'node:assert/strict'
import { alignBidirectionalAbi, canonicalizeFieldName } from './bidirectional-abi-linker.mjs'

test('canonicalizeFieldName normalizes camelCase, PascalCase and snake_case', () => {
  assert.equal(canonicalizeFieldName('userId'), 'user_id')
  assert.equal(canonicalizeFieldName('UserId'), 'user_id')
  assert.equal(canonicalizeFieldName('user_id'), 'user_id')
  assert.equal(canonicalizeFieldName('task-status'), 'task_status')
})

test('alignBidirectionalAbi aligns TypeScript client interface with C# backend DTO', () => {
  const clientTs = `
export interface UserTask {
  taskId: string;
  taskTitle: string;
  isCompleted: boolean;
}
`
  const serverCs = `
public class UserTaskDto {
  public string TaskId { get; set; }
  public string TaskTitle { get; set; }
  public bool IsCompleted { get; set; }
}
`
  const alignment = alignBidirectionalAbi(clientTs, serverCs)
  assert.equal(alignment.aligned, true)
  assert.equal(alignment.alignmentScore, 100)
  assert.equal(alignment.matchedCount, 3)
  assert.equal(alignment.fieldMapping['taskId'], 'TaskId')
  assert.equal(alignment.fieldMapping['taskTitle'], 'TaskTitle')
  assert.equal(alignment.fieldMapping['isCompleted'], 'IsCompleted')
})
