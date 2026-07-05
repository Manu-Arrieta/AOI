<script setup lang="ts">
import { computed } from 'vue'

import type { TaskRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'
import { translateDashboardStatus } from '../utils/locales'
import { resolveTaskBoardLane } from '../utils/task-board'

const props = defineProps<{
  task: TaskRecord
  selected: boolean
  changed: boolean
}>()

const { locale, messages } = useLocale()

const relationCount = computed(
  () => props.task.relations.userstories.length + props.task.relations.workflows.length,
)
const laneId = computed(() => resolveTaskBoardLane(props.task.status))
const statusLabel = computed(() => translateDashboardStatus(props.task.status, locale.value))
const statusBadgeColor = computed(() => {
  if (laneId.value === 'implemented') return 'primary'
  if (laneId.value === 'implementation' || laneId.value === 'sandbox') return 'success'
  if (['exploring', 'proposed', 'analysis', 'planned'].includes(laneId.value)) return 'warning'
  if (laneId.value === 'cancelled') return 'error'
  if (laneId.value === 'archived') return 'neutral'
  return 'secondary'
})

const statusTone = computed(() => {
  const map: Record<string, string> = {
    implementation: 'status-live',
    sandbox:        'status-sandbox',
    implemented:    'status-review',
    cancelled:      'status-cancelled',
    archived:       'status-archived',
    exploring:      'status-discovery',
    proposed:       'status-discovery',
    analysis:       'status-plan',
    planned:        'status-plan',
  }
  return map[laneId.value] ?? 'status-review'
})
</script>

<template>
  <div
    :class="[
      'task-card',
      statusTone,
      { 'task-card-selected': selected, 'task-card-changed': changed },
    ]"
  >
    <div class="task-card-topline">
      <UBadge color="neutral" variant="outline" class="task-card-id">
        {{ task.id }}
      </UBadge>
      <UBadge :color="statusBadgeColor" variant="subtle" size="sm">
        {{ statusLabel }}
      </UBadge>
    </div>

    <h3>{{ task.title }}</h3>

    <div class="task-card-context-row">
      <UBadge color="neutral" variant="soft" size="sm">{{ task.feature }}</UBadge>
      <span class="task-card-context-owner">{{ task.owner }}</span>
    </div>

    <div class="task-card-chip-row">
      <UBadge color="neutral" variant="outline" size="sm">
        {{ messages.taskCard.artifacts }} · {{ task.artifacts.length }}
      </UBadge>
      <UBadge color="neutral" variant="outline" size="sm">
        {{ messages.taskCard.relations }} · {{ relationCount }}
      </UBadge>
      <UBadge
        :color="task.warnings.length ? 'warning' : 'neutral'"
        variant="outline"
        size="sm"
      >
        {{ messages.taskCard.warnings }} · {{ task.warnings.length }}
      </UBadge>
    </div>

    <div class="task-card-footer">
      <span class="task-card-open-indicator">
        <UIcon name="i-lucide-arrow-up-right" class="task-card-open-icon" />
      </span>
    </div>
  </div>
</template>