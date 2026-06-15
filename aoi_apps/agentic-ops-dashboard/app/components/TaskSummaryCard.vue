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
  if (laneId.value === 'implemented') {
    return 'primary'
  }

  if (laneId.value === 'implementation' || laneId.value === 'sandbox') {
    return 'success'
  }

  if (
    laneId.value === 'exploring'
    || laneId.value === 'proposed'
    || laneId.value === 'analysis'
    || laneId.value === 'planned'
  ) {
    return 'warning'
  }

  if (laneId.value === 'cancelled') {
    return 'error'
  }

  if (laneId.value === 'archived') {
    return 'neutral'
  }

  return 'secondary'
})

const statusTone = computed(() => {
  if (laneId.value === 'implementation') {
    return 'status-live'
  }

  if (laneId.value === 'sandbox') {
    return 'status-sandbox'
  }

  if (laneId.value === 'implemented') {
    return 'status-review'
  }

  if (laneId.value === 'cancelled') {
    return 'status-cancelled'
  }

  if (laneId.value === 'archived') {
    return 'status-archived'
  }

  if (laneId.value === 'exploring' || laneId.value === 'proposed') {
    return 'status-discovery'
  }

  if (laneId.value === 'analysis' || laneId.value === 'planned') {
    return 'status-plan'
  }

  return 'status-review'
})
</script>

<template>
  <UCard
    :class="['task-card', statusTone, { 'task-card-selected': selected, 'task-card-changed': changed }]"
    variant="soft"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <div class="task-card-topline">
      <UBadge color="neutral" variant="outline">{{ task.id }}</UBadge>
      <UBadge :color="statusBadgeColor" variant="subtle">{{ statusLabel }}</UBadge>
    </div>
    <h3>{{ task.title }}</h3>
    <div class="task-card-context-row">
      <UBadge color="neutral" variant="soft">{{ task.feature }}</UBadge>
      <span class="task-card-context-owner">{{ task.owner }}</span>
    </div>
    <div class="task-card-chip-row">
      <UBadge color="neutral" variant="outline">
        {{ messages.taskCard.artifacts }} · {{ task.artifacts.length }}
      </UBadge>
      <UBadge color="neutral" variant="outline">
        {{ messages.taskCard.relations }} · {{ relationCount }}
      </UBadge>
      <UBadge :color="task.warnings.length ? 'warning' : 'neutral'" variant="outline">
        {{ messages.taskCard.warnings }} · {{ task.warnings.length }}
      </UBadge>
    </div>

    <div class="task-card-footer">
      <span class="task-card-open-indicator">
        <UIcon name="i-lucide-arrow-up-right" class="task-card-open-icon" />
      </span>
    </div>
  </UCard>
</template>