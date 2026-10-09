import { EMPTY_VAULT_TREE, type VaultTree } from './vaultTree'

type SaveFn = (tree: VaultTree) => void
type Listener = () => void

let tree: VaultTree = EMPTY_VAULT_TREE
let saveFn: SaveFn | null = null
const listeners: Set<Listener> = new Set()

export function getVaultTree(): VaultTree {
  return tree
}

export function bindVaultTreeStore(initial: VaultTree, save: SaveFn): void {
  tree = initial
  saveFn = save
  notify()
}

export function resetVaultTreeStore(): void {
  tree = EMPTY_VAULT_TREE
  saveFn = null
  notify()
}

/** Replace the tree definition and persist it. Callers pass a pure result from `vaultTree.ts`. */
export function updateVaultTree(next: VaultTree): void {
  tree = next
  saveFn?.(next)
  notify()
}

export function subscribeVaultTree(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  for (const fn of listeners) fn()
}
