/**
 * Vault-root directories that Tolaria owns.
 *
 * These hold app-managed content rather than user notes, so they are hidden from
 * the folder tree, the note tree, and note indexing (ADR 0184). Keep this list in
 * one place: the same names were previously duplicated across the folder tree and
 * the note tree, so adding a directory in one spot silently left the other exposed.
 */

/** The managed workspace directory. Also holds the sidebar tree definition (ADR 0188). */
export const TOLARIA_WORKSPACE_DIR = 'tolaria'

export const MANAGED_VAULT_DIRS = ['attachments', TOLARIA_WORKSPACE_DIR, 'views'] as const

const MANAGED_VAULT_DIR_SET: ReadonlySet<string> = new Set(MANAGED_VAULT_DIRS)

function pathSegments(path: string): string[] {
  return path
    .replace(/\\/g, '/')
    .toLocaleLowerCase()
    .split('/')
    .filter(Boolean)
}

/** Whether any segment of `path` names a Tolaria-managed directory. */
export function hasManagedVaultSegment(path: string): boolean {
  return pathSegments(path).some((segment) => MANAGED_VAULT_DIR_SET.has(segment))
}

/** Whether a vault-relative path sits inside the Tolaria workspace directory. */
export function isInsideTolariaWorkspace(relativePath: string): boolean {
  return pathSegments(relativePath)[0] === TOLARIA_WORKSPACE_DIR
}
