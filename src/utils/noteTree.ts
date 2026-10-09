import type { VaultEntry } from '../types'
import { resolveEntry, wikilinkTarget } from './wikilink'
import {
  EMPTY_VAULT_TREE,
  normalizeVaultKey,
  vaultTreeOrder,
  vaultTreeParent,
  type VaultTree,
} from './vaultTree'

export const NOTE_TREE_PARENT_KEY = '_parent_note'

export interface NoteTreeNode {
  entry: VaultEntry
  children: NoteTreeNode[]
}

function parentReference(entry: VaultEntry): string | null {
  const value = entry.properties[NOTE_TREE_PARENT_KEY]
  return typeof value === 'string' && value.trim() ? value : null
}

/**
 * Resolve a `tree.yml` parent key into an entry. Unlike `_parent_note`, which
 * holds a wikilink, the tree file stores a vault-relative path, so match on the
 * normalized path suffix (the same tolerance as ADR 0035 wikilink resolution).
 */
function resolveTreeParent(entries: VaultEntry[], entry: VaultEntry, key: string): VaultEntry | null {
  const target = normalizeVaultKey(key)
  if (!target) return null
  return entries.find((candidate) => {
    if (candidate.path === entry.path) return false
    const candidateKey = normalizeVaultKey(candidate.path)
    return candidateKey === target || candidateKey.endsWith(`/${target}`)
  }) ?? null
}

/**
 * A `tree.yml` parent wins outright when present, even if it no longer resolves:
 * a stale record then renders at the root (ADR 0188) rather than silently
 * reviving the superseded frontmatter value.
 */
function parentForEntry(entry: VaultEntry, entries: VaultEntry[], tree: VaultTree): VaultEntry | null {
  const treeParent = vaultTreeParent(tree, entry.path)
  if (treeParent) return resolveTreeParent(entries, entry, treeParent)

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
  tree: VaultTree = EMPTY_VAULT_TREE,
): boolean {
  if (!parent || parent.path === note.path) return parent?.path !== note.path
  const parents = new Map<string, string>()
  for (const entry of entries) {
    const savedParent = parentForEntry(entry, entries, tree)
    if (savedParent) parents.set(entry.path, savedParent.path)
  }
  parents.set(note.path, parent.path)
  return !createsCycle(note, parent.path, parents)
}

/**
 * Order siblings by `tree.yml` order (lower first). When no sibling carries an
 * explicit order the input order is preserved, so existing vaults keep their
 * current arrangement until someone actually reorders something.
 */
function sortSiblings(nodes: NoteTreeNode[], tree: VaultTree): NoteTreeNode[] {
  const isOrdered = nodes.some((node) => vaultTreeOrder(tree, node.entry.path) !== null)
  if (!isOrdered) return nodes
  return [...nodes].sort((left, right) => {
    const orderLeft = vaultTreeOrder(tree, left.entry.path)
    const orderRight = vaultTreeOrder(tree, right.entry.path)
    if (orderLeft === orderRight) return 0
    return (orderLeft ?? Infinity) - (orderRight ?? Infinity)
  })
}

export function buildNoteTree(entries: VaultEntry[], tree: VaultTree = EMPTY_VAULT_TREE): NoteTreeNode[] {
  const nodes = new Map(entries.map((entry) => [entry.path, { entry, children: [] as NoteTreeNode[] }]))
  const parents = new Map<string, string>()

  for (const entry of entries) {
    const parent = parentForEntry(entry, entries, tree)
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
      node.children.splice(0, node.children.length, ...sortSiblings(node.children, tree))
    }
  }

  return sortSiblings(roots, tree)
}
