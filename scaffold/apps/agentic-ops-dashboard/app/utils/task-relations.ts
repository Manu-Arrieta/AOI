import type { TaskRelationReference } from '~/shared/types'

export function groupRelationReferences(relationReferences: TaskRelationReference[]) {
  return {
    userstories: relationReferences.filter((relation) => relation.bucket === 'userstories'),
    workflows: relationReferences.filter((relation) => relation.bucket === 'workflows'),
  }
}

export function countMissingRelations(relationReferences: TaskRelationReference[]) {
  return relationReferences.filter((relation) => !relation.exists).length
}