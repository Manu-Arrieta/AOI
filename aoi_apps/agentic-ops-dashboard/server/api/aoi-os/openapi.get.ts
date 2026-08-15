import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return {
    openapi: '3.1.0',
    info: {
      title: 'AOI-OS C2 Command Deck API',
      version: '1.0.0',
      description: 'Auto-synthesized by AOI-OS Deterministic Engine (0 LLM Tokens)',
    },
    paths: {
      '/api/aoi-os/stream': {
        get: {
          summary: 'SSE Live Telemetry Stream',
          operationId: 'get_aoi_os_stream',
          tags: ['c2', 'telemetry'],
        },
      },
      '/api/aoi-os/control': {
        post: {
          summary: 'Execution DAG Playback Controller',
          operationId: 'post_aoi_os_control',
          tags: ['c2', 'playback'],
        },
      },
      '/api/aoi-os/c4': {
        get: {
          summary: 'Dynamic C4 Architecture Diagram',
          operationId: 'get_aoi_os_c4',
          tags: ['c2', 'architecture'],
        },
      },
    },
  }
})
