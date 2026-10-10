import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowsDownUp,
  FunnelSimple,
  ListPlus,
  MagnifyingGlass,
  Plus,
  X,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { translate, type AppLocale } from '../../lib/i18n'
import {
  VIEW_TABLE_COLUMN_TYPES,
  viewTableFilterNeedsValue,
  viewTableFilterOps,
  type ViewTableColumn,
  type ViewTableColumnType,
  type ViewTableFilter,
  type ViewTableFilterOp,
  type ViewTableSort,
} from '../../utils/viewTableModel'
import { VIEW_TABLE_TYPE_ICONS, viewTableTypeLabel } from './columnTypes'

export interface ViewTableToolbarProps {
  title: string
  locale: AppLocale
  search: string
  shownCount: number
  totalCount: number
  columns: ViewTableColumn[]
  filters: ViewTableFilter[]
  sort: ViewTableSort | null
  editable: boolean
  onSearchChange: (value: string) => void
  onRenameTitle: (title: string) => void
  onAddColumn: (name: string, type: ViewTableColumnType) => void
  onAddFilter: () => void
  onUpdateFilter: (filterId: string, patch: Partial<Omit<ViewTableFilter, 'id'>>) => void
  onRemoveFilter: (filterId: string) => void
  onClearSort: () => void
}

/**
 * Title input: kept as a local draft and committed on blur/Enter, so typing a
 * name does not push one block update per keystroke.
 */
