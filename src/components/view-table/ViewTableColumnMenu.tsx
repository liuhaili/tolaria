import { useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowsDownUp,
  ArrowsHorizontal,
  ArrowUp,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { translate, type AppLocale } from '../../lib/i18n'
import {
  isOptionColumnType,
  VIEW_TABLE_COLUMN_TYPES,
  viewTableOptionColor,
  type ViewTableColumn,
  type ViewTableColumnType,
  type ViewTableOptionColor,
  type ViewTableSortDirection,
} from '../../utils/viewTableModel'
import { VIEW_TABLE_TYPE_ICONS, viewTableTypeLabel } from './columnTypes'
import { OptionColorPicker } from './OptionColorPalette'
import { isolatePopoverEvents } from './popoverEventIsolation'

export interface ViewTableColumnMenuProps {
  column: ViewTableColumn
  columnIndex: number
  columnCount: number
  /** `null` when this column is not the active sort. */
  sortDirection: ViewTableSortDirection | null
  locale: AppLocale
  onRename: (name: string) => void
  onChangeType: (type: ViewTableColumnType) => void
  onChangeOptions: (options: string[]) => void
  onChangeOptionColor: (option: string, color: ViewTableOptionColor | null) => void
  onMove: (offset: -1 | 1) => void
  /** `null` clears the sort. */
  onSort: (direction: ViewTableSortDirection | null) => void
  onResetWidth: () => void
  onRemove: () => void
}

/** Column header popover: rename, retype, edit choices, sort, reorder, delete. */
export function ViewTableColumnMenu({
  column,
  columnIndex,
  columnCount,
  sortDirection,
  locale,
  onRename,
  onChangeType,
  onChangeOptions,
  onChangeOptionColor,
  onMove,
  onSort,
  onResetWidth,
  onRemove,
}: ViewTableColumnMenuProps) {
  // The menu lives inside a popover, so it mounts fresh (and re-reads the
  // column) every time it is opened; the draft needs no prop sync effect.
  const [name, setName] = useState(column.name)
  const [draftOption, setDraftOption] = useState('')

  const commitName = () => {
    const next = name.trim()
    if (next === '' || next === column.name) {
      setName(column.name)
      return
    }
    onRename(next)
  }

  const addOption = () => {
    const next = draftOption.trim()
    setDraftOption('')
    if (next === '' || column.options.includes(next)) return
    onChangeOptions([...column.options, next])
  }

  return (
    // Clicks stay inside the menu: without this they bubble (through the React
    // tree, not the DOM tree) to react-data-grid's header click-to-sort, whose
    // stale-data commit overwrote whatever the menu just changed.
    <div data-testid="view-table-column-menu" {...isolatePopoverEvents}>
      <div className="view-table__menu-section">
        <span className="view-table__menu-label">{translate(locale, 'viewTable.columnName')}</span>
        <Input
          className="view-table__menu-input"
          value={name}
          aria-label={translate(locale, 'viewTable.columnName')}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
        />
      </div>

      <div className="view-table__menu-section">
        <span className="view-table__menu-label">{translate(locale, 'viewTable.columnType')}</span>
        <div className="view-table__type-grid">
          {VIEW_TABLE_COLUMN_TYPES.map((type) => {
            const Icon = VIEW_TABLE_TYPE_ICONS[type]
            return (
              <button
                key={type}
                type="button"
                className="view-table__type-option"
                data-active={type === column.type}
                onClick={() => onChangeType(type)}
              >
                <Icon size={13} aria-hidden />
                {viewTableTypeLabel(locale, type)}
              </button>
            )
          })}
        </div>
      </div>

      {isOptionColumnType(column.type) && (
        <div className="view-table__menu-section">
          <span className="view-table__menu-label">{translate(locale, 'viewTable.options')}</span>
          {column.options.length > 0 && (
            <div className="view-table__option-list">
              {column.options.map((option) => (
                <div className="view-table__option-row" key={option}>
                  <span className="view-table__option-name">{option}</span>
                  <OptionColorPicker
                    locale={locale}
                    color={viewTableOptionColor(column, option)}
                    onChange={(color) => onChangeOptionColor(option, color)}
                  />
                  <button
                    type="button"
                    className="view-table__icon-button"
                    aria-label={translate(locale, 'viewTable.removeOption')}
                    onClick={() => onChangeOptions(column.options.filter((candidate) => candidate !== option))}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-1 flex items-center gap-1.5">
            <Input
              className="view-table__menu-input"
              value={draftOption}
              placeholder={translate(locale, 'viewTable.addOption')}
              aria-label={translate(locale, 'viewTable.addOption')}
              onChange={(event) => setDraftOption(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addOption()
                }
              }}
            />
            <button
              type="button"
              className="view-table__icon-button"
              aria-label={translate(locale, 'viewTable.addOption')}
              onClick={addOption}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="view-table__menu-separator" />

      <div className="view-table__menu-actions">
        <button
          type="button"
          className="view-table__menu-action"
          data-active={sortDirection === 'asc'}
          onClick={() => onSort('asc')}
        >
          <ArrowUp size={12} aria-hidden />
          {translate(locale, 'viewTable.sortAsc')}
        </button>
        <button
          type="button"
          className="view-table__menu-action"
          data-active={sortDirection === 'desc'}
          onClick={() => onSort('desc')}
        >
          <ArrowDown size={12} aria-hidden />
          {translate(locale, 'viewTable.sortDesc')}
        </button>
        <button
          type="button"
          className="view-table__menu-action"
          disabled={sortDirection === null}
          onClick={() => onSort(null)}
        >
          <ArrowsDownUp size={12} aria-hidden />
          {translate(locale, 'viewTable.sortClear')}
        </button>
        <div className="view-table__menu-separator" />
        <button
          type="button"
          className="view-table__menu-action"
          disabled={columnIndex === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowLeft size={12} aria-hidden />
          {translate(locale, 'viewTable.moveColumnLeft')}
        </button>
        <button
          type="button"
          className="view-table__menu-action"
          disabled={columnIndex >= columnCount - 1}
          onClick={() => onMove(1)}
        >
          <ArrowRight size={12} aria-hidden />
          {translate(locale, 'viewTable.moveColumnRight')}
        </button>
        <button
          type="button"
          className="view-table__menu-action"
          disabled={column.width === null}
          onClick={onResetWidth}
        >
          <ArrowsHorizontal size={12} aria-hidden />
          {translate(locale, 'viewTable.widthAuto')}
        </button>
        <div className="view-table__menu-separator" />
        <button
          type="button"
          className="view-table__menu-action view-table__menu-action--danger"
          disabled={columnCount <= 1}
          onClick={onRemove}
        >
          <Trash size={12} aria-hidden />
          {translate(locale, 'viewTable.removeColumn')}
        </button>
      </div>
    </div>
  )
}
