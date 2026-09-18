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
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return null
    const parts = dateStr.split('-')
    if (parts.length !== 3) return null
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    return new Date(year, month, day)
  }

  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const todayStr = getLocalDateString()

  if (dateFilter.value === 'today') {
    list = list.filter(t => t.created === todayStr)
  } else if (dateFilter.value === 'week') {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diffToMonday)
    monday.setHours(0, 0, 0, 0)
    
    list = list.filter(t => {
      const d = parseLocalDate(t.created)
      return d ? d >= monday : false
    })
  }

  list.sort((a, b) => {
    const dateA = a.created || ''
    const dateB = b.created || ''
    if (dateFilter.value === 'oldest') {
      return dateA.localeCompare(dateB)
    }
    return dateB.localeCompare(dateA)
  })

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
  <div class="space-y-4">
    <!-- Board Header & Filters Card -->
    <UCard variant="outline" class="backdrop-blur-md">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <p class="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
              {{ messages.taskBoard.eyebrow }}
            </p>
            <UBadge color="neutral" variant="soft" size="xs">
              {{ messages.taskBoard.boardMode }}
            </UBadge>
          </div>
          <h2 class="text-lg font-bold text-neutral-900 dark:text-white mt-0.5">
            {{ messages.taskBoard.title }}
          </h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {{ messages.taskBoard.boardCopy }}
          </p>
        </div>

        <UBadge color="neutral" variant="outline" size="sm">
          {{ props.tasks.length }} {{ messages.taskBoard.trackedTasks }}
        </UBadge>
      </div>

      <!-- Filters Toolbar -->
      <div class="flex flex-wrap items-center gap-3 pt-3 mt-3 border-t border-neutral-200 dark:border-neutral-800">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-neutral-500">{{ messages.common.filterByFeature }}:</span>
          <USelect
            v-model="selectedFeatureFilter"
            :items="featureItems"
            class="w-40"
            size="sm"
          />
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-neutral-500">{{ messages.common.filterByRelation }}:</span>
          <USelect
            v-model="selectedRelationFilter"
            :items="relationItems"
            class="w-48"
            size="sm"
          />
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-neutral-500">{{ messages.common.sortByDate }}:</span>
          <USelect
            v-model="dateFilter"
            :items="dateItems"
            class="w-36"
            size="sm"
          />
        </div>
      </div>
    </UCard>

    <div v-if="props.loading && !props.tasks.length" class="py-12 text-center text-neutral-400 font-mono text-xs">
      <UIcon name="i-lucide-loader-circle" class="animate-spin inline-block mr-2 w-4 h-4 text-primary" />
      {{ messages.taskBoard.refreshing }}
    </div>

    <div v-else-if="!props.tasks.length" class="py-12 text-center text-neutral-400 font-mono text-xs">
      {{ messages.taskBoard.empty }}
    </div>

    <!-- Kanban Lanes Canvas -->
    <div v-else class="overflow-x-auto pb-4">
      <div class="flex items-start gap-4 min-w-max">
        <div
          v-for="lane in boardLanes"
          :key="lane.id"
          class="flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-900/50 backdrop-blur-md transition-all duration-300"
          :class="[
            isLaneCollapsed(lane) ? 'w-20' : 'w-72 sm:w-80'
          ]"
        >
          <!-- Lane Header -->
          <div class="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-sm shrink-0">{{ lane.symbol }}</span>
              <span v-if="!isLaneCollapsed(lane)" class="font-semibold text-xs text-neutral-900 dark:text-white truncate">
                {{ lane.label }}
              </span>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <UBadge color="neutral" variant="outline" size="xs">
                {{ lane.tasks.length }}
              </UBadge>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="isLaneCollapsed(lane) ? 'i-lucide-panel-right-open' : 'i-lucide-panel-right-close'"
                :aria-label="isLaneCollapsed(lane) ? messages.taskBoard.expandLane : messages.taskBoard.collapseLane"
                @click="toggleLane(lane)"
              />
            </div>
          </div>

          <!-- Lane Body -->
          <div v-if="!isLaneCollapsed(lane)" class="p-3 space-y-3 flex-1 flex flex-col min-h-[300px]">
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
              {{ lane.copy }}
            </p>

            <div v-if="lane.tasks.length" class="space-y-2.5 flex-1">
              <div
                v-for="task in lane.tasks"
                :key="task.id"
                role="button"
                tabindex="0"
                class="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                :class="resolveTaskButtonClass(task.id)"
                @click="emit('select', task.id)"
                @keydown.enter="emit('select', task.id)"
              >
                <TaskSummaryCard
                  :task="task"
                  :selected="task.id === props.selectedTaskId"
                  :changed="Boolean(resolveTaskChange(task.id))"
                />
              </div>
            </div>

            <div v-else class="py-8 text-center text-neutral-400 font-mono text-xs italic">
              {{ messages.taskBoard.laneEmpty }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>