import { CaretDown, CaretRight, Plus, Smiley } from '@phosphor-icons/react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useMemo, useRef, useState, type MouseEvent } from 'react'
import type { VaultEntry } from '../types'
import { buildNoteTree, canAssignNoteParent, type NoteTreeNode } from '../utils/noteTree'
import { hasManagedVaultSegment } from '../utils/managedVaultPaths'
import { isMarkdownEntry } from '../utils/typeDefinitions'
import { Button } from './ui/button'
import { EmojiPicker } from './EmojiPicker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { translate } from '../lib/i18n'
import { isEmoji } from '../utils/emoji'
import { trackEvent } from '../lib/telemetry'

const t = (key: Parameters<typeof translate>[1]) => translate('zh-CN', key)

function entryEmoji(entry: VaultEntry): string {
  const icon = entry.icon
  return icon && isEmoji(icon) ? icon : ''
}

interface NoteTreeProps {
  entries: VaultEntry[]
  vaultRootPath?: string
  onCreateNote?: () => void
  onSetNoteEmoji?: (note: VaultEntry, emoji: string) => Promise<void>
  onSelectNote?: (entry: VaultEntry) => void
  onMoveNote?: (note: VaultEntry, parent: VaultEntry | null) => void | Promise<void>
}

function isManagedEntry(entry: VaultEntry): boolean {
  if (entry.isA === 'Type') return true
  return hasManagedVaultSegment(entry.path)
}

function NoteTreeRow({ depth, node, entries, onSelectNote, onOpenContext, onEditEmoji }: {
  depth: number
  node: NoteTreeNode
  entries: VaultEntry[]
  onSelectNote?: (entry: VaultEntry) => void
  onOpenContext: (entry: VaultEntry, event: MouseEvent<HTMLButtonElement>) => void
  onEditEmoji: (entry: VaultEntry) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const draggable = useDraggable({ id: node.entry.path })
  const droppable = useDroppable({ id: node.entry.path })
  const activeEntry = entries.find((entry) => entry.path === draggable.active?.id)
  const isValidDrop = droppable.isOver && !!activeEntry && canAssignNoteParent(activeEntry, node.entry, entries)
  const emoji = entryEmoji(node.entry)

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
      {expanded && node.children.map((child) => <NoteTreeRow key={child.entry.path} depth={depth + 1} node={child} entries={entries} onSelectNote={onSelectNote} onOpenContext={onOpenContext} onEditEmoji={onEditEmoji} />)}
    </>
  )
}

function NoteTreeRootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'note-tree-root' })
  return <div ref={setNodeRef} data-testid="note-tree-root-drop" className={`h-12 rounded ${isOver ? 'bg-accent/50 ring-1 ring-primary' : ''}`} />
}

