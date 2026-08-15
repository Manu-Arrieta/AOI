import test from 'node:test'
import assert from 'node:assert/strict'
import { runMicroBenchmark } from './micro-benchmark-suite.mjs'

test('runMicroBenchmark measures throughput and latency accurately', () => {
  const pureMath = () => {
    let sum = 0
    for (let i = 0; i < 10; i++) sum += i
    return sum
  }

  const report = runMicroBenchmark('pureMath', pureMath, { iterations: 1000 })
  assert.equal(report.functionName, 'pureMath')
  assert.equal(report.iterations, 1000)
  assert.ok(report.opsPerSec > 0)
  assert.equal(report.passed, true)
  assert.equal(report.regressionDetected, false)
})

test('runMicroBenchmark detects significant regressions compared to baseline', () => {
  const slowFn = () => {
    const arr = new Array(100).fill(1)
    return arr.reduce((a, b) => a + b, 0)
  }

  // Set an impossibly high baseline to trigger regression detection
  const report = runMicroBenchmark('slowFn', slowFn, {
    iterations: 100,
    baselineOpsPerSec: 1000000000,
    maxAllowedRegressionPct: 10,
  })

  assert.equal(report.regressionDetected, true)
  assert.equal(report.passed, false)
})
