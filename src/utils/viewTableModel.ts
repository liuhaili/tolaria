/**
 * Data model for the inline data-table block (a ```view fence).
 *
 * The block owns its rows: the values live in the fence itself, so the table
 * travels with the note it is pasted into. A column is a typed field — not a
 * frontmatter property — and nothing here reads or writes vault notes.
 * See ADR 0193.
 */

export type ViewTableColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'multiSelect'
  | 'url'
  | 'image'
  | 'attachment'

export type ViewTableCellValue = string | number | boolean | string[] | null

/**
 * Named palette for `select` / `multiSelect` choices.
 *
 * Names, not hex values: the chip colours are painted by CSS from these names,
 * so one fence renders correctly in both the light and the dark theme (and
 * stays readable if the theme changes later).
 */
export const VIEW_TABLE_OPTION_COLORS = [
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'red',
] as const

export type ViewTableOptionColor = (typeof VIEW_TABLE_OPTION_COLORS)[number]

/** Option value → palette colour name. Missing values render uncoloured. */
export type ViewTableOptionColors = Record<string, string>

export interface ViewTableColumn {
  /** Stable id, also used as the key in every row. */
  id: string
  name: string
  type: ViewTableColumnType
  /** Preferred pixel width; `null` lets the table size the column. */
  width: number | null
  /** Choices offered by `select` and `multiSelect`. */
  options: string[]
  /** Per-choice colours for `select` / `multiSelect`; empty means uncoloured. */
  optionColors: ViewTableOptionColors
}

/** A row is a plain column-id → value map, which keeps the fence readable. */
export type ViewTableRow = Record<string, ViewTableCellValue>

export type ViewTableFilterOp =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'gt'
  | 'lt'
  | 'before'
  | 'after'
  | 'isTrue'
  | 'isFalse'

/** A row filter. Conditions are combined with AND. */
export interface ViewTableFilter {
  id: string
  columnId: string
  op: ViewTableFilterOp
  value: string
}

export type ViewTableSortDirection = 'asc' | 'desc'

export interface ViewTableSort {
  columnId: string
  direction: ViewTableSortDirection
}

export interface ViewTableData {
  title: string
  columns: ViewTableColumn[]
  rows: ViewTableRow[]
  /** Row filters (AND). Empty means "show everything". */
  filters: ViewTableFilter[]
  /** Display order. `null` keeps the authored row order. */
  sort: ViewTableSort | null
  /** Fixed body height in px; 0 grows with the rows. */
  height: number
}

export const VIEW_TABLE_COLUMN_TYPES: readonly ViewTableColumnType[] = [
  'text',
  'number',
  'date',
  'checkbox',
  'select',
  'multiSelect',
  'url',
  'image',
  'attachment',
]

/** Guards against a runaway table turning a note into an unopenable file. */
export const MAX_VIEW_TABLE_SOURCE_LENGTH = 200_000
export const MAX_VIEW_TABLE_COLUMNS = 50
export const MAX_VIEW_TABLE_ROWS = 2000
export const MAX_VIEW_TABLE_FILTERS = 20
export const MAX_VIEW_TABLE_OPTIONS = 50
export const VIEW_TABLE_MIN_COLUMN_WIDTH = 56
export const VIEW_TABLE_MAX_COLUMN_WIDTH = 900

const COLUMN_TYPE_SET = new Set<string>(VIEW_TABLE_COLUMN_TYPES)
const OPTION_COLUMN_TYPES = new Set<ViewTableColumnType>(['select', 'multiSelect'])
const OPTION_COLOR_SET = new Set<string>(VIEW_TABLE_OPTION_COLORS)

