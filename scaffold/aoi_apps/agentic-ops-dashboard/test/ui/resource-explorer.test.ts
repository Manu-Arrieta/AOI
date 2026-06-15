import { describe, expect, it } from 'vitest'

import { flattenResources, isProtectedResourceDirectory } from '../../app/utils/resource-tree'

describe('resource explorer UI helpers', () => {
  it('flattens nested resources and marks protected directories', () => {
    const flat = flattenResources([
      {
        name: 'userstories',
        path: '.resources/userstories',
        kind: 'directory',
        children: [
          {
            name: 'story.md',
            path: '.resources/userstories/story.md',
            kind: 'file',
          },
        ],
      },
    ])

    expect(flat).toHaveLength(2)
    expect(flat[1]?.depth).toBe(1)
    expect(isProtectedResourceDirectory('.resources/userstories')).toBe(true)
    expect(isProtectedResourceDirectory('.resources/research')).toBe(false)
  })
})