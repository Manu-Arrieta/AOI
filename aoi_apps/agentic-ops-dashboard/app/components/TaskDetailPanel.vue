<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { TokenUsageAggregateRow } from '~/shared/token-observability'
import type { TaskRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'
import { translateDashboardStatus } from '../utils/locales'

const props = defineProps<{
  task: TaskRecord | null
  loading: boolean
  featureStatus: string | null
  taskTokenStats: TokenUsageAggregateRow | null
  operationalContext: {
    boardPulse: {
      activeRatio: number
      activeTasks: number
      totalTasks: number
    }
    resourceState: {
      rootCount: number
      statusLabel: string
    }
    realtimeSignal: {
      isListening: boolean
      message: string
    }
  }
}>()

const { locale, messages } = useLocale()
const artifactGridStyle = { '--task-artifact-max-count': '11' }

const selectedArtifactPath = ref<string | null>(null)
const activeDetailSection = ref<'relations' | 'artifacts'>('relations')

watch(
  () => props.task?.id,
  () => {
    activeDetailSection.value = 'relations'
    selectedArtifactPath.value = props.task?.artifacts.find((a) => a.kind === 'file')?.path
      ?? props.task?.artifacts[0]?.path
      ?? null
  },
  { immediate: true },
)

const selectedArtifact = computed(
  () => props.task?.artifacts.find((a) => a.path === selectedArtifactPath.value) ?? null,
)
const taskStatusLabel = computed(() =>
  props.task ? translateDashboardStatus(props.task.status, locale.value) : null,
)
const detailTabs = computed(() => [
  {
    label: messages.value.relationsPanel.title,
    value: 'relations',
    icon: 'i-lucide-link-2',
    badge: props.task?.relationReferences.length ?? 0,
  },
  {
    label: messages.value.artifactsPanel.title,
    value: 'artifacts',
    icon: 'i-lucide-files',
    badge: props.task?.artifacts.length ?? 0,
  },
])
const signalStatus = computed(() => ({
  icon: props.operationalContext.realtimeSignal.isListening ? 'i-lucide-audio-lines' : 'i-lucide-bell-off',
  label: props.operationalContext.realtimeSignal.isListening
    ? messages.value.detail.listening
    : messages.value.detail.standby,
}))

const tokenCards = computed(() => {
  const t = props.taskTokenStats
  if (!t) return null
  return [
    { label: messages.value.tokenMetrics.requests,     value: t.requestCount,           icon: 'i-lucide-activity' },
    { label: messages.value.tokenMetrics.inputTokens,  value: t.inputTokens,            icon: 'i-lucide-arrow-down-to-line' },
    { label: messages.value.tokenMetrics.outputTokens, value: t.outputTokens,           icon: 'i-lucide-arrow-up-from-line' },
    { label: messages.value.tokenMetrics.cachedTokens, value: t.cachedTokens,           icon: 'i-lucide-database-zap' },
  ]
})

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}
</script>

