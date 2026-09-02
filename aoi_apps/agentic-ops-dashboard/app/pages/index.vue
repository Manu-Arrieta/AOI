<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useLocale } from '../composables/useLocale'
import { translateDashboardStatus, translateWorkspaceError } from '../utils/locales'

const {
  snapshot,
  selectedTask,
  selectedTaskId,
  selectedFeature,
  counts,
  isLoading,
  isTaskLoading,
  isMutatingResources,
  errorMessage,
  lastEvent,
  taskChanges,
  initializeWorkspace,
  refreshWorkspace,
  selectTask,
  performResourceAction,
} = useWorkspace()

const {
  summary: tokenUsageSummary,
  isLoading: isTokenUsageLoading,
  errorMessage: tokenUsageError,
  initializeTokenObservability,
  refreshTokenObservability,
  setTokenObservabilityEnabled,
} = useTokenObservability()

const { locale, messages, setLocale } = useLocale()

type WorkspaceView = 'tasks' | 'table' | 'resources' | 'memoir' | 'facts' | 'metrics'

const dialogMode       = ref<'create' | 'move' | 'delete' | null>(null)
const dialogAnchorPath = ref('.resources')
const activeWorkspaceView    = ref<WorkspaceView>('tasks')
const isTaskDetailModalOpen  = ref(false)

await initializeWorkspace()

/* ── Computed ──────────────────────────────────────────────── */
const featureHighlights = computed(() => snapshot.value?.features.slice(0, 3) ?? [])
const translatedFeatureHighlights = computed(() =>
  featureHighlights.value.map((f) => ({
    ...f,
    statusLabel: translateDashboardStatus(f.status, locale.value),
  })),
)
const selectedFeatureStatus = computed(() =>
  selectedFeature.value ? translateDashboardStatus(selectedFeature.value.status, locale.value) : null,
)
const liveSignal = computed(() => {
  if (!lastEvent.value) return messages.value.hero.streamWaiting
  if (lastEvent.value.changedPath) return `${lastEvent.value.reason} · ${lastEvent.value.changedPath}`
  return `${lastEvent.value.reason} · ${messages.value.hero.streamConnected}`
})
const translatedErrorMessage = computed(() =>
  errorMessage.value ? translateWorkspaceError(errorMessage.value, locale.value) : null,
)
const localeItems = computed(() => [
  { label: messages.value.common.english, value: 'en', icon: 'i-lucide-languages' },
  { label: messages.value.common.spanish, value: 'es', icon: 'i-lucide-languages' },
])
const localeSelection = computed({
  get: () => locale.value,
  set: (value: string | number) => setLocale(value === 'es' ? 'es' : 'en'),
})
const workspaceCounts   = computed(() => counts.value)
const activeTaskRatio   = computed(() => {
  if (!workspaceCounts.value.tasks) return 0
  return Math.round((workspaceCounts.value.activeTasks / workspaceCounts.value.tasks) * 100)
})
const resourceRoots     = computed(() => snapshot.value?.resources.length ?? 0)
const workstreamItems   = computed(() => translatedFeatureHighlights.value.slice(0, 4))
const heroTelemetry     = computed(() => [
  { label: messages.value.hero.features, value: String(workspaceCounts.value.features), icon: 'i-lucide-layers' },
  { label: messages.value.hero.tasks,    value: String(workspaceCounts.value.tasks),    icon: 'i-lucide-list-todo' },
  { label: messages.value.landing.hero.governed, value: String(resourceRoots.value),   icon: 'i-lucide-database' },
  {
    label: messages.value.landing.numbers.selectedTask,
    value: selectedTask.value?.id ?? messages.value.landing.numbers.noSelection,
    icon:  'i-lucide-crosshair',
  },
])

