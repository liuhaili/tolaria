import { CaretDown, CaretRight, Plus, Smiley } from '@phosphor-icons/react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react'
import type { VaultEntry } from '../types'
import { buildNoteTree, canAssignNoteParent, type NoteTreeNode } from '../utils/noteTree'
import { hasManagedVaultSegment } from '../utils/managedVaultPaths'
import { relativeVaultKey, vaultTreeIcon, withVaultTreeIcon, type VaultTree } from '../utils/vaultTree'
import { getVaultTree, subscribeVaultTree, updateVaultTree } from '../utils/vaultTreeStore'
import { Button } from './ui/button'
import { DiagramCreateButton } from './DiagramCreateButton'
import { EmojiPicker } from './EmojiPicker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { translate } from '../lib/i18n'
import { isEmoji } from '../utils/emoji'
import { trackEvent } from '../lib/telemetry'

const t = (key: Parameters<typeof translate>[1]) => translate('zh-CN', key)

function entryEmoji(tree: VaultTree, entry: VaultEntry): string {
  const icon = vaultTreeIcon(tree, entry.path) ?? entry.icon
  return icon && isEmoji(icon) ? icon : ''
}

interface NoteTreeProps {
  entries: VaultEntry[]
  vaultRootPath?: string
  onCreateNote?: () => void
  onCreateDiagram?: (title: string) => Promise<void>
  onSelectNote?: (entry: VaultEntry) => void
  onMoveNote?: (note: VaultEntry, parent: VaultEntry | null) => void | Promise<void>
}

function isManagedEntry(entry: VaultEntry): boolean {
  if (entry.isA === 'Type') return true
  return hasManagedVaultSegment(entry.path)
}

function NoteTreeRow({ depth, node, entries, tree, onSelectNote, onOpenContext, onEditEmoji }: {
  depth: number
  node: NoteTreeNode
  entries: VaultEntry[]
  tree: VaultTree
  onSelectNote?: (entry: VaultEntry) => void
  onOpenContext: (entry: VaultEntry, event: MouseEvent<HTMLButtonElement>) => void
  onEditEmoji: (entry: VaultEntry) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const draggable = useDraggable({ id: node.entry.path })
  const droppable = useDroppable({ id: node.entry.path })
  const activeEntry = entries.find((entry) => entry.path === draggable.active?.id)
  const isValidDrop = droppable.isOver && !!activeEntry && canAssignNoteParent(activeEntry, node.entry, entries, tree)
  const emoji = entryEmoji(tree, node.entry)

  return (
    <>
      <div className="group relative">
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
        <span className="size-5 shrink-0" aria-hidden="true" />
        <span className="truncate">{node.entry.title || node.entry.filename}</span>
      </Button>
      <Button type="button" variant="ghost" size="icon-xs"
        aria-label={t(emoji ? 'tree.emoji.change' : 'tree.emoji.add')}
        title={t(emoji ? 'tree.emoji.change' : 'tree.emoji.add')}
        className={`absolute top-1/2 size-5 -translate-y-1/2 p-0 text-base ${emoji ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100'}`}
        style={{ left: 36 + depth * 20 }}
        onClick={() => onEditEmoji(node.entry)}
      >{emoji || <Smiley size={17} />}</Button>
      </div>
      {expanded && node.children.map((child) => <NoteTreeRow key={child.entry.path} depth={depth + 1} node={child} entries={entries} tree={tree} onSelectNote={onSelectNote} onOpenContext={onOpenContext} onEditEmoji={onEditEmoji} />)}
    </>
  )
}

function NoteTreeRootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'note-tree-root' })
  return <div ref={setNodeRef} data-testid="note-tree-root-drop" className={`h-12 rounded ${isOver ? 'bg-accent/50 ring-1 ring-primary' : ''}`} />
}