<template>
  <div class="surface-panel detail-panel">
    <header class="panel-header">
      <div>
        <p class="eyebrow">{{ messages.detail.eyebrow }}</p>
        <h2>{{ task?.title ?? messages.detail.selectTask }}</h2>
      </div>
      <UBadge color="neutral" variant="outline">
        {{ featureStatus ?? messages.detail.noFeatureStatus }}
      </UBadge>
    </header>

    <p v-if="loading" class="panel-empty">{{ messages.detail.refreshing }}</p>
    <p v-else-if="!task" class="panel-empty">{{ messages.detail.empty }}</p>

    <div v-else class="detail-stack">
      <!-- Information section -->
      <section class="detail-information-section">
        <div class="detail-section-header">
          <div>
            <p class="eyebrow">{{ messages.detail.informationEyebrow }}</p>
            <h3>{{ messages.detail.informationTitle }}</h3>
          </div>
          <UBadge color="neutral" variant="outline">{{ task.id }}</UBadge>
        </div>

        <section class="task-facts-grid">
          <article>
            <span>{{ messages.detail.status }}</span>
            <strong>{{ taskStatusLabel }}</strong>
          </article>
          <article>
            <span>{{ messages.detail.directory }}</span>
            <strong>{{ task.directoryPath }}</strong>
          </article>
          <article>
            <span>{{ messages.detail.created }}</span>
            <strong>{{ task.created }}</strong>
          </article>
          <article>
            <span>{{ messages.detail.closed }}</span>
            <strong>{{ task.closed ?? messages.detail.open }}</strong>
          </article>
        </section>

        <!-- Operational context -->
        <section class="detail-operational-context">
          <div class="detail-context-topline">
            <div>
              <p class="eyebrow">{{ messages.detail.contextEyebrow }}</p>
              <h4>{{ messages.detail.contextTitle }}</h4>
            </div>
            <UBadge color="neutral" variant="soft" :icon="signalStatus.icon">
              {{ signalStatus.label }}
            </UBadge>
          </div>

          <div class="detail-context-grid">
            <article class="detail-context-card">
              <span>{{ messages.landing.workspace.inventoryTitle }}</span>
              <strong>{{ operationalContext.boardPulse.activeRatio }}%</strong>
              <p>
                {{ operationalContext.boardPulse.activeTasks }} {{ messages.hero.activeTasks }}
                / {{ operationalContext.boardPulse.totalTasks }} {{ messages.taskBoard.trackedTasks }}
              </p>
              <UProgress
                color="neutral"
                size="xs"
                :model-value="operationalContext.boardPulse.activeRatio"
              />
            </article>

            <article class="detail-context-card">
              <span>{{ messages.landing.workspace.governanceTitle }}</span>
              <strong>{{ operationalContext.resourceState.rootCount }}</strong>
              <p>{{ operationalContext.resourceState.statusLabel }}</p>
            </article>

            <article class="detail-context-card detail-context-card-signal">
              <span>{{ messages.landing.workspace.signalTitle }}</span>
              <strong>{{ signalStatus.label }}</strong>
              <p>{{ operationalContext.realtimeSignal.message }}</p>
            </article>
          </div>
        </section>

        <!-- Token Usage mini-section -->
        <section v-if="tokenCards" class="detail-token-section">
          <div class="detail-context-topline">
            <div>
              <p class="eyebrow">{{ messages.tokenMetrics.taskTokenEyebrow }}</p>
              <h4>{{ messages.tokenMetrics.taskTokenTitle }}</h4>
            </div>
            <UBadge color="neutral" variant="outline">
              {{ task.id }}
            </UBadge>
          </div>
          <div class="detail-token-grid">
            <article v-for="card in tokenCards" :key="card.label" class="detail-token-card">
              <span>
                <UIcon :name="card.icon" style="vertical-align:middle;margin-right:0.3em;" />
                {{ card.label }}
              </span>
              <strong>{{ formatNumber(card.value) }}</strong>
            </article>
          </div>
        </section>

        <UAlert
          v-if="task.warnings.length"
          color="warning"
          icon="i-lucide-triangle-alert"
          variant="subtle"
          :title="messages.detail.attention"
          :description="task.warnings.join(' · ')"
        />
      </section>

      <!-- Functions section -->
      <section class="detail-function-section">
        <UDashboardToolbar class="detail-toolbar">
          <template #left>
            <div class="detail-toolbar-copy">
              <p>{{ messages.detail.operationsEyebrow }}</p>
              <strong>{{ messages.detail.operationsTitle }}</strong>
            </div>
          </template>
          <template #right>
            <UTabs
              v-model="activeDetailSection"
              color="neutral"
              size="sm"
              variant="link"
              :content="false"
              :items="detailTabs"
              class="detail-tabs"
            />
          </template>
        </UDashboardToolbar>

        <TaskRelationsPanel v-if="activeDetailSection === 'relations'" :task="task" />

        <div v-else class="detail-artifact-grid" :style="artifactGridStyle">
          <ArtifactList
            :artifacts="task.artifacts"
            :selected-path="selectedArtifactPath"
            @select="selectedArtifactPath = $event"
          />
          <ArtifactViewer :artifact="selectedArtifact" />
        </div>
      </section>
    </div>
  </div>
</template>