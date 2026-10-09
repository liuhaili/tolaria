import { memo, startTransition, useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from './ui/button'
import { EMOJI_GROUPS, EMOJIS_BY_GROUP, GROUP_SHORT_LABELS, searchEmojis, type EmojiEntry } from '../utils/emoji'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
  inline?: boolean
  searchPlaceholder?: string
  emptyLabel?: string
}

const EMOJI_BATCH_SIZE = 64

/** Let the opening frame paint, then append small, interruptible batches. */
function useProgressiveEmojiCount(total: number): number {
  const [count, setCount] = useState(EMOJI_BATCH_SIZE)
  useEffect(() => {
    if (count >= total) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        startTransition(() => setCount(current => Math.min(current + EMOJI_BATCH_SIZE, total)))
      }, count === EMOJI_BATCH_SIZE ? 250 : 100)
    })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [count, total])
  return Math.min(count, total)
}

const EmojiOptionButton = memo(function EmojiOptionButton({ entry, onSelect }: { entry: EmojiEntry; onSelect: (emoji: string) => void }) {
  return (
    <Button variant="ghost"
      type="button"
      key={entry.emoji}
      className="flex h-8 w-8 items-center justify-center rounded text-xl transition-colors hover:bg-accent"
      onClick={() => onSelect(entry.emoji)}
      title={entry.name}
      data-testid="emoji-option"
    >
      {entry.emoji}
    </Button>
  )
})

function EmojiSearchResults({
  entries,
  onSelect,
  emptyLabel,
}: {
  entries: EmojiEntry[]
  onSelect: (emoji: string) => void
  emptyLabel: string
}) {
  const visibleCount = useProgressiveEmojiCount(entries.length)
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-8 gap-0.5">
      {entries.slice(0, visibleCount).map(entry => <EmojiOptionButton key={entry.emoji} entry={entry} onSelect={onSelect} />)}
    </div>
  )
}

const EmojiGroupSection = memo(function EmojiGroupSection({
  group,
  onSelect,
  limit,
}: {
  group: string
  onSelect: (emoji: string) => void
  limit: number
}) {
  const emojis = EMOJIS_BY_GROUP.get(group)
  if (!emojis?.length) return null
  const label = (Reflect.get(GROUP_SHORT_LABELS, group) as string | undefined) ?? group

  return (
    <div>
      <div className="sticky top-0 z-10 bg-popover px-1 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="grid grid-cols-8 gap-0.5">
        {emojis.slice(0, limit).map(entry => <EmojiOptionButton key={entry.emoji} entry={entry} onSelect={onSelect} />)}
      </div>
    </div>
  )
})

function EmojiGroupedResults({ onSelect }: { onSelect: (emoji: string) => void }) {
  const total = EMOJI_GROUPS.reduce((sum, group) => sum + (EMOJIS_BY_GROUP.get(group)?.length ?? 0), 0)
  let remaining = useProgressiveEmojiCount(total)
  return EMOJI_GROUPS.map(group => {
    const limit = Math.min(remaining, EMOJIS_BY_GROUP.get(group)?.length ?? 0)
    remaining -= limit
    return limit > 0 ? <EmojiGroupSection key={group} group={group} limit={limit} onSelect={onSelect} /> : null
  })
}

export function EmojiPicker({ onSelect, onClose, inline = false, searchPlaceholder = 'Search emoji by name...', emptyLabel = 'No emojis found' }: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  // Close when clicking outside
  useEffect(() => {
    if (inline) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose, inline])

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji)
    onClose()
  }, [onSelect, onClose])

  const searchResults = search.trim() ? searchEmojis(search) : null
  const isSearching = searchResults !== null

  return (
    <div
      ref={containerRef}
      className={inline ? 'w-full bg-popover' : 'absolute z-50 w-[340px] rounded-lg border border-[var(--border-dialog)] bg-popover shadow-lg'}
      style={inline ? undefined : { left: 54, top: 0 }}
      data-testid="emoji-picker"
    >
      <div className="border-b border-border px-3 py-2">
        <Input
          ref={inputRef}
          type="text"
          className="h-8 border-0 bg-transparent px-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="emoji-picker-search"
        />
      </div>
      <div ref={scrollRef} className="max-h-[300px] overflow-y-auto p-2" data-testid="emoji-picker-grid">
        {isSearching ? (
          <EmojiSearchResults key={search} entries={searchResults} onSelect={handleSelect} emptyLabel={emptyLabel} />
        ) : (
          <EmojiGroupedResults onSelect={handleSelect} />
        )}
      </div>
    </div>
  )
}
