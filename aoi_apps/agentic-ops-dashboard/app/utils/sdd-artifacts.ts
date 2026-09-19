import type { ArtifactRecord } from '~/shared/types'

export type SddPhaseId = 'explore' | 'specify' | 'plan' | 'implement' | 'verify' | 'archive'

export interface SddPhaseDef {
  id: SddPhaseId
  order: number
  icon: string
  color: 'info' | 'warning' | 'primary' | 'neutral' | 'success'
}

export const SDD_PHASES: readonly SddPhaseDef[] = [
  { id: 'explore', order: 1, icon: 'i-lucide-compass', color: 'info' },
  { id: 'specify', order: 2, icon: 'i-lucide-file-check', color: 'warning' },
  { id: 'plan', order: 3, icon: 'i-lucide-cpu', color: 'primary' },
  { id: 'implement', order: 4, icon: 'i-lucide-code', color: 'neutral' },
  { id: 'verify', order: 5, icon: 'i-lucide-shield-check', color: 'success' },
  { id: 'archive', order: 6, icon: 'i-lucide-archive', color: 'neutral' },
] as const

export interface SddArtifactMeta {
  phase: SddPhaseId
  phaseColor: 'info' | 'warning' | 'primary' | 'neutral' | 'success'
  gate: string | null
  gateBadgeColor: 'info' | 'warning' | 'primary' | 'success' | 'neutral' | null
  icon: string
  isGateArtifact: boolean
}

export function resolveArtifactSddMeta(filename: string): SddArtifactMeta {
  const lower = filename.toLowerCase()

  if (lower === 'proposal.md') {
    return {
      phase: 'explore',
      phaseColor: 'info',
      gate: 'Proposal Gate',
      gateBadgeColor: 'info',
      icon: 'i-lucide-file-signature',
      isGateArtifact: true,
    }
  }

  if (lower === 'context.md' || lower === 'requirement.md') {
    return {
      phase: 'explore',
      phaseColor: 'info',
      gate: null,
      gateBadgeColor: null,
      icon: 'i-lucide-compass',
      isGateArtifact: false,
    }
  }

  if (lower === 'spec.md') {
    return {
      phase: 'specify',
      phaseColor: 'warning',
      gate: 'Design Gate',
      gateBadgeColor: 'warning',
      icon: 'i-lucide-file-check',
      isGateArtifact: true,
    }
  }

  if (lower === 'design.md' || lower === 'tasks.md' || lower === 'implementation-plan.md') {
    return {
      phase: 'plan',
      phaseColor: 'primary',
      gate: 'Implementation Gate',
      gateBadgeColor: 'primary',
      icon: lower === 'tasks.md' ? 'i-lucide-list-todo' : lower === 'design.md' ? 'i-lucide-cpu' : 'i-lucide-map',
      isGateArtifact: true,
    }
  }

  if (lower === 'relations.json') {
    return {
      phase: 'plan',
      phaseColor: 'primary',
      gate: null,
      gateBadgeColor: null,
      icon: 'i-lucide-link-2',
      isGateArtifact: false,
    }
  }

  if (lower === 'iterations' || lower.startsWith('iteration')) {
    return {
      phase: 'implement',
      phaseColor: 'neutral',
      gate: 'TDD Gate',
      gateBadgeColor: 'neutral',
      icon: 'i-lucide-repeat',
      isGateArtifact: true,
    }
  }

  if (lower === 'verify-report.md') {
    return {
      phase: 'verify',
      phaseColor: 'success',
      gate: 'Archive Gate',
      gateBadgeColor: 'success',
      icon: 'i-lucide-shield-check',
      isGateArtifact: true,
    }
  }

  if (lower === 'archive-report.md' || lower === 'functional-docs.md') {
    return {
      phase: 'archive',
      phaseColor: 'neutral',
      gate: null,
      gateBadgeColor: null,
      icon: lower === 'functional-docs.md' ? 'i-lucide-book-open' : 'i-lucide-archive',
      isGateArtifact: false,
    }
  }

  // Fallback for custom or extra artifacts
  return {
    phase: 'plan',
    phaseColor: 'neutral',
    gate: null,
    gateBadgeColor: null,
    icon: 'i-lucide-file-text',
    isGateArtifact: false,
  }
}

export interface SddPhaseStatus {
  phase: SddPhaseId
  order: number
  icon: string
  color: 'info' | 'warning' | 'primary' | 'neutral' | 'success'
  completed: boolean
  active: boolean
  artifactCount: number
}

export interface SddPipelineSummary {
  phases: SddPhaseStatus[]
  currentPhase: SddPhaseId
  progressRatio: number
  totalArtifacts: number
  gateArtifactCount: number
}

export function computeSddPipeline(artifacts: readonly (Pick<ArtifactRecord, 'name'>)[]): SddPipelineSummary {
  const phaseArtifactCounts: Record<SddPhaseId, number> = {
    explore: 0,
    specify: 0,
    plan: 0,
    implement: 0,
    verify: 0,
    archive: 0,
  }

  let gateCount = 0

  for (const item of artifacts) {
    const meta = resolveArtifactSddMeta(item.name)
    phaseArtifactCounts[meta.phase] += 1
    if (meta.isGateArtifact) {
      gateCount += 1
    }
  }

  // Determine current active phase (furthest phase with artifacts, or next expected)
  let furthestIndex = -1
  for (let i = SDD_PHASES.length - 1; i >= 0; i--) {
    const phaseId = SDD_PHASES[i]!.id
    if (phaseArtifactCounts[phaseId] > 0) {
      furthestIndex = i
      break
    }
  }

  const currentPhase: SddPhaseId = furthestIndex >= 0 ? SDD_PHASES[furthestIndex]!.id : 'explore'

  let completedPhases = 0
  const phases: SddPhaseStatus[] = SDD_PHASES.map((def, idx) => {
    const count = phaseArtifactCounts[def.id]
    const hasArtifacts = count > 0
    if (hasArtifacts) {
      completedPhases += 1
    }
    const isActive = idx === furthestIndex || (furthestIndex === -1 && idx === 0)
    return {
      phase: def.id,
      order: def.order,
      icon: def.icon,
      color: def.color,
      completed: hasArtifacts,
      active: isActive,
      artifactCount: count,
    }
  })

  const progressRatio = Math.round((completedPhases / SDD_PHASES.length) * 100)

  return {
    phases,
    currentPhase,
    progressRatio,
    totalArtifacts: artifacts.length,
    gateArtifactCount: gateCount,
  }
}
