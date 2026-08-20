/**
 * scripts/aoi-os/telemetry/pipeline-metrics-exporter.mjs
 *
 * Deterministic Pipeline Metrics and Prometheus / OpenTelemetry Exporter for AOI-OS:
 * Collects runtime telemetry across DAG waves, node execution latencies, token consumption,
 * and memory metrics, exporting standard Prometheus text format and OpenTelemetry-compatible metrics (0 LLM Tokens).
 */

/**
 * Creates a pipeline telemetry and metrics exporter instance.
 *
 * @param {object} options
 * @returns {object} Metrics collector and exporter
 */
export function createPipelineMetricsExporter(options = {}) {
  const serviceName = options.serviceName || 'aoi-os'
  const metrics = {
    waveExecutionCount: 0,
    totalNodesExecuted: 0,
    totalDurationMs: 0,
    peakHeapUsedBytes: 0,
    tokenTokensAllocated: 0,
    nodeLatencies: new Map(),
  }

  /**
   * Records execution of a single DAG wave.
   *
   * @param {object} waveInfo - { waveIndex, nodeCount, durationMs, heapUsedBytes, tokenBudgetUsed }
   */
  function recordWaveExecution(waveInfo = {}) {
    metrics.waveExecutionCount++
    metrics.totalNodesExecuted += Number(waveInfo.nodeCount || 0)
    metrics.totalDurationMs += Number(waveInfo.durationMs || 0)
    if (waveInfo.heapUsedBytes && waveInfo.heapUsedBytes > metrics.peakHeapUsedBytes) {
      metrics.peakHeapUsedBytes = waveInfo.heapUsedBytes
    }
    if (waveInfo.tokenBudgetUsed) {
      metrics.tokenTokensAllocated += Number(waveInfo.tokenBudgetUsed)
    }
  }

  /**
   * Records latency of an individual task node.
   *
   * @param {string} nodeId
   * @param {number} latencyMs
   */
  function recordNodeLatency(nodeId, latencyMs) {
    metrics.nodeLatencies.set(nodeId, Number(latencyMs))
  }

  /**
   * Exports metrics in standard Prometheus exposition text format.
   *
   * @returns {string} Prometheus formatted metrics string
   */
  function exportPrometheusText() {
    return [
      `# HELP aoi_waves_executed_total Total number of DAG execution waves processed.`,
      `# TYPE aoi_waves_executed_total counter`,
      `aoi_waves_executed_total{service="${serviceName}"} ${metrics.waveExecutionCount}`,
      ``,
      `# HELP aoi_nodes_executed_total Total number of task nodes executed across waves.`,
      `# TYPE aoi_nodes_executed_total counter`,
      `aoi_nodes_executed_total{service="${serviceName}"} ${metrics.totalNodesExecuted}`,
      ``,
      `# HELP aoi_pipeline_duration_ms Total pipeline execution duration in milliseconds.`,
      `# TYPE aoi_pipeline_duration_ms counter`,
      `aoi_pipeline_duration_ms{service="${serviceName}"} ${metrics.totalDurationMs}`,
      ``,
      `# HELP aoi_peak_heap_bytes Peak heap memory allocated during execution.`,
      `# TYPE aoi_peak_heap_bytes gauge`,
      `aoi_peak_heap_bytes{service="${serviceName}"} ${metrics.peakHeapUsedBytes}`,
      ``,
    ].join('\n')
  }

  /**
   * Exports metrics in OpenTelemetry JSON payload format.
   *
   * @returns {object} OpenTelemetry metric structure
   */
  function exportOpenTelemetryJson() {
    return {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: serviceName } },
            ],
          },
          scopeMetrics: [
            {
              scope: { name: 'aoi.telemetry.metrics', version: '1.0.0' },
              metrics: [
                {
                  name: 'aoi.waves.executed',
                  description: 'Total number of DAG execution waves processed',
                  data: {
                    dataPoints: [
                      {
                        value: metrics.waveExecutionCount,
                        timeUnixNano: String(Date.now() * 1000000),
                      },
                    ],
                  },
                },
                {
                  name: 'aoi.nodes.executed',
                  description: 'Total number of task nodes executed',
                  data: {
                    dataPoints: [
                      {
                        value: metrics.totalNodesExecuted,
                        timeUnixNano: String(Date.now() * 1000000),
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    }
  }

  return {
    recordWaveExecution,
    recordNodeLatency,
    exportPrometheusText,
    exportOpenTelemetryJson,
    getMetrics: () => ({ ...metrics }),
  }
}
