import { type BlockLike, type DurableBlockCodec, readInlineText } from './durableMarkdownBlocks'
import {
  MAX_VIEW_TABLE_SOURCE_LENGTH,
  parseViewTableData,
  serializeViewTableData,
  type ViewTableData,
} from './viewTableModel'

export const VIEW_TABLE_BLOCK_TYPE = 'viewTableBlock'
export const VIEW_TABLE_FENCE_LANGUAGE = 'view'

/** An empty fence body means "a fresh default table" (see parseViewTableData). */
export const EMPTY_VIEW_TABLE_SOURCE = ''

/** Aliases accepted when reading a note; serialization always writes `view`. */
const VIEW_TABLE_FENCE_LANGUAGES = new Set(['view', 'database', 'db', 'data'])

/** Accepts `view` (plus the `database`/`db`/`data` aliases) and nothing else. */
export function readViewTableFenceInfo(info: string): string | null {
  const language = info.trim().split(/\s+/u)[0]?.toLowerCase() ?? ''
  return VIEW_TABLE_FENCE_LANGUAGES.has(language) ? language : null
}

export function isViewTableSource(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_VIEW_TABLE_SOURCE_LENGTH
}

function fenceLine(source: string): string {
  let longest = 0
  for (const match of source.matchAll(/`+/gu)) longest = Math.max(longest, match[0].length)
  return '`'.repeat(Math.max(3, longest + 1))
}

export function viewTableFenceSource(source: string): string {
  const fence = fenceLine(source)
  const body = source.trim()
  return body === ''
    ? `${fence}${VIEW_TABLE_FENCE_LANGUAGE}\n${fence}`
    : `${fence}${VIEW_TABLE_FENCE_LANGUAGE}\n${body}\n${fence}`
}

interface ViewTablePayload {
  source: string
  /**
   * Fence language the payload came from. Only the alias paths set it, so a
   * ```db fence whose body is not table data can be handed back as-is instead
   * of being relabelled `view`.
   */
  language?: string
}

function payload(value: unknown): ViewTablePayload | null {
  if (!value || typeof value !== 'object') return null
  const source: unknown = Reflect.get(value, 'source')
  if (typeof source !== 'string') return null
  const language = Reflect.get(value, 'language')
  return {
    source,
    language: typeof language === 'string' && VIEW_TABLE_FENCE_LANGUAGES.has(language) ? language : undefined,
  }
}

function readViewTableCodeBlock(block: BlockLike) {
  const language = block.props?.language
  if (typeof language !== 'string') return null
  const matched = readViewTableFenceInfo(language)
  if (!matched) return null
  const source = readInlineText(block.content)
  if (source === null || !isViewTableSource(source)) return null
  return { source: source.trim(), language: matched }
}

export const viewTableMarkdownCodec: DurableBlockCodec = {
  tokenPrefix: '@@TOLARIA_VIEW_TABLE:',
  tokenSuffix: '@@',
  readFenceMetadata: readViewTableFenceInfo,
  buildPayload: ({ lines, start, end }) => ({
    source: lines.slice(start + 1, end).join('').trim(),
  }),
  decodePayload: payload,
  buildBlock: (block, value): BlockLike => {
    const decoded = payload(value)
    const source = decoded?.source ?? ''
    const parsed: ViewTableData | null = parseViewTableData(source)
    // Unreadable body: keep the author's text as a code block, under the fence
    // language it was written with, instead of silently showing an empty table.
    if (!parsed) {
      return {
        ...block,
        type: 'codeBlock',
        props: { language: decoded?.language ?? VIEW_TABLE_FENCE_LANGUAGE },
        content: [{ type: 'text', text: source }],
        children: [],
      }
    }
    return {
      ...block,
      type: VIEW_TABLE_BLOCK_TYPE,
      props: { source: serializeViewTableData(parsed) } as unknown as Record<string, string>,
      content: undefined,
      children: [],
    }
  },
  readCodeBlock: readViewTableCodeBlock,
  isBlock: block => block.type === VIEW_TABLE_BLOCK_TYPE && typeof block.props?.source === 'string',
  serializeBlock: block => viewTableFenceSource(block.props?.source ?? EMPTY_VIEW_TABLE_SOURCE),
}
