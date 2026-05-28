import { z } from 'zod'

export const relationResourcePathSchema = z
  .string()
  .min(1)
  .regex(/^\.resources\//, 'Relation paths must stay inside .resources/')

export const taskRelationsSchema = z
  .object({
    userstories: z.array(relationResourcePathSchema).default([]),
    workflows: z.array(relationResourcePathSchema).default([]),
  })
  .strict()

export type TaskRelations = z.infer<typeof taskRelationsSchema>
export type TaskRelationBucket = keyof TaskRelations

export interface RegistryFeatureRow {
  slug: string
  status: string
  tasks: number
  created: string
}

export interface RegistryTaskRow {
  id: string
  feature: string
  title: string
  status: string
  owner: string
  created: string
  closed: string | null
}

export interface ArtifactRecord {
  name: string
  path: string
  kind: 'file' | 'directory'
  extension: string | null
  size: number | null
  preview: string | null
}

export interface ResourceTreeNode {
  name: string
  path: string
  kind: 'file' | 'directory'
  children?: ResourceTreeNode[]
}

export interface TaskRelationReference {
  bucket: TaskRelationBucket
  path: string
  exists: boolean
}

export interface TaskRecord extends RegistryTaskRow {
  directoryPath: string
  artifacts: ArtifactRecord[]
  relations: TaskRelations
  relationReferences: TaskRelationReference[]
  warnings: string[]
}

export interface WorkspaceSnapshot {
  workspaceName: string
  generatedAt: string
  features: RegistryFeatureRow[]
  tasks: TaskRecord[]
  resources: ResourceTreeNode[]
  warnings: string[]
  counts: {
    features: number
    tasks: number
    activeTasks: number
  }
}

export interface WorkspaceEventPayload {
  id: string
  type: 'workspace:ready' | 'workspace:refresh'
  changedPath: string | null
  reason: string
  generatedAt: string
}