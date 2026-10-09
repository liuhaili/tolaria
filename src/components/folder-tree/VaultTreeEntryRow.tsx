import { FileText } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VaultEntry } from '../../types'
import { NoteTitleIcon } from '../NoteTitleIcon'
import { getFolderDepthIndent, FOLDER_ROW_CONTENT_INSET } from './folderTreeLayout'

interface VaultTreeEntryRowProps {
  depth: number
  entry: VaultEntry
  onSelect: (entry: VaultEntry) => void
}

export function VaultTreeEntryRow({ depth, entry, onSelect }: VaultTreeEntryRowProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full justify-start gap-2 rounded text-left text-[13px] font-medium text-foreground hover:bg-accent"
      style={{
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: getFolderDepthIndent(depth) + FOLDER_ROW_CONTENT_INSET,
        paddingRight: 16,
      }}
      data-testid={`vault-tree-entry:${entry.path}`}
      title={entry.title}
      onClick={() => onSelect(entry)}
    >
      {entry.icon ? (
        <NoteTitleIcon icon={entry.icon} size={17} />
      ) : (
        <FileText size={17} className="shrink-0 text-muted-foreground" />
      )}
      <span className={cn('truncate', entry.archived && 'text-muted-foreground line-through')}>
        {entry.title || entry.filename}
      </span>
    </Button>
  )
}
