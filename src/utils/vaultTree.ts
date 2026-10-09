/**
 * The sidebar tree definition that lives outside frontmatter (ADR 0188).
 *
 * Frontmatter is a Markdown-only envelope, so `.drawio`, images, PDFs, and every
 * other `fileKind: text | binary` entry could not carry a parent or an icon and
 * were stuck at the tree root. That metadata now lives in
 * `{vault}/tolaria/config/tree.yml`.
 *
 * The file is parsed in Rust (`serde_yaml`, alongside `scan_views`) and reaches
 * the renderer as JSON, so this module only normalizes that payload and offers
 * the pure read/write helpers the tree resolver needs. The filesystem remains the
 * source of truth for which entries exist (ADR 0002): records here describe
 * presentation only, and records whose target is gone are pruned.
 *
 * Keys in `tree.yml` are vault-relative, while entries carry absolute paths, so
 * lookups match the longest path suffix exactly as ADR 0035 wikilink resolution
 * does. Reads never invent a key; a write reuses the existing key when one
 * matches and otherwise stores the caller-supplied key.
 */

export const VAULT_TREE_CONFIG_PATH = 'tolaria/config/tree.yml'
export const VAULT_TREE_VERSION = 1

/** Presentation overrides for one entry. `null` means "not set in tree.yml". */
export interface VaultTreeNodeRecord {
  parent: string | null
  order: number | null
  icon: string | null
}

export interface VaultTree {
  version: number
  nodes: Record<string, VaultTreeNodeRecord>
}

export const EMPTY_VAULT_TREE: VaultTree = { version: VAULT_TREE_VERSION, nodes: {} }

const EMPTY_RECORD: VaultTreeNodeRecord = { parent: null, order: null, icon: null }

/** Vault-relative path with forward slashes and no surrounding whitespace or separators. */
export function normalizeVaultKey(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

/** Progressively shorter path suffixes, longest first: `a/b/c.md` → `a/b/c.md`, `b/c.md`, `c.md`. */
function pathSuffixes(path: string): string[] {
  const segments = normalizeVaultKey(path).split('/').filter(Boolean)
  return segments.map((_, index) => segments.slice(index).join('/'))
}

/** The stored key that applies to `path`, or null when no record matches. */
function resolveRecordKey(tree: VaultTree, path: string): string | null {
  for (const candidate of pathSuffixes(path)) {
    if (tree.nodes[candidate] !== undefined) return candidate
    const lowered = candidate.toLocaleLowerCase()
    if (tree.nodes[lowered] !== undefined) return lowered
  }
  return null
}

function recordFor(tree: VaultTree, path: string): VaultTreeNodeRecord {
  const key = resolveRecordKey(tree, path)
  return key ? tree.nodes[key] : EMPTY_RECORD
}

/**
 * Vault-relative key for an absolute entry path. Falls back to the path itself,
 * so callers that already hold a relative key can pass it through unchanged.
 */
export function relativeVaultKey(entryPath: string, vaultRoot: string | undefined): string {
  const path = normalizeVaultKey(entryPath)
  const root = normalizeVaultKey(vaultRoot ?? '')
  if (!root) return path
  if (path === root) return ''
  const prefix = `${root}/`
  if (path.startsWith(prefix)) return path.slice(prefix.length)
  if (path.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) return path.slice(prefix.length)
  return path
}

function parseRecord(value: unknown): VaultTreeNodeRecord | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const { parent, order, icon } = source
  return {
    parent: typeof parent === 'string' && parent.trim() ? normalizeVaultKey(parent) : null,
    order: typeof order === 'number' && Number.isFinite(order) ? order : null,
    icon: typeof icon === 'string' && (icon === '' || icon.trim()) ? icon.trim() : null,
  }
}

function isEmptyRecord(record: VaultTreeNodeRecord): boolean {
  return !record.parent && record.order === null && record.icon === null
}

/**
 * Defensively normalize the payload returned by the native tree reader. Malformed
 * records are dropped rather than throwing, so a hand-edited `tree.yml` degrades
 * to "no override" instead of breaking the sidebar.
 */
export function parseVaultTree(value: unknown): VaultTree {
  if (!value || typeof value !== 'object') return EMPTY_VAULT_TREE
  const source = value as Record<string, unknown>
  const rawNodes = source.nodes
  if (!rawNodes || typeof rawNodes !== 'object') return EMPTY_VAULT_TREE

  const nodes: Record<string, VaultTreeNodeRecord> = {}
  for (const [rawKey, rawValue] of Object.entries(rawNodes as Record<string, unknown>)) {
    const key = normalizeVaultKey(rawKey)
    const record = parseRecord(rawValue)
    if (!key || !record || isEmptyRecord(record)) continue
    nodes[key] = record
  }

  const version = typeof source.version === 'number' ? source.version : VAULT_TREE_VERSION
  return { version, nodes }
}