function TitleInput({
  title,
  locale,
  editable,
  onCommit,
}: {
  title: string
  locale: AppLocale
  editable: boolean
  onCommit: (title: string) => void
}) {
  const [draft, setDraft] = useState(title)

  useEffect(() => {
    setDraft(title)
  }, [title])

  return (
    <input
      className="view-table__title"
      value={draft}
      readOnly={!editable}
      placeholder={translate(locale, 'viewTable.titlePlaceholder')}
      aria-label={translate(locale, 'viewTable.titlePlaceholder')}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

function AddColumnPopover({
  locale,
  editable,
  onAddColumn,
}: Pick<ViewTableToolbarProps, 'locale' | 'editable' | 'onAddColumn'>) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<ViewTableColumnType>('text')

  const submit = () => {
    onAddColumn(name, type)
    setName('')
    setType('text')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="xs" disabled={!editable} data-testid="view-table-add-column">
          <ListPlus size={12} aria-hidden />
          {translate(locale, 'viewTable.addColumn')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="view-table__menu" data-testid="view-table-add-column-popover">
        <div className="view-table__menu-section">
          <span className="view-table__menu-label">{translate(locale, 'viewTable.columnName')}</span>
          <Input
            className="view-table__menu-input"
            value={name}
            placeholder={translate(locale, 'viewTable.columnName')}
            aria-label={translate(locale, 'viewTable.columnName')}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
        </div>
        <div className="view-table__menu-section">
          <span className="view-table__menu-label">{translate(locale, 'viewTable.columnType')}</span>
          <div className="view-table__type-grid">
            {VIEW_TABLE_COLUMN_TYPES.map((candidate) => {
              const Icon = VIEW_TABLE_TYPE_ICONS[candidate]
              return (
                <button
                  key={candidate}
                  type="button"
                  className="view-table__type-option"
                  data-active={candidate === type}
                  onClick={() => setType(candidate)}
                >
                  <Icon size={13} aria-hidden />
                  {viewTableTypeLabel(locale, candidate)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="view-table__menu-separator" />
        <button type="button" className="view-table__menu-action" onClick={submit}>
          <Plus size={12} aria-hidden />
          {translate(locale, 'viewTable.addColumnConfirm')}
        </button>
      </PopoverContent>
    </Popover>
  )
}

/** Value field for one condition, typed after the column it filters. */
function FilterValueInput({
  filter,
  type,
  locale,
  onUpdate,
}: {
  filter: ViewTableFilter
  type: ViewTableColumnType
  locale: AppLocale
  onUpdate: (patch: Partial<Omit<ViewTableFilter, 'id'>>) => void
}) {
  const label = translate(locale, 'viewTable.filterValue')
  const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
  return (
    <Input
      className="view-table__menu-input"
      type={inputType}
      value={filter.value}
      placeholder={label}
      aria-label={label}
      onChange={(event) => onUpdate({ value: event.target.value })}
    />
  )
}

function FilterRow({
  filter,
  columns,
  locale,
  onUpdate,
  onRemove,
}: {
  filter: ViewTableFilter
  columns: ViewTableColumn[]
  locale: AppLocale
  onUpdate: (patch: Partial<Omit<ViewTableFilter, 'id'>>) => void
  onRemove: () => void
}) {
  const column = columns.find(candidate => candidate.id === filter.columnId)
  const type = column?.type ?? 'text'
  const ops = viewTableFilterOps(type)
  const needsValue = viewTableFilterNeedsValue(filter.op)

  return (
    <div className="view-table__filter-row" data-testid="view-table-filter-row">
      <div className="view-table__filter-row-top">
        <Select value={filter.columnId} onValueChange={(columnId) => onUpdate({ columnId })}>
          <SelectTrigger
            className="view-table__filter-select"
            aria-label={translate(locale, 'viewTable.filterColumn')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filter.op} onValueChange={(op) => onUpdate({ op: op as ViewTableFilterOp })}>
          <SelectTrigger
            className="view-table__filter-select"
            aria-label={translate(locale, 'viewTable.filterOp')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ops.map((candidate) => (
              <SelectItem key={candidate} value={candidate}>
                {translate(locale, `viewTable.filterOp.${candidate}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          className="view-table__icon-button"
          aria-label={translate(locale, 'viewTable.removeFilter')}
          onClick={onRemove}
        >
          <X size={11} />
        </button>
      </div>

      {needsValue && (
        <FilterValueInput filter={filter} type={type} locale={locale} onUpdate={onUpdate} />
      )}
    </div>
  )
}

/** Row filters: AND-combined conditions stored in the fence. */
function FilterPopover({
  locale,
  columns,
  filters,
  editable,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
}: Pick<
  ViewTableToolbarProps,
  'locale' | 'columns' | 'filters' | 'editable' | 'onAddFilter' | 'onUpdateFilter' | 'onRemoveFilter'
>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={!editable}
          data-active={filters.length > 0}
          className="view-table__toolbar-button"
          data-testid="view-table-filter"
        >
          <FunnelSimple size={12} aria-hidden />
          {translate(locale, 'viewTable.filter')}
          {filters.length > 0 && <span className="view-table__badge">{filters.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="view-table__menu view-table__menu--wide" data-testid="view-table-filter-popover">
        <div className="view-table__menu-label">{translate(locale, 'viewTable.filterLabel')}</div>
        {filters.length === 0 && (
          <div className="view-table__placeholder">{translate(locale, 'viewTable.filterEmpty')}</div>
        )}
        <div className="view-table__filter-list">
          {filters.map((filter) => (
            <FilterRow
              key={filter.id}
              filter={filter}
              columns={columns}
              locale={locale}
              onUpdate={(patch) => onUpdateFilter(filter.id, patch)}
              onRemove={() => onRemoveFilter(filter.id)}
            />
          ))}
        </div>
        <div className="view-table__menu-separator" />
        <button
          type="button"
          className="view-table__menu-action"
          onClick={onAddFilter}
          data-testid="view-table-add-filter"
        >
          <Plus size={12} aria-hidden />
          {translate(locale, 'viewTable.addFilter')}
        </button>
      </PopoverContent>
    </Popover>
  )
}

/** The active sort, shown as a chip so it can be cleared without the menu. */
function SortChip({
  sort,
  columns,
  locale,
  onClear,
}: {
  sort: ViewTableSort
  columns: ViewTableColumn[]
  locale: AppLocale
  onClear: () => void
}) {
  const column = columns.find(candidate => candidate.id === sort.columnId)
  if (!column) return null
  const Icon = sort.direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <span className="view-table__sort-chip" data-testid="view-table-sort-chip">
      <ArrowsDownUp size={11} aria-hidden />
      <span className="view-table__sort-label">
        {translate(locale, 'viewTable.sortedBy')} {column.name}
      </span>
      <Icon size={10} aria-hidden />
      <button
        type="button"
        className="view-table__icon-button"
        aria-label={translate(locale, 'viewTable.sortClear')}
        onClick={onClear}
      >
        <X size={10} />
      </button>
    </span>
  )
}

/** Block chrome: title, search, filters, sort, "add column" and the row count. */
export function ViewTableToolbar({
  title,
  locale,
  search,
  shownCount,
  totalCount,
  columns,
  filters,
  sort,
  editable,
  onSearchChange,
  onRenameTitle,
  onAddColumn,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onClearSort,
}: ViewTableToolbarProps) {
  const hiddenCount = totalCount - shownCount

  return (
    <div className="view-table__toolbar" data-testid="view-table-toolbar">
      <TitleInput title={title} locale={locale} editable={editable} onCommit={onRenameTitle} />

      <div className="view-table__search">
        <MagnifyingGlass size={12} aria-hidden />
        <Input
          value={search}
          placeholder={translate(locale, 'viewTable.searchPlaceholder')}
          aria-label={translate(locale, 'viewTable.searchPlaceholder')}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <FilterPopover
        locale={locale}
        columns={columns}
        filters={filters}
        editable={editable}
        onAddFilter={onAddFilter}
        onUpdateFilter={onUpdateFilter}
        onRemoveFilter={onRemoveFilter}
      />

      {sort && <SortChip sort={sort} columns={columns} locale={locale} onClear={onClearSort} />}

      <AddColumnPopover locale={locale} editable={editable} onAddColumn={onAddColumn} />

      <span className="view-table__count">
        {translate(locale, 'viewTable.count', { shown: shownCount, total: totalCount })}
        {hiddenCount > 0 && (
          <>
            {' · '}
            {translate(locale, 'viewTable.rowsHidden', { count: hiddenCount })}
          </>
        )}
      </span>
    </div>
  )
}
