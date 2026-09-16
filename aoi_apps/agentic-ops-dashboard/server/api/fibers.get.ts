import { defineEventHandler } from 'h3'
import { createCoeffectRegistry } from '../../../../scripts/spatiotemporal-runtime/coeffect-resolver.mjs'
import { createFiberRuntime } from '../../../../scripts/spatiotemporal-runtime/fiber-lifecycle.mjs'

let globalRegistry: any = null
let globalRuntime: any = null

const OBSERVABILITY = Object.freeze({
  source: 'synthetic-local-runtime',
  liveAgentExecution: false,
  filesystemTelemetry: false,
  rollbackTelemetry: false,
  note: 'Seeded local Fiber model; it does not observe agent execution, file writes, or rollback outcomes.',
})

function getRuntime() {
  if (!globalRuntime) {
    globalRegistry = createCoeffectRegistry()
    globalRuntime = createFiberRuntime(globalRegistry)
    
    // Seed a synthetic local model for UI observability; not agent telemetry.
    globalRuntime.instantiate({
      name: 'supervisor-fiber',
      inject: [],
      provide: ['orchestrator', 'sdd-lifecycle'],
      apply: (ctx: any) => {
        ctx.provide('orchestrator', { version: '2.0.0' })
      }
    })

    globalRuntime.instantiate({
      name: 'mcp-gateway-compressor',
      inject: ['orchestrator'],
      provide: ['mcp-compressor', 'tier1-signatures'],
      apply: (ctx: any) => {
        ctx.provide('tier1-signatures', { activeTools: 5 })
      }
    })
  }
  return { registry: globalRegistry, runtime: globalRuntime }
}

export default defineEventHandler(() => {
  const { runtime, registry } = getRuntime()
  const fibers = runtime.getAllFibers()

  return {
    success: true,
    timestamp: new Date().toISOString(),
    observability: OBSERVABILITY,
    metrics: {
      totalFibers: fibers.length,
      activeFibers: runtime.getActiveFibers().length,
      providedKeys: registry.getProvidedKeys(),
    },
    fibers: fibers.map((f: any) => ({
      uid: f.uid,
      name: f.name,
      state: f.state,
      parentUid: f.parentUid,
      inject: f.inject,
      provides: f.provides,
      activeEffects: f.accumulator.activeEffectCount,
      metadata: f.metadata,
    })),
  }
})
