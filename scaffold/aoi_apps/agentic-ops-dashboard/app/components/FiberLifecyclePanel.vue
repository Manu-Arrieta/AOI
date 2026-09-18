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
  observability: {
    source: 'synthetic-local-runtime'
    liveAgentExecution: false
    filesystemTelemetry: false
    rollbackTelemetry: false
    note: string
  }
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
  <UCard variant="outline" class="backdrop-blur-md">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon name="i-lucide-layers" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="font-semibold text-neutral-900 dark:text-white">Spatiotemporal Fiber Runtime</h3>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">Synthetic local model — not live agent execution</p>
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
    </template>

    <div v-if="loading && !data" class="space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <USkeleton class="h-20 w-full rounded-xl" />
        <USkeleton class="h-20 w-full rounded-xl" />
        <USkeleton class="h-20 w-full rounded-xl" />
      </div>
      <USkeleton class="h-12 w-full rounded-lg" />
      <USkeleton class="h-12 w-full rounded-lg" />
    </div>

    <template v-else-if="data">
      <!-- Telemetry Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <UCard variant="subtle" :ui="{ body: 'p-3 sm:p-4' }">
          <div class="text-xs text-neutral-500 dark:text-neutral-400">Active Fibers</div>
          <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {{ data.metrics.activeFibers }} / {{ data.metrics.totalFibers }}
          </div>
        </UCard>

        <UCard variant="subtle" :ui="{ body: 'p-3 sm:p-4' }">
          <div class="text-xs text-neutral-500 dark:text-neutral-400">Provided Coeffects</div>
          <div class="text-xl font-bold text-primary mt-1">
            {{ data.metrics.providedKeys.length }}
          </div>
        </UCard>

        <UCard variant="subtle" :ui="{ body: 'p-3 sm:p-4' }">
          <div class="text-xs text-neutral-500 dark:text-neutral-400">Observability source</div>
          <div class="text-sm font-semibold text-cyan-600 dark:text-cyan-400 mt-1">
            Synthetic local
          </div>
        </UCard>
      </div>

      <p class="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {{ data.observability.note }}
      </p>

      <!-- Fiber State Items -->
      <div class="mt-4 space-y-2">
        <div
          v-for="fiber in data.fibers"
          :key="fiber.uid"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 px-3 py-2.5 text-sm"
        >
          <div class="flex items-center gap-2">
            <UBadge size="xs" :color="getStateBadgeColor(fiber.state)" variant="subtle">
              {{ fiber.state }}
            </UBadge>
            <span class="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200">{{ fiber.name }}</span>
            <span v-if="fiber.inject.length" class="text-xs text-neutral-500">
              (injects: {{ fiber.inject.join(', ') }})
            </span>
          </div>

          <div class="flex items-center gap-2">
            <UBadge
              v-if="fiber.provides.length"
              color="primary"
              variant="soft"
              size="xs"
              class="font-mono"
            >
              + {{ fiber.provides.join(', ') }}
            </UBadge>
            <span class="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
              {{ fiber.activeEffects }} effects
            </span>
          </div>
        </div>
      </div>
    </template>
  </UCard>
</template>
