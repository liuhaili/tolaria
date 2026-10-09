import type { VaultEntry } from '../types'
import { resolveEntry, wikilinkTarget } from './wikilink'

export const NOTE_TREE_PARENT_KEY = '_parent_note'

export interface NoteTreeNode {
  entry: VaultEntry
  children: NoteTreeNode[]
}

function parentReference(entry: VaultEntry): string | null {
  const value = entry.properties[NOTE_TREE_PARENT_KEY]
  return typeof value === 'string' && value.trim() ? value : null
}

function parentForEntry(entry: VaultEntry, entries: VaultEntry[]): VaultEntry | null {
  const reference = parentReference(entry)
  if (!reference) return null
  const parent = resolveEntry(entries, wikilinkTarget(reference), entry)
  return parent?.path === entry.path ? null : parent ?? null
}

function createsCycle(entry: VaultEntry, parentPath: string, parents: Map<string, string>): boolean {
  const visited = new Set<string>([entry.path])
  let currentPath: string | undefined = parentPath
  while (currentPath) {
    if (visited.has(currentPath)) return true
    visited.add(currentPath)
    currentPath = parents.get(currentPath)
  }
  return false
}

/** Whether assigning `parent` keeps the visual note hierarchy acyclic. */
export function canAssignNoteParent(
  note: VaultEntry,
  parent: VaultEntry | null,
  entries: VaultEntry[],
): boolean {
  if (!parent || parent.path === note.path) return parent?.path !== note.path
  const parents = new Map<string, string>()
  for (const entry of entries) {
    const savedParent = parentForEntry(entry, entries)
    if (savedParent) parents.set(entry.path, savedParent.path)
  }
  parents.set(note.path, parent.path)
  return !createsCycle(note, parent.path, parents)
}

/**
 * Order siblings by the note's `_order` frontmatter (lower first). When no sibling carries an
 * explicit order the input order is preserved, so existing vaults keep their
 * current arrangement until someone actually reorders something.
 */
function sortSiblings(nodes: NoteTreeNode[]): NoteTreeNode[] {
  const isOrdered = nodes.some((node) => node.entry.order !== null)
  if (!isOrdered) return nodes
  return [...nodes].sort((left, right) => {
    const orderLeft = left.entry.order
    const orderRight = right.entry.order
    if (orderLeft === orderRight) return 0
    return (orderLeft ?? Infinity) - (orderRight ?? Infinity)
  })
}

export function buildNoteTree(entries: VaultEntry[]): NoteTreeNode[] {
  const nodes = new Map(entries.map((entry) => [entry.path, { entry, children: [] as NoteTreeNode[] }]))
  const parents = new Map<string, string>()

  for (const entry of entries) {
    const parent = parentForEntry(entry, entries)
    if (parent) parents.set(entry.path, parent.path)
  }

  const roots: NoteTreeNode[] = []
  for (const entry of entries) {
    const node = nodes.get(entry.path)
    if (!node) continue
    const parentPath = parents.get(entry.path)
    if (!parentPath || createsCycle(entry, parentPath, parents)) {
      roots.push(node)
      continue
    }
    const parent = nodes.get(parentPath)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  for (const node of nodes.values()) {
    if (node.children.length > 1) {
      node.children.splice(0, node.children.length, ...sortSiblings(node.children))
    }
  }

  return sortSiblings(roots)
}
