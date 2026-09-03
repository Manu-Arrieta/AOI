import { useState } from '#imports'

import type { TokenUsageSummary } from '~/shared/token-observability'

const loadErrorMessage = 'Could not load token metrics.'

export function useTokenObservability() {
  const summary = useState<TokenUsageSummary | null>('ops-dashboard-token-summary', () => null)
  const isLoading = useState('ops-dashboard-token-loading', () => false)
  const errorMessage = useState<string | null>('ops-dashboard-token-error', () => null)

  async function refreshTokenObservability() {
    isLoading.value = true

    try {
      summary.value = await $fetch<TokenUsageSummary>('/api/token-observability/summary')
      errorMessage.value = null
    } catch {
      errorMessage.value = loadErrorMessage
    } finally {
      isLoading.value = false
    }
  }

  async function initializeTokenObservability() {
    if (!summary.value) {
      await refreshTokenObservability()
    }
  }

  async function setTokenObservabilityEnabled(enabled: boolean) {
    isLoading.value = true

    try {
      await $fetch('/api/token-observability/config', {
        method: 'POST',
        body: { enabled },
      })

      summary.value = await $fetch<TokenUsageSummary>('/api/token-observability/summary')
      errorMessage.value = null
    } catch {
      errorMessage.value = loadErrorMessage
    } finally {
      isLoading.value = false
    }
  }

  return {
    summary,
    isLoading,
    errorMessage,
    initializeTokenObservability,
    refreshTokenObservability,
    setTokenObservabilityEnabled,
  }
}