import test from 'node:test'
import assert from 'node:assert/strict'
import { skeletonizeCode, foldBlockBodies } from './ast-skeletonizer.mjs'

test('skeletonizeCode preserves interfaces and type definitions', () => {
  const ts = `
export interface FiberHealthResult {
  healthScore: number
  status: 'stable' | 'degraded' | 'critical'
}

export type Status = 'active' | 'inactive'
`
  const skel = skeletonizeCode(ts)
  assert.match(skel, /export interface FiberHealthResult/)
  assert.match(skel, /healthScore: number/)
  assert.match(skel, /export type Status/)
})

test('skeletonizeCode folds function implementation bodies', () => {
  const code = `
export function evaluateFiberHealth(active, failed) {
  const total = active + failed
  if (total === 0) return { healthScore: 100, status: 'stable' }
  const ratio = active / total
  const healthScore = Math.round(ratio * 100)
  let status = 'stable'
  if (healthScore < 70) status = 'critical'
  return { healthScore, status }
}
`
  const skel = skeletonizeCode(code)
  assert.match(skel, /export function evaluateFiberHealth\(active, failed\)/)
  assert.match(skel, /\{ \/\* folded: \d+ lines \*\/ \}/)
  assert.doesNotMatch(skel, /const ratio = active \/ total/)
})

test('skeletonizeCode preserves comments and strings with braces without false folding', () => {
  const code = `
// Comment with { open brace
const template = "This is a {string} with braces"
export function test() {
  console.log("line 1")
  console.log("line 2")
  console.log("line 3")
  console.log("line 4")
}
`
  const skel = skeletonizeCode(code)
  assert.match(skel, /Comment with \{ open brace/)
  assert.match(skel, /"This is a \{string\} with braces"/)
  assert.match(skel, /\{ \/\* folded: \d+ lines \*\/ \}/)
})
