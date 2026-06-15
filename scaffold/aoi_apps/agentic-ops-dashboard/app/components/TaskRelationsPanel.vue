<script setup lang="ts">
import { computed } from 'vue'

import type { TaskRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'
import { groupRelationReferences } from '~/utils/task-relations'

const props = defineProps<{
  task: TaskRecord
}>()

const { messages } = useLocale()

const groupedRelations = computed(() => groupRelationReferences(props.task.relationReferences))
</script>

<template>
  <UCard class="relation-panel" variant="soft" :ui="{ header: 'p-0 sm:p-0', body: 'px-0 pt-4 pb-0 sm:px-0 sm:pt-4 sm:pb-0' }">
    <template #header>
      <header class="mini-header">
        <h3>{{ messages.relationsPanel.title }}</h3>
        <UBadge color="neutral" variant="outline">{{ task.relationReferences.length }}</UBadge>
      </header>
    </template>

    <div v-if="!task.relationReferences.length" class="panel-empty panel-empty-tight">
      {{ messages.relationsPanel.empty }}
    </div>

    <div v-else class="relation-groups">
      <article class="relation-group">
        <div class="relation-group-header">
          <p class="eyebrow">{{ messages.relationsPanel.userstories }}</p>
          <UBadge color="neutral" variant="outline">{{ groupedRelations.userstories.length }}</UBadge>
        </div>
        <ul>
          <li v-for="relation in groupedRelations.userstories" :key="relation.path" :class="{ 'relation-stale': !relation.exists }">
            <span>{{ relation.path }}</span>
            <UBadge :color="relation.exists ? 'success' : 'error'" variant="subtle">
              {{ relation.exists ? messages.relationsPanel.linked : messages.relationsPanel.missing }}
            </UBadge>
          </li>
        </ul>
      </article>

      <article class="relation-group">
        <div class="relation-group-header">
          <p class="eyebrow">{{ messages.relationsPanel.workflows }}</p>
          <UBadge color="neutral" variant="outline">{{ groupedRelations.workflows.length }}</UBadge>
        </div>
        <ul>
          <li v-for="relation in groupedRelations.workflows" :key="relation.path" :class="{ 'relation-stale': !relation.exists }">
            <span>{{ relation.path }}</span>
            <UBadge :color="relation.exists ? 'success' : 'error'" variant="subtle">
              {{ relation.exists ? messages.relationsPanel.linked : messages.relationsPanel.missing }}
            </UBadge>
          </li>
        </ul>
      </article>
    </div>
  </UCard>
</template>