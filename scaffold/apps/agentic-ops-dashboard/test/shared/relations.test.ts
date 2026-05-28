import { describe, expect, it } from 'vitest'

import {
  buildTaskRelations,
  classifyResourcePath,
  mergeTaskRelations,
} from '../../shared/relations'

describe('relations helpers', () => {
  it('classifies resource paths by subtree', () => {
    expect(classifyResourcePath('.resources/userstories/story.md')).toBe('userstories')
    expect(classifyResourcePath('.resources/workflows/flow.md')).toBe('workflows')
    expect(classifyResourcePath('.tasks/feature/TASK-1/spec.md')).toBeNull()
  })

  it('builds deduplicated task relations from explicit resource links', () => {
    expect(
      buildTaskRelations([
        '.resources/userstories/story.md',
        '.resources/workflows/flow.md',
        '.resources/userstories/story.md',
      ]),
    ).toEqual({
      userstories: ['.resources/userstories/story.md'],
      workflows: ['.resources/workflows/flow.md'],
    })
  })

  it('merges existing and new relations without duplication', () => {
    expect(
      mergeTaskRelations(
        { userstories: ['.resources/userstories/a.md'], workflows: [] },
        { userstories: ['.resources/userstories/a.md'], workflows: ['.resources/workflows/b.md'] },
      ),
    ).toEqual({
      userstories: ['.resources/userstories/a.md'],
      workflows: ['.resources/workflows/b.md'],
    })
  })
})