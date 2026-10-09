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

describe('buildNoteTree with a tree.yml definition', () => {
  const tree = (nodes: Record<string, { parent: string | null; order: number | null; icon: string | null }>) => ({
    version: 1,
    nodes,
  })

  it('nests an entry that cannot carry frontmatter, such as a diagram', () => {
    const parent = entry('/vault/project.md')
    const diagram = entry('/vault/attachments/architecture.drawio')
    const definition = tree({ 'attachments/architecture.drawio': { parent: 'project.md', order: null, icon: 'blueprint' } })
    expect(buildNoteTree([parent, diagram], definition)).toEqual([
      { entry: parent, children: [{ entry: diagram, children: [] }] },
    ])
  })

  it('prefers the tree.yml parent over frontmatter', () => {
    const project = entry('/vault/project.md')
    const other = entry('/vault/other.md')
    const child = entry('/vault/child.md', '[[project]]')
    const definition = tree({ 'child.md': { parent: 'other.md', order: null, icon: null } })
    const nodes = buildNoteTree([project, other, child], definition)
    expect(nodes.map((node) => node.entry.path)).toEqual([project.path, other.path])
    expect(nodes[1].children.map((node) => node.entry.path)).toEqual([child.path])
  })

  it('renders a stale parent at the root instead of reviving frontmatter', () => {
    const project = entry('/vault/project.md')
    const child = entry('/vault/child.md', '[[project]]')
    const definition = tree({ 'child.md': { parent: 'deleted.md', order: null, icon: null } })
    expect(buildNoteTree([project, child], definition).map((node) => node.entry.path)).toEqual([
      project.path,
      child.path,
    ])
  })

  it('orders siblings only once one of them carries an explicit order', () => {
    const first = entry('/vault/first.md')
    const second = entry('/vault/second.md')
    expect(buildNoteTree([second, first]).map((node) => node.entry.path)).toEqual([second.path, first.path])

    const definition = tree({
      'first.md': { parent: null, order: 2, icon: null },
      'second.md': { parent: null, order: 1, icon: null },
    })
    expect(buildNoteTree([first, second], definition).map((node) => node.entry.path)).toEqual([
      second.path,
      first.path,
    ])
  })

  it('treats tree.yml parents as real edges when checking for cycles', () => {
    const project = entry('/vault/project.md')
    const child = entry('/vault/child.md')
    const definition = tree({ 'child.md': { parent: 'project.md', order: null, icon: null } })
    expect(canAssignNoteParent(project, child, [project, child], definition)).toBe(false)
    expect(canAssignNoteParent(child, project, [project, child], definition)).toBe(true)
  })
})
