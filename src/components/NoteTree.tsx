import { CaretDown, CaretRight, Plus } from '@phosphor-icons/react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useState, useSyncExternalStore, type MouseEvent } from 'react'
import type { VaultEntry } from '../types'
import { buildNoteTree, canAssignNoteParent, type NoteTreeNode } from '../utils/noteTree'
import { hasManagedVaultSegment } from '../utils/managedVaultPaths'
import type { VaultTree } from '../utils/vaultTree'
import { getVaultTree, subscribeVaultTree } from '../utils/vaultTreeStore'
import { Button } from './ui/button'
import { NoteTitleIcon } from './NoteTitleIcon'
import { DiagramCreateButton } from './DiagramCreateButton'

interface NoteTreeProps {
  entries: VaultEntry[]
  onCreateNote?: () => void
  onCreateDiagram?: (title: string) => Promise<void>
  onSelectNote?: (entry: VaultEntry) => void
  onMoveNote?: (note: VaultEntry, parent: VaultEntry | null) => void | Promise<void>
}

function isManagedEntry(entry: VaultEntry): boolean {
  if (entry.isA === 'Type') return true
  return hasManagedVaultSegment(entry.path)
}

function NoteTreeRow({ depth, node, entries, tree, onSelectNote, onOpenContext }: {
  depth: number
  node: NoteTreeNode
  entries: VaultEntry[]
  tree: VaultTree
  onSelectNote?: (entry: VaultEntry) => void
  onOpenContext: (entry: VaultEntry, event: MouseEvent<HTMLButtonElement>) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const draggable = useDraggable({ id: node.entry.path })
  const droppable = useDroppable({ id: node.entry.path })
  const activeEntry = entries.find((entry) => entry.path === draggable.active?.id)
  const isValidDrop = droppable.isOver && !!activeEntry && canAssignNoteParent(activeEntry, node.entry, entries, tree)

  return (
    <>
      <Button
        ref={(element) => { draggable.setNodeRef(element); droppable.setNodeRef(element) }}
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start gap-2 rounded text-left text-[13px] font-medium text-foreground hover:bg-accent"
        style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 12 + depth * 20, paddingRight: 16, opacity: draggable.isDragging ? 0.45 : 1, outline: isValidDrop ? '1px solid var(--accent-blue)' : undefined }}
        data-testid={`note-tree-entry:${node.entry.path}`}
        onClick={() => onSelectNote?.(node.entry)}
        onContextMenu={(event) => onOpenContext(node.entry, event)}
        {...draggable.listeners}
        {...draggable.attributes}
      >
        {hasChildren ? (
          <span aria-hidden="true" className="-ml-1 flex size-4 shrink-0 items-center justify-center" onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value) }}>
            {expanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
          </span>
        ) : <span className="size-4 shrink-0" />}
        {node.entry.icon && <NoteTitleIcon icon={node.entry.icon} size={17} />}
        <span className="truncate">{node.entry.title || node.entry.filename}</span>
      </Button>
      {expanded && node.children.map((child) => <NoteTreeRow key={child.entry.path} depth={depth + 1} node={child} entries={entries} tree={tree} onSelectNote={onSelectNote} onOpenContext={onOpenContext} />)}
    </>
  )
}

function NoteTreeRootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'note-tree-root' })
  return <div ref={setNodeRef} data-testid="note-tree-root-drop" className={`h-12 rounded ${isOver ? 'bg-accent/50 ring-1 ring-primary' : ''}`} />
}

export function NoteTree({ entries, onCreateNote, onCreateDiagram, onSelectNote, onMoveNote }: NoteTreeProps) {
  const tree = useSyncExternalStore(subscribeVaultTree, getVaultTree, getVaultTree)
  const visibleEntries = entries.filter((entry) => !isManagedEntry(entry))
  const nodes = buildNoteTree(visibleEntries, tree)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [draggedEntry, setDraggedEntry] = useState<VaultEntry | null>(null)
  const [contextEntry, setContextEntry] = useState<VaultEntry | null>(null)
  const [contextPosition, setContextPosition] = useState({ x: 0, y: 0 })
  const openContext = (entry: VaultEntry, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setContextEntry(entry)
    setContextPosition({ x: event.clientX, y: event.clientY })
  }
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggedEntry(null)
    if (!over || !onMoveNote || active.id === over.id) return
    const note = visibleEntries.find((entry) => entry.path === active.id)
    const parent = over.id === 'note-tree-root' ? null : visibleEntries.find((entry) => entry.path === over.id) ?? null
    if (note && canAssignNoteParent(note, parent, visibleEntries, tree)) void onMoveNote(note, parent)
  }

  return (
    <div className="border-b border-border px-1 py-1" data-testid="note-tree">
      <div className="flex items-center justify-end px-1 pb-1">
        {onCreateDiagram && <DiagramCreateButton onCreate={onCreateDiagram} />}
        {onCreateNote && <Button type="button" variant="ghost" size="icon-xs" aria-label="新建笔记" title="新建笔记" onClick={onCreateNote}><Plus size={16} /></Button>}
      </div>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={({ active }) => setDraggedEntry(visibleEntries.find((entry) => entry.path === active.id) ?? null)} onDragCancel={() => setDraggedEntry(null)} onDragEnd={handleDragEnd}>
          {nodes.map((node) => <NoteTreeRow key={node.entry.path} depth={0} node={node} entries={visibleEntries} tree={tree} onSelectNote={onSelectNote} onOpenContext={openContext} />)}
          <NoteTreeRootDropZone />
          <DragOverlay>{draggedEntry && <div className="rounded border border-border bg-popover px-3 py-2 text-sm shadow-md">{draggedEntry.title || draggedEntry.filename}</div>}</DragOverlay>
      </DndContext>
      {contextEntry && (
        <div role="menu" className="fixed z-[1100] min-w-32 rounded border border-border bg-popover p-1 shadow-md" style={{ left: contextPosition.x, top: contextPosition.y }}>
          <Button type="button" variant="ghost" className="h-8 w-full justify-start px-2 text-sm" onClick={() => { onSelectNote?.(contextEntry); setContextEntry(null) }}>打开笔记</Button>
          <Button type="button" variant="ghost" className="h-8 w-full justify-start px-2 text-sm" onClick={() => { if (onMoveNote) void onMoveNote(contextEntry, null); setContextEntry(null) }}>移到顶级</Button>
        </div>
      )}
    </div>
  )
}
