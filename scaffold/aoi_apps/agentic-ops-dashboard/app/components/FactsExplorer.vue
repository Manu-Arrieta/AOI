<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
</script>

<template>
  <div class="space-y-6">
    <!-- Header Controls -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
            {{ messages.facts.eyebrow }}
          </span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-mono">
            {{ facts.length }} facts
          </span>
        </div>
        <h2 class="text-lg font-bold text-white mt-1">
          {{ messages.facts.title }}
        </h2>
        <p class="text-xs text-neutral-400 mt-0.5">
          {{ messages.facts.copy }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <UButton
          color="gray"
          variant="ghost"
          size="sm"
          icon="i-lucide-refresh-cw"
          :loading="isLoading"
          @click="fetchFacts()"
        />
      </div>
    </div>

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
        <button
          v-for="ns in namespaces"
          :key="ns"
          type="button"
          class="px-2.5 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap cursor-pointer"
          :class="[
            selectedNamespace === ns
              ? 'bg-emerald-600 text-white font-medium shadow-sm'
              : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/60'
          ]"
          @click="selectedNamespace = ns"
        >
          {{ ns === 'all' ? messages.facts.allNamespaces : ns }}
        </button>
      </div>
    </div>

    <!-- Facts Table -->
    <div class="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/40">
      <div v-if="isLoading" class="p-8 text-center text-neutral-400 font-mono text-xs">
        <span class="inline-block animate-spin mr-2">⚙️</span> Loading deterministic facts...
      </div>

      <div v-else-if="filteredFacts.length === 0" class="p-8 text-center text-neutral-400 font-mono text-xs space-y-2">
        <p>🔍 {{ messages.facts.noFacts }}</p>
        <p class="text-[11px] text-neutral-500">{{ messages.facts.cliHint }}</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left font-mono text-xs">
          <thead class="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800">
            <tr>
              <th class="py-2.5 px-4 font-semibold">Entity</th>
              <th class="py-2.5 px-4 font-semibold">Namespace</th>
              <th class="py-2.5 px-4 font-semibold">Fact Key</th>
              <th class="py-2.5 px-4 font-semibold">Value</th>
              <th class="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="fact in filteredFacts"
              :key="fact.key"
              class="hover:bg-neutral-800/40 transition-colors"
            >
              <td class="py-2.5 px-4 text-emerald-400 font-semibold">{{ fact.entity }}</td>
              <td class="py-2.5 px-4">
                <span class="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 text-[10px]">
                  {{ fact.namespace }}
                </span>
              </td>
              <td class="py-2.5 px-4 text-white font-medium">{{ fact.key }}</td>
              <td class="py-2.5 px-4 text-neutral-300 break-all max-w-md">{{ fact.value }}</td>
              <td class="py-2.5 px-4 text-right">
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-[10px] transition-all cursor-pointer"
                  @click="copyCliCommand(fact)"
                >
                  {{ copiedKey === fact.key ? '✓ Copied' : '📋 Copy CLI' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