export function NoteTree({ entries, onCreateNote, onSetNoteEmoji, onSelectNote, onMoveNote }: NoteTreeProps) {
  const visibleEntries = useMemo(() => entries.filter((entry) => isMarkdownEntry(entry) && /\.md$/i.test(entry.path) && !isManagedEntry(entry)), [entries])
  const nodes = useMemo(() => buildNoteTree(visibleEntries), [visibleEntries])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [draggedEntry, setDraggedEntry] = useState<VaultEntry | null>(null)
  const [contextEntry, setContextEntry] = useState<VaultEntry | null>(null)
  const [contextPosition, setContextPosition] = useState({ x: 0, y: 0 })
  const [emojiEntry, setEmojiEntry] = useState<VaultEntry | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [savingEmoji, setSavingEmoji] = useState(false)
  const savingEmojiRef = useRef(false)
  const editEmoji = (entry: VaultEntry) => { setContextEntry(null); setEmojiEntry(entry) }
  const saveEmoji = async (entry: VaultEntry, emoji: string) => {
    if (!onSetNoteEmoji || savingEmojiRef.current || (emoji && !isEmoji(emoji))) return
    savingEmojiRef.current = true
    setSavingEmoji(true)
    setSaveError(false)
    try {
      await onSetNoteEmoji(entry, emoji)
      trackEvent('tree_emoji_changed', { action: emoji ? 'set' : 'remove' })
      setEmojiEntry(null)
      setContextEntry(null)
    } catch { setSaveError(true) }
    finally { savingEmojiRef.current = false; setSavingEmoji(false) }
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
    if (note && canAssignNoteParent(note, parent, visibleEntries)) {
      setSaveError(false)
      void Promise.resolve(onMoveNote(note, parent)).catch(() => setSaveError(true))
    }
  }

  return (
    <div className="px-1 py-1" data-testid="note-tree">
      <div className="flex items-center justify-end px-1 pb-1">
        {onCreateNote && <Button type="button" variant="ghost" size="icon-xs" aria-label="新建笔记" title="新建笔记" onClick={onCreateNote}><Plus size={16} /></Button>}
      </div>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={({ active }) => setDraggedEntry(visibleEntries.find((entry) => entry.path === active.id) ?? null)} onDragCancel={() => setDraggedEntry(null)} onDragEnd={handleDragEnd}>
          {nodes.map((node) => <NoteTreeRow key={node.entry.path} depth={0} node={node} entries={visibleEntries} onSelectNote={onSelectNote} onOpenContext={openContext} onEditEmoji={editEmoji} />)}
          <NoteTreeRootDropZone />
          <DragOverlay>{draggedEntry && <div className="rounded border border-border bg-popover px-3 py-2 text-sm shadow-md">{draggedEntry.title || draggedEntry.filename}</div>}</DragOverlay>
      </DndContext>
      {contextEntry && (
        <div role="menu" className="fixed z-[1100] min-w-32 rounded border border-border bg-popover p-1 shadow-md" style={{ left: contextPosition.x, top: contextPosition.y }}>
          <Button type="button" variant="ghost" className="h-8 w-full justify-start px-2 text-sm" onClick={() => { onSelectNote?.(contextEntry); setContextEntry(null) }}>打开笔记</Button>
          <Button type="button" variant="ghost" className="h-8 w-full justify-start px-2 text-sm" onClick={() => { if (onMoveNote) void Promise.resolve(onMoveNote(contextEntry, null)).catch(() => setSaveError(true)); setContextEntry(null) }}>移到顶级</Button>
          <Button type="button" variant="ghost" className="h-8 w-full justify-start px-2 text-sm" onClick={() => editEmoji(contextEntry)}>{t(entryEmoji(contextEntry) ? 'tree.emoji.change' : 'tree.emoji.add')}</Button>
          {entryEmoji(contextEntry) && <Button type="button" variant="ghost" disabled={savingEmoji} className="h-8 w-full justify-start px-2 text-sm" onClick={() => void saveEmoji(contextEntry, '')}>{t('tree.emoji.remove')}</Button>}
        </div>
      )}
      {saveError && <p role="alert" className="px-2 text-sm text-destructive">{t('tree.saveError')}</p>}
      <Dialog open={!!emojiEntry} onOpenChange={(open) => { if (!open && !savingEmoji) setEmojiEntry(null) }}>
        <DialogContent className="w-[360px] max-w-[calc(100vw-16px)] p-3" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('tree.emoji.choose')}</DialogTitle></DialogHeader>
          {emojiEntry && <EmojiPicker inline searchPlaceholder={t('tree.emoji.search')} emptyLabel={t('tree.emoji.empty')} onSelect={(emoji) => void saveEmoji(emojiEntry, emoji)} onClose={() => { if (!savingEmojiRef.current) setEmojiEntry(null) }} />}
          {saveError && <p role="alert" className="text-sm text-destructive">{t('tree.saveError')}</p>}
          {emojiEntry && entryEmoji(emojiEntry) && <Button type="button" variant="ghost" disabled={savingEmoji} onClick={() => void saveEmoji(emojiEntry, '')}>{t('tree.emoji.remove')}</Button>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