const workspaceViewItems = computed(() => [
  {
    label: messages.value.taskBoard.title,
    value: 'tasks',
    icon: 'i-lucide-layout-grid',
    badge: workspaceCounts.value.tasks,
  },
  {
    label: 'TanStack Table',
    value: 'table',
    icon: 'i-lucide-table',
    badge: workspaceCounts.value.tasks,
  },
  {
    label: messages.value.resources.title,
    value: 'resources',
    icon: 'i-lucide-folder-tree',
    badge: resourceRoots.value,
  },
  {
    label: messages.value.memoir.title,
    value: 'memoir',
    icon: 'i-lucide-network',
  },
  {
    label: messages.value.facts.title,
    value: 'facts',
    icon: 'i-lucide-database',
  },
  {
    label: messages.value.tokenMetrics.title,
    value: 'metrics',
    icon: 'i-lucide-chart-no-axes-column',
    badge: tokenUsageSummary.value?.totals.requestCount ?? 0,
  },
])
const activeWorkspaceViewMeta = computed(() => {
  if (activeWorkspaceView.value === 'metrics') {
    return {
      eyebrow: messages.value.tokenMetrics.eyebrow,
      title:   messages.value.tokenMetrics.title,
      badge:   tokenUsageSummary.value?.status === 'disabled'
        ? messages.value.tokenMetrics.statusDisabled
        : `${tokenUsageSummary.value?.totals.requestCount ?? 0} ${messages.value.tokenMetrics.requests}`,
    }
  }
  if (activeWorkspaceView.value === 'memoir') {
    return {
      eyebrow: messages.value.memoir.eyebrow,
      title:   messages.value.memoir.title,
      badge:   'ICM Memoir',
    }
  }
  if (activeWorkspaceView.value === 'facts') {
    return {
      eyebrow: messages.value.facts.eyebrow,
      title:   messages.value.facts.title,
      badge:   'ICM Facts (O(1))',
    }
  }
  if (activeWorkspaceView.value === 'resources') {
    return {
      eyebrow: messages.value.resources.eyebrow,
      title:   messages.value.resources.title,
      badge:   `${resourceRoots.value} ${messages.value.landing.numbers.governedRoots}`,
    }
  }
  if (activeWorkspaceView.value === 'table') {
    return {
      eyebrow: 'TanStack Data Matrix',
      title:   'Governed Task Registry Table',
      badge:   `${workspaceCounts.value.tasks} tasks`,
    }
  }
  return {
    eyebrow: messages.value.taskBoard.eyebrow,
    title:   messages.value.taskBoard.title,
    badge:   `${workspaceCounts.value.tasks} ${messages.value.taskBoard.trackedTasks}`,
  }
})
const isActiveWorkspaceViewLoading = computed(() =>
  activeWorkspaceView.value === 'metrics' ? isTokenUsageLoading.value : isLoading.value,
)
const detailOperationalContext = computed(() => ({
  boardPulse: {
    activeRatio:  activeTaskRatio.value,
    activeTasks:  workspaceCounts.value.activeTasks,
    totalTasks:   workspaceCounts.value.tasks,
  },
  resourceState: {
    rootCount:   resourceRoots.value,
    statusLabel: isMutatingResources.value ? messages.value.resources.busy : messages.value.resources.ready,
  },
  realtimeSignal: {
    isListening: Boolean(lastEvent.value),
    message:     liveSignal.value,
  },
}))

// Per-task token stats: look up the selected task in byTask breakdown
const taskTokenStats = computed(() => {
  const taskId = selectedTask.value?.id
  if (!taskId || !tokenUsageSummary.value?.byTask) return null
  return tokenUsageSummary.value.byTask.find((row) => row.key === taskId) ?? null
})

/* ── Handlers ──────────────────────────────────────────────── */
function setWorkspaceView(view: WorkspaceView) {
  activeWorkspaceView.value = view
}

async function handleActiveWorkspaceViewRefresh() {
  if (activeWorkspaceView.value === 'metrics') {
    await refreshTokenObservability()
    return
  }
  await refreshWorkspace(true)
}

function openTaskDetailModal() {
  if (!selectedTask.value) return
  isTaskDetailModalOpen.value = true
}

function closeTaskDetailModal() {
  isTaskDetailModalOpen.value = false
}

function openResourceDialog(mode: 'create' | 'move' | 'delete', path: string) {
  dialogMode.value       = mode
  dialogAnchorPath.value = path
}

function closeResourceDialog() {
  dialogMode.value = null
}

function handleTaskSelection(taskId: string) {
  selectTask(taskId)
  isTaskDetailModalOpen.value = true
}

async function handleResourceSubmit(payload: Record<string, string | boolean>) {
  if (!dialogMode.value) return
  await performResourceAction(dialogMode.value, payload)
  closeResourceDialog()
}

async function handleTokenObservabilityToggle(enabled: boolean) {
  await setTokenObservabilityEnabled(enabled)
}

watch(activeWorkspaceView, (view) => {
  if (view === 'metrics') void initializeTokenObservability()
})
</script>

<template>
  <main class="ops-shell">
    <!-- ── Hero ─────────────────────────────────────────────── -->
    <section class="landing-shell">
      <div class="landing-hero-card">
        <!-- Top bar -->
        <div class="landing-hero-bar">
          <div class="landing-badge-row">
            <UBadge color="neutral" variant="soft">
              <UIcon name="i-lucide-cpu" style="margin-right: 0.3em;" />
              {{ messages.landing.hero.badge }}
            </UBadge>
            <span class="landing-release-chip">{{ messages.landing.workspace.badge }}</span>
          </div>
          <div class="locale-switcher-shell">
            <span class="locale-label">{{ messages.common.language }}</span>
            <UTabs
              v-model="localeSelection"
              color="neutral"
              size="sm"
              variant="link"
              :content="false"
              :items="localeItems"
              class="locale-tabs"
            />
          </div>
        </div>

        <!-- Hero grid -->
        <div class="landing-hero-grid">
          <!-- Left: copy -->
          <div class="landing-copy-column">
            <div>
              <p class="eyebrow">{{ messages.landing.workspace.eyebrow }}</p>
              <h1 class="landing-title">{{ messages.landing.workspace.dashboardTitle }}</h1>
            </div>

            <p class="landing-copy">{{ messages.landing.workspace.copy }}</p>

            <div v-if="workstreamItems.length" class="landing-workstream-row">
              <span class="landing-workstream-label">{{ messages.landing.trust.workstreams }}</span>
              <div class="landing-workstream-pills">
                <UBadge
                  v-for="feature in workstreamItems"
                  :key="feature.slug"
                  color="neutral"
                  variant="outline"
                  class="landing-workstream-chip"
                >
                  {{ feature.slug }} · {{ feature.statusLabel }}
                </UBadge>
              </div>
            </div>
          </div>

          <!-- Right: stats + signal -->
          <div class="dashboard-overview-side">
            <div class="dashboard-overview-stats">
              <div
                v-for="item in heroTelemetry"
                :key="item.label"
                class="overview-stat-card"
              >
                <span>
                  <UIcon :name="item.icon" style="vertical-align: middle; margin-right: 0.3em;" />
                  {{ item.label }}
                </span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>

            <div class="overview-signal-card">
              <div class="overview-signal-head">
                <div>
                  <p class="overview-card-label">{{ messages.landing.capabilities.streamEyebrow }}</p>
                  <strong>
                    {{ lastEvent ? messages.landing.capabilities.live : messages.landing.capabilities.standby }}
                  </strong>
                </div>
                <UBadge color="neutral" variant="outline">
                  {{ selectedFeatureStatus ?? messages.detail.noFeatureStatus }}
                </UBadge>
              </div>

              <p>{{ liveSignal }}</p>
              <UProgress
                color="neutral"
                size="xs"
                status
                :model-value="activeTaskRatio"
              />
              <small>{{ messages.landing.hero.baseline }}</small>
            </div>
          </div>
        </div>
      </div>

      <UAlert
        v-if="translatedErrorMessage"
        class="error-banner"
        color="error"
        icon="i-lucide-triangle-alert"
        variant="subtle"
        :description="translatedErrorMessage"
      />
    </section>

    <!-- ── Workspace dashboard ───────────────────────────────── -->
    <section class="workspace-dashboard-shell">
      <!-- Main navbar -->
      <UDashboardNavbar
        class="workspace-dashboard-navbar"
        icon="i-lucide-layout-dashboard"
        :title="messages.landing.workspace.dashboardTitle"
      >
        <template #leading>
          <UBadge color="neutral" variant="soft">
            <UIcon name="i-lucide-folder" style="margin-right: 0.3em;" />
            {{ snapshot?.workspaceName || messages.landing.workspace.badge }}
          </UBadge>
        </template>

        <template #right>
          <DoctorHealthBadge />
          <UButton
            v-if="selectedTask"
            color="neutral"
            variant="outline"
            icon="i-lucide-panel-right-open"
            size="sm"
            @click="openTaskDetailModal"
          >
            {{ messages.landing.workspace.currentTask }} · {{ selectedTask.id }}
          </UButton>
          <UBadge v-else color="neutral" variant="outline">
            {{ messages.landing.workspace.currentTask }} · {{ messages.landing.numbers.noSelection }}
          </UBadge>
          <UBadge color="neutral" variant="outline">
            {{ messages.landing.workspace.currentStatus }} · {{ selectedFeatureStatus ?? messages.detail.noFeatureStatus }}
          </UBadge>
        </template>
      </UDashboardNavbar>

      <!-- Toolbar -->
      <UDashboardToolbar class="workspace-dashboard-toolbar">
        <template #left>
          <div class="workspace-toolbar-copy">
            <p>{{ messages.landing.workspace.stageEyebrow }}</p>
            <strong>{{ activeWorkspaceViewMeta.title }}</strong>
          </div>
        </template>

        <template #default>
          <UTabs
            v-model="activeWorkspaceView"
            color="neutral"
            size="sm"
            variant="link"
            :content="false"
            :items="workspaceViewItems"
            class="workspace-view-tabs"
          />
        </template>

        <template #right>
          <div class="hero-button-row workspace-toolbar-actions">
            <UButton
              color="neutral"
              icon="i-lucide-refresh-cw"
              variant="solid"
              size="sm"
              :loading="isActiveWorkspaceViewLoading"
              @click="handleActiveWorkspaceViewRefresh"
            >
              {{ isActiveWorkspaceViewLoading ? messages.common.refreshing : messages.common.refresh }}
            </UButton>
          </div>
        </template>
      </UDashboardToolbar>

      <!-- Stage -->
      <UDashboardGroup
        class="workspace-stage-layout"
        as="section"
        :ui="{ base: 'relative inset-auto flex flex-col overflow-visible' }"
      >
        <UDashboardPanel
          class="workspace-stage-panel"
          id="stage"
          :ui="{ root: 'min-h-[30rem] sm:min-h-[34rem] lg:min-h-[44rem]', body: 'p-0 sm:p-0' }"
        >
          <template #header>
            <UDashboardNavbar class="workspace-stage-navbar" :title="activeWorkspaceViewMeta.title">
              <template #leading>
                <UBadge color="neutral" variant="soft">{{ activeWorkspaceViewMeta.eyebrow }}</UBadge>
              </template>
              <template #right>
                <UBadge color="neutral" variant="outline">{{ activeWorkspaceViewMeta.badge }}</UBadge>
              </template>
            </UDashboardNavbar>
          </template>

          <template #body>
            <div class="workspace-panel-anchor workspace-panel-stage">
              <TaskBoard
                v-if="activeWorkspaceView === 'tasks'"
                :tasks="snapshot?.tasks ?? []"
                :selected-task-id="selectedTaskId"
                :loading="isLoading"
                :task-changes="taskChanges"
                @select="handleTaskSelection"
              />

              <TaskTanstackTable
                v-else-if="activeWorkspaceView === 'table'"
                :tasks="snapshot?.tasks ?? []"
                :selected-task-id="selectedTaskId"
                @select="handleTaskSelection"
              />

              <ResourceExplorer
                v-else-if="activeWorkspaceView === 'resources'"
                :resources="snapshot?.resources ?? []"
                :busy="isMutatingResources"
                @create="openResourceDialog('create', $event)"
                @move="openResourceDialog('move', $event)"
                @delete="openResourceDialog('delete', $event)"
              />

              <MemoirGraphViewer
                v-else-if="activeWorkspaceView === 'memoir'"
              />

              <FactsExplorer
                v-else-if="activeWorkspaceView === 'facts'"
              />

              <TokenUsagePanel
                v-else
                :summary="tokenUsageSummary"
                :loading="isTokenUsageLoading"
                :error-message="tokenUsageError"
                @toggle="handleTokenObservabilityToggle"
              />
            </div>
          </template>
        </UDashboardPanel>
      </UDashboardGroup>

      <!-- Task detail modal -->
      <UModal
        v-model:open="isTaskDetailModalOpen"
        scrollable
        :title="selectedTask?.id ?? messages.detail.selectTask"
        :description="selectedTask?.title ?? messages.detail.empty"
        :ui="{
          content: 'w-[calc(100vw-2rem)] max-w-7xl rounded-[28px]',
          header: 'min-h-0 px-4 py-4 sm:px-6',
          body: 'p-0',
          footer: 'justify-end px-4 pb-4 sm:px-6 sm:pb-6',
        }"
      >
        <template #body>
          <TaskDetailPanel
            :task="selectedTask"
            :loading="isTaskLoading"
            :feature-status="selectedFeatureStatus"
            :task-token-stats="taskTokenStats"
            :operational-context="detailOperationalContext"
          />
        </template>

        <template #footer="{ close }">
          <UButton color="neutral" variant="ghost" @click="close(); closeTaskDetailModal()">
            {{ messages.common.close }}
          </UButton>
        </template>
      </UModal>
    </section>

    <!-- Resource action dialog -->
    <ResourceActionDialog
      :open="Boolean(dialogMode)"
      :mode="dialogMode"
      :anchor-path="dialogAnchorPath"
      :pending="isMutatingResources"
      @close="closeResourceDialog"
      @submit="handleResourceSubmit"
    />
  </main>
</template>