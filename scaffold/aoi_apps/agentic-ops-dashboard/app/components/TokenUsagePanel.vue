<script setup lang="ts">
import { computed } from 'vue'

import type { TokenUsageSummary } from '~/shared/token-observability'

import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  summary: TokenUsageSummary | null
  loading: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{ toggle: [enabled: boolean] }>()

const { locale, messages } = useLocale()

const cacheEfficiency = computed(() => {
  const totals = props.summary?.totals
  const input = totals?.inputTokens ?? 0
  const cached = totals?.cachedTokens ?? 0
  const totalInput = input + cached
  const hitRate = totalInput > 0 ? (cached / totalInput) * 100 : 0

  let healthColor: 'success' | 'warning' | 'error' = 'success'
  let healthLabel = messages.value.tokenMetrics.healthOptimal

  if (hitRate < 70) {
    healthColor = 'error'
    healthLabel = messages.value.tokenMetrics.healthBloat
  } else if (hitRate < 90) {
    healthColor = 'warning'
    healthLabel = messages.value.tokenMetrics.healthModerate
  }

  return {
    hitRate: hitRate.toFixed(1),
    healthColor,
    healthLabel,
  }
})

const totalCards = computed(() => {
  const totals = props.summary?.totals
  return [
    { label: messages.value.tokenMetrics.requests,        value: formatNumber(totals?.requestCount ?? 0), icon: 'i-lucide-activity' },
    { label: messages.value.tokenMetrics.inputTokens,     value: formatNumber(totals?.inputTokens  ?? 0), icon: 'i-lucide-arrow-down-to-line' },
    { label: messages.value.tokenMetrics.outputTokens,    value: formatNumber(totals?.outputTokens ?? 0), icon: 'i-lucide-arrow-up-from-line' },
    { label: messages.value.tokenMetrics.cachedTokens,    value: formatNumber(totals?.cachedTokens ?? 0), icon: 'i-lucide-database-zap' },
    {
      label: messages.value.tokenMetrics.cacheHitRate,
      value: `${cacheEfficiency.value.hitRate}%`,
      icon: 'i-lucide-gauge',
      badge: cacheEfficiency.value.healthLabel,
      badgeColor: cacheEfficiency.value.healthColor,
    },
  ]
})

const topAgents  = computed(() => props.summary?.byAgent.slice(0, 5)  ?? [])
const topModels  = computed(() => props.summary?.byModel.slice(0, 5)  ?? [])
const topPrompts = computed(() => props.summary?.byPrompt.slice(0, 5) ?? [])
const topTasks   = computed(() =>
  (props.summary?.byTask ?? [])
    .filter((r) => r.key !== 'unattributed')
    .slice(0, 8)
)
const topTools   = computed(() => props.summary?.byTool.slice(0, 5)   ?? [])
const recentRequests = computed(() => props.summary?.recentRequests.slice(0, 6) ?? [])

const maxTotal = computed(() => {
  const all = [...topAgents.value, ...topModels.value, ...topPrompts.value, ...topTools.value]
  return Math.max(1, ...all.map((r) => r.inputTokens + r.outputTokens))
})

function rowPct(row: { inputTokens: number; outputTokens: number }) {
  return Math.round(((row.inputTokens + row.outputTokens) / maxTotal.value) * 100)
}

const statusLabel = computed(() => {
  switch (props.summary?.status) {
    case 'ready':          return messages.value.tokenMetrics.statusReady
    case 'missing-source': return messages.value.tokenMetrics.statusMissing
    default:               return messages.value.tokenMetrics.statusDisabled
  }
})

const isEnabled = computed(() => props.summary?.status !== 'disabled')

