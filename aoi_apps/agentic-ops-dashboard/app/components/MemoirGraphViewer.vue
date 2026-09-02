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

const categoryColors: Record<string, string> = {
  Architecture: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60',
  Process: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60',
  Substrate: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
  Governance: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
  default: 'bg-neutral-800 text-neutral-300 border-neutral-700',
}

function getCategoryClass(category: string): string {
  return categoryColors[category] || categoryColors.default
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Controls -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400">
            {{ messages.memoir.eyebrow }}
          </span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 font-mono">
            {{ concepts.length }} concepts
          </span>
        </div>
        <h2 class="text-lg font-bold text-white mt-1">
          {{ messages.memoir.title }}
        </h2>
        <p class="text-xs text-neutral-400 mt-0.5">
          {{ messages.memoir.copy }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <UButton
          color="gray"
          variant="ghost"
          size="sm"
          icon="i-lucide-refresh-cw"
          :loading="isLoading"
          @click="fetchMemoirs()"
        />
      </div>
    </div>

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
    <div v-if="isLoading" class="p-12 text-center text-neutral-400 font-mono text-xs border border-neutral-800 rounded-xl bg-neutral-900/30">
      <span class="inline-block animate-spin mr-2">⚙️</span> Loading architectural concepts...
    </div>

    <div v-else-if="filteredConcepts.length === 0" class="p-12 text-center text-neutral-400 font-mono text-xs border border-neutral-800 rounded-xl bg-neutral-900/30">
      🔍 {{ messages.memoir.noConcepts }}
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="concept in filteredConcepts"
        :key="concept.id"
        class="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-all space-y-3 relative group"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-bold text-white text-sm font-mono flex items-center gap-2">
              <span>🏛️</span> {{ concept.name }}
            </h3>
            <span
              class="inline-block mt-1 text-[10px] px-2 py-0.5 rounded border font-mono font-medium"
              :class="getCategoryClass(concept.category)"
            >
              {{ concept.category }}
            </span>
          </div>
        </div>

        <p class="text-xs text-neutral-300 leading-relaxed">
          {{ concept.summary }}
        </p>

        <!-- Dependencies -->
        <div v-if="concept.dependencies && concept.dependencies.length > 0" class="pt-2 border-t border-neutral-800/60">
          <span class="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block mb-1.5">
            ↳ {{ messages.memoir.dependencies }}:
          </span>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="dep in concept.dependencies"
              :key="dep"
              class="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 text-neutral-400 border border-neutral-800 flex items-center gap-1"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              {{ dep }}
            </span>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="concept.tags && concept.tags.length > 0" class="flex flex-wrap gap-1 pt-1">
          <span
            v-for="tag in concept.tags"
            :key="tag"
            class="text-[9px] font-mono text-neutral-500 hover:text-neutral-400"
          >
            #{{ tag }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
