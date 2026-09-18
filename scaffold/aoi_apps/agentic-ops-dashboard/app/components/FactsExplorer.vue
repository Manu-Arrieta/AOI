<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { useLocale } from '../composables/useLocale'
import { useMemoryExplorer } from '../composables/useMemoryExplorer'

const {
  facts,
  isLoading,
  selectedNamespace,
  searchQuery,
  namespaces,
  filteredFacts,
  fetchFacts,
} = useMemoryExplorer()

const { messages } = useLocale()
const copiedKey = ref<string | null>(null)

onMounted(() => {
  fetchFacts()
})

function copyCliCommand(fact: any) {
  const cmd = `icm facts set "${fact.entity}" "${fact.key}" "${fact.value}"`
  navigator.clipboard.writeText(cmd)
  copiedKey.value = fact.key
  setTimeout(() => {
    copiedKey.value = null
  }, 2000)
}

const columns: TableColumn<any>[] = [
  { accessorKey: 'entity', header: 'Entity' },
  { accessorKey: 'namespace', header: 'Namespace' },
  { accessorKey: 'key', header: 'Fact Key' },
  { accessorKey: 'value', header: 'Value' },
  { id: 'actions', header: 'Actions' },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header Controls -->
    <UCard variant="subtle">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {{ messages.facts.eyebrow }}
            </span>
            <UBadge color="success" variant="subtle" size="xs" class="font-mono">
              {{ facts.length }} facts
            </UBadge>
          </div>
          <h2 class="text-lg font-bold text-neutral-900 dark:text-white mt-1">
            {{ messages.facts.title }}
          </h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {{ messages.facts.copy }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-refresh-cw"
            :loading="isLoading"
            @click="fetchFacts()"
          />
        </div>
      </div>
    </UCard>

    <!-- Filter & Search Toolbar -->
    <div class="flex flex-col sm:flex-row items-center gap-3">
      <div class="w-full sm:w-72">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          size="sm"
          :placeholder="messages.facts.searchPlaceholder"
          class="w-full font-mono text-xs"
        />
      </div>

      <!-- Namespace Chips -->
      <div class="flex items-center gap-1.5 overflow-x-auto w-full py-1">
        <UButton
          v-for="ns in namespaces"
          :key="ns"
          size="xs"
          :variant="selectedNamespace === ns ? 'solid' : 'subtle'"
          :color="selectedNamespace === ns ? 'success' : 'neutral'"
          class="font-mono whitespace-nowrap"
          @click="selectedNamespace = ns"
        >
          {{ ns === 'all' ? messages.facts.allNamespaces : ns }}
        </UButton>
      </div>
    </div>

    <!-- Facts Table -->
    <UCard variant="outline" :ui="{ body: 'p-0 sm:p-0 overflow-hidden' }">
      <div v-if="isLoading" class="p-8 text-center text-neutral-500 dark:text-neutral-400 font-mono text-xs">
        <UIcon name="i-lucide-loader-circle" class="animate-spin inline-block mr-2 w-4 h-4 text-primary" />
        Loading deterministic facts...
      </div>

      <div v-else-if="filteredFacts.length === 0" class="p-8 text-center text-neutral-500 dark:text-neutral-400 font-mono text-xs space-y-2">
        <div class="flex items-center justify-center gap-2">
          <UIcon name="i-lucide-search-x" class="w-4 h-4" />
          <span>{{ messages.facts.noFacts }}</span>
        </div>
        <p class="text-[11px] opacity-70">{{ messages.facts.cliHint }}</p>
      </div>

      <UTable
        v-else
        :data="filteredFacts"
        :columns="columns"
        class="font-mono text-xs"
      >
        <template #entity-cell="{ row }">
          <span class="text-emerald-600 dark:text-emerald-400 font-semibold">
            {{ row.original.entity }}
          </span>
        </template>

        <template #namespace-cell="{ row }">
          <UBadge color="neutral" variant="outline" size="xs">
            {{ row.original.namespace }}
          </UBadge>
        </template>

        <template #key-cell="{ row }">
          <span class="font-medium text-neutral-900 dark:text-neutral-100">
            {{ row.original.key }}
          </span>
        </template>

        <template #value-cell="{ row }">
          <span class="text-neutral-600 dark:text-neutral-300 break-all max-w-md block">
            {{ row.original.value }}
          </span>
        </template>

        <template #actions-cell="{ row }">
          <div class="text-right">
            <UButton
              size="xs"
              variant="subtle"
              :color="copiedKey === row.original.key ? 'success' : 'neutral'"
              :icon="copiedKey === row.original.key ? 'i-lucide-check' : 'i-lucide-copy'"
              @click="copyCliCommand(row.original)"
            >
              {{ copiedKey === row.original.key ? 'Copied' : 'Copy CLI' }}
            </UButton>
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
