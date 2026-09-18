<script setup lang="ts">
import { onMounted } from 'vue'
import { useLocale } from '../composables/useLocale'
import { useMemoryExplorer } from '../composables/useMemoryExplorer'

const {
  concepts,
  isLoading,
  searchQuery,
  filteredConcepts,
  fetchMemoirs,
} = useMemoryExplorer()

const { messages } = useLocale()

onMounted(() => {
  fetchMemoirs()
})

function getCategoryColor(category: string): 'info' | 'primary' | 'success' | 'warning' | 'neutral' {
  switch (category) {
    case 'Architecture': return 'info'
    case 'Process': return 'primary'
    case 'Substrate': return 'success'
    case 'Governance': return 'warning'
    default: return 'neutral'
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Controls -->
    <UCard variant="subtle">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              {{ messages.memoir.eyebrow }}
            </span>
            <UBadge color="info" variant="subtle" size="xs" class="font-mono">
              {{ concepts.length }} concepts
            </UBadge>
          </div>
          <h2 class="text-lg font-bold text-neutral-900 dark:text-white mt-1">
            {{ messages.memoir.title }}
          </h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {{ messages.memoir.copy }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-refresh-cw"
            :loading="isLoading"
            @click="fetchMemoirs()"
          />
        </div>
      </div>
    </UCard>

    <!-- Search Toolbar -->
    <div class="w-full sm:w-80">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        size="sm"
        :placeholder="messages.memoir.searchPlaceholder"
        class="w-full font-mono text-xs"
      />
    </div>

    <!-- Concepts Grid / DAG Cards -->
    <div v-if="isLoading" class="p-12 text-center text-neutral-500 dark:text-neutral-400 font-mono text-xs border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900/30">
      <UIcon name="i-lucide-loader-circle" class="animate-spin inline-block mr-2 w-4 h-4 text-primary" />
      Loading architectural concepts...
    </div>

    <div v-else-if="filteredConcepts.length === 0" class="p-12 text-center text-neutral-500 dark:text-neutral-400 font-mono text-xs border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900/30 flex items-center justify-center gap-2">
      <UIcon name="i-lucide-search-x" class="w-4 h-4" />
      <span>{{ messages.memoir.noConcepts }}</span>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard
        v-for="concept in filteredConcepts"
        :key="concept.id"
        variant="outline"
        class="hover:border-primary/50 transition-all group"
        :ui="{ body: 'space-y-3 p-4 sm:p-5' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-bold text-neutral-900 dark:text-white text-sm font-mono flex items-center gap-2">
              <UIcon name="i-lucide-landmark" class="w-4 h-4 text-primary shrink-0" />
              {{ concept.name }}
            </h3>
            <UBadge
              :color="getCategoryColor(concept.category)"
              variant="subtle"
              size="xs"
              class="font-mono mt-1.5"
            >
              {{ concept.category }}
            </UBadge>
          </div>
        </div>

        <p class="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
          {{ concept.summary }}
        </p>

        <!-- Dependencies -->
        <div v-if="concept.dependencies && concept.dependencies.length > 0" class="pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <span class="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block mb-1.5">
            ↳ {{ messages.memoir.dependencies }}:
          </span>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="dep in concept.dependencies"
              :key="dep"
              color="neutral"
              variant="subtle"
              size="xs"
              class="font-mono"
            >
              <UIcon name="i-lucide-corner-down-right" class="mr-1 text-cyan-500" />
              {{ dep }}
            </UBadge>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="concept.tags && concept.tags.length > 0" class="flex flex-wrap gap-1 pt-1">
          <span
            v-for="tag in concept.tags"
            :key="tag"
            class="text-[9px] font-mono text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            #{{ tag }}
          </span>
        </div>
      </UCard>
    </div>
  </div>
</template>