export function NoteTree({ entries, vaultRootPath, onCreateNote, onCreateDiagram, onSelectNote, onMoveNote }: NoteTreeProps) {
  const tree = useSyncExternalStore(subscribeVaultTree, getVaultTree, getVaultTree)
  const visibleEntries = useMemo(() => entries.filter((entry) => !isManagedEntry(entry)), [entries])
  const nodes = useMemo(() => buildNoteTree(visibleEntries, tree), [visibleEntries, tree])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [draggedEntry, setDraggedEntry] = useState<VaultEntry | null>(null)
  const [contextEntry, setContextEntry] = useState<VaultEntry | null>(null)
  const [contextPosition, setContextPosition] = useState({ x: 0, y: 0 })
  const [emojiEntry, setEmojiEntry] = useState<VaultEntry | null>(null)
  const editEmoji = (entry: VaultEntry) => { setContextEntry(null); setEmojiEntry(entry) }
  const saveEmoji = (entry: VaultEntry, emoji: string) => {
    const key = relativeVaultKey(entry.path, vaultRootPath)
    if (!key || (emoji && !isEmoji(emoji))) return
    updateVaultTree(withVaultTreeIcon(getVaultTree(), key, emoji))
    trackEvent('tree_emoji_changed', { action: emoji ? 'set' : 'remove' })
    setEmojiEntry(null)
    setContextEntry(null)
  }
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
    <div className="px-1 py-1" data-testid="note-tree">
      <div className="flex items-center justify-end px-1 pb-1">
        {onCreateDiagram && <DiagramCreateButton onCreate={onCreateDiagram} />}
        {onCreateNote && <Button type="button" variant="ghost" size="icon-xs" aria-label="新建笔记" title="新建笔记" onClick={onCreateNote}><Plus size={16} /></Button>}
      </div>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={({ active }) => setDraggedEntry(visibleEntries.find((entry) => entry.path === active.id) ?? null)} onDragCancel={() => setDraggedEntry(null)} onDragEnd={handleDragEnd}>
          {nodes.map((node) => <NoteTreeRow key={node.entry.path} depth={0} node={node} entries={visibleEntries} tree={tree} onSelectNote={onSelectNote} onOpenContext={openContext} onEditEmoji={editEmoji} />)}
          <NoteTreeRootDropZone />
          <DragOverlay>{draggedEntry && <div className="rounded border border-border bg-popover px-3 py-2 text-sm shadow-md">{draggedEntry.title || draggedEntry.filename}</div>}</DragOverlay>
      </DndContext>
      {contextEntry && (
        <div role="menu" className="fixed z-[1100] min-w-32 rounded border border-border bg-popover p-1 shadow-md" style={{ left: contextPosition.x, top: contextPosition.y }}>
          <Button type="button" variant="ghost" className="h-8 w-full justify-start px-2 text-sm" onClick={() => { onSelectNote?.(contextEntry); setContextEntry(null) }}>打开笔记</Button>
          <Button type="button" variant="ghost" className="h-8 w-full justify-start px-2 text-sm" onClick={() => { if (onMoveNote) void onMoveNote(contextEntry, null); setContextEntry(null) }}>移到顶级</Button>
          <Button type="button" variant="ghost" className="h-8 w-full justify-start px-2 text-sm" onClick={() => editEmoji(contextEntry)}>{t(entryEmoji(tree, contextEntry) ? 'tree.emoji.change' : 'tree.emoji.add')}</Button>
          {entryEmoji(tree, contextEntry) && <Button type="button" variant="ghost" className="h-8 w-full justify-start px-2 text-sm" onClick={() => saveEmoji(contextEntry, '')}>{t('tree.emoji.remove')}</Button>}
        </div>
      )}
      <Dialog open={!!emojiEntry} onOpenChange={(open) => { if (!open) setEmojiEntry(null) }}>
        <DialogContent className="w-[360px] max-w-[calc(100vw-16px)] p-3" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('tree.emoji.choose')}</DialogTitle></DialogHeader>
          {emojiEntry && <EmojiPicker inline searchPlaceholder={t('tree.emoji.search')} emptyLabel={t('tree.emoji.empty')} onSelect={(emoji) => saveEmoji(emojiEntry, emoji)} onClose={() => setEmojiEntry(null)} />}
          {emojiEntry && entryEmoji(tree, emojiEntry) && <Button type="button" variant="ghost" onClick={() => saveEmoji(emojiEntry, '')}>{t('tree.emoji.remove')}</Button>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
