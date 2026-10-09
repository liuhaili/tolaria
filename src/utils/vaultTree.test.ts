import { describe, expect, it } from 'vitest'
import {
  EMPTY_VAULT_TREE,
  applyVaultTreeIcons,
  normalizeVaultKey,
  parseVaultTree,
  pruneVaultTree,
  relativeVaultKey,
  renameVaultTreeKey,
  vaultTreeIcon,
  vaultTreeOrder,
  vaultTreeParent,
  withVaultTreeIcon,
  withVaultTreeOrder,
  withVaultTreeParent,
  type VaultTree,
} from './vaultTree'

function tree(nodes: VaultTree['nodes']): VaultTree {
  return { version: 1, nodes }
}

describe('normalizeVaultKey', () => {
  it('converts backslashes and trims surrounding separators', () => {
    expect(normalizeVaultKey('\\docs\\readme.md')).toBe('docs/readme.md')
    expect(normalizeVaultKey('/docs/readme.md/')).toBe('docs/readme.md')
    expect(normalizeVaultKey(' docs/readme.md ')).toBe('docs/readme.md')
  })
})

describe('relativeVaultKey', () => {
  it('strips the vault root from an absolute entry path', () => {
    expect(relativeVaultKey('/vault/attachments/a.drawio', '/vault')).toBe('attachments/a.drawio')
    expect(relativeVaultKey('C:\\vault\\notes\\a.md', 'C:\\vault')).toBe('notes/a.md')
  })

  it('returns the path unchanged when it is outside the vault or no root is known', () => {
    expect(relativeVaultKey('/elsewhere/a.md', '/vault')).toBe('elsewhere/a.md')
    expect(relativeVaultKey('notes/a.md', undefined)).toBe('notes/a.md')
    expect(relativeVaultKey('/vault', '/vault')).toBe('')
  })
})

describe('parseVaultTree', () => {
  it('preserves an explicit empty icon so removal survives reload', () => {
    const parsed = parseVaultTree({ version: 1, nodes: { 'a.md': { icon: '' } } })
    expect(parsed.nodes['a.md']).toEqual({ parent: null, order: null, icon: '' })
    expect(vaultTreeIcon(parsed, '/vault/a.md')).toBe('')
  })
  it('returns the empty tree for a missing or malformed payload', () => {
    expect(parseVaultTree(null)).toBe(EMPTY_VAULT_TREE)
    expect(parseVaultTree('nope')).toBe(EMPTY_VAULT_TREE)
    expect(parseVaultTree({ nodes: 'nope' })).toBe(EMPTY_VAULT_TREE)
  })

  it('normalizes keys and drops records that carry no override', () => {
    const parsed = parseVaultTree({
      nodes: {
        '/docs/readme.md': { parent: ' project.md ', order: 2, icon: ' rocket ' },
        'empty.md': {},
        'bad.md': 'nope',
      },
    })
    expect(parsed.nodes['docs/readme.md']).toEqual({ parent: 'project.md', order: 2, icon: 'rocket' })
    expect(parsed.nodes['empty.md']).toBeUndefined()
    expect(parsed.nodes['bad.md']).toBeUndefined()
  })

  it('ignores non-finite orders and non-string parents', () => {
    const parsed = parseVaultTree({ nodes: { 'a.md': { parent: 7, order: Number.NaN, icon: 42 } } })
    expect(parsed.nodes).toEqual({})
  })
})

describe('tree lookups', () => {
  const subject = tree({ 'docs/readme.md': { parent: 'project.md', order: 3, icon: 'rocket' } })

  it('reads each field by path', () => {
    expect(vaultTreeParent(subject, 'docs/readme.md')).toBe('project.md')
    expect(vaultTreeOrder(subject, '/docs/readme.md')).toBe(3)
    expect(vaultTreeIcon(subject, 'docs\\readme.md')).toBe('rocket')
  })

  it('falls back to null for unrecorded paths', () => {
    expect(vaultTreeParent(subject, 'missing.md')).toBeNull()
    expect(vaultTreeOrder(subject, 'missing.md')).toBeNull()
    expect(vaultTreeIcon(subject, 'missing.md')).toBeNull()
  })
})

