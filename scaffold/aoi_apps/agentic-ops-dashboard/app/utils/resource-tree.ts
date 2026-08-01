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

// ─── UTree helpers ────────────────────────────────────────────────────────────

/**
 * Shape that UTree consumes for the folder-picker inside ResourceActionDialog.
 * Extends the generic TreeItem contract with the extra fields we need.
 */
export interface FolderTreeItem {
  label: string
  path: string
  kind: 'file' | 'directory'
  icon: string
  /** true → UTree renders the item as non-interactive (for file nodes) */
  disabled: boolean
  defaultExpanded?: boolean
  children?: FolderTreeItem[]
}

/**
 * Recursively maps ResourceTreeNode[] → FolderTreeItem[].
 * Nodes whose path is in `expandedPaths` get defaultExpanded = true.
 * Nodes under `disabledSubtreePath` (inclusive) get disabled = true.
 */
export function toFolderTreeItems(
  nodes: ResourceTreeNode[],
  expandedPaths: Set<string> = new Set(),
  disabledSubtreePath?: string,
): FolderTreeItem[] {
  return nodes.map(node => {
    const isUnderDisabledSubtree = disabledSubtreePath && (
      node.path === disabledSubtreePath ||
      node.path.startsWith(disabledSubtreePath + '/')
    )

    return {
      label: node.name,
      path: node.path,
      kind: node.kind,
      icon: node.kind === 'directory' ? 'i-lucide-folder' : 'i-lucide-file',
      disabled: node.kind === 'file' || Boolean(isUnderDisabledSubtree),
      defaultExpanded: expandedPaths.has(node.path),
      children: node.children?.length
        ? toFolderTreeItems(node.children, expandedPaths, disabledSubtreePath)
        : undefined,
    }
  })
}

/**
 * Returns the parent directory path of a given resource path.
 * E.g., ".resources/userstories/epic-1" -> ".resources/userstories"
 * E.g., ".resources" -> ".resources"
 */
export function getParentPath(path: string): string {
  if (!path || path === '.resources') return '.resources'
  const lastSlash = path.lastIndexOf('/')
  if (lastSlash === -1) return '.resources'
  const parent = path.substring(0, lastSlash)
  return parent || '.resources'
}

/**
 * Given a path like ".resources/foo/bar", returns a Set of ancestor paths:
 * { ".resources", ".resources/foo" }
 * Used to pre-expand the ancestor nodes of the anchorPath.
 */
export function getAncestorPaths(path: string): Set<string> {
  const parts = path.split('/')
  const ancestors = new Set<string>()
  for (let i = 1; i < parts.length; i++) {
    ancestors.add(parts.slice(0, i).join('/'))
  }
  return ancestors
}

/**
 * DFS search for the FolderTreeItem whose path === targetPath.
 * Returns undefined if not found.
 */
export function findTreeItem(
  items: FolderTreeItem[],
  targetPath: string,
): FolderTreeItem | undefined {
  for (const item of items) {
    if (item.path === targetPath) return item
    if (item.children) {
      const found = findTreeItem(item.children, targetPath)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Converts ResourceTreeNode[] → FolderTreeItem[] for the ResourceExplorer UTree.
 *
 * Differences from toFolderTreeItems:
 * - Includes ALL node kinds (files become disabled leaf nodes).
 * - All directory nodes are defaultExpanded = true.
 * - Does NOT create a synthetic root wrapper — operates on the top-level children
 *   of .resources/ directly, so the caller passes `resources` (the top-level array).
 * - Does NOT apply a disabledSubtreePath (no cycle prevention needed in explorer).
 */
export function toExplorerTreeItems(nodes: ResourceTreeNode[]): FolderTreeItem[] {
  return nodes.map(node => ({
    label: node.name,
    path: node.path,
    kind: node.kind,
    icon: node.kind === 'directory' ? 'i-lucide-folder' : 'i-lucide-file-text',
    disabled: node.kind === 'file',
    defaultExpanded: true,
    children: node.children?.length
      ? toExplorerTreeItems(node.children)
      : undefined,
  }))
}