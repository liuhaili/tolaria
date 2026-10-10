import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Plus } from '@phosphor-icons/react'
import { translate } from '../lib/i18n'
import {
  addViewTableFilter,
  addViewTableRow,
  changeViewTableColumnType,
  createViewTableColumn,
  defaultViewTableData,
  duplicateViewTableRow,
  moveViewTableColumn,
  moveViewTableRow,
  parseViewTableData,
  removeViewTableColumn,
  removeViewTableFilter,
  removeViewTableRow,
  serializeViewTableData,
  setViewTableCell,
  setViewTableOptionColor,
  setViewTableSort,
  updateViewTableColumn,
  updateViewTableFilter,
  viewTableVisibleRows,
  type ViewTableData,
  type ViewTableFilter,
  type ViewTableOptionColor,
} from '../utils/viewTableModel'
import { VIEW_TABLE_BLOCK_TYPE } from '../utils/viewTableMarkdown'
import { portableAttachmentPathFromAnyAssetUrl } from '../utils/vaultAttachments'
import { useActiveVaultPath } from './activeVaultPath'
import { dispatchRichEditorExternalChange } from './editorExternalChangeEvents'
import { useDocumentLocale } from './markdownHighlightControlState'
import { ViewTableGrid, type ViewTableGridActions } from './view-table/ViewTableGrid'
import { ViewTableToolbar } from './view-table/ViewTableToolbar'
import './ViewTableBlock.css'

const DEFAULT_MAX_HEIGHT = '30rem'

interface ViewTableBlockEditor {
  isEditable?: boolean
  /** BlockNote's file importer; saves into `vault/tolaria/attachments`. */
  uploadFile?: (file: File, blockId?: string) => Promise<unknown>
  updateBlock: (
    id: string,
    update: { type: typeof VIEW_TABLE_BLOCK_TYPE; props: { source: string } },
  ) => unknown
}

interface ViewTableBlockProps {
  block: { id: string; props: { source: string } }
  editor: ViewTableBlockEditor
}

/** BlockNote's `uploadFile` returns either a URL string or `{ props: { url } }`. */
function uploadedUrl(result: unknown): string | null {
  if (typeof result === 'string') return result === '' ? null : result
  if (typeof result !== 'object' || result === null) return null
  const props = Reflect.get(result, 'props')
  if (typeof props !== 'object' || props === null) return null
  const url = Reflect.get(props, 'url')
  return typeof url === 'string' && url !== '' ? url : null
}

/**
 * An inline data table that **owns its data**: rows and typed columns live in
 * the ```view fence itself, so the table travels with the note it is pasted
 * into. Editing a cell rewrites the block's own payload — it never touches
 * another note's frontmatter. See ADR 0193.
 */
