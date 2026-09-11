<script setup lang="ts">
import { computed, ref, h } from 'vue'
import {
  useVueTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from '@tanstack/vue-table'

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
// `owner`, not `role`. The component was written against a `TaskItem` type
// that does not exist in shared/types.ts, reading `featureName` and `role` —
// two fields the registry parser never produces. TypeScript never caught it
// because the phantom import is a type-only import that esbuild strips, and
// no test ever mounted the component. In the running dashboard the Feature
// column therefore printed the literal 'General' for every row, the Assigned
// Role column printed 'general', and the role facet had exactly one option.
// The sibling views, TaskBoard and TaskSummaryCard, always used `feature` and
// `owner`; only this table invented its own names.
const ownerFilter = ref('all')
const statusFilter = ref('all')
const sorting = ref<SortingState>([])

/** Filtered data source based on facet selectors */
const filteredData = computed(() => {
  return props.tasks.filter((task) => {
    if (ownerFilter.value !== 'all' && task.owner !== ownerFilter.value) {
      return false
    }
    if (statusFilter.value !== 'all' && task.status !== statusFilter.value) {
      return false
    }
    return true
  })
})

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

// Columns definition for TanStack Table
const columns: ColumnDef<TaskRecord>[] = [
  {
    accessorKey: 'id',
    header: 'Task ID',
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: 'feature',
    header: 'Feature',
    cell: (info) => info.getValue() || 'General',
  },
  {
    accessorKey: 'owner',
    header: 'Owner',
    cell: (info) => info.getValue() || 'general',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) => info.getValue(),
  },
]

const table = useVueTable({
  get data() {
    return filteredData.value
  },
  columns,
  state: {
    get globalFilter() {
      return globalFilter.value
    },
    get sorting() {
      return sorting.value
    },
  },
  onSortingChange: (updaterOrValue) => {
    sorting.value = typeof updaterOrValue === 'function' ? updaterOrValue(sorting.value) : updaterOrValue
  },
  onGlobalFilterChange: (updaterOrValue) => {
    globalFilter.value = typeof updaterOrValue === 'function' ? updaterOrValue(globalFilter.value) : updaterOrValue
  },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  initialState: {
    pagination: {
      pageSize: 8,
    },
  },
})

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
  <div class="tanstack-task-matrix flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl ring-1 ring-white/5">
    <!-- Toolbar: Search & Facet Filters -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-1 items-center gap-2 min-w-[240px]">
        <UInput
          v-model="globalFilter"
          icon="i-lucide-search"
          placeholder="Filter tasks by ID, title, files..."
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

    <!-- Data Table Container -->
    <div class="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="px-4 py-3 cursor-pointer select-none hover:text-slate-200 transition-colors"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <div class="flex items-center gap-1">
                <span>{{ header.column.columnDef.header }}</span>
                <UIcon
                  v-if="header.column.getIsSorted() === 'asc'"
                  name="i-lucide-arrow-up"
                  class="text-primary w-3 h-3"
                />
                <UIcon
                  v-else-if="header.column.getIsSorted() === 'desc'"
                  name="i-lucide-arrow-down"
                  class="text-primary w-3 h-3"
                />
              </div>
            </th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-800/60">
          <tr v-if="!table.getRowModel().rows.length">
            <td colspan="6" class="px-4 py-8 text-center text-slate-500 italic">
              No tasks matching current filters.
            </td>
          </tr>

          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="hover:bg-slate-800/40 transition-colors cursor-pointer"
            :class="{ 'bg-primary-950/30 border-l-2 border-primary-500': props.selectedTaskId === row.original.id }"
            @click="emit('select', row.original.id)"
          >
            <!-- ID -->
            <td class="px-4 py-3 font-mono font-semibold text-primary-400 whitespace-nowrap">
              {{ row.original.id }}
            </td>

            <!-- Title -->
            <td class="px-4 py-3 font-medium text-slate-200 max-w-xs truncate">
              {{ row.original.title }}
            </td>

            <!-- Feature -->
            <td class="px-4 py-3 text-slate-400 whitespace-nowrap">
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-layers" class="w-3.5 h-3.5 text-slate-500" />
                {{ row.original.feature || 'General' }}
              </span>
            </td>

            <!-- Owner -->
            <td class="px-4 py-3 whitespace-nowrap">
              <UBadge
                :color="getOwnerBadgeColor(row.original.owner)"
                variant="subtle"
                size="xs"
              >
                @{{ row.original.owner || 'general' }}
              </UBadge>
            </td>

            <!-- Status -->
            <td class="px-4 py-3 whitespace-nowrap">
              <UBadge
                :color="getStatusBadgeColor(row.original.status)"
                variant="outline"
                size="xs"
              >
                {{ row.original.status }}
              </UBadge>
            </td>

            <!-- Action button -->
            <td class="px-4 py-3 text-right whitespace-nowrap" @click.stop>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-external-link"
                @click="emit('select', row.original.id)"
              >
                Inspect
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Footer -->
    <div class="flex items-center justify-between gap-2 text-xs text-slate-400 pt-1">
      <div class="flex items-center gap-1">
        <span>Showing</span>
        <strong class="text-slate-200">{{ table.getRowModel().rows.length }}</strong>
        <span>of</span>
        <strong class="text-slate-200">{{ filteredData.length }}</strong>
        <span>tasks</span>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-chevron-left"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()"
        >
          Prev
        </UButton>
        <span class="font-mono text-slate-300">
          Page {{ table.getState().pagination.pageIndex + 1 }} of {{ Math.max(1, table.getPageCount()) }}
        </span>
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-chevron-right"
          :disabled="!table.getCanNextPage()"
          @click="table.nextPage()"
        >
          Next
        </UButton>
      </div>
    </div>
  </div>
</template>
