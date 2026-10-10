import { useRef, useState } from 'react'
import { FileArrowUp, Image as ImageIcon, Paperclip } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate, type AppLocale } from '../../lib/i18n'
import { openExternalUrl, openLocalFile } from '../../utils/url'
import type { ViewTableCellValue } from '../../utils/viewTableModel'
import { cellFileExtension, cellFileName, cellMediaPath, cellMediaUrl } from './cellMedia'
import { isolatePopoverEvents } from './popoverEventIsolation'

export interface ViewTableMediaCellProps {
  value: ViewTableCellValue
  locale: AppLocale
  editable: boolean
  /** The block's own vault, needed to resolve vault-relative media. */
  vaultPath?: string
  /** Imports a picked file into the vault; resolves to the stored value. */
  uploadFile?: (file: File) => Promise<string | null>
  onChange: (value: ViewTableCellValue) => void
}

/**
 * Keeps the picker open when focus wanders.
 *
 * Radix dismisses a popover as soon as focus leaves it, and react-data-grid
 * hands focus back to the cell a moment after the popover opened — so the
 * popover closed again inside the very click that opened it. A real outside
 * click (and Escape) still dismisses, which is all the picker needs.
 */
const keepOpenOnFocusOutside = (event: { preventDefault: () => void }) => {
  event.preventDefault()
}

function storedValue(value: ViewTableCellValue): string {
  return typeof value === 'string' ? value : ''
}

/** Opens a stored reference with the OS default app, or in the browser. */
function openMedia(value: string, vaultPath?: string) {
  const path = cellMediaPath(value, vaultPath)
  if (path !== null) {
    void openLocalFile(path, vaultPath).catch((error) => {
      console.warn('[view-table] Failed to open attachment:', error)
    })
    return
  }
  const url = cellMediaUrl(value, vaultPath)
  if (url !== null) {
    void openExternalUrl(url).catch((error) => {
      console.warn('[view-table] Failed to open media URL:', error)
    })
  }
}

/**
 * Shared picker body: the file the cell points at, a way to type a URL and a
 * way to import a local file into `vault/tolaria/attachments`.
 */
function MediaPickerBody({
  kind,
  locale,
  value,
  vaultPath,
  uploadFile,
  onChange,
  onDone,
}: {
  kind: 'image' | 'file'
  locale: AppLocale
  value: string
  vaultPath?: string
  uploadFile?: (file: File) => Promise<string | null>
  onChange: (value: ViewTableCellValue) => void
  onDone: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [draft, setDraft] = useState(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const commitDraft = () => {
    const next = draft.trim()
    if (next === value) return
    onChange(next === '' ? null : next)
  }

  const pickFile = async (file: File) => {
    if (!uploadFile) return
    setBusy(true)
    setError('')
    try {
      const stored = await uploadFile(file)
      if (stored === null) {
        setError(translate(locale, 'viewTable.uploadFailed'))
        return
      }
      onChange(stored)
      onDone()
    } catch (uploadError) {
      console.warn('[view-table] Failed to import a file into the vault:', uploadError)
      setError(translate(locale, 'viewTable.uploadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view-table__media-picker" {...isolatePopoverEvents}>
      <Input
        className="view-table__menu-input"
        value={draft}
        placeholder={translate(locale, 'viewTable.mediaUrl')}
        aria-label={translate(locale, 'viewTable.mediaUrl')}
        data-testid="view-table-media-url"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitDraft()
            onDone()
          }
        }}
      />

      <input
        ref={inputRef}
        className="view-table__media-file-input"
        type="file"
        accept={kind === 'image' ? 'image/*' : undefined}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Reset so picking the same file twice still fires a change event.
          event.target.value = ''
          if (file) void pickFile(file)
        }}
      />

      <div className="view-table__menu-actions">
        <button
          type="button"
          className="view-table__menu-action"
          disabled={busy || uploadFile === undefined}
          title={uploadFile === undefined ? translate(locale, 'viewTable.mediaTauriOnly') : undefined}
          data-testid="view-table-media-choose"
          onClick={() => inputRef.current?.click()}
        >
          <FileArrowUp size={12} aria-hidden />
          {busy
            ? translate(locale, 'viewTable.uploading')
            : translate(locale, kind === 'image' ? 'viewTable.pickImage' : 'viewTable.pickFile')}
        </button>
        {value !== '' && (
          <>
            <button
              type="button"
              className="view-table__menu-action"
              onClick={() => {
                openMedia(value, vaultPath)
              }}
            >
              <Paperclip size={12} aria-hidden />
              {translate(locale, 'viewTable.openFile')}
            </button>
            <div className="view-table__menu-separator" />
            <button
              type="button"
              className="view-table__menu-action view-table__menu-action--danger"
              data-testid="view-table-media-clear"
              onClick={() => {
                setDraft('')
                onChange(null)
                onDone()
              }}
            >
              {translate(locale, 'viewTable.clearValue')}
            </button>
          </>
        )}
      </div>

      {error !== '' && <div className="view-table__media-error">{error}</div>}
    </div>
  )
}

