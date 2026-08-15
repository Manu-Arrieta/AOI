/**
 * scripts/aoi-os/benchmark/micro-benchmark-suite.mjs
 *
 * Deterministic Zero-Overhead Micro-Benchmark Suite for AOI-OS:
 * Executes high-resolution local performance benchmarks (ops/sec, latency budgets)
 * on generated functions to detect regressions before consensus approval.
 */

import { performance } from 'node:perf_hooks'

/**
 * Runs a deterministic micro-benchmark on a target function.
 *
 * @param {string} functionName
 * @param {Function} fn - Function to benchmark
 * @param {object} [options]
 * @param {number} [options.iterations=1000]
 * @param {number} [options.baselineOpsPerSec]
 * @param {number} [options.maxAllowedRegressionPct=15]
 * @returns {object} Micro-benchmark results and regression audit
 */
export function runMicroBenchmark(functionName, fn, options = {}) {
  const {
    iterations = 1000,
    baselineOpsPerSec = null,
    maxAllowedRegressionPct = 15,
  } = options

  if (typeof fn !== 'function') {
    throw new Error(`Micro-benchmark target for [${functionName}] must be a function.`)
  }

  // Warmup run
  for (let i = 0; i < Math.min(50, iterations); i++) {
    fn()
  }

  const startTime = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const endTime = performance.now()

  const totalDurationMs = Math.max(0.001, endTime - startTime)
  const opsPerSec = Math.round((iterations / totalDurationMs) * 1000)
  const avgLatencyUs = Math.round((totalDurationMs / iterations) * 1000 * 100) / 100

  let regressionDetected = false
  let performanceDeltaPct = 0

  if (baselineOpsPerSec && baselineOpsPerSec > 0) {
    performanceDeltaPct = Math.round(((opsPerSec - baselineOpsPerSec) / baselineOpsPerSec) * 100)
    if (performanceDeltaPct < -maxAllowedRegressionPct) {
      regressionDetected = true
    }
  }

  return {
    functionName,
    iterations,
    totalDurationMs: Math.round(totalDurationMs * 100) / 100,
    opsPerSec,
    avgLatencyUs,
    baselineOpsPerSec,
    performanceDeltaPct,
    regressionDetected,
    passed: !regressionDetected,
  }
}
