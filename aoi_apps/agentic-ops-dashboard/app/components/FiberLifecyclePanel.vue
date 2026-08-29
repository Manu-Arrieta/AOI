<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface FiberData {
  uid: string
  name: string
  state: 'INACTIVE' | 'RELOADING' | 'ACTIVE' | 'UNLOADING' | 'FAILED'
  parentUid: string
  inject: string[]
  provides: string[]
  activeEffects: number
}

interface FiberResponse {
  metrics: {
    totalFibers: number
    activeFibers: number
    providedKeys: string[]
  }
  fibers: FiberData[]
}

const loading = ref(true)
const data = ref<FiberResponse | null>(null)

async function fetchFibers() {
  loading.value = true
  try {
    const res = await $fetch<FiberResponse>('/api/fibers')
    data.value = res
  } catch (err) {
    console.error('Failed to fetch fibers:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchFibers()
})

function getStateBadgeColor(state: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (state) {
    case 'ACTIVE': return 'success'
    case 'RELOADING':
    case 'UNLOADING': return 'warning'
    case 'FAILED': return 'error'
    default: return 'neutral'
  }
}
</script>

<template>
  <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
    <div class="flex items-center justify-between border-b border-slate-800 pb-4">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
          <UIcon name="i-lucide-layers" class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-100">Spatiotemporal Fiber Runtime</h3>
          <p class="text-xs text-slate-400">DeepSeek Dynamic Composability & Reversible Lifecycles</p>
        </div>
      </div>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        @click="fetchFibers"
      >
        Refresh
      </UButton>
    </div>

    <div v-if="data" class="mt-4 grid grid-cols-3 gap-3">
      <div class="rounded-lg bg-slate-950/40 p-3 border border-slate-800/60">
        <div class="text-xs text-slate-400">Active Fibers</div>
        <div class="text-xl font-bold text-emerald-400">{{ data.metrics.activeFibers }} / {{ data.metrics.totalFibers }}</div>
      </div>
      <div class="rounded-lg bg-slate-950/40 p-3 border border-slate-800/60">
        <div class="text-xs text-slate-400">Provided Coeffects</div>
        <div class="text-xl font-bold text-indigo-400">{{ data.metrics.providedKeys.length }}</div>
      </div>
      <div class="rounded-lg bg-slate-950/40 p-3 border border-slate-800/60">
        <div class="text-xs text-slate-400">Zero-Restart Uptime</div>
        <div class="text-xl font-bold text-cyan-400">100%</div>
      </div>
    </div>

    <div class="mt-4 space-y-2">
      <div
        v-for="fiber in data?.fibers ?? []"
        :key="fiber.uid"
        class="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/30 px-3 py-2 text-sm"
      >
        <div class="flex items-center gap-2">
          <UBadge size="xs" :color="getStateBadgeColor(fiber.state)" variant="subtle">
            {{ fiber.state }}
          </UBadge>
          <span class="font-mono text-xs text-slate-200">{{ fiber.name }}</span>
          <span v-if="fiber.inject.length" class="text-xs text-slate-500">
            (injects: {{ fiber.inject.join(', ') }})
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="fiber.provides.length" class="rounded bg-indigo-950/40 px-1.5 py-0.5 font-mono text-[10px] text-indigo-300">
            + {{ fiber.provides.join(', ') }}
          </span>
          <span class="text-xs text-slate-400">
            {{ fiber.activeEffects }} effects
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