export function ViewTableBlock({ block, editor }: ViewTableBlockProps) {
  const locale = useDocumentLocale()
  const vaultPath = useActiveVaultPath()
  const [search, setSearch] = useState('')

  // Newest fence payload, kept in a ref so every commit builds on the current
  // table instead of a render-time snapshot. Popover menus are portalled but
  // React still routes their clicks through the React tree, so a callback from
  // an earlier render can fire in the same tick as a fresh edit; deriving each
  // update from the live source makes such a late arrival a no-op rather than
  // an overwrite. Commits also advance the ref themselves, so the value is
  // correct even before the matching re-render reaches this effect.
  const sourceRef = useRef(block.props.source)
  useEffect(() => {
    sourceRef.current = block.props.source
  }, [block.props.source])

  const data = useMemo(
    () => parseViewTableData(block.props.source) ?? defaultViewTableData(),
    [block.props.source],
  )

  const commit = useCallback((update: (current: ViewTableData) => ViewTableData) => {
    const current = parseViewTableData(sourceRef.current) ?? defaultViewTableData()
    const serialized = serializeViewTableData(update(current))
    if (serialized === sourceRef.current) return
    sourceRef.current = serialized
    editor.updateBlock(block.id, { type: VIEW_TABLE_BLOCK_TYPE, props: { source: serialized } })
    dispatchRichEditorExternalChange(editor)
  }, [block.id, editor])

  const editable = editor.isEditable !== false

  // Importing a picture or an attachment goes through the editor's own upload
  // hook, so the file lands in the same `tolaria/attachments` folder the rest
  // of the vault uses. The stored value is the *portable* relative path, which
  // keeps the fence readable and the note usable on another machine.
  const uploadFile = useMemo(() => {
    const upload = editor.uploadFile
    if (typeof upload !== 'function') return undefined
    return async (file: File): Promise<string | null> => {
      const url = uploadedUrl(await upload(file, block.id))
      // A data URL would be copied verbatim into the fence, so a fallback
      // upload (no vault open) is refused instead of bloating the note.
      if (url === null || url.startsWith('data:')) return null
      return portableAttachmentPathFromAnyAssetUrl({ url }) ?? url
    }
  }, [block.id, editor])

  const visibleRows = useMemo(() => viewTableVisibleRows(data, search), [data, search])

  const actions = useMemo<ViewTableGridActions>(() => ({
    resizeColumn: (columnId, width) => commit(
      current => updateViewTableColumn(current, columnId, { width: width > 0 ? width : null }),
    ),
    renameColumn: (columnId, name) => commit(
      current => updateViewTableColumn(current, columnId, { name }),
    ),
    changeColumnType: (columnId, type) => commit(
      current => changeViewTableColumnType(current, columnId, type),
    ),
    changeColumnOptions: (columnId, options) => commit(
      current => updateViewTableColumn(current, columnId, { options }),
    ),
    changeOptionColor: (columnId, option, color: ViewTableOptionColor | null) => commit(
      current => setViewTableOptionColor(current, columnId, option, color),
    ),
    moveColumn: (columnId, offset) => commit(
      current => moveViewTableColumn(current, columnId, offset),
    ),
    resetColumnWidth: (columnId) => commit(
      current => updateViewTableColumn(current, columnId, { width: null }),
    ),
    removeColumn: (columnId) => commit(current => removeViewTableColumn(current, columnId)),
    addColumn: () => commit(current => createViewTableColumn(current, '', 'text')),
    changeCell: (rowIndex, columnId, value) => commit(
      current => setViewTableCell(current, rowIndex, columnId, value),
    ),
    addRow: () => commit(addViewTableRow),
    removeRow: (rowIndex) => commit(current => removeViewTableRow(current, rowIndex)),
    duplicateRow: (rowIndex) => commit(current => duplicateViewTableRow(current, rowIndex)),
    moveRow: (rowIndex, offset) => commit(
      current => moveViewTableRow(current, rowIndex, rowIndex + offset),
    ),
    sortColumn: (columnId, direction) => commit(
      current => setViewTableSort(current, { columnId, direction }),
    ),
    clearSort: () => commit(current => setViewTableSort(current, null)),
  }), [commit])

  const handleAddFilter = useCallback(() => {
    commit(addViewTableFilter)
  }, [commit])

  const handleUpdateFilter = useCallback((filterId: string, patch: Partial<Omit<ViewTableFilter, 'id'>>) => {
    commit(current => updateViewTableFilter(current, filterId, patch))
  }, [commit])

  const handleRemoveFilter = useCallback((filterId: string) => {
    commit(current => removeViewTableFilter(current, filterId))
  }, [commit])

  const handleClearSort = useCallback(() => {
    commit(current => setViewTableSort(current, null))
  }, [commit])

  const bodyStyle = data.height > 0
    ? ({ '--view-table-height': `${data.height}px`, '--view-table-max-height': `${data.height}px` } as CSSProperties)
    : ({ '--view-table-max-height': DEFAULT_MAX_HEIGHT } as CSSProperties)

  const shownCount = visibleRows.length
  const totalCount = data.rows.length

  return (
    // Form controls live in here. For `content: 'none'` blocks BlockNote's
    // node view `stopEvent` already hides every event from ProseMirror and
    // blurs the editor on mousedown, so the grid needs no extra guards —
    // which keeps react-data-grid's own React handlers working.
    <div
      className="view-table"
      contentEditable={false}
      data-testid="view-table-block"
    >
      <ViewTableToolbar
        title={data.title}
        locale={locale}
        search={search}
        shownCount={shownCount}
        totalCount={totalCount}
        columns={data.columns}
        filters={data.filters}
        sort={data.sort}
        editable={editable}
        onSearchChange={setSearch}
        onRenameTitle={(title) => commit(current => ({ ...current, title }))}
        onAddColumn={(name, type) => commit(current => createViewTableColumn(current, name, type))}
        onAddFilter={handleAddFilter}
        onUpdateFilter={handleUpdateFilter}
        onRemoveFilter={handleRemoveFilter}
        onClearSort={handleClearSort}
      />
      <div className="view-table__body" data-fixed-height={data.height > 0} style={bodyStyle}>
        <ViewTableGrid
          data={data}
          visibleRows={visibleRows}
          locale={locale}
          editable={editable}
          vaultPath={vaultPath}
          uploadFile={uploadFile}
          actions={actions}
        />
      </div>
      <div className="view-table__footer">
        <button
          type="button"
          className="view-table__footer-button"
          disabled={!editable}
          onClick={actions.addRow}
        >
          <Plus size={12} aria-hidden />
          {translate(locale, 'viewTable.newRow')}
        </button>
      </div>
    </div>
  )
}
