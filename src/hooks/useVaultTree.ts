import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { parseVaultTree, type VaultTree } from '../utils/vaultTree'
import { bindVaultTreeStore, resetVaultTreeStore } from '../utils/vaultTreeStore'

async function loadVaultTree(vaultPath: string): Promise<VaultTree> {
  const load = isTauri() ? invoke : mockInvoke
  return parseVaultTree(await load('load_vault_tree', { vaultPath }))
}

async function saveVaultTree(vaultPath: string, tree: VaultTree): Promise<void> {
  const save = isTauri() ? invoke : mockInvoke
  await save('save_vault_tree', { vaultPath, tree })
}

/**
 * Load `tolaria/config/tree.yml` for the active vault and keep the module store in
 * sync (ADR 0188). Writes go back through the same store so the sidebar tree and
 * the file never disagree.
 */
export function useVaultTree(vaultPath: string): void {
  useEffect(() => {
    resetVaultTreeStore()
    let cancelled = false

    void loadVaultTree(vaultPath)
      .then((loaded) => {
        if (cancelled) return
        bindVaultTreeStore(loaded, (next) => {
          void saveVaultTree(vaultPath, next).catch((error) => {
            console.warn('Failed to save vault tree:', error)
          })
        })
      })
      .catch((error) => {
        console.warn('Failed to load vault tree:', error)
      })

    return () => {
      cancelled = true
      resetVaultTreeStore()
    }
  }, [vaultPath])
}
