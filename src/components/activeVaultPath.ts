import { useSyncExternalStore } from 'react'

/**
 * The vault the open editor belongs to.
 *
 * Editor blocks (the inline data table's picture/attachment columns, for one)
 * have to resolve `tolaria/attachments/…` references into asset URLs, but a
 * block only receives `{ block, editor }` — it never sees the vault root. This
 * tiny store carries the active root the same way `useDocumentLocale` reads the
 * active language off the document, instead of threading a prop through every
 * block spec.
 */
let activeVaultPath: string | undefined
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot(): string | undefined {
  return activeVaultPath
}

export function setActiveVaultPath(path: string | undefined): void {
  const trimmed = typeof path === 'string' ? path.trim() : ''
  const next = trimmed === '' ? undefined : trimmed
  if (next === activeVaultPath) return
  activeVaultPath = next
  for (const listener of listeners) listener()
}

export function useActiveVaultPath(): string | undefined {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
