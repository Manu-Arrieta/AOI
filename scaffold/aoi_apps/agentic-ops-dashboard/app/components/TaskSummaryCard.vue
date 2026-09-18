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
</script>

<template>
  <UCard
    variant="outline"
    :class="[
      'task-card cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md relative group',
      selected ? 'ring-2 ring-primary border-primary bg-primary/5 dark:bg-primary/10' : 'hover:border-primary/50',
      changed ? 'ring-2 ring-amber-400 animate-pulse' : '',
    ]"
    :ui="{
      body: 'p-3.5 sm:p-4 space-y-2.5',
    }"
  >
    <!-- Topline: ID & Status Badge -->
    <div class="flex items-center justify-between gap-2">
      <UBadge color="neutral" variant="outline" size="xs" class="font-mono font-semibold">
        {{ task.id }}
      </UBadge>
      <UBadge :color="statusBadgeColor" variant="subtle" size="xs">
        {{ statusLabel }}
      </UBadge>
    </div>

    <!-- Title -->
    <h3 class="font-semibold text-sm text-neutral-900 dark:text-white line-clamp-2 leading-snug">
      {{ task.title }}
    </h3>

    <!-- Context: Feature & Owner -->
    <div class="flex items-center justify-between gap-2 pt-1 text-xs">
      <UBadge color="neutral" variant="soft" size="xs">
        {{ task.feature }}
      </UBadge>
      <span class="text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">
        @{{ task.owner }}
      </span>
    </div>

    <!-- Chips: Artifacts, Relations, Warnings -->
    <div class="flex flex-wrap items-center gap-1.5 pt-1">
      <UBadge color="neutral" variant="subtle" size="xs">
        <UIcon name="i-lucide-files" class="w-3 h-3 mr-1 opacity-70" />
        {{ messages.taskCard.artifacts }} · {{ task.artifacts.length }}
      </UBadge>
      <UBadge color="neutral" variant="subtle" size="xs">
        <UIcon name="i-lucide-network" class="w-3 h-3 mr-1 opacity-70" />
        {{ messages.taskCard.relations }} · {{ relationCount }}
      </UBadge>
      <UBadge
        v-if="task.warnings.length"
        color="warning"
        variant="subtle"
        size="xs"
      >
        <UIcon name="i-lucide-alert-triangle" class="w-3 h-3 mr-1" />
        {{ messages.taskCard.warnings }} · {{ task.warnings.length }}
      </UBadge>
    </div>

    <!-- Footer: Open detail indicator -->
    <div class="flex items-center justify-end pt-1">
      <UIcon
        name="i-lucide-arrow-up-right"
        class="w-3.5 h-3.5 text-neutral-400 group-hover:text-primary transition-colors"
      />
    </div>
  </UCard>
</template>