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

const totalCards = computed(() => {
  const totals = props.summary?.totals
  return [
    { label: messages.value.tokenMetrics.requests,     value: totals?.requestCount ?? 0, icon: 'i-lucide-activity' },
    { label: messages.value.tokenMetrics.inputTokens,  value: totals?.inputTokens  ?? 0, icon: 'i-lucide-arrow-down-to-line' },
    { label: messages.value.tokenMetrics.outputTokens, value: totals?.outputTokens ?? 0, icon: 'i-lucide-arrow-up-from-line' },
    { label: messages.value.tokenMetrics.cachedTokens, value: totals?.cachedTokens ?? 0, icon: 'i-lucide-database-zap' },
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
function modelChipColor(model: string) {
  if (model.includes('claude'))  return 'warning'
  if (model.includes('gpt'))     return 'success'
  if (model.includes('gemini'))  return 'info'
  if (model.includes('deepseek') || model.includes('qwen') || model.includes('kimi')) return 'secondary'
  return 'neutral'
}
</script>

<template>
  <div class="surface-panel token-usage-panel">
    <header class="panel-header">
      <div>
        <p class="eyebrow">{{ messages.tokenMetrics.eyebrow }}</p>
        <h2>{{ messages.tokenMetrics.title }}</h2>
      </div>
      <div class="token-usage-state">
        <UBadge color="neutral" variant="outline">{{ statusLabel }}</UBadge>
        <USwitch
          :model-value="isEnabled"
          :loading="props.loading"
          size="sm"
          @update:model-value="emit('toggle', $event)"
        />
      </div>
    </header>

    <p class="token-usage-copy">{{ messages.tokenMetrics.copy }}</p>
    <p class="token-usage-toggle-note">{{ messages.tokenMetrics.sourceNote }}</p>

    <UAlert
      v-if="props.errorMessage"
      class="error-banner"
      color="error"
      icon="i-lucide-triangle-alert"
      variant="subtle"
      :description="messages.tokenMetrics.loadError"
    />

    <div v-if="props.loading && !props.summary" class="token-usage-empty">
      <p>{{ messages.common.refreshing }}</p>
    </div>

    <div v-else-if="props.summary?.status === 'disabled'" class="token-usage-empty">
      <UIcon name="i-lucide-eye-off" class="token-usage-empty-icon" />
      <p>{{ messages.tokenMetrics.disabledTitle }}</p>
      <p class="token-usage-toggle-note">{{ messages.tokenMetrics.disabledCopy }}</p>
      <div class="hero-button-row" style="justify-content: center;">
        <UButton color="neutral" variant="solid" icon="i-lucide-activity" @click="emit('toggle', true)">
          {{ messages.tokenMetrics.enable }}
        </UButton>
      </div>
    </div>

    <div v-else class="token-usage-shell">
      <UAlert
        v-if="props.summary?.status === 'missing-source'"
        color="warning"
        icon="i-lucide-info"
        variant="subtle"
        :description="messages.tokenMetrics.missingSource"
      />

      <!-- Summary cards -->
      <div class="metric-grid token-usage-summary-grid">
        <article v-for="card in totalCards" :key="card.label" class="metric-card">
          <span>
            <UIcon :name="card.icon" style="vertical-align: middle; margin-right: 0.3em;" />
            {{ card.label }}
          </span>
          <strong>{{ formatNumber(card.value) }}</strong>
        </article>
      </div>

      <!-- Breakdown sections -->
      <div class="token-usage-section-grid">
        <!-- Top Agents -->
        <section class="token-usage-section">
          <header>
            <div>
              <p class="eyebrow">{{ messages.tokenMetrics.breakdown }}</p>
              <h3>{{ messages.tokenMetrics.topAgents }}</h3>
            </div>
          </header>
          <p v-if="!topAgents.length" class="panel-empty-tight">{{ messages.tokenMetrics.noData }}</p>
          <div v-else>
            <div v-for="row in topAgents" :key="row.key" class="token-usage-row">
              <div class="token-usage-row-label">
                <strong>{{ row.label }}</strong>
                <small>{{ formatNumber(row.requestCount) }} {{ messages.tokenMetrics.requests }}</small>
              </div>
              <div class="token-usage-row-value">
                <strong>{{ formatNumber(row.inputTokens + row.outputTokens) }}</strong>
                <small>{{ messages.tokenMetrics.tokens }}</small>
              </div>
            </div>
          </div>
        </section>

        <!-- Top Models -->
        <section class="token-usage-section">
          <header>
            <div>
              <p class="eyebrow">{{ messages.tokenMetrics.breakdown }}</p>
              <h3>{{ messages.tokenMetrics.topModels }}</h3>
            </div>
          </header>
          <p v-if="!topModels.length" class="panel-empty-tight">{{ messages.tokenMetrics.noData }}</p>
          <div v-else>
            <div v-for="row in topModels" :key="row.key" class="token-usage-row">
              <div class="token-usage-row-label">
                <UBadge :color="modelChipColor(row.key)" variant="subtle" size="sm">
                  {{ row.label }}
                </UBadge>
                <small>{{ formatNumber(row.requestCount) }} {{ messages.tokenMetrics.requests }}</small>
              </div>
              <div class="token-usage-row-value">
                <strong>{{ formatNumber(row.inputTokens + row.outputTokens) }}</strong>
                <small>{{ messages.tokenMetrics.tokens }}</small>
              </div>
            </div>
          </div>
        </section>

        <!-- Top Prompts -->
        <section class="token-usage-section">
          <header>
            <div>
              <p class="eyebrow">{{ messages.tokenMetrics.breakdown }}</p>
              <h3>{{ messages.tokenMetrics.topPrompts }}</h3>
            </div>
          </header>
          <p v-if="!topPrompts.length" class="panel-empty-tight">{{ messages.tokenMetrics.noData }}</p>
          <div v-else>
            <div v-for="row in topPrompts" :key="row.key" class="token-usage-row">
              <div class="token-usage-row-label">
                <strong>{{ row.label }}</strong>
                <small>{{ formatNumber(row.requestCount) }} {{ messages.tokenMetrics.requests }}</small>
              </div>
              <div class="token-usage-row-value">
                <strong>{{ formatNumber(row.inputTokens + row.outputTokens) }}</strong>
                <small>{{ messages.tokenMetrics.tokens }}</small>
              </div>
            </div>
          </div>
        </section>

        <!-- Top Tasks -->
        <section class="token-usage-section">
          <header>
            <div>
              <p class="eyebrow">{{ messages.tokenMetrics.taskBreakdown }}</p>
              <h3>{{ messages.tokenMetrics.topTask }}</h3>
            </div>
          </header>
          <p v-if="!topTasks.length" class="panel-empty-tight">{{ messages.tokenMetrics.noData }}</p>
          <div v-else>
            <div v-for="row in topTasks" :key="row.key" class="token-usage-row">
              <div class="token-usage-row-label">
                <UBadge color="neutral" variant="outline" size="sm" class="task-id-badge">
                  {{ row.label }}
                </UBadge>
                <small>{{ formatNumber(row.requestCount) }} {{ messages.tokenMetrics.requests }}</small>
              </div>
              <div class="token-usage-row-value">
                <strong>{{ formatNumber(row.inputTokens + row.outputTokens) }}</strong>
                <small>{{ messages.tokenMetrics.tokens }}</small>
              </div>
            </div>
          </div>
        </section>

        <!-- Top Tools (estimated) -->
        <section class="token-usage-section">
          <header>
            <div>
              <p class="eyebrow">{{ messages.tokenMetrics.estimated }}</p>
              <h3>{{ messages.tokenMetrics.topTools }}</h3>
            </div>
          </header>
          <p v-if="!topTools.length" class="panel-empty-tight">{{ messages.tokenMetrics.noData }}</p>
          <div v-else>
            <div v-for="row in topTools" :key="row.key" class="token-usage-row">
              <div class="token-usage-row-label">
                <strong>{{ row.label }}</strong>
                <small>{{ formatNumber(row.callCount) }} {{ messages.tokenMetrics.calls }}</small>
              </div>
              <div class="token-usage-row-value">
                <strong>{{ formatNumber(row.inputTokens + row.outputTokens) }}</strong>
                <small>{{ messages.tokenMetrics.tokens }}</small>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Recent requests -->
      <section class="token-usage-section token-usage-section-wide">
        <header>
          <div>
            <p class="eyebrow">{{ messages.tokenMetrics.activity }}</p>
            <h3>{{ messages.tokenMetrics.recentRequests }}</h3>
          </div>
        </header>

        <p v-if="!recentRequests.length" class="panel-empty-tight">{{ messages.tokenMetrics.noData }}</p>
        <div v-else class="token-usage-request-list">
          <article v-for="request in recentRequests" :key="request.requestId" class="token-usage-request">
            <div class="token-usage-request-top">
              <div>
                <strong>
                  <UBadge :color="modelChipColor(request.model)" variant="subtle" size="sm">
                    {{ request.model }}
                  </UBadge>
                </strong>
                <p>{{ formatTimestamp(request.timestamp) }}</p>
              </div>
              <UBadge color="neutral" variant="outline">
                {{ formatNumber(request.inputTokens + request.outputTokens) }} {{ messages.tokenMetrics.tokens }}
              </UBadge>
            </div>

            <div class="token-usage-request-copy">
              <p>{{ messages.tokenMetrics.requestPrompt }} · {{ request.promptName ?? messages.tokenMetrics.directChat }}</p>
              <p>{{ messages.tokenMetrics.requestAgent }} · {{ request.agentName ?? messages.tokenMetrics.unattributed }}</p>
              <p>{{ messages.tokenMetrics.requestTools }} · {{ formatToolList(request) }}</p>
            </div>

            <div class="token-usage-request-metrics">
              <article>
                <span>{{ messages.tokenMetrics.inputTokens }}</span>
                <strong>{{ formatNumber(request.inputTokens) }}</strong>
              </article>
              <article>
                <span>{{ messages.tokenMetrics.outputTokens }}</span>
                <strong>{{ formatNumber(request.outputTokens) }}</strong>
              </article>
              <article>
                <span>{{ messages.tokenMetrics.cachedTokens }}</span>
                <strong>{{ formatNumber(request.cachedTokens) }}</strong>
              </article>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>