/** Filter operators offered per column type, in menu order. */
const FILTER_OPS_BY_TYPE: Record<ViewTableColumnType, readonly ViewTableFilterOp[]> = {
  text: ['contains', 'notContains', 'equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  url: ['contains', 'notContains', 'equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  image: ['contains', 'notContains', 'equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  attachment: ['contains', 'notContains', 'equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  number: ['equals', 'notEquals', 'gt', 'lt', 'isEmpty', 'isNotEmpty'],
  date: ['equals', 'before', 'after', 'isEmpty', 'isNotEmpty'],
  checkbox: ['isTrue', 'isFalse'],
  select: ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  multiSelect: ['contains', 'notContains', 'isEmpty', 'isNotEmpty'],
}

const FILTER_OP_SET = new Set<string>(Object.values(FILTER_OPS_BY_TYPE).flat())
/** Operators that carry no value to type in. */
const VALUELESS_FILTER_OPS = new Set<ViewTableFilterOp>([
  'isEmpty',
  'isNotEmpty',
  'isTrue',
  'isFalse',
])

export function viewTableFilterOps(type: ViewTableColumnType): readonly ViewTableFilterOp[] {
  return FILTER_OPS_BY_TYPE[type]
}

export function viewTableFilterNeedsValue(op: ViewTableFilterOp): boolean {
  return !VALUELESS_FILTER_OPS.has(op)
}

export function isOptionColumnType(type: ViewTableColumnType): boolean {
  return OPTION_COLUMN_TYPES.has(type)
}

let columnIdCounter = 0

/** Short, readable ids keep the JSON fence hand-editable. */
export function createViewTableColumnId(taken?: Iterable<string>): string {
  const used = taken ? new Set(taken) : null
  for (;;) {
    columnIdCounter += 1
    const id = `c${columnIdCounter.toString(36)}`
    if (!used || !used.has(id)) return id
  }
}

let filterIdCounter = 0

export function createViewTableFilterId(taken?: Iterable<string>): string {
  const used = taken ? new Set(taken) : null
  for (;;) {
    filterIdCounter += 1
    const id = `f${filterIdCounter.toString(36)}`
    if (!used || !used.has(id)) return id
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function readNumberAsText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  return null
}

function readColumnType(value: unknown): ViewTableColumnType | null {
  return typeof value === 'string' && COLUMN_TYPE_SET.has(value)
    ? value as ViewTableColumnType
    : null
}

function readColumnWidth(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  if (rounded < VIEW_TABLE_MIN_COLUMN_WIDTH || rounded > VIEW_TABLE_MAX_COLUMN_WIDTH) return null
  return rounded
}

function readHeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const rounded = Math.round(value)
  if (rounded <= 0) return 0
  return Math.min(rounded, 4000)
}

function readOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const options: string[] = []
  for (const item of value) {
    const option = readText(item)
    if (option === null || seen.has(option)) continue
    seen.add(option)
    options.push(option)
  }
  return options
}

/** Keeps only colours that name a real palette entry and a real choice. */
function readOptionColors(value: unknown, options: readonly string[]): ViewTableOptionColors {
  if (!isRecord(value)) return {}
  const known = new Set(options)
  const colors: ViewTableOptionColors = {}
  for (const [option, color] of Object.entries(value)) {
    if (!known.has(option)) continue
    if (typeof color !== 'string' || !OPTION_COLOR_SET.has(color)) continue
    colors[option] = color
  }
  return colors
}

function pruneOptionColors(
  colors: ViewTableOptionColors,
  options: readonly string[],
): ViewTableOptionColors {
  const known = new Set(options)
  const pruned: ViewTableOptionColors = {}
  for (const [option, color] of Object.entries(colors)) {
    if (known.has(option)) pruned[option] = color
  }
  return pruned
}

/** A choice colour is only stored once it differs from the default. */
export function viewTableOptionColor(
  column: ViewTableColumn,
  option: string,
): ViewTableOptionColor | null {
  const color = column.optionColors[option]
  return typeof color === 'string' && OPTION_COLOR_SET.has(color)
    ? color as ViewTableOptionColor
    : null
}

/** Coerces an untrusted value into what the column type can hold. */
export function normalizeViewTableCellValue(
  value: unknown,
  type: ViewTableColumnType,
): ViewTableCellValue {
  switch (type) {
    case 'number': {
      if (typeof value === 'number') return Number.isFinite(value) ? value : null
      const text = readText(value)
      if (text === null) return null
      const parsed = Number(text)
      return Number.isFinite(parsed) ? parsed : null
    }
    case 'checkbox': {
      if (typeof value === 'boolean') return value
      if (value === 'true' || value === 'yes') return true
      if (value === 'false' || value === 'no') return false
      return null
    }
    case 'multiSelect': {
      if (Array.isArray(value)) {
        const items: string[] = []
        for (const item of value) {
          const option = readText(item)
          if (option !== null && !items.includes(option)) items.push(option)
        }
        return items.length > 0 ? items : null
      }
      const single = readText(value)
      return single === null ? null : [single]
    }
    case 'date': {
      const text = readText(value) ?? readNumberAsText(value)
      if (text === null) return null
      const match = /^(\d{4}-\d{2}-\d{2})/u.exec(text)
      return match?.[1] ?? text
    }
    case 'text':
    case 'url':
    case 'image':
    case 'attachment':
    case 'select':
      return readText(value) ?? readNumberAsText(value)
    default:
      return null
  }
}

function normalizeColumn(value: unknown, index: number, taken: Set<string>): ViewTableColumn | null {
  if (!isRecord(value)) return null
  const type = readColumnType(Reflect.get(value, 'type')) ?? 'text'
  let id = readText(Reflect.get(value, 'id')) ?? createViewTableColumnId(taken)
  while (taken.has(id)) id = createViewTableColumnId(taken)
  taken.add(id)

  const options = OPTION_COLUMN_TYPES.has(type) ? readOptions(Reflect.get(value, 'options')) : []

  return {
    id,
    name: readText(Reflect.get(value, 'name')) ?? `Column ${index + 1}`,
    type,
    width: readColumnWidth(Reflect.get(value, 'width')),
    options,
    optionColors: readOptionColors(Reflect.get(value, 'optionColors'), options),
  }
}

function normalizeRow(value: unknown, columns: ViewTableColumn[]): ViewTableRow {
  const row: ViewTableRow = {}
  if (!isRecord(value)) return row
  for (const column of columns) {
    const normalized = normalizeViewTableCellValue(Reflect.get(value, column.id), column.type)
    if (normalized === null) continue
    row[column.id] = normalized
  }
  return row
}

function normalizeFilter(
  value: unknown,
  columns: ViewTableColumn[],
  taken: Set<string>,
): ViewTableFilter | null {
  if (!isRecord(value)) return null
  if (typeof Reflect.get(value, 'op') !== 'string') return null
  const op = Reflect.get(value, 'op')
  if (typeof op !== 'string' || !FILTER_OP_SET.has(op)) return null
  const columnId = readText(Reflect.get(value, 'columnId'))
  if (columnId === null) return null
  const column = columns.find(candidate => candidate.id === columnId)
  if (!column) return null
  let id = readText(Reflect.get(value, 'id')) ?? createViewTableFilterId(taken)
  while (taken.has(id)) id = createViewTableFilterId(taken)
  taken.add(id)
  return {
    id,
    columnId,
    op: op as ViewTableFilterOp,
    value: typeof Reflect.get(value, 'value') === 'string' ? Reflect.get(value, 'value') as string : '',
  }
}

function normalizeSort(value: unknown, columns: ViewTableColumn[]): ViewTableSort | null {
  if (!isRecord(value)) return null
  const columnId = readText(Reflect.get(value, 'columnId'))
  if (columnId === null || !columns.some(column => column.id === columnId)) return null
  const direction = Reflect.get(value, 'direction')
  return { columnId, direction: direction === 'desc' ? 'desc' : 'asc' }
}

export function defaultViewTableData(): ViewTableData {
  // Fixed ids, not generated ones: an empty fence body means "fresh default
  // table", and it must produce the *same* column ids on every parse. The
  // block renders one parse while an edit re-parses the same empty source;
  // with generated ids the two disagreed and the first edit on a fresh table
  // silently matched no column.
  return {
    title: '',
    columns: [
      { id: 'name', name: 'Name', type: 'text', width: null, options: [], optionColors: {} },
      {
        id: 'status',
        name: 'Status',
        type: 'select',
        width: null,
        options: ['To do', 'Doing', 'Done'],
        optionColors: { 'To do': 'gray', Doing: 'blue', Done: 'green' },
      },
      { id: 'notes', name: 'Notes', type: 'text', width: null, options: [], optionColors: {} },
    ],
    rows: [{}],
    filters: [],
    sort: null,
    height: 0,
  }
}

export function normalizeViewTableData(value: unknown): ViewTableData {
  if (!isRecord(value)) return defaultViewTableData()

  const title = readText(Reflect.get(value, 'title')) ?? ''
  const height = readHeight(Reflect.get(value, 'height'))

  const rawColumns = Array.isArray(Reflect.get(value, 'columns'))
    ? Reflect.get(value, 'columns') as unknown[]
    : []
  const taken = new Set<string>()
  const columns: ViewTableColumn[] = []
  for (const [index, item] of rawColumns.slice(0, MAX_VIEW_TABLE_COLUMNS).entries()) {
    const column = normalizeColumn(item, index, taken)
    if (column) columns.push(column)
  }

  // A table without columns cannot be edited at all, so fall back to the
  // default set rather than rendering an empty grid.
  if (columns.length === 0) {
    return { ...defaultViewTableData(), title, height }
  }

  const rawRows = Array.isArray(Reflect.get(value, 'rows'))
    ? Reflect.get(value, 'rows') as unknown[]
    : []

  const rawFilters = Array.isArray(Reflect.get(value, 'filters'))
    ? Reflect.get(value, 'filters') as unknown[]
    : []
  const filterIds = new Set<string>()
  const filters: ViewTableFilter[] = []
  for (const item of rawFilters.slice(0, MAX_VIEW_TABLE_FILTERS)) {
    const filter = normalizeFilter(item, columns, filterIds)
    if (filter) filters.push(filter)
  }

  return {
    title,
    columns,
    rows: rawRows.slice(0, MAX_VIEW_TABLE_ROWS).map(row => normalizeRow(row, columns)),
    filters,
    sort: normalizeSort(Reflect.get(value, 'sort'), columns),
    height,
  }
}

/**
 * Parses a fence body. An empty body is a fresh default table; anything that is
 * not JSON is rejected so the caller can keep the text as a code block instead.
 */
export function parseViewTableData(raw: string): ViewTableData | null {
  const text = raw.trim()
  if (text === '') return defaultViewTableData()
  if (text.length > MAX_VIEW_TABLE_SOURCE_LENGTH) return null
  try {
    return normalizeViewTableData(JSON.parse(text))
  } catch {
    return null
  }
}

function compactColumn(column: ViewTableColumn): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: column.id,
    name: column.name,
    type: column.type,
  }
  if (column.width !== null) payload.width = column.width
  if (isOptionColumnType(column.type) && column.options.length > 0) {
    payload.options = column.options
    // The colour map is rewritten from the live choices every time, so a
    // removed choice can never leave a stale colour behind in the fence.
    const colors = pruneOptionColors(column.optionColors, column.options)
    if (Object.keys(colors).length > 0) payload.optionColors = colors
  }
  return payload
}

