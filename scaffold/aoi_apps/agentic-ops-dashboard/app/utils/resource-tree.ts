import type { ResourceTreeNode } from '~/shared/types'

export interface FlattenedResourceNode extends ResourceTreeNode {
  depth: number
}

export function flattenResources(nodes: ResourceTreeNode[], depth = 0): FlattenedResourceNode[] {
  return nodes.flatMap((node) => {
    const current: FlattenedResourceNode = {
      ...node,
      depth,
    }

    if (node.kind !== 'directory' || !node.children?.length) {
      return [current]
    }

    return [current, ...flattenResources(node.children, depth + 1)]
  })
}

export function isProtectedResourceDirectory(path: string) {
  return ['.resources/userstories', '.resources/workflows'].includes(path)
}