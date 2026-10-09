import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { NOTE_TREE_PARENT_KEY } from '../utils/noteTree'
import { NoteTree } from './NoteTree'
import { bindVaultTreeStore, getVaultTree, resetVaultTreeStore } from '../utils/vaultTreeStore'
import { EMPTY_VAULT_TREE, parseVaultTree } from '../utils/vaultTree'

afterEach(() => { cleanup(); resetVaultTreeStore() })

function entry(path: string, parent?: string): VaultEntry {
  return {
    path, filename: path.split('/').at(-1) ?? '', title: path.split('/').at(-1)?.replace('.md', '') ?? '',
    isA: null, aliases: [], belongsTo: [], relatedTo: [], status: null, archived: false, modifiedAt: null,
    createdAt: null, fileSize: 0, snippet: '', wordCount: 0, relationships: {}, icon: null, color: null,
    order: null, sidebarLabel: null, template: null, sort: null, view: null, visible: true, organized: true,
    favorite: false, favoriteIndex: null, listPropertiesDisplay: [], outgoingLinks: [], hasH1: true,
    properties: parent ? { [NOTE_TREE_PARENT_KEY]: parent } : {},
  }
}

describe('NoteTree', () => {
  it('sets a Unicode emoji without opening the note and restores it after reload', () => {
    const save = vi.fn()
    bindVaultTreeStore(EMPTY_VAULT_TREE, save)
    const onSelectNote = vi.fn()
    const entries = [entry('/vault/diagram.drawio')]
    const view = render(<NoteTree entries={entries} vaultRootPath="/vault" onSelectNote={onSelectNote} />)
    fireEvent.click(screen.getByRole('button', { name: '添加表情' }))
    fireEvent.click(screen.getAllByTestId('emoji-option')[0])
    const stored = getVaultTree()
    const emoji = stored.nodes['diagram.drawio'].icon
    expect(emoji).toBeTruthy()
    expect(save).toHaveBeenCalledWith(stored)
    expect(onSelectNote).not.toHaveBeenCalled()
    view.unmount()
    bindVaultTreeStore(parseVaultTree(JSON.parse(JSON.stringify(stored))), save)
    render(<NoteTree entries={entries} vaultRootPath="/vault" />)
    expect(screen.getByRole('button', { name: '更换表情' })).toHaveTextContent(emoji!)
  })

  it('removes a legacy icon without changing the hierarchy or resurrecting it on reload', () => {
    const note = { ...entry('/vault/note.md'), icon: '📚' }
    bindVaultTreeStore({ version: 1, nodes: { 'note.md': { parent: 'parent.md', order: 2, icon: null } } }, vi.fn())
    const view = render(<NoteTree entries={[note]} vaultRootPath="/vault" />)
    fireEvent.contextMenu(screen.getByTestId('note-tree-entry:/vault/note.md'))
    fireEvent.click(screen.getByRole('button', { name: '移除表情' }))
    expect(getVaultTree().nodes['note.md']).toEqual({ parent: 'parent.md', order: 2, icon: '' })
    const stored = parseVaultTree(getVaultTree())
    view.unmount()
    bindVaultTreeStore(stored, vi.fn())
    render(<NoteTree entries={[note]} vaultRootPath="/vault" />)
    expect(screen.getByRole('button', { name: '添加表情' })).not.toHaveTextContent('📚')
  })
  it('renders child notes below their parent and opens the selected note', () => {
    const parent = entry('/vault/project.md')
    const child = entry('/vault/login.md', '[[project]]')
    const onSelectNote = vi.fn()
    render(<NoteTree entries={[parent, child]} onSelectNote={onSelectNote} />)

    expect(screen.getByTestId('note-tree-entry:/vault/login.md')).toHaveTextContent('login')
    fireEvent.click(screen.getByTestId('note-tree-entry:/vault/login.md'))
    expect(onSelectNote).toHaveBeenCalledWith(child)
  })

  it('fills every row icon slot with a default icon when the note has none', () => {
    const note = entry('/vault/plain.md')
    render(<NoteTree entries={[note]} />)

    const slot = screen.getByTestId('note-tree-icon:/vault/plain.md')
    expect(slot).toBeInTheDocument()
    expect(slot.querySelector('svg')).toBeTruthy()
  })

  it('prefers a named icon and an emoji over the default icon', () => {
    const named = { ...entry('/vault/named.md'), icon: 'star' }
    const emojiNote = { ...entry('/vault/emoji.md'), icon: '📚' }
    render(<NoteTree entries={[named, emojiNote]} />)

    // Named icon renders in the shared slot; emoji is drawn by the emoji button instead.
    expect(screen.getByTestId('note-tree-icon:/vault/named.md').querySelector('svg')).toBeTruthy()
    expect(screen.getByTestId('note-tree-icon:/vault/emoji.md').querySelector('svg')).toBeNull()
    expect(screen.getByTestId('note-tree-icon:/vault/emoji.md').textContent).toBe('')
    expect(screen.getByRole('button', { name: '更换表情' })).toHaveTextContent('📚')
  })

  it('offers a button to create a root note', () => {    const parent = entry('/vault/project.md')
    const onCreateNote = vi.fn()
    render(<NoteTree entries={[parent]} onCreateNote={onCreateNote} />)

    fireEvent.click(screen.getByRole('button', { name: '新建笔记' }))
    expect(onCreateNote).toHaveBeenCalledOnce()
  })
})