/** Cells are emitted in column order with empty values omitted, so edits diff cleanly. */
function compactRow(row: ViewTableRow, columns: ViewTableColumn[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const column of columns) {
    const value = row[column.id]
    if (value === undefined || value === null) continue
    if (Array.isArray(value) && value.length === 0) continue
    payload[column.id] = value
  }
  return payload
}

export function serializeViewTableData(data: ViewTableData): string {
  const payload: Record<string, unknown> = {}
  const title = data.title.trim()
  if (title !== '') payload.title = title
  payload.columns = data.columns.map(compactColumn)
  if (data.filters.length > 0) {
    payload.filters = data.filters.map(filter => {
      const compact: Record<string, unknown> = {
        id: filter.id,
        columnId: filter.columnId,
        op: filter.op,
      }
      if (filter.value !== '') compact.value = filter.value
      return compact
    })
  }
  if (data.sort) payload.sort = { columnId: data.sort.columnId, direction: data.sort.direction }
  payload.rows = data.rows.map(row => compactRow(row, data.columns))
  if (data.height > 0) payload.height = data.height
  return JSON.stringify(payload, null, 2)
}

/* ------------------------------------------------------------------ *
 * Row / column operations. Pure, so the block component stays thin.
 * ------------------------------------------------------------------ */

