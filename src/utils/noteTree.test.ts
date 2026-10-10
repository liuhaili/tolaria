import { describe, expect, it } from 'vitest'
import type { VaultEntry } from '../types'
import { buildNoteTree, canAssignNoteParent, NOTE_TREE_PARENT_KEY } from './noteTree'

function entry(path: string, parent?: string): VaultEntry {
  return {
    path, filename: path.split('/').at(-1) ?? '', title: path.split('/').at(-1)?.replace('.md', '') ?? '',
    isA: null, aliases: [], belongsTo: [], relatedTo: [], status: null, archived: false,
    modifiedAt: null, createdAt: null, fileSize: 0, snippet: '', wordCount: 0, relationships: {},
    icon: null, color: null, order: null, sidebarLabel: null, template: null, sort: null, view: null,
    visible: true, organized: true, favorite: false, favoriteIndex: null, listPropertiesDisplay: [],
    outgoingLinks: [], hasH1: true, properties: parent ? { [NOTE_TREE_PARENT_KEY]: parent } : {},
  }
}

describe('buildNoteTree', () => {
  it('nests a note below its saved parent wikilink', () => {
    const parent = entry('/vault/project.md')
    const child = entry('/vault/login.md', '[[project]]')
    expect(buildNoteTree([parent, child])).toEqual([{ entry: parent, children: [{ entry: child, children: [] }] }])
  })

  it('keeps cyclic parent references at the root', () => {
    const first = entry('/vault/first.md', '[[second]]')
    const second = entry('/vault/second.md', '[[first]]')
    expect(buildNoteTree([first, second]).map((node) => node.entry.path)).toEqual([first.path, second.path])
  })

  it('rejects a drop that would make a note its own ancestor', () => {
    const parent = entry('/vault/project.md')
    const child = entry('/vault/login.md', '[[project]]')
    expect(canAssignNoteParent(parent, child, [parent, child])).toBe(false)
    expect(canAssignNoteParent(child, parent, [parent, child])).toBe(true)
  })
})
