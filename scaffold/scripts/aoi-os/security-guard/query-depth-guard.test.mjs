import test from 'node:test'
import assert from 'node:assert/strict'
import { auditQueryDepthSafety } from './query-depth-guard.mjs'

test('auditQueryDepthSafety approves GraphQL server with depthLimit configured', () => {
  const code = `
const server = new ApolloServer({
  schema,
  validationRules: [depthLimit(6)],
});
`
  const result = auditQueryDepthSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.queryDepthProof, 'QUERY_DEPTH_RESTRICTION_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditQueryDepthSafety detects GraphQL server without query depth limit', () => {
  const code = `
const server = new ApolloServer({
  schema,
});
`
  const result = auditQueryDepthSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.queryDepthProof, 'UNBOUNDED_QUERY_DEPTH_DETECTED')
  assert.equal(result.violationsCount, 1)
})
