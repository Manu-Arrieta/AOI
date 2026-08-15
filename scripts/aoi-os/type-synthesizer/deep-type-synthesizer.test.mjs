import test from 'node:test'
import assert from 'node:assert/strict'
import { synthesizeFunctionTypesAndSchema } from './deep-type-synthesizer.mjs'

test('synthesizeFunctionTypesAndSchema infers types and builds clean TypeScript interface and Zod schema', () => {
  const fn = 'function createWorkspace(workspaceId, taskCount, isEnabled, tags)'
  const result = synthesizeFunctionTypesAndSchema(fn)

  assert.equal(result.functionName, 'createWorkspace')
  assert.equal(result.interfaceName, 'CreateWorkspaceParams')
  assert.equal(result.schemaName, 'CreateWorkspaceSchema')

  assert.ok(result.tsInterface.includes('workspaceId: string;'))
  assert.ok(result.tsInterface.includes('taskCount: number;'))
  assert.ok(result.tsInterface.includes('isEnabled: boolean;'))
  assert.ok(result.tsInterface.includes('tags: string[];'))

  assert.ok(result.zodSchema.includes('workspaceId: z.string(),'))
  assert.ok(result.zodSchema.includes('taskCount: z.number(),'))
  assert.ok(result.zodSchema.includes('isEnabled: z.boolean(),'))
  assert.ok(result.zodSchema.includes('tags: z.array(z.string()),'))
})