export function vaultTreeParent(tree: VaultTree, path: string): string | null {
  return recordFor(tree, path).parent
}

export function vaultTreeOrder(tree: VaultTree, path: string): number | null {
  return recordFor(tree, path).order
}

export function vaultTreeIcon(tree: VaultTree, path: string): string | null {
  return recordFor(tree, path).icon
}

function withRecord(tree: VaultTree, path: string, patch: Partial<VaultTreeNodeRecord>): VaultTree {
  const key = resolveRecordKey(tree, path) ?? normalizeVaultKey(path)
  if (!key) return tree

  const next: VaultTreeNodeRecord = { ...recordFor(tree, path), ...patch }
  const nodes = { ...tree.nodes }
  if (isEmptyRecord(next)) delete nodes[key]
  else nodes[key] = next

  return { ...tree, nodes }
}

/** Set or clear an entry's parent. Passing `null` returns it to the tree root. */
export function withVaultTreeParent(tree: VaultTree, path: string, parent: string | null): VaultTree {
  return withRecord(tree, path, { parent: parent ? normalizeVaultKey(parent) : null })
}

/** Set or clear an entry's sibling order. */
export function withVaultTreeOrder(tree: VaultTree, path: string, order: number | null): VaultTree {
  return withRecord(tree, path, { order })
}

/** Set an icon; '' explicitly hides a legacy icon, null restores the fallback. */
export function withVaultTreeIcon(tree: VaultTree, path: string, icon: string | null): VaultTree {
  return withRecord(tree, path, { icon: icon === null ? null : icon.trim() })
}

/**
 * Follow a rename or move: relocate the entry's own record (and the records of
 * everything under it) to the new key, and repoint parent references that
 * targeted the old key. Keys the file never mentioned are left alone — the
 * filesystem remains the source of truth for existence (ADR 0002/0188).
 */
export function renameVaultTreeKey(tree: VaultTree, oldKey: string, newKey: string): VaultTree {
  const from = normalizeVaultKey(oldKey)
  const to = normalizeVaultKey(newKey)
  if (!from || !to || from === to) return tree

  let changed = false
  const nodes: Record<string, VaultTreeNodeRecord> = {}
  for (const [key, record] of Object.entries(tree.nodes)) {
    let movedKey = key
    let movedRecord = record
    if (key === from) {
      movedKey = to
      changed = true
    } else if (key.startsWith(`${from}/`)) {
      movedKey = `${to}${key.slice(from.length)}`
      changed = true
    }
    if (movedRecord.parent === from) {
      movedRecord = { ...movedRecord, parent: to }
      changed = true
    } else if (movedRecord.parent?.startsWith(`${from}/`)) {
      movedRecord = { ...movedRecord, parent: `${to}${movedRecord.parent.slice(from.length)}` }
      changed = true
    }
    nodes[movedKey] = movedRecord
  }

  return changed ? { ...tree, nodes } : tree
}

/**
 * Drop records whose target is absent from `existingPaths`. Keeps `tree.yml` from
 * accumulating stale entries after external renames or deletions (ADR 0002).
 */export function pruneVaultTree(tree: VaultTree, existingPaths: Iterable<string>): VaultTree {
  const known = new Set<string>()
  for (const path of existingPaths) {
    for (const suffix of pathSuffixes(path)) known.add(suffix)
  }

  const nodes: Record<string, VaultTreeNodeRecord> = {}
  let changed = false
  for (const [key, record] of Object.entries(tree.nodes)) {
    if (known.has(normalizeVaultKey(key))) nodes[key] = record
    else changed = true
  }

  return changed ? { ...tree, nodes } : tree
}

/**
 * Fill in tree icons for entries that carry none. Frontmatter `_icon` keeps ADR
 * 0049 semantics and wins where it exists; `tree.yml` supplies the icon for
 * entries that could not store one (non-Markdown files).
 */
export function applyVaultTreeIcons<T extends { path: string; icon: string | null }>(
  entries: T[],
  tree: VaultTree,
): T[] {
  return entries.map((entry) => {
    if (entry.icon) return entry
    const icon = vaultTreeIcon(tree, entry.path)
    return icon ? { ...entry, icon } : entry
  })
}
