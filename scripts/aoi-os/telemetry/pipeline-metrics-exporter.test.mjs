import test from 'node:test'
import assert from 'node:assert/strict'
import { createPipelineMetricsExporter } from './pipeline-metrics-exporter.mjs'

test('createPipelineMetricsExporter aggregates metrics and exports Prometheus text', () => {
  const exporter = createPipelineMetricsExporter({ serviceName: 'aoi-os-test' })

  exporter.recordWaveExecution({
    waveIndex: 0,
    nodeCount: 4,
    durationMs: 120,
    heapUsedBytes: 52428800,
    tokenBudgetUsed: 1500,
  })

  exporter.recordWaveExecution({
    waveIndex: 1,
    nodeCount: 2,
    durationMs: 80,
    heapUsedBytes: 62914560,
    tokenBudgetUsed: 800,
  })

  exporter.recordNodeLatency('T-1', 45)
  exporter.recordNodeLatency('T-2', 75)

  const metrics = exporter.getMetrics()
  assert.equal(metrics.waveExecutionCount, 2)
  assert.equal(metrics.totalNodesExecuted, 6)
  assert.equal(metrics.totalDurationMs, 200)
  assert.equal(metrics.peakHeapUsedBytes, 62914560)

  const promText = exporter.exportPrometheusText()
  assert.ok(promText.includes('aoi_waves_executed_total{service="aoi-os-test"} 2'))
  assert.ok(promText.includes('aoi_nodes_executed_total{service="aoi-os-test"} 6'))
  assert.ok(promText.includes('aoi_pipeline_duration_ms{service="aoi-os-test"} 200'))
  assert.ok(promText.includes('aoi_peak_heap_bytes{service="aoi-os-test"} 62914560'))

  const otelJson = exporter.exportOpenTelemetryJson()
  assert.equal(otelJson.resourceMetrics[0].resource.attributes[0].value.stringValue, 'aoi-os-test')
  assert.equal(otelJson.resourceMetrics[0].scopeMetrics[0].metrics[0].name, 'aoi.waves.executed')
})