export function viewTableColumnById(data: ViewTableData, columnId: string): ViewTableColumn | null {
  return data.columns.find(column => column.id === columnId) ?? null
}

export function addViewTableRow(data: ViewTableData, at?: number): ViewTableData {
  if (data.rows.length >= MAX_VIEW_TABLE_ROWS) return data
  const index = at === undefined ? data.rows.length : Math.max(0, Math.min(at, data.rows.length))
  const rows = [...data.rows]
  rows.splice(index, 0, {})
  return { ...data, rows }
}

export function removeViewTableRow(data: ViewTableData, index: number): ViewTableData {
  if (index < 0 || index >= data.rows.length) return data
  return { ...data, rows: data.rows.filter((_, rowIndex) => rowIndex !== index) }
}

export function duplicateViewTableRow(data: ViewTableData, index: number): ViewTableData {
  const row = data.rows.at(index)
  if (row === undefined || data.rows.length >= MAX_VIEW_TABLE_ROWS) return data
  const rows = [...data.rows]
  rows.splice(index + 1, 0, { ...row })
  return { ...data, rows }
}

export function moveViewTableRow(data: ViewTableData, from: number, to: number): ViewTableData {
  const row = data.rows.at(from)
  if (row === undefined || to < 0 || to >= data.rows.length || from === to) return data
  const rows = [...data.rows]
  rows.splice(from, 1)
  rows.splice(to, 0, row)
  return { ...data, rows }
}

export function setViewTableCell(
  data: ViewTableData,
  rowIndex: number,
  columnId: string,
  value: ViewTableCellValue,
): ViewTableData {
  const row = data.rows.at(rowIndex)
  const column = viewTableColumnById(data, columnId)
  if (row === undefined || column === null) return data

  const normalized = normalizeViewTableCellValue(value, column.type)
  const nextRow: ViewTableRow = { ...row }
  if (normalized === null || (Array.isArray(normalized) && normalized.length === 0)) {
    delete nextRow[columnId]
  } else {
    nextRow[columnId] = normalized
  }

  const rows = [...data.rows]
  rows[rowIndex] = nextRow
  return { ...data, rows }
}

export function createViewTableColumn(
  data: ViewTableData,
  name: string,
  type: ViewTableColumnType,
  at?: number,
): ViewTableData {
  if (data.columns.length >= MAX_VIEW_TABLE_COLUMNS) return data
  const column: ViewTableColumn = {
    id: createViewTableColumnId(data.columns.map(candidate => candidate.id)),
    name: name.trim() === '' ? `Column ${data.columns.length + 1}` : name.trim(),
    type,
    width: null,
    options: [],
    optionColors: {},
  }
  const columns = [...data.columns]
  columns.splice(at === undefined ? columns.length : Math.max(0, Math.min(at, columns.length)), 0, column)
  return { ...data, columns }
}

export function updateViewTableColumn(
  data: ViewTableData,
  columnId: string,
  patch: Partial<Omit<ViewTableColumn, 'id'>>,
): ViewTableData {
  const columns = data.columns.map(column => {
    if (column.id !== columnId) return column
    const next = { ...column, ...patch, id: column.id }
    // Dropping a choice also drops its colour, so the map can never point at
    // an option that is no longer offered.
    if (patch.options !== undefined) {
      next.optionColors = pruneOptionColors(next.optionColors, patch.options)
    }
    return next
  })
  return { ...data, columns }
}

/** Paints one choice, or clears it when `color` is `null`. */
export function setViewTableOptionColor(
  data: ViewTableData,
  columnId: string,
  option: string,
  color: ViewTableOptionColor | null,
): ViewTableData {
  const column = viewTableColumnById(data, columnId)
  if (column === null || !isOptionColumnType(column.type)) return data
  const isKnownOption = column.options.includes(option)
  if (!isKnownOption && !data.rows.some(row => {
    const value = row[columnId]
    return value === option || (Array.isArray(value) && value.includes(option))
  })) return data

  const current = column.optionColors[option]
  if (color === null) {
    if (current === undefined) return data
    const optionColors = { ...column.optionColors }
    delete optionColors[option]
    return updateViewTableColumn(data, columnId, { optionColors })
  }
  if (!OPTION_COLOR_SET.has(color) || current === color) return data
  return updateViewTableColumn(data, columnId, {
    options: isKnownOption ? column.options : [...column.options, option],
    optionColors: { ...column.optionColors, [option]: color },
  })
}

/** Choosing select/multiSelect offers the values the column already holds. */
function optionsFromCells(
  rows: readonly ViewTableRow[],
  columnId: string,
  existing: readonly string[],
): string[] {
  const options = [...existing]
  const seen = new Set(options)
  for (const row of rows) {
    const value = row[columnId]
    if (value === undefined || value === null) continue
    const items = Array.isArray(value) ? value : [value]
    for (const item of items) {
      const text = String(item).trim()
      if (text === '' || text.length > 60 || seen.has(text)) continue
      if (options.length >= MAX_VIEW_TABLE_OPTIONS) return options
      seen.add(text)
      options.push(text)
    }
  }
  return options
}

/**
 * Changing a column's type re-coerces every cell, so switching text → number
 * does not leave strings that the number editor cannot read.
 */
