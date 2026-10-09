import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { NOTE_TREE_PARENT_KEY } from '../utils/noteTree'
import { NoteTree } from './NoteTree'

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
  it('renders child notes below their parent and opens the selected note', () => {
    const parent = entry('/vault/project.md')
    const child = entry('/vault/login.md', '[[project]]')
    const onSelectNote = vi.fn()
    render(<NoteTree entries={[parent, child]} onSelectNote={onSelectNote} />)

    expect(screen.getByTestId('note-tree-entry:/vault/login.md')).toHaveTextContent('login')
    fireEvent.click(screen.getByTestId('note-tree-entry:/vault/login.md'))
    expect(onSelectNote).toHaveBeenCalledWith(child)
  })

  it('offers a button to create a root note', () => {
    const parent = entry('/vault/project.md')
    const onCreateNote = vi.fn()
    render(<NoteTree entries={[parent]} onCreateNote={onCreateNote} />)

    fireEvent.click(screen.getByRole('button', { name: '新建笔记' }))
    expect(onCreateNote).toHaveBeenCalledOnce()
  })
})
