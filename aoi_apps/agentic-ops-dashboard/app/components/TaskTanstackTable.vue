<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SortingState } from '@tanstack/vue-table'

import { useLocale } from '../composables/useLocale'
import type { TaskRecord } from '~/shared/types'

const props = withDefaults(
  defineProps<{
    tasks?: TaskRecord[]
    selectedTaskId?: string | null
  }>(),
  {
    tasks: () => [],
    selectedTaskId: null,
  }
)

const emit = defineEmits<{
  select: [taskId: string]
}>()

const { messages } = useLocale()
const globalFilter = ref('')
const ownerFilter = ref('all')
const statusFilter = ref('all')
const sorting = ref<SortingState>([])
const page = ref(1)
const pageSize = 8

/** Filtered data source based on facet selectors and search */
const filteredData = computed(() => {
  return props.tasks.filter((task) => {
    if (ownerFilter.value !== 'all' && task.owner !== ownerFilter.value) {
      return false
    }
    if (statusFilter.value !== 'all' && task.status !== statusFilter.value) {
      return false
    }
    if (globalFilter.value) {
      const q = globalFilter.value.toLowerCase()
      const matchId = task.id.toLowerCase().includes(q)
      const matchTitle = task.title.toLowerCase().includes(q)
      const matchFeature = (task.feature || '').toLowerCase().includes(q)
      const matchOwner = (task.owner || '').toLowerCase().includes(q)
      if (!matchId && !matchTitle && !matchFeature && !matchOwner) {
        return false
      }
    }
    return true
  })
})

const paginatedData = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredData.value.slice(start, start + pageSize)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / pageSize)))

/** Owner badge color mapping */
function getOwnerBadgeColor(role?: string): 'neutral' | 'info' | 'warning' | 'success' | 'secondary' {
  const r = (role || '').toLowerCase()
  if (r.includes('front') || r.includes('ui')) return 'info'
  if (r.includes('back') || r.includes('api')) return 'secondary'
  if (r.includes('devops') || r.includes('infra')) return 'warning'
  if (r.includes('qa') || r.includes('test')) return 'success'
  return 'neutral'
}

/** Status badge color mapping */
function getStatusBadgeColor(status: string): 'neutral' | 'info' | 'warning' | 'success' | 'error' {
  const s = status.toLowerCase()
  if (s.includes('comple') || s.includes('done')) return 'success'
  if (s.includes('prog') || s.includes('impl')) return 'info'
  if (s.includes('heal') || s.includes('block')) return 'warning'
  if (s.includes('fail') || s.includes('err')) return 'error'
  return 'neutral'
}

// Columns definition for TanStack Table / Nuxt UI UTable
const columns: TableColumn<TaskRecord>[] = [
  {
    accessorKey: 'id',
    header: 'Task ID',
  },
  {
    accessorKey: 'title',
    header: 'Title',
  },
  {
    accessorKey: 'feature',
    header: 'Feature',
  },
  {
    accessorKey: 'owner',
    header: 'Owner',
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
  {
    id: 'actions',
    header: 'Actions',
  },
]

// Unique owner options for filter dropdown
const ownerOptions = computed(() => {
  const owners = Array.from(new Set(props.tasks.map((t) => t.owner).filter(Boolean)))
  return [
    { label: 'All Owners', value: 'all' },
    ...owners.map((o) => ({ label: `@${o}`, value: o })),
  ]
})

// Unique status options for filter dropdown
const statusOptions = computed(() => {
  const statuses = Array.from(new Set(props.tasks.map((t) => t.status).filter(Boolean)))
  return [
    { label: 'All Statuses', value: 'all' },
    ...statuses.map((s) => ({ label: s, value: s })),
  ]
})
</script>

<template>
  <UCard variant="outline" class="backdrop-blur-xl">
    <!-- Toolbar: Search & Facet Filters -->
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-1 items-center gap-2 min-w-[240px]">
          <UInput
            v-model="globalFilter"
            icon="i-lucide-search"
            placeholder="Filter tasks by ID, title, feature..."
            class="w-full"
            size="sm"
          />
        </div>

        <div class="flex items-center gap-2">
          <USelect
            v-model="ownerFilter"
            :items="ownerOptions"
            size="sm"
            class="w-36"
          />
          <USelect
            v-model="statusFilter"
            :items="statusOptions"
            size="sm"
            class="w-40"
          />
        </div>
      </div>
    </template>

    <!-- Data Table -->
    <UTable
      :data="paginatedData"
      :columns="columns"
      class="text-xs"
      :ui="{
        tr: 'cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40 transition-colors',
      }"
      @select="(row: any) => emit('select', row.original.id)"
    >
      <template #id-cell="{ row }">
        <span
          class="font-mono font-semibold"
          :class="props.selectedTaskId === row.original.id ? 'text-primary underline font-bold' : 'text-primary'"
        >
          {{ row.original.id }}
        </span>
      </template>

      <template #title-cell="{ row }">
        <span class="font-medium text-neutral-900 dark:text-neutral-100 max-w-xs truncate block">
          {{ row.original.title }}
        </span>
      </template>

      <template #feature-cell="{ row }">
        <span class="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
          <UIcon name="i-lucide-layers" class="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          {{ row.original.feature || 'General' }}
        </span>
      </template>

      <template #owner-cell="{ row }">
        <UBadge
          :color="getOwnerBadgeColor(row.original.owner)"
          variant="subtle"
          size="xs"
        >
          @{{ row.original.owner || 'general' }}
        </UBadge>
      </template>

      <template #status-cell="{ row }">
        <UBadge
          :color="getStatusBadgeColor(row.original.status)"
          variant="outline"
          size="xs"
        >
          {{ row.original.status }}
        </UBadge>
      </template>

      <template #actions-cell="{ row }">
        <div class="text-right" @click.stop>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-external-link"
            @click="emit('select', row.original.id)"
          >
            Inspect
          </UButton>
        </div>
      </template>

      <template #empty>
        <div class="py-8 text-center text-neutral-400 font-mono text-xs italic">
          No tasks matching current filters.
        </div>
      </template>
    </UTable>

    <!-- Pagination Footer -->
    <template #footer>
      <div class="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <div class="flex items-center gap-1">
          <span>Showing</span>
          <strong class="text-neutral-900 dark:text-white font-mono">{{ paginatedData.length }}</strong>
          <span>of</span>
          <strong class="text-neutral-900 dark:text-white font-mono">{{ filteredData.length }}</strong>
          <span>tasks</span>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="outline"
            color="neutral"
            icon="i-lucide-chevron-left"
            :disabled="page <= 1"
            @click="page = Math.max(1, page - 1)"
          >
            Prev
          </UButton>
          <span class="font-mono text-neutral-700 dark:text-neutral-300">
            Page {{ page }} of {{ totalPages }}
          </span>
          <UButton
            size="xs"
            variant="outline"
            color="neutral"
            icon="i-lucide-chevron-right"
            :disabled="page >= totalPages"
            @click="page = Math.min(totalPages, page + 1)"
          >
            Next
          </UButton>
        </div>
      </div>
    </template>
  </UCard>
</template>
