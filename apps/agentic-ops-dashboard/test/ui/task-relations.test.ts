import { describe, expect, it } from 'vitest'

import { countMissingRelations, groupRelationReferences } from '../../app/utils/task-relations'

describe('task relations UI helpers', () => {
  it('groups relations by bucket and counts missing references', () => {
    const grouped = groupRelationReferences([
      { bucket: 'userstories', path: '.resources/userstories/a.md', exists: true },
      { bucket: 'workflows', path: '.resources/workflows/b.md', exists: false },
    ])

    expect(grouped.userstories).toHaveLength(1)
    expect(grouped.workflows).toHaveLength(1)
    expect(
      countMissingRelations([
        { bucket: 'userstories', path: '.resources/userstories/a.md', exists: true },
        { bucket: 'workflows', path: '.resources/workflows/b.md', exists: false },
      ]),
    ).toBe(1)
  })
})