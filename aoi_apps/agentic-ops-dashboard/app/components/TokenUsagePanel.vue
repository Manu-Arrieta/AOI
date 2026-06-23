<script setup lang="ts">
import { computed } from 'vue'

import type { TokenUsageSummary } from '~/shared/token-observability'

import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  summary: TokenUsageSummary | null
  loading: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{
  toggle: [enabled: boolean]
}>()

const { locale, messages } = useLocale()

const totalCards = computed(() => {
  const totals = props.summary?.totals

  return [
    { label: messages.value.tokenMetrics.requests, value: totals?.requestCount ?? 0 },
    { label: messages.value.tokenMetrics.inputTokens, value: totals?.inputTokens ?? 0 },
    { label: messages.value.tokenMetrics.outputTokens, value: totals?.outputTokens ?? 0 },
    { label: messages.value.tokenMetrics.cachedTokens, value: totals?.cachedTokens ?? 0 },
  ]
})

const topAgents = computed(() => props.summary?.byAgent.slice(0, 5) ?? [])
const topPrompts = computed(() => props.summary?.byPrompt.slice(0, 5) ?? [])
const topTools = computed(() => props.summary?.byTool.slice(0, 5) ?? [])
const recentRequests = computed(() => props.summary?.recentRequests.slice(0, 6) ?? [])

const statusLabel = computed(() => {
  switch (props.summary?.status) {
    case 'ready':
      return messages.value.tokenMetrics.statusReady
    case 'missing-source':
      return messages.value.tokenMetrics.statusMissing
    default:
      return messages.value.tokenMetrics.statusDisabled
  }
})

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
  if (!request.tools.length) {
    return messages.value.tokenMetrics.noToolAttribution
  }

  return request.tools.map((tool) => `${tool.toolName} (${tool.callCount})`).join(', ')
}
</script>

<template>
  <UCard
    class="surface-panel token-usage-panel"
    variant="subtle"
    :ui="{ header: 'p-0 sm:p-0', body: 'px-0 pt-4 pb-0 sm:px-0 sm:pt-4 sm:pb-0' }"
  >
    <template #header>
      <header class="panel-header">
        <div>
          <p class="eyebrow">{{ messages.tokenMetrics.eyebrow }}</p>
          <h2>{{ messages.tokenMetrics.title }}</h2>
        </div>

        <div class="token-usage-state">
          <UBadge color="neutral" variant="outline">{{ statusLabel }}</UBadge>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            :loading="props.loading"
            @click="emit('toggle', props.summary?.status === 'disabled')"
          >
            {{ props.summary?.status === 'disabled' ? messages.tokenMetrics.enable : messages.tokenMetrics.disable }}
          </UButton>
        </div>
      </header>

      <p class="token-usage-copy">{{ messages.tokenMetrics.copy }}</p>
      <p class="token-usage-toggle-note">{{ messages.tokenMetrics.sourceNote }}</p>
    </template>

    <UAlert
      v-if="props.errorMessage"
      class="error-banner"
      color="error"
      icon="i-lucide-triangle-alert"
      variant="subtle"
      :description="messages.tokenMetrics.loadError"
    />

    <div v-if="props.loading && !props.summary" class="token-usage-empty">
      <p class="panel-empty">{{ messages.common.refreshing }}</p>
    </div>

    <div v-else-if="props.summary?.status === 'disabled'" class="token-usage-empty">
      <p class="panel-empty">{{ messages.tokenMetrics.disabledTitle }}</p>
      <p class="token-usage-copy">{{ messages.tokenMetrics.disabledCopy }}</p>
      <div class="hero-button-row">
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

      <div class="metric-grid token-usage-summary-grid">
        <article v-for="card in totalCards" :key="card.label" class="metric-card">
          <span>{{ card.label }}</span>
          <strong>{{ formatNumber(card.value) }}</strong>
        </article>
      </div>

      <div class="token-usage-section-grid">
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
                <strong>{{ request.model }}</strong>
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
  </UCard>
</template>