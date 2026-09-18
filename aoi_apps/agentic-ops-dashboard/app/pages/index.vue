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
  <main class="ops-shell max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
    <!-- ── Hero Landing Card ─────────────────────────────────── -->
    <UCard
      variant="outline"
      class="backdrop-blur-xl bg-white/85 dark:bg-neutral-900/85 rounded-3xl shadow-sm border border-neutral-200/80 dark:border-neutral-800"
      :ui="{ body: 'p-6 sm:p-8 space-y-6' }"
    >
      <!-- Top bar -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-200/70 dark:border-neutral-800">
        <div class="flex items-center gap-2">
          <UBadge color="primary" variant="subtle" size="sm">
            <UIcon name="i-lucide-cpu" class="mr-1.5" />
            {{ messages.landing.hero.badge }}
          </UBadge>
          <UBadge color="neutral" variant="outline" size="sm">
            {{ messages.landing.workspace.badge }}
          </UBadge>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-mono text-neutral-500">{{ messages.common.language }}:</span>
          <UTabs
            v-model="localeSelection"
            color="primary"
            size="sm"
            variant="link"
            :content="false"
            :items="localeItems"
          />
        </div>
      </div>

      <!-- Hero grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left: copy & workstreams -->
        <div class="lg:col-span-7 space-y-4">
          <div>
            <p class="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
              {{ messages.landing.workspace.eyebrow }}
            </p>
            <h1 class="text-2xl sm:text-3xl lg:text-4xl font-black text-neutral-900 dark:text-white tracking-tight mt-1">
              {{ messages.landing.workspace.dashboardTitle }}
            </h1>
          </div>

          <p class="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-2xl">
            {{ messages.landing.workspace.copy }}
          </p>

          <div v-if="workstreamItems.length" class="space-y-2 pt-2">
            <span class="text-xs font-mono text-neutral-500 block uppercase tracking-wider">
              {{ messages.landing.trust.workstreams }}
            </span>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="feature in workstreamItems"
                :key="feature.slug"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                <UIcon name="i-lucide-layers" class="mr-1 opacity-70" />
                {{ feature.slug }} · {{ feature.statusLabel }}
              </UBadge>
            </div>
          </div>
        </div>

        <!-- Right: Telemetry KPI cards + Realtime Signal -->
        <div class="lg:col-span-5 space-y-3">
          <div class="grid grid-cols-2 gap-2.5">
            <UCard
              v-for="item in heroTelemetry"
              :key="item.label"
              variant="subtle"
              :ui="{ body: 'p-3 space-y-1' }"
            >
              <span class="text-[11px] text-neutral-500 flex items-center gap-1.5">
                <UIcon :name="item.icon" class="w-3.5 h-3.5 text-primary" />
                {{ item.label }}
              </span>
              <strong class="text-base font-bold font-mono text-neutral-900 dark:text-white block">
                {{ item.value }}
              </strong>
            </UCard>
          </div>

          <!-- Realtime Signal Card -->
          <UCard variant="outline" :ui="{ body: 'p-4 space-y-2.5' }">
            <div class="flex items-center justify-between gap-2">
              <div>
                <p class="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  {{ messages.landing.capabilities.streamEyebrow }}
                </p>
                <strong class="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                  <span class="w-2 h-2 rounded-full" :class="lastEvent ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'" />
                  {{ lastEvent ? messages.landing.capabilities.live : messages.landing.capabilities.standby }}
                </strong>
              </div>
              <UBadge color="neutral" variant="outline" size="xs">
                {{ selectedFeatureStatus ?? messages.detail.noFeatureStatus }}
              </UBadge>
            </div>

            <p class="text-xs text-neutral-600 dark:text-neutral-300 font-mono truncate" :title="liveSignal">
              {{ liveSignal }}
            </p>
            <UProgress
              color="primary"
              size="xs"
              :model-value="activeTaskRatio"
            />
            <small class="text-[10px] text-neutral-400 font-mono block">
              {{ messages.landing.hero.baseline }}
            </small>
          </UCard>
        </div>
      </div>

      <UAlert
        v-if="translatedErrorMessage"
        color="error"
        icon="i-lucide-triangle-alert"
        variant="subtle"
        :description="translatedErrorMessage"
      />
    </UCard>

    <!-- ── Workspace Operations Dashboard ──────────────────────── -->
    <section class="space-y-4">
      <!-- Main navbar -->
      <UDashboardNavbar
        icon="i-lucide-layout-dashboard"
        :title="messages.landing.workspace.dashboardTitle"
        class="border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md px-4 py-2.5"
      >
        <template #leading>
          <UBadge color="neutral" variant="soft" size="sm">
            <UIcon name="i-lucide-folder" class="mr-1.5" />
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
          <UBadge v-else color="neutral" variant="outline" size="sm">
            {{ messages.landing.workspace.currentTask }} · {{ messages.landing.numbers.noSelection }}
          </UBadge>
          <UBadge color="neutral" variant="outline" size="sm">
            {{ messages.landing.workspace.currentStatus }} · {{ selectedFeatureStatus ?? messages.detail.noFeatureStatus }}
          </UBadge>
        </template>
      </UDashboardNavbar>

      <!-- View Navigation Toolbar -->
      <UDashboardToolbar class="border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md px-4 py-2">
        <template #left>
          <div class="hidden sm:block">
            <p class="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">{{ messages.landing.workspace.stageEyebrow }}</p>
            <strong class="text-xs font-bold text-neutral-900 dark:text-white">{{ activeWorkspaceViewMeta.title }}</strong>
          </div>
        </template>

        <template #default>
          <UTabs
            v-model="activeWorkspaceView"
            color="primary"
            size="sm"
            variant="link"
            :content="false"
            :items="workspaceViewItems"
          />
        </template>

        <template #right>
          <UButton
            color="primary"
            icon="i-lucide-refresh-cw"
            variant="solid"
            size="sm"
            :loading="isActiveWorkspaceViewLoading"
            @click="handleActiveWorkspaceViewRefresh"
          >
            {{ isActiveWorkspaceViewLoading ? messages.common.refreshing : messages.common.refresh }}
          </UButton>
        </template>
      </UDashboardToolbar>

      <!-- Main Stage View Container -->
      <div class="min-h-[30rem] sm:min-h-[36rem]">
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

      <!-- Task Detail Modal -->
      <UModal
        v-model:open="isTaskDetailModalOpen"
        scrollable
        :title="selectedTask?.id ?? messages.detail.selectTask"
        :description="selectedTask?.title ?? messages.detail.empty"
        :ui="{
          content: 'w-[calc(100vw-2rem)] max-w-6xl rounded-3xl',
          header: 'px-6 py-4 border-b border-neutral-200 dark:border-neutral-800',
          body: 'p-6',
          footer: 'justify-end px-6 py-4 border-t border-neutral-200 dark:border-neutral-800',
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

    <!-- Resource Action Dialog -->
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