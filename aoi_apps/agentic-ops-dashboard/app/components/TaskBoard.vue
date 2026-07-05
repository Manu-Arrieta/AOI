<script setup lang="ts">
import { computed, ref } from 'vue'

import type { TaskRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'
import type { TaskChangeState } from '../utils/task-changes'
import {
  type TaskBoardLaneCollapsePreference,
  type TaskBoardLaneId,
  resolveTaskBoardLane,
  resolveTaskBoardLaneCollapsed,
  taskBoardLaneOrder,
} from '../utils/task-board'

const props = withDefaults(defineProps<{
  tasks: TaskRecord[]
  selectedTaskId: string | null
  loading: boolean
  taskChanges?: Record<string, TaskChangeState>
}>(), {
  taskChanges: () => ({}),
})

type BoardLaneView = {
  id: TaskBoardLaneId
  label: string
  copy: string
  symbol: string
  tasks: TaskRecord[]
}

const { messages } = useLocale()
const laneCollapsePreferences = ref<Partial<Record<TaskBoardLaneId, TaskBoardLaneCollapsePreference>>>({})

// --- Filters & Sorting ---
const selectedFeatureFilter = ref<string>('all')
const selectedRelationFilter = ref<string>('all')
const dateFilter = ref<string>('newest')

const uniqueFeatures = computed(() => {
  const set = new Set<string>()
  props.tasks.forEach(task => {
    if (task.feature) set.add(task.feature)
  })
  return ['all', ...Array.from(set)]
})

const featureItems = computed(() => uniqueFeatures.value.map(f => ({
  label: f === 'all' ? messages.value.common.allFeatures : f,
  value: f
})))

const uniqueRelations = computed(() => {
  const set = new Set<string>()
  props.tasks.forEach(task => {
    task.relationReferences?.forEach(ref => {
      if (ref.path) set.add(ref.path)
    })
  })
  return ['all', ...Array.from(set)]
})

const relationItems = computed(() => uniqueRelations.value.map(r => ({
  label: r === 'all' ? messages.value.common.allRelations : r.replace(/^\.resources\//, ''),
  value: r
})))

const dateItems = computed(() => [
  { label: messages.value.common.newest, value: 'newest' },
  { label: messages.value.common.oldest, value: 'oldest' },
  { label: messages.value.common.today, value: 'today' },
  { label: messages.value.common.thisWeek, value: 'week' }
])

const filteredTasks = computed(() => {
  let list = [...props.tasks]

  // 1. Feature Filter
  if (selectedFeatureFilter.value !== 'all') {
    list = list.filter(t => t.feature === selectedFeatureFilter.value)
  }

  // 2. Relation/Resource Filter
  if (selectedRelationFilter.value !== 'all') {
    list = list.filter(t => t.relationReferences?.some(r => r.path === selectedRelationFilter.value))
  }

  // 3. Date Range & Sorting
  const parseDate = (d: string) => d ? new Date(d).getTime() : 0

  if (dateFilter.value === 'today') {
    const today = new Date().toDateString()
    list = list.filter(t => t.created && new Date(t.created).toDateString() === today)
  } else if (dateFilter.value === 'week') {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    list = list.filter(t => parseDate(t.created) >= oneWeekAgo)
  }

  if (dateFilter.value === 'oldest') {
    list.sort((a, b) => parseDate(a.created) - parseDate(b.created))
  } else {
    list.sort((a, b) => parseDate(b.created) - parseDate(a.created))
  }

  return list
})

const boardLanes = computed<BoardLaneView[]>(() => {
  const laneMeta: Record<TaskBoardLaneId, { label: string; copy: string; symbol: string }> = {
    exploring:      { label: messages.value.taskBoard.exploringLane,      copy: messages.value.taskBoard.exploringCopy,      symbol: '🔍' },
    proposed:       { label: messages.value.taskBoard.proposedLane,       copy: messages.value.taskBoard.proposedCopy,       symbol: '📋' },
    analysis:       { label: messages.value.taskBoard.analysisLane,       copy: messages.value.taskBoard.analysisCopy,       symbol: '📐' },
    planned:        { label: messages.value.taskBoard.plannedLane,        copy: messages.value.taskBoard.plannedCopy,        symbol: '🏗️' },
    implementation: { label: messages.value.taskBoard.implementationLane, copy: messages.value.taskBoard.implementationCopy, symbol: '⚙️' },
    implemented:    { label: messages.value.taskBoard.implementedLane,    copy: messages.value.taskBoard.implementedCopy,    symbol: '✅' },
    archived:       { label: messages.value.taskBoard.archivedLane,       copy: messages.value.taskBoard.archivedCopy,       symbol: '📦' },
    sandbox:        { label: messages.value.taskBoard.sandboxLane,        copy: messages.value.taskBoard.sandboxCopy,        symbol: '🔄' },
    cancelled:      { label: messages.value.taskBoard.cancelledLane,      copy: messages.value.taskBoard.cancelledCopy,      symbol: '❌' },
  }

  return taskBoardLaneOrder.map((laneId) => ({
    id: laneId,
    ...laneMeta[laneId],
    tasks: filteredTasks.value.filter((task) => resolveTaskBoardLane(task.status) === laneId),
  }))
})

const emit = defineEmits<{ select: [taskId: string] }>()

function resolveTaskChange(taskId: string) {
  return props.taskChanges[taskId] ?? null
}

function resolveTaskButtonClass(taskId: string) {
  const taskChange = resolveTaskChange(taskId)
  return {
    'task-card-button-shift-forward':  taskChange?.direction === 'forward',
    'task-card-button-shift-backward': taskChange?.direction === 'backward',
  }
}

function isLaneCollapsed(lane: BoardLaneView) {
  return resolveTaskBoardLaneCollapsed(lane.tasks.length, laneCollapsePreferences.value[lane.id] ?? null)
}

function toggleLane(lane: BoardLaneView) {
  const nextPreference: TaskBoardLaneCollapsePreference = isLaneCollapsed(lane) ? 'expanded' : 'collapsed'
  const shouldResetToAuto = lane.tasks.length === 0 ? nextPreference === 'collapsed' : nextPreference === 'expanded'

  if (shouldResetToAuto) {
    const { [lane.id]: _removed, ...rest } = laneCollapsePreferences.value
    laneCollapsePreferences.value = rest
    return
  }

  laneCollapsePreferences.value = { ...laneCollapsePreferences.value, [lane.id]: nextPreference }
}
</script>

<template>
  <div class="surface-panel surface-panel-board">
    <header class="panel-header">
      <div>
        <p class="eyebrow">{{ messages.taskBoard.eyebrow }}</p>
        <h2>{{ messages.taskBoard.title }}</h2>
      </div>
      <UBadge color="neutral" variant="outline">
        {{ props.tasks.length }} {{ messages.taskBoard.trackedTasks }}
      </UBadge>
    </header>

    <div class="task-board-meta">
      <UBadge color="neutral" variant="soft">{{ messages.taskBoard.boardMode }}</UBadge>
      <p>{{ messages.taskBoard.boardCopy }}</p>
    </div>

    <!-- Tablero Filters -->
    <div class="task-board-filters">
      <div class="filter-group">
        <span class="filter-label">{{ messages.common.filterByFeature }}</span>
        <USelect
          v-model="selectedFeatureFilter"
          :items="featureItems"
          class="filter-select w-44"
          size="sm"
        />
      </div>
      <div class="filter-group">
        <span class="filter-label">{{ messages.common.filterByRelation }}</span>
        <USelect
          v-model="selectedRelationFilter"
          :items="relationItems"
          class="filter-select w-56"
          size="sm"
        />
      </div>
      <div class="filter-group">
        <span class="filter-label">{{ messages.common.sortByDate }}</span>
        <USelect
          v-model="dateFilter"
          :items="dateItems"
          class="filter-select w-44"
          size="sm"
        />
      </div>
    </div>

    <p v-if="props.loading && !props.tasks.length" class="panel-empty">
      {{ messages.taskBoard.refreshing }}
    </p>
    <p v-else-if="!props.tasks.length" class="panel-empty">
      {{ messages.taskBoard.empty }}
    </p>

    <div v-else class="task-board-canvas" :class="{ 'task-board-canvas-updating': props.loading }">
      <div class="task-board-lane-grid">
        <section
          v-for="lane in boardLanes"
          :key="lane.id"
          :class="[
            'task-board-lane',
            `task-board-lane-${lane.id}`,
            { 'task-board-lane-collapsed': isLaneCollapsed(lane) },
          ]"
        >
          <header class="task-board-lane-head">
            <div class="task-board-lane-kicker">
              <span class="task-board-lane-symbol">{{ lane.symbol }}</span>
              <span class="task-board-lane-name">{{ lane.label }}</span>
            </div>
            <div class="task-board-lane-actions">
              <UBadge class="task-board-lane-count" color="neutral" variant="outline" size="sm">
                {{ lane.tasks.length }}
              </UBadge>
              <UButton
                class="task-board-lane-toggle"
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="isLaneCollapsed(lane) ? 'i-lucide-panel-right-open' : 'i-lucide-panel-right-close'"
                :aria-label="isLaneCollapsed(lane) ? messages.taskBoard.expandLane : messages.taskBoard.collapseLane"
                :title="isLaneCollapsed(lane) ? messages.taskBoard.expandLane : messages.taskBoard.collapseLane"
                @click="toggleLane(lane)"
              />
            </div>
          </header>

          <div v-if="!isLaneCollapsed(lane)" class="task-board-lane-body">
            <p class="task-board-lane-copy">{{ lane.copy }}</p>

            <TransitionGroup v-if="lane.tasks.length" name="task-lane" tag="div" class="task-board-lane-list">
              <button
                v-for="task in lane.tasks"
                :key="task.id"
                :class="['task-card-button', resolveTaskButtonClass(task.id)]"
                type="button"
                @click="emit('select', task.id)"
              >
                <TaskSummaryCard
                  :task="task"
                  :selected="task.id === props.selectedTaskId"
                  :changed="Boolean(resolveTaskChange(task.id))"
                />
              </button>
            </TransitionGroup>

            <p v-else class="task-board-lane-empty">{{ messages.taskBoard.laneEmpty }}</p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>