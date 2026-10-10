import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { NOTE_TREE_PARENT_KEY } from '../utils/noteTree'
import { NoteTree } from './NoteTree'

afterEach(cleanup)

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
  it('saves an emoji through the Markdown frontmatter callback without opening the note', async () => {
    const note = entry('/vault/note.md')
    const save = vi.fn().mockResolvedValue(undefined)
    const onSelectNote = vi.fn()
    render(<NoteTree entries={[note]} onSetNoteEmoji={save} onSelectNote={onSelectNote} />)
    fireEvent.click(screen.getByRole('button', { name: '添加表情' }))
    fireEvent.click(screen.getAllByTestId('emoji-option')[0])
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ path: note.path }), expect.any(String)))
    expect(onSelectNote).not.toHaveBeenCalled()
  })

  it('removes the Markdown emoji through the frontmatter callback', async () => {
    const note = { ...entry('/vault/note.md'), icon: '📚' }
    const save = vi.fn().mockResolvedValue(undefined)
    render(<NoteTree entries={[note]} onSetNoteEmoji={save} />)
    fireEvent.contextMenu(screen.getByTestId('note-tree-entry:/vault/note.md'))
    fireEvent.click(screen.getByRole('button', { name: '移除表情' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ path: note.path }), ''))
  })
  it('renders child notes below their parent and opens the selected note', () => {
    const parent = entry('/vault/project.md')
    const child = entry('/vault/login.md', '[[project]]')
    const onSelectNote = vi.fn()
    render(<NoteTree entries={[parent, child]} onSelectNote={onSelectNote} />)

    expect(screen.getByTestId('note-tree-entry:/vault/login.md')).toHaveTextContent('login')
    fireEvent.click(screen.getByTestId('note-tree-entry:/vault/login.md'))
    expect(onSelectNote).toHaveBeenCalledWith(expect.objectContaining({ path: child.path }))
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