export function changeViewTableColumnType(
  data: ViewTableData,
  columnId: string,
  type: ViewTableColumnType,
): ViewTableData {
  const column = viewTableColumnById(data, columnId)
  if (column === null || column.type === type) return data

  const rows = data.rows.map(row => {
    const normalized = normalizeViewTableCellValue(row[columnId], type)
    const nextRow: ViewTableRow = { ...row }
    if (normalized === null) {
      delete nextRow[columnId]
    } else {
      nextRow[columnId] = normalized
    }
    return nextRow
  })

  const next = updateViewTableColumn({ ...data, rows }, columnId, { type })

  // Turning a text column into a choice column should not leave the picker
  // empty: the values already in the cells become the offered choices.
  const options = isOptionColumnType(type)
    ? optionsFromCells(rows, columnId, next.columns.find(column => column.id === columnId)?.options ?? [])
    : []
  const withOptions = isOptionColumnType(type)
    ? updateViewTableColumn(next, columnId, { options })
    : next

  // A filter written for the old type may not be expressible with the new one
  // (e.g. "greater than" on a text column), so re-seat those conditions.
  const allowed = FILTER_OPS_BY_TYPE[type]
  const filters = withOptions.filters.map(filter => {
    if (filter.columnId !== columnId) return filter
    if (allowed.includes(filter.op)) return filter
    return { ...filter, op: allowed[0], value: '' }
  })

  return { ...withOptions, filters }
}

export function removeViewTableColumn(data: ViewTableData, columnId: string): ViewTableData {
  if (data.columns.length <= 1) return data
  const rows = data.rows.map(row => {
    if (!(columnId in row)) return row
    const nextRow = { ...row }
    delete nextRow[columnId]
    return nextRow
  })
  return {
    ...data,
    columns: data.columns.filter(column => column.id !== columnId),
    rows,
    filters: data.filters.filter(filter => filter.columnId !== columnId),
    sort: data.sort?.columnId === columnId ? null : data.sort,
  }
}

export function moveViewTableColumn(data: ViewTableData, columnId: string, offset: -1 | 1): ViewTableData {
  const index = data.columns.findIndex(column => column.id === columnId)
  const target = index + offset
  if (index < 0 || target < 0 || target >= data.columns.length) return data
  const columns = [...data.columns]
  const [column] = columns.splice(index, 1)
  if (column === undefined) return data
  columns.splice(target, 0, column)
  return { ...data, columns }
}

/* ------------------------------------------------------------------ *
 * Presentation helpers
 * ------------------------------------------------------------------ */

export function isViewTableCellEmpty(value: ViewTableCellValue): boolean {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'string') return value.trim() === ''
  return false
}

