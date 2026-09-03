import { computed, ref } from 'vue'

export interface FactItem {
  entity: string
  key: string
  value: string
  namespace: string
}

export interface MemoirConcept {
  id: string
  name: string
  category: string
  summary: string
  dependencies: string[]
  tags: string[]
}

export function useMemoryExplorer() {
  const facts = ref<FactItem[]>([])
  const concepts = ref<MemoirConcept[]>([])
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)
  const selectedNamespace = ref<string>('all')
  const searchQuery = ref<string>('')

  const namespaces = computed(() => {
    const set = new Set<string>()
    facts.value.forEach((f) => set.add(f.namespace))
    return ['all', ...Array.from(set).sort()]
  })

  const filteredFacts = computed(() => {
    return facts.value.filter((f) => {
      const matchesNs = selectedNamespace.value === 'all' || f.namespace === selectedNamespace.value
      const q = searchQuery.value.toLowerCase().trim()
      const matchesQuery = !q || f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q) || f.entity.toLowerCase().includes(q)
      return matchesNs && matchesQuery
    })
  })

  const filteredConcepts = computed(() => {
    const q = searchQuery.value.toLowerCase().trim()
    if (!q) return concepts.value
    return concepts.value.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.dependencies.some((d) => d.toLowerCase().includes(q))
      )
    })
  })

  async function fetchFacts(entity?: string) {
    try {
      const res = await $fetch<{ success: boolean; facts?: FactItem[] }>('/api/memory/facts', {
        query: entity ? { entity } : {},
      })
      if (res.success && res.facts) {
        facts.value = res.facts
      }
    } catch (err: any) {
      console.warn('Could not load facts:', err.message)
    }
  }

  async function fetchMemoirs(memoir?: string) {
    try {
      const res = await $fetch<{ success: boolean; concepts?: MemoirConcept[] }>('/api/memory/memoirs', {
        query: memoir ? { memoir } : {},
      })
      if (res.success && res.concepts) {
        concepts.value = res.concepts
      }
    } catch (err: any) {
      console.warn('Could not load memoirs:', err.message)
    }
  }

  async function loadAll() {
    isLoading.value = true
    errorMessage.value = null
    try {
      await Promise.all([fetchFacts(), fetchMemoirs()])
    } finally {
      isLoading.value = false
    }
  }

  return {
    facts,
    concepts,
    isLoading,
    errorMessage,
    selectedNamespace,
    searchQuery,
    namespaces,
    filteredFacts,
    filteredConcepts,
    fetchFacts,
    fetchMemoirs,
    loadAll,
  }
}