describe('tree writes', () => {
  it('sets a parent and keeps unrelated fields', () => {
    const before = tree({ 'a.md': { parent: null, order: 4, icon: 'rocket' } })
    const after = withVaultTreeParent(before, 'a.md', 'project.md')
    expect(after.nodes['a.md']).toEqual({ parent: 'project.md', order: 4, icon: 'rocket' })
    expect(before.nodes['a.md']?.parent).toBeNull()
  })

  it('removes a record once every field is cleared', () => {
    const cleared = withVaultTreeParent(tree({ 'a.md': { parent: 'p.md', order: null, icon: null } }), 'a.md', null)
    expect(cleared.nodes['a.md']).toBeUndefined()
  })

  it('ignores an empty path', () => {
    const before = tree({})
    expect(withVaultTreeOrder(before, '', 2)).toBe(before)
  })

  it('updates the existing key instead of duplicating it for an absolute path', () => {
    const after = withVaultTreeParent(tree({ 'docs/a.md': { parent: null, order: 4, icon: null } }), '/vault/docs/a.md', 'p.md')
    expect(Object.keys(after.nodes)).toEqual(['docs/a.md'])
    expect(after.nodes['docs/a.md']).toEqual({ parent: 'p.md', order: 4, icon: null })
  })

  it('keys a brand new record by the caller-supplied relative path', () => {
    const after = withVaultTreeParent(tree({}), 'notes/a.md', 'p.md')
    expect(after.nodes['notes/a.md']?.parent).toBe('p.md')
  })

  it('sets and clears order and icon', () => {    const ordered = withVaultTreeOrder(tree({}), 'a.md', 2)
    expect(vaultTreeOrder(ordered, 'a.md')).toBe(2)

    const iconed = withVaultTreeIcon(ordered, 'a.md', ' rocket ')
    expect(vaultTreeIcon(iconed, 'a.md')).toBe('rocket')

    const cleared = withVaultTreeIcon(iconed, 'a.md', null)
    expect(vaultTreeIcon(cleared, 'a.md')).toBeNull()
    expect(vaultTreeOrder(cleared, 'a.md')).toBe(2)
  })
})

describe('renameVaultTreeKey', () => {
  const source = tree({
    'docs/a.md': { parent: 'index.md', icon: 'star' },
    'docs/sub/b.md': { parent: 'docs/a.md' },
    'elsewhere.md': { parent: 'docs/a.md' },
  })

  it('moves the record, its subtree, and parent references', () => {
    const renamed = renameVaultTreeKey(source, 'docs', 'reference')
    expect(renamed.nodes['reference/a.md']).toEqual({ parent: 'index.md', icon: 'star' })
    expect(renamed.nodes['reference/sub/b.md']).toEqual({ parent: 'reference/a.md' })
    expect(renamed.nodes['elsewhere.md']).toEqual({ parent: 'reference/a.md' })
    expect(renamed.nodes['docs/a.md']).toBeUndefined()
  })

  it('returns the same tree for unrecorded or degenerate keys', () => {
    expect(renameVaultTreeKey(source, 'missing.md', 'renamed.md')).toBe(source)
    expect(renameVaultTreeKey(source, 'docs/a.md', 'docs/a.md')).toBe(source)
    expect(renameVaultTreeKey(source, '', 'x.md')).toBe(source)
  })
})

describe('pruneVaultTree', () => {
  it('drops records whose target is gone and keeps the rest', () => {
    const subject = tree({
      'keep.md': { parent: null, order: 1, icon: null },
      'gone.md': { parent: null, order: 2, icon: null },
    })
    expect(Object.keys(pruneVaultTree(subject, ['/vault/keep.md']).nodes)).toEqual(['keep.md'])
  })

  it('returns the same tree when nothing needs pruning', () => {
    const subject = tree({ 'keep.md': { parent: null, order: 1, icon: null } })
    expect(pruneVaultTree(subject, ['keep.md'])).toBe(subject)
  })
})

describe('applyVaultTreeIcons', () => {
  it('fills icons only where frontmatter did not provide one', () => {
    const entries = [
      { path: 'a.md', icon: 'star' },
      { path: 'diagram.drawio', icon: null },
    ]
    const applied = applyVaultTreeIcons(entries, tree({ 'diagram.drawio': { parent: null, order: null, icon: 'blueprint' } }))
    expect(applied[0].icon).toBe('star')
    expect(applied[1].icon).toBe('blueprint')
  })

  it('leaves entries untouched when the tree has no icon', () => {
    const entries = [{ path: 'photo.png', icon: null }]
    const applied = applyVaultTreeIcons(entries, EMPTY_VAULT_TREE)
    expect(applied[0]).toBe(entries[0])
  })

  it('treats an empty icon in the tree as an explicit clear', () => {
    const entries = [{ path: 'note.md', icon: '📚' }]
    const applied = applyVaultTreeIcons(entries, tree({ 'note.md': { parent: null, order: null, icon: '' } }))
    expect(applied[0].icon).toBeNull()
    expect(applied[0]).not.toBe(entries[0])
  })
})