export function viewTableCellText(value: ViewTableCellValue, type: ViewTableColumnType): string {
  if (isViewTableCellEmpty(value)) return ''
  if (type === 'checkbox') return value === true ? '✓' : ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

/** Free-text search across every column of a row. */
export function viewTableRowMatches(row: ViewTableRow, columns: ViewTableColumn[], needle: string): boolean {
  const query = needle.trim().toLowerCase()
  if (query === '') return true
  return columns.some(column => viewTableCellText(row[column.id] ?? null, column.type).toLowerCase().includes(query))
}

/* ------------------------------------------------------------------ *
 * Filter / sort operations. Pure, so the block component stays thin.
 * ------------------------------------------------------------------ */

export function addViewTableFilter(
  data: ViewTableData,
  columnId?: string,
  op?: ViewTableFilterOp,
  value = '',
): ViewTableData {
  if (data.filters.length >= MAX_VIEW_TABLE_FILTERS) return data
  const column = (columnId === undefined ? null : viewTableColumnById(data, columnId)) ?? data.columns[0]
  if (!column) return data
  const allowed = FILTER_OPS_BY_TYPE[column.type]
  const resolvedOp = op && allowed.includes(op) ? op : allowed[0]
  const filter: ViewTableFilter = {
    id: createViewTableFilterId(data.filters.map(candidate => candidate.id)),
    columnId: column.id,
    op: resolvedOp,
    value: viewTableFilterNeedsValue(resolvedOp) ? value : '',
  }
  return { ...data, filters: [...data.filters, filter] }
}

export function updateViewTableFilter(
  data: ViewTableData,
  filterId: string,
  patch: Partial<Omit<ViewTableFilter, 'id'>>,
): ViewTableData {
  const filters = data.filters.map(filter => {
    if (filter.id !== filterId) return filter
    const next = { ...filter, ...patch, id: filter.id }
    // Switching to another column may make the operator meaningless.
    const column = viewTableColumnById(data, next.columnId)
    const allowed = column ? FILTER_OPS_BY_TYPE[column.type] : null
    if (allowed && !allowed.includes(next.op)) {
      next.op = allowed[0]
      next.value = ''
    }
    if (!viewTableFilterNeedsValue(next.op)) next.value = ''
    return next
  })
  return { ...data, filters }
}

export function removeViewTableFilter(data: ViewTableData, filterId: string): ViewTableData {
  const filters = data.filters.filter(filter => filter.id !== filterId)
  return filters.length === data.filters.length ? data : { ...data, filters }
}

export function setViewTableSort(data: ViewTableData, sort: ViewTableSort | null): ViewTableData {
  if (sort === null) return data.sort === null ? data : { ...data, sort: null }
  if (!viewTableColumnById(data, sort.columnId)) return data
  if (data.sort?.columnId === sort.columnId && data.sort.direction === sort.direction) return data
  return { ...data, sort }
}

function viewTableRowMatchesFilter(row: ViewTableRow, filter: ViewTableFilter, data: ViewTableData): boolean {
  const column = viewTableColumnById(data, filter.columnId)
  if (column === null) return true
  const value = row[filter.columnId] ?? null

  switch (filter.op) {
    case 'isEmpty':
      return isViewTableCellEmpty(value)
    case 'isNotEmpty':
      return !isViewTableCellEmpty(value)
    case 'isTrue':
      return value === true
    case 'isFalse':
      return value !== true
    default:
      break
  }

  const needle = filter.value.trim()
  // An unfinished condition should not hide every row.
  if (needle === '') return true

  const text = viewTableCellText(value, column.type)
  const haystack = text.toLowerCase()
  const lowered = needle.toLowerCase()

  switch (filter.op) {
    case 'contains':
      return haystack.includes(lowered)
    case 'notContains':
      return !haystack.includes(lowered)
    case 'equals':
      return haystack === lowered
    case 'notEquals':
      return haystack !== lowered
    case 'gt': {
      const left = Number(text)
      const right = Number(needle)
      return Number.isFinite(left) && Number.isFinite(right) && left > right
    }
    case 'lt': {
      const left = Number(text)
      const right = Number(needle)
      return Number.isFinite(left) && Number.isFinite(right) && left < right
    }
    case 'before':
      return text !== '' && text < needle
    case 'after':
      return text !== '' && text > needle
    default:
      return true
  }
}

function compareViewTableCells(
  left: ViewTableCellValue,
  right: ViewTableCellValue,
  type: ViewTableColumnType,
): number {
  if (type === 'checkbox') return (left === true ? 1 : 0) - (right === true ? 1 : 0)
  if (type === 'number') {
    const leftNumber = typeof left === 'number' ? left : Number(left)
    const rightNumber = typeof right === 'number' ? right : Number(right)
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber
  }
  const leftText = Array.isArray(left) ? left.join('\u0000') : String(left)
  const rightText = Array.isArray(right) ? right.join('\u0000') : String(right)
  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' })
}

export interface ViewTableVisibleRow {
  row: ViewTableRow
  /** Index in `data.rows`, so edits still target the authored row. */
  index: number
}

/**
 * Rows as shown: filters (AND) → transient search → sort. Empty cells always
 * sink to the bottom, whichever direction is chosen.
 */
export function viewTableVisibleRows(data: ViewTableData, search = ''): ViewTableVisibleRow[] {
  let entries: ViewTableVisibleRow[] = data.rows.map((row, index) => ({ row, index }))

  if (data.filters.length > 0) {
    entries = entries.filter(entry => data.filters.every(filter => viewTableRowMatchesFilter(entry.row, filter, data)))
  }

  const query = search.trim()
  if (query !== '') {
    entries = entries.filter(entry => viewTableRowMatches(entry.row, data.columns, query))
  }

  const sort = data.sort
  if (!sort) return entries
  const column = viewTableColumnById(data, sort.columnId)
  if (column === null) return entries

  const factor = sort.direction === 'desc' ? -1 : 1
  return [...entries].sort((left, right) => {
    const leftEmpty = isViewTableCellEmpty(left.row[column.id] ?? null)
    const rightEmpty = isViewTableCellEmpty(right.row[column.id] ?? null)
    if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1
    if (leftEmpty) return left.index - right.index
    const order = compareViewTableCells(left.row[column.id] ?? null, right.row[column.id] ?? null, column.type)
    return order === 0 ? left.index - right.index : order * factor
  })
}
