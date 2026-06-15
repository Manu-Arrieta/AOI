import { describe, expect, it } from 'vitest'

import { resolveTaskBoardLane, resolveTaskBoardLaneCollapsed } from '../../app/utils/task-board'

describe('task board helpers', () => {
  it('maps each registry legend status into its own board column', () => {
    expect(resolveTaskBoardLane('🔍 Exploring')).toBe('exploring')
    expect(resolveTaskBoardLane('📋 Propuesto')).toBe('proposed')
    expect(resolveTaskBoardLane('📐 En Analisis')).toBe('analysis')
    expect(resolveTaskBoardLane('🏗️ Planned')).toBe('planned')
    expect(resolveTaskBoardLane('⚙️ En Implementacion')).toBe('implementation')
    expect(resolveTaskBoardLane('✅ Implemented')).toBe('implemented')
    expect(resolveTaskBoardLane('📦 Archivado')).toBe('archived')
    expect(resolveTaskBoardLane('🔄 Active Sandbox')).toBe('sandbox')
    expect(resolveTaskBoardLane('❌ Cancelled')).toBe('cancelled')
  })

  it('falls back to planned when the workflow state is unknown', () => {
    expect(resolveTaskBoardLane('Needs triage')).toBe('planned')
  })

  it('auto-collapses empty columns unless the operator overrides them', () => {
    expect(resolveTaskBoardLaneCollapsed(0, null)).toBe(true)
    expect(resolveTaskBoardLaneCollapsed(0, 'expanded')).toBe(false)
    expect(resolveTaskBoardLaneCollapsed(2, null)).toBe(false)
    expect(resolveTaskBoardLaneCollapsed(2, 'collapsed')).toBe(true)
  })
})