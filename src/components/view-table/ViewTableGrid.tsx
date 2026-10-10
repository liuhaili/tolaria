import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { DataGrid } from 'react-data-grid'
import type {
  Column,
  ColumnWidths,
  RenderCellProps,
  RenderEditCellProps,
  RenderHeaderCellProps,
  RowsChangeData,
  SortColumn,
} from 'react-data-grid'
import 'react-data-grid/lib/styles.css'
import { ArrowDown, ArrowUp, Copy, DotsThree, Plus, Trash } from '@phosphor-icons/react'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate, type AppLocale } from '../../lib/i18n'
import {
  MAX_VIEW_TABLE_COLUMNS,
  VIEW_TABLE_MAX_COLUMN_WIDTH,
  VIEW_TABLE_MIN_COLUMN_WIDTH,
  viewTableCellText,
  type ViewTableCellValue,
  type ViewTableColumn,
  type ViewTableColumnType,
  type ViewTableData,
  type ViewTableOptionColor,
  type ViewTableRow,
  type ViewTableSortDirection,
} from '../../utils/viewTableModel'
import { VIEW_TABLE_TYPE_ICONS } from './columnTypes'
import { AttachmentCell, ImageCell } from './MediaCell'
import { isolatePopoverEvents } from './popoverEventIsolation'
import { ViewTableColumnMenu } from './ViewTableColumnMenu'
import { MultiSelectCell, SelectCell } from './ViewTableCell'

const GUTTER_WIDTH = 36
const ADD_COLUMN_WIDTH = 36
const GUTTER_KEY = '__gutter'
const ADD_COLUMN_KEY = '__add'

/**
 * The row object handed to react-data-grid. `__index` is the row's position in
 * `data.rows`, so edits can be committed through the data layer no matter how
 * the grid has sorted or filtered the display order.
 */
type GridRow = ViewTableRow & { readonly __index: number }

export interface ViewTableGridActions {
  resizeColumn: (columnId: string, width: number) => void
  renameColumn: (columnId: string, name: string) => void
  changeColumnType: (columnId: string, type: ViewTableColumnType) => void
  changeColumnOptions: (columnId: string, options: string[]) => void
  changeOptionColor: (columnId: string, option: string, color: ViewTableOptionColor | null) => void
  moveColumn: (columnId: string, offset: -1 | 1) => void
  resetColumnWidth: (columnId: string) => void
  removeColumn: (columnId: string) => void
  addColumn: () => void
  changeCell: (rowIndex: number, columnId: string, value: ViewTableCellValue) => void
  addRow: () => void
  removeRow: (rowIndex: number) => void
  duplicateRow: (rowIndex: number) => void
  moveRow: (rowIndex: number, offset: -1 | 1) => void
  sortColumn: (columnId: string, direction: ViewTableSortDirection) => void
  clearSort: () => void
}

export interface ViewTableGridProps {
  data: ViewTableData
  /** Rows after search, paired with their index in `data.rows`. */
  visibleRows: { row: ViewTableRow; index: number }[]
  locale: AppLocale
  editable: boolean
  /** Vault root, used to resolve `tolaria/attachments/…` media. */
  vaultPath?: string
  /** Imports a picked file into the vault; `undefined` in the browser build. */
  uploadFile?: (file: File) => Promise<string | null>
  actions: ViewTableGridActions
}

/** Column types whose cells are edited through their own popover, not RDG. */
const POPOVER_CELL_TYPES = new Set<ViewTableColumnType>([
  'checkbox',
  'select',
  'multiSelect',
  'image',
  'attachment',
])

function columnWidth(column: ViewTableColumn): number {
  if (column.width !== null) return column.width
  if (column.type === 'checkbox') return 92
  if (column.type === 'image') return 140
  if (column.type === 'attachment') return 200
  return 180
}

function safeUrlHref(text: string): string | null {
  return /^https?:\/\//i.test(text) ? text : null
}

/* ------------------------------------------------------------------ *
 * Editors
 *
 * react-data-grid beta.61 only treats a column as editable when it has
 * `renderEditCell`, and its built-in text editor pushes every keystroke
 * through `onRowChange` — which would commit the markdown fence on each
 * character. This editor keeps a local draft and only commits on
 * Enter/Tab/blur, so the block update happens once per edit.
 * ------------------------------------------------------------------ */

function DraftTextEditor({
  row,
  column,
  onRowChange,
  onClose,
  numeric = false,
}: RenderEditCellProps<GridRow> & { numeric?: boolean }) {
  const [draft, setDraft] = useState(() => String(row[column.key] ?? ''))
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const commitDraft = () => {
    const next = draft === '' ? null : draft
    if (next !== (row[column.key] ?? null)) {
      // commitChanges=true: this beta only persists the row when the change is
      // committed inline; staging alone is lost to a stale closure when the
      // grid's own Enter/blur handlers close the editor afterwards.
      onRowChange({ ...row, [column.key]: next }, true)
    } else {
      onClose(true, false)
    }
  }

  return (
    <input
      ref={inputRef}
      className="view-table__cell-input"
      value={draft}
      inputMode={numeric ? 'decimal' : undefined}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitDraft}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'Tab') commitDraft()
      }}
    />
  )
}

function DateCellEditor({ row, column, onRowChange, onClose }: RenderEditCellProps<GridRow>) {
  const initial = viewTableCellText(row[column.key] ?? null, 'date')
  return (
    <input
      type="date"
      autoFocus
      className="view-table__cell-input"
      defaultValue={initial}
      onChange={(event) => onRowChange({ ...row, [column.key]: event.target.value || null }, true)}
      onBlur={() => onClose(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    />
  )
}

/* ------------------------------------------------------------------ *
 * Cells
 * ------------------------------------------------------------------ */

function renderCellFor(
  column: ViewTableColumn,
  locale: AppLocale,
  editable: boolean,
  actions: ViewTableGridActions,
  media: { vaultPath?: string; uploadFile?: (file: File) => Promise<string | null> },
) {
  return ({ row, onRowChange }: RenderCellProps<GridRow>): ReactNode => {
    const value = row[column.id] ?? null
    const change = (next: ViewTableCellValue) => onRowChange({ ...row, [column.id]: next })

    if (column.type === 'checkbox') {
      return (
        <Checkbox
          checked={value === true}
          disabled={!editable}
          aria-label={column.name}
          onCheckedChange={(checked) => change(checked === true)}
        />
      )
    }

    if (column.type === 'select' || column.type === 'multiSelect') {
      const Cell = column.type === 'select' ? SelectCell : MultiSelectCell
      return (
        <Cell
          column={column}
          value={value}
          locale={locale}
          editable={editable}
          onChange={change}
          onChangeOptions={(options) => actions.changeColumnOptions(column.id, options)}
          onChangeOptionColor={(option, color) => actions.changeOptionColor(column.id, option, color)}
        />
      )
    }

    if (column.type === 'image') {
      return (
        <ImageCell
          value={value}
          locale={locale}
          editable={editable}
          vaultPath={media.vaultPath}
          uploadFile={media.uploadFile}
          onChange={change}
        />
      )
    }

    if (column.type === 'attachment') {
      return (
        <AttachmentCell
          value={value}
          locale={locale}
          editable={editable}
          vaultPath={media.vaultPath}
          uploadFile={media.uploadFile}
          onChange={change}
        />
      )
    }

    const text = viewTableCellText(value, column.type)
    if (column.type === 'url' && text !== '') {
      const href = safeUrlHref(text)
      return href === null
        ? <span className="view-table__text">{text}</span>
        : (
            <a className="view-table__link" href={href} target="_blank" rel="noreferrer">{text}</a>
          )
    }

    return (
      <span
        className={text === '' ? 'view-table__text view-table__placeholder' : 'view-table__text'}
        data-testid="view-table-cell-text"
      >
        {text}
      </span>
    )
  }
}

/* ------------------------------------------------------------------ *
 * Headers
 * ------------------------------------------------------------------ */

function HeaderCell({
  props,
  column,
  index,
  count,
  sort,
  locale,
  actions,
}: {
  props: RenderHeaderCellProps<GridRow>
  column: ViewTableColumn
  index: number
  count: number
  sort: ViewTableData['sort']
  locale: AppLocale
  actions: ViewTableGridActions
}) {
  const Icon = VIEW_TABLE_TYPE_ICONS[column.type]
  const sorted = sort?.columnId === column.id ? sort.direction : null

  return (
    <div className="view-table__head-inner" data-testid="view-table-header-cell">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="view-table__head-button"
            title={column.name}
            // Stop the click so react-data-grid's header click-to-sort does not
            // also fire when the user opens the column menu.
            onClick={(event) => event.stopPropagation()}
          >
            <Icon size={12} aria-hidden />
            <span className="view-table__head-label">{column.name}</span>
            {props.sortDirection === 'ASC' && <ArrowUp size={10} aria-hidden className="view-table__head-sort" />}
            {props.sortDirection === 'DESC' && <ArrowDown size={10} aria-hidden className="view-table__head-sort" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="view-table__menu">
          <ViewTableColumnMenu
            column={column}
            columnIndex={index}
            columnCount={count}
            sortDirection={sorted}
            locale={locale}
            onRename={(name) => actions.renameColumn(column.id, name)}
            onChangeType={(type) => actions.changeColumnType(column.id, type)}
            onChangeOptions={(options) => actions.changeColumnOptions(column.id, options)}
            onChangeOptionColor={(option, color) => actions.changeOptionColor(column.id, option, color)}
            onMove={(offset) => actions.moveColumn(column.id, offset)}
            onSort={(direction) => (
              direction === null
                ? actions.clearSort()
                : actions.sortColumn(column.id, direction)
            )}
            onResetWidth={() => actions.resetColumnWidth(column.id)}
            onRemove={() => actions.removeColumn(column.id)}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function RowMenu({
  rowIndex,
  rowCount,
  locale,
  editable,
  actions,
}: {
  rowIndex: number
  rowCount: number
  locale: AppLocale
  editable: boolean
  actions: ViewTableGridActions
}) {
  if (!editable) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="view-table__row-menu-trigger"
          aria-label={translate(locale, 'viewTable.rowActions')}
        >
          <DotsThree size={14} weight="bold" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="view-table__menu">
        <div className="view-table__menu-actions" {...isolatePopoverEvents}>
          <button
            type="button"
            className="view-table__menu-action"
            onClick={() => actions.duplicateRow(rowIndex)}
          >
            <Copy size={12} aria-hidden />
            {translate(locale, 'viewTable.duplicateRow')}
          </button>
          <button
            type="button"
            className="view-table__menu-action"
            disabled={rowIndex === 0}
            onClick={() => actions.moveRow(rowIndex, -1)}
          >
            <ArrowUp size={12} aria-hidden />
            {translate(locale, 'viewTable.moveRowUp')}
          </button>
          <button
            type="button"
            className="view-table__menu-action"
            disabled={rowIndex >= rowCount - 1}
            onClick={() => actions.moveRow(rowIndex, 1)}
          >
            <ArrowDown size={12} aria-hidden />
            {translate(locale, 'viewTable.moveRowDown')}
          </button>
          <div className="view-table__menu-separator" />
          <button
            type="button"
            className="view-table__menu-action view-table__menu-action--danger"
            onClick={() => actions.removeRow(rowIndex)}
          >
            <Trash size={12} aria-hidden />
            {translate(locale, 'viewTable.removeRow')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * The grid: react-data-grid (MIT) supplies cell editing, keyboard
 * navigation, column resizing and click-to-sort; the data layer above it stays
 * ours so the markdown fence remains the single source of truth.
 */
export function ViewTableGrid({
  data,
  visibleRows,
  locale,
  editable,
  vaultPath,
  uploadFile,
  actions,
}: ViewTableGridProps) {
  // Controlled resize widths: react-data-grid only delivers the final map on
  // resize end when `columnWidths` is controlled too (see its README pattern).
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(new Map())

  const gridRows = useMemo<GridRow[]>(
    () => visibleRows.map(({ row, index }) => ({ ...row, __index: index })),
    [visibleRows],
  )

  const columns = useMemo<Column<GridRow>[]>(() => [
    {
      key: GUTTER_KEY,
      name: '',
      width: GUTTER_WIDTH,
      minWidth: GUTTER_WIDTH,
      maxWidth: GUTTER_WIDTH,
      resizable: false,
      sortable: false,
      headerCellClass: 'view-table__gutter-head',
      cellClass: 'view-table__gutter',
      renderHeaderCell: () => null,
      renderCell: ({ row, rowIdx }) => (
        <div className="view-table__row-actions">
          <span className="view-table__row-number">{rowIdx + 1}</span>
          <RowMenu
            rowIndex={row.__index}
            rowCount={data.rows.length}
            locale={locale}
            editable={editable}
            actions={actions}
          />
        </div>
      ),
    },
    ...data.columns.map<Column<GridRow>>((column) => ({
      key: column.id,
      name: column.name,
      width: columnWidth(column),
      minWidth: VIEW_TABLE_MIN_COLUMN_WIDTH,
      maxWidth: VIEW_TABLE_MAX_COLUMN_WIDTH,
      resizable: editable,
      sortable: true,
      editable: editable && !POPOVER_CELL_TYPES.has(column.type),
      renderEditCell:
        column.type === 'date'
          ? DateCellEditor
          : (editProps: RenderEditCellProps<GridRow>) => (
              <DraftTextEditor {...editProps} numeric={column.type === 'number'} />
            ),
      renderHeaderCell: (headerProps) => (
        <HeaderCell
          props={headerProps}
          column={column}
          index={data.columns.indexOf(column)}
          count={data.columns.length}
          sort={data.sort}
          locale={locale}
          actions={actions}
        />
      ),
      renderCell: renderCellFor(column, locale, editable, actions, { vaultPath, uploadFile }),
    })),
    {
      key: ADD_COLUMN_KEY,
      name: '',
      width: ADD_COLUMN_WIDTH,
      minWidth: ADD_COLUMN_WIDTH,
      maxWidth: ADD_COLUMN_WIDTH,
      resizable: false,
      sortable: false,
      headerCellClass: 'view-table__add-column-head',
      renderHeaderCell: () => (
        <button
          type="button"
          className="view-table__add-column"
          disabled={!editable || data.columns.length >= MAX_VIEW_TABLE_COLUMNS}
          title={translate(locale, 'viewTable.addColumn')}
          aria-label={translate(locale, 'viewTable.addColumn')}
          onClick={(event) => {
            event.stopPropagation()
            actions.addColumn()
          }}
        >
          <Plus size={13} aria-hidden />
        </button>
      ),
      renderCell: () => null,
    },
    // `data` carries the columns, so the memo already tracks every column
    // change; the rest are the closures the cells call into.
  ], [data, locale, editable, vaultPath, uploadFile, actions])

  const sortColumns = useMemo<readonly SortColumn[]>(() => (
    data.sort
      ? [{
          columnKey: data.sort.columnId,
          direction: data.sort.direction === 'desc' ? 'DESC' : 'ASC',
        }]
      : []
  ), [data.sort])

  const handleRowsChange = (rows: GridRow[], { indexes, column }: RowsChangeData<GridRow>) => {
    if (!editable || column.key === GUTTER_KEY || column.key === ADD_COLUMN_KEY) return
    if (!data.columns.some(candidate => candidate.id === column.key)) return
    for (const idx of indexes) {
      const row = rows[idx]
      if (row === undefined) continue
      actions.changeCell(row.__index, column.key, row[column.key] ?? null)
    }
  }

  const handleSortColumnsChange = (next: SortColumn[]) => {
    const first = next[0]
    if (first === undefined || first.columnKey === GUTTER_KEY || first.columnKey === ADD_COLUMN_KEY) {
      actions.clearSort()
      return
    }
    actions.sortColumn(first.columnKey, first.direction === 'DESC' ? 'desc' : 'asc')
  }

  const handleColumnWidthsChange = (next: ColumnWidths) => {
    setColumnWidths(next)
    if (!editable) return
    // Fires once per resize gesture with every resized column; commit the
    // user-resized ones so the fence keeps them.
    for (const [key, entry] of next) {
      if (entry.type !== 'resized' || key === GUTTER_KEY || key === ADD_COLUMN_KEY) continue
      const column = data.columns.find(candidate => candidate.id === key)
      if (column !== undefined && column.width !== entry.width) {
        actions.resizeColumn(key, Math.round(entry.width))
      }
    }
  }

  const gridStyle: CSSProperties = {
    height: data.height > 0 ? 'var(--view-table-height)' : 'auto',
    maxHeight: 'var(--view-table-max-height)',
  }

  return (
    <DataGrid
      className="view-table__rdg"
      style={gridStyle}
      columns={columns}
      rows={gridRows}
      rowKeyGetter={(row: GridRow) => row.__index}
      rowHeight={34}
      headerRowHeight={32}
      enableVirtualization={data.rows.length > 60}
      sortColumns={sortColumns}
      onSortColumnsChange={handleSortColumnsChange}
      onRowsChange={handleRowsChange}
      columnWidths={columnWidths}
      onColumnWidthsChange={handleColumnWidthsChange}
      renderers={{
        noRowsFallback: (
          <div className="view-table__empty">{translate(locale, 'viewTable.emptyRows')}</div>
        ),
      }}
    />
  )
}