/** A picture cell: thumbnail in the grid, full picture in the popover. */
export function ImageCell({
  value,
  locale,
  editable,
  vaultPath,
  uploadFile,
  onChange,
}: ViewTableMediaCellProps) {
  const [open, setOpen] = useState(false)
  const text = storedValue(value)
  const url = cellMediaUrl(text, vaultPath)

  const thumb = text === '' ? null : (
    url === null
      ? <span className="view-table__media-missing">{cellFileName(text)}</span>
      : <img className="view-table__thumb" src={url} alt={cellFileName(text)} loading="lazy" />
  )

  if (!editable) {
    return text === '' ? null : <span className="view-table__media-static">{thumb}</span>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={text === '' ? 'view-table__media-trigger view-table__media-trigger--empty' : 'view-table__media-trigger'}
          aria-label={translate(locale, 'viewTable.pickImage')}
          data-testid="view-table-image-cell"
        >
          {thumb ?? (
            <>
              <ImageIcon size={13} aria-hidden />
              <span className="view-table__media-hint">{translate(locale, 'viewTable.addImage')}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="view-table__menu"
        data-testid="view-table-image-popover"
        onFocusOutside={keepOpenOnFocusOutside}
      >
        {url !== null && (
          <div className="view-table__media-preview">
            <img src={url} alt={cellFileName(text)} />
          </div>
        )}
        <MediaPickerBody
          kind="image"
          locale={locale}
          value={text}
          vaultPath={vaultPath}
          uploadFile={uploadFile}
          onChange={onChange}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

/** A file cell: a chip with the file name that opens the file with the OS. */
export function AttachmentCell({
  value,
  locale,
  editable,
  vaultPath,
  uploadFile,
  onChange,
}: ViewTableMediaCellProps) {
  const [open, setOpen] = useState(false)
  const text = storedValue(value)
  const name = cellFileName(text)
  const extension = cellFileExtension(text)

  if (!editable) {
    if (text === '') return null
    return (
      <button
        type="button"
        className="view-table__file-chip"
        title={name}
        onClick={() => openMedia(text, vaultPath)}
      >
        <Paperclip size={11} aria-hidden />
        <span className="view-table__file-name">{name}</span>
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={text === '' ? 'view-table__media-trigger view-table__media-trigger--empty' : 'view-table__file-chip'}
          title={name}
          aria-label={translate(locale, 'viewTable.pickFile')}
          data-testid="view-table-attachment-cell"
        >
          <Paperclip size={11} aria-hidden />
          {text === ''
            ? <span className="view-table__media-hint">{translate(locale, 'viewTable.addFile')}</span>
            : <span className="view-table__file-name">{name}</span>}
          {extension !== '' && <span className="view-table__file-ext">{extension}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="view-table__menu"
        data-testid="view-table-attachment-popover"
        onFocusOutside={keepOpenOnFocusOutside}
      >
        <MediaPickerBody
          kind="file"
          locale={locale}
          value={text}
          vaultPath={vaultPath}
          uploadFile={uploadFile}
          onChange={onChange}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
