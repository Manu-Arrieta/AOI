import test from 'node:test'
import assert from 'node:assert/strict'
import { auditPayloadDeserializationSafety } from './content-type-guard.mjs'

test('auditPayloadDeserializationSafety approves validated body parser', () => {
  const code = `
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, (b) => taskSchema.safeParse(b));
  return { success: true, body };
});
`
  const result = auditPayloadDeserializationSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.payloadProof, 'PAYLOAD_DESERIALIZATION_SAFE_AND_VALIDATED')
  assert.equal(result.violationsCount, 0)
})

test('auditPayloadDeserializationSafety detects unvalidated readBody without schema', () => {
  const code = `
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return { success: true, id: body.id };
});
`
  const result = auditPayloadDeserializationSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.payloadProof, 'UNGUARDED_PAYLOAD_PARSING_DETECTED')
  assert.equal(result.violationsCount, 1)
})
