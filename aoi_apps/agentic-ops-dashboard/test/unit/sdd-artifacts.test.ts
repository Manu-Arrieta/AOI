import { describe, expect, it } from 'vitest'
import {
  computeSddPipeline,
  resolveArtifactSddMeta,
  SDD_PHASES,
} from '../../app/utils/sdd-artifacts'

describe('SDD Phase Gates & Artifacts resolution', () => {
  it('correctly maps canonical artifacts to their respective phases and gates', () => {
    const proposal = resolveArtifactSddMeta('proposal.md')
    expect(proposal.phase).toBe('explore')
    expect(proposal.gate).toBe('Proposal Gate')
    expect(proposal.isGateArtifact).toBe(true)

    const spec = resolveArtifactSddMeta('spec.md')
    expect(spec.phase).toBe('specify')
    expect(spec.gate).toBe('Design Gate')
    expect(spec.isGateArtifact).toBe(true)

    const tasks = resolveArtifactSddMeta('tasks.md')
    expect(tasks.phase).toBe('plan')
    expect(tasks.gate).toBe('Implementation Gate')
    expect(tasks.isGateArtifact).toBe(true)

    const design = resolveArtifactSddMeta('design.md')
    expect(design.phase).toBe('plan')
    expect(design.gate).toBe('Implementation Gate')

    const iterations = resolveArtifactSddMeta('iterations')
    expect(iterations.phase).toBe('implement')
    expect(iterations.gate).toBe('TDD Gate')

    const verify = resolveArtifactSddMeta('verify-report.md')
    expect(verify.phase).toBe('verify')
    expect(verify.gate).toBe('Archive Gate')
    expect(verify.isGateArtifact).toBe(true)

    const archive = resolveArtifactSddMeta('archive-report.md')
    expect(archive.phase).toBe('archive')
    expect(archive.gate).toBeNull()
    expect(archive.isGateArtifact).toBe(false)
  })

  it('computes empty pipeline progress correctly', () => {
    const summary = computeSddPipeline([])
    expect(summary.totalArtifacts).toBe(0)
    expect(summary.gateArtifactCount).toBe(0)
    expect(summary.progressRatio).toBe(0)
    expect(summary.currentPhase).toBe('explore')
    expect(summary.phases.length).toBe(SDD_PHASES.length)
  })

  it('computes pipeline progress for intermediate task states', () => {
    const artifacts = [
      { name: 'context.md' },
      { name: 'proposal.md' },
      { name: 'spec.md' },
      { name: 'design.md' },
      { name: 'tasks.md' },
    ]

    const summary = computeSddPipeline(artifacts)
    expect(summary.totalArtifacts).toBe(5)
    // proposal (explore), spec (specify), design (plan), tasks (plan) -> 4 gate artifacts
    expect(summary.gateArtifactCount).toBe(4)
    expect(summary.currentPhase).toBe('plan')
    // 3 phases completed: explore, specify, plan -> 3 / 6 = 50%
    expect(summary.progressRatio).toBe(50)

    const exploreStatus = summary.phases.find((p) => p.phase === 'explore')
    expect(exploreStatus?.completed).toBe(true)
    expect(exploreStatus?.artifactCount).toBe(2) // context.md, proposal.md

    const planStatus = summary.phases.find((p) => p.phase === 'plan')
    expect(planStatus?.completed).toBe(true)
    expect(planStatus?.active).toBe(true)
    expect(planStatus?.artifactCount).toBe(2) // design.md, tasks.md

    const verifyStatus = summary.phases.find((p) => p.phase === 'verify')
    expect(verifyStatus?.completed).toBe(false)
  })

  it('handles fallback for unknown artifact names without crashing', () => {
    const custom = resolveArtifactSddMeta('custom-notes.txt')
    expect(custom.phase).toBe('plan')
    expect(custom.gate).toBeNull()
    expect(custom.isGateArtifact).toBe(false)
  })
})