function formatNumber(value: number) {
  return new Intl.NumberFormat(locale.value === 'es' ? 'es-AR' : 'en-US').format(value)
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(locale.value === 'es' ? 'es-AR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatToolList(request: TokenUsageSummary['recentRequests'][number]) {
  if (!request.tools.length) return messages.value.tokenMetrics.noToolAttribution
  return request.tools.map((t) => `${t.toolName} (${t.callCount})`).join(', ')
}

/** Returns a subtle color class depending on the model family */
function modelChipColor(model: string): 'warning' | 'success' | 'info' | 'primary' | 'neutral' {
  if (model.includes('claude'))  return 'warning'
  if (model.includes('gpt'))     return 'success'
  if (model.includes('gemini'))  return 'info'
  if (model.includes('deepseek') || model.includes('qwen') || model.includes('kimi')) return 'primary'
  return 'neutral'
}
</script>

<template>
  <UCard variant="outline" class="backdrop-blur-md">
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p class="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
            {{ messages.tokenMetrics.eyebrow }}
          </p>
          <h2 class="text-lg font-bold text-neutral-900 dark:text-white mt-1">
            {{ messages.tokenMetrics.title }}
          </h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {{ messages.tokenMetrics.copy }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <UBadge color="neutral" variant="outline" size="sm">
            {{ statusLabel }}
          </UBadge>
          <USwitch
            :model-value="isEnabled"
            :loading="props.loading"
            size="sm"
            @update:model-value="emit('toggle', $event)"
          />
        </div>
      </div>
      <p class="text-[11px] text-neutral-400 mt-2 font-mono">
        {{ messages.tokenMetrics.sourceNote }}
      </p>
    </template>

    <UAlert
      v-if="props.errorMessage"
      class="mb-4"
      color="error"
      icon="i-lucide-triangle-alert"
      variant="subtle"
      :description="messages.tokenMetrics.loadError"
    />

    <div v-if="props.loading && !props.summary" class="py-12 text-center text-neutral-400 font-mono text-xs">
      <UIcon name="i-lucide-loader-circle" class="animate-spin inline-block mr-2 w-4 h-4 text-primary" />
      {{ messages.common.refreshing }}
    </div>

    <div v-else-if="props.summary?.status === 'disabled'" class="py-16 text-center space-y-3">
      <UIcon name="i-lucide-eye-off" class="w-8 h-8 text-neutral-400 mx-auto" />
      <h3 class="font-bold text-neutral-900 dark:text-white text-base">
        {{ messages.tokenMetrics.disabledTitle }}
      </h3>
      <p class="text-xs text-neutral-500 max-w-md mx-auto">
        {{ messages.tokenMetrics.disabledCopy }}
      </p>
      <div class="pt-2">
        <UButton color="primary" variant="solid" icon="i-lucide-activity" @click="emit('toggle', true)">
          {{ messages.tokenMetrics.enable }}
        </UButton>
      </div>
    </div>

    <div v-else class="space-y-6">
      <UAlert
        v-if="props.summary?.status === 'missing-source'"
        color="warning"
        icon="i-lucide-info"
        variant="subtle"
        :description="messages.tokenMetrics.missingSource"
      />

      <!-- Summary KPI Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <UCard
          v-for="card in totalCards"
          :key="card.label"
          variant="subtle"
          :ui="{ body: 'p-3.5 space-y-1' }"
        >
          <span class="text-[11px] text-neutral-500 flex items-center gap-1.5 font-medium">
            <UIcon :name="card.icon" class="w-3.5 h-3.5 text-primary" />
            {{ card.label }}
          </span>
          <div class="flex items-baseline justify-between gap-2">
            <strong class="text-base sm:text-lg font-bold font-mono text-neutral-900 dark:text-white">
              {{ card.value }}
            </strong>
            <UBadge v-if="card.badge" :color="card.badgeColor" variant="subtle" size="xs">
              {{ card.badge }}
            </UBadge>
          </div>
        </UCard>
      </div>

      <!-- Breakdown Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Top Agents -->
        <UCard variant="subtle" :ui="{ body: 'space-y-3 p-4' }">
          <div class="border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <p class="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
              {{ messages.tokenMetrics.breakdown }}
            </p>
            <h3 class="font-bold text-sm text-neutral-900 dark:text-white">
              {{ messages.tokenMetrics.topAgents }}
            </h3>
          </div>
          <p v-if="!topAgents.length" class="text-xs text-neutral-400 italic py-2">{{ messages.tokenMetrics.noData }}</p>
          <div v-else class="space-y-2.5">
            <div v-for="row in topAgents" :key="row.key" class="space-y-1 text-xs">
              <div class="flex items-center justify-between">
                <strong class="text-neutral-800 dark:text-neutral-200">{{ row.label }}</strong>
                <span class="font-mono text-neutral-500">{{ formatNumber(row.inputTokens + row.outputTokens) }} t</span>
              </div>
              <UProgress color="primary" size="xs" :model-value="rowPct(row)" />
            </div>
          </div>
        </UCard>

        <!-- Top Models -->
        <UCard variant="subtle" :ui="{ body: 'space-y-3 p-4' }">
          <div class="border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <p class="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
              {{ messages.tokenMetrics.breakdown }}
            </p>
            <h3 class="font-bold text-sm text-neutral-900 dark:text-white">
              {{ messages.tokenMetrics.topModels }}
            </h3>
          </div>
          <p v-if="!topModels.length" class="text-xs text-neutral-400 italic py-2">{{ messages.tokenMetrics.noData }}</p>
          <div v-else class="space-y-2.5">
            <div v-for="row in topModels" :key="row.key" class="space-y-1 text-xs">
              <div class="flex items-center justify-between">
                <UBadge :color="modelChipColor(row.key)" variant="subtle" size="xs">
                  {{ row.label }}
                </UBadge>
                <span class="font-mono text-neutral-500">{{ formatNumber(row.inputTokens + row.outputTokens) }} t</span>
              </div>
              <UProgress color="primary" size="xs" :model-value="rowPct(row)" />
            </div>
          </div>
        </UCard>

        <!-- Top Prompts -->
        <UCard variant="subtle" :ui="{ body: 'space-y-3 p-4' }">
          <div class="border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <p class="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
              {{ messages.tokenMetrics.breakdown }}
            </p>
            <h3 class="font-bold text-sm text-neutral-900 dark:text-white">
              {{ messages.tokenMetrics.topPrompts }}
            </h3>
          </div>
          <p v-if="!topPrompts.length" class="text-xs text-neutral-400 italic py-2">{{ messages.tokenMetrics.noData }}</p>
          <div v-else class="space-y-2.5">
            <div v-for="row in topPrompts" :key="row.key" class="space-y-1 text-xs">
              <div class="flex items-center justify-between">
                <span class="text-neutral-800 dark:text-neutral-200 truncate max-w-[160px]">{{ row.label }}</span>
                <span class="font-mono text-neutral-500">{{ formatNumber(row.inputTokens + row.outputTokens) }} t</span>
              </div>
              <UProgress color="primary" size="xs" :model-value="rowPct(row)" />
            </div>
          </div>
        </UCard>

        <!-- Top Tasks -->
        <UCard variant="subtle" :ui="{ body: 'space-y-3 p-4' }">
          <div class="border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <p class="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
              {{ messages.tokenMetrics.taskBreakdown }}
            </p>
            <h3 class="font-bold text-sm text-neutral-900 dark:text-white">
              {{ messages.tokenMetrics.topTask }}
            </h3>
          </div>
          <p v-if="!topTasks.length" class="text-xs text-neutral-400 italic py-2">{{ messages.tokenMetrics.noData }}</p>
          <div v-else class="space-y-2.5">
            <div v-for="row in topTasks" :key="row.key" class="space-y-1 text-xs">
              <div class="flex items-center justify-between">
                <UBadge color="neutral" variant="outline" size="xs" class="font-mono">
                  {{ row.label }}
                </UBadge>
                <span class="font-mono text-neutral-500">{{ formatNumber(row.inputTokens + row.outputTokens) }} t</span>
              </div>
              <UProgress color="primary" size="xs" :model-value="rowPct(row)" />
            </div>
          </div>
        </UCard>

        <!-- Top Tools -->
        <UCard variant="subtle" :ui="{ body: 'space-y-3 p-4' }">
          <div class="border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <p class="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
              {{ messages.tokenMetrics.estimated }}
            </p>
            <h3 class="font-bold text-sm text-neutral-900 dark:text-white">
              {{ messages.tokenMetrics.topTools }}
            </h3>
          </div>
          <p v-if="!topTools.length" class="text-xs text-neutral-400 italic py-2">{{ messages.tokenMetrics.noData }}</p>
          <div v-else class="space-y-2.5">
            <div v-for="row in topTools" :key="row.key" class="space-y-1 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-mono text-neutral-800 dark:text-neutral-200 truncate max-w-[160px]">{{ row.label }}</span>
                <span class="font-mono text-neutral-500">{{ formatNumber(row.inputTokens + row.outputTokens) }} t</span>
              </div>
              <UProgress color="primary" size="xs" :model-value="rowPct(row)" />
            </div>
          </div>
        </UCard>
      </div>

      <!-- Recent Requests List -->
      <UCard variant="outline" :ui="{ body: 'space-y-3 p-4' }">
        <div class="border-b border-neutral-200 dark:border-neutral-800 pb-2">
          <p class="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
            {{ messages.tokenMetrics.activity }}
          </p>
          <h3 class="font-bold text-sm text-neutral-900 dark:text-white">
            {{ messages.tokenMetrics.recentRequests }}
          </h3>
        </div>

        <p v-if="!recentRequests.length" class="text-xs text-neutral-400 italic py-2">{{ messages.tokenMetrics.noData }}</p>
        <div v-else class="space-y-3">
          <UCard
            v-for="request in recentRequests"
            :key="request.requestId"
            variant="subtle"
            :ui="{ body: 'p-3 space-y-2' }"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div class="flex items-center gap-2">
                <UBadge :color="modelChipColor(request.model)" variant="subtle" size="xs">
                  {{ request.model }}
                </UBadge>
                <span class="text-neutral-400 font-mono text-[11px]">{{ formatTimestamp(request.timestamp) }}</span>
              </div>
              <UBadge color="neutral" variant="outline" size="xs" class="font-mono">
                {{ formatNumber(request.inputTokens + request.outputTokens) }} tokens
              </UBadge>
            </div>

            <div class="text-[11px] text-neutral-600 dark:text-neutral-400 space-y-0.5 font-mono">
              <p><span class="opacity-70">{{ messages.tokenMetrics.requestPrompt }}:</span> {{ request.promptName ?? messages.tokenMetrics.directChat }}</p>
              <p><span class="opacity-70">{{ messages.tokenMetrics.requestAgent }}:</span> {{ request.agentName ?? messages.tokenMetrics.unattributed }}</p>
              <p><span class="opacity-70">{{ messages.tokenMetrics.requestTools }}:</span> {{ formatToolList(request) }}</p>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60 text-[11px] font-mono">
              <div>
                <span class="text-neutral-400 block">{{ messages.tokenMetrics.inputTokens }}</span>
                <strong class="text-neutral-800 dark:text-neutral-200">{{ formatNumber(request.inputTokens) }}</strong>
              </div>
              <div>
                <span class="text-neutral-400 block">{{ messages.tokenMetrics.outputTokens }}</span>
                <strong class="text-neutral-800 dark:text-neutral-200">{{ formatNumber(request.outputTokens) }}</strong>
              </div>
              <div>
                <span class="text-neutral-400 block">{{ messages.tokenMetrics.cachedTokens }}</span>
                <strong class="text-neutral-800 dark:text-neutral-200">{{ formatNumber(request.cachedTokens) }}</strong>
              </div>
            </div>
          </UCard>
        </div>
      </UCard>
    </div>
  </UCard>
</template>