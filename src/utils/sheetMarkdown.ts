import { type BlockLike, type DurableBlockCodec, readInlineText } from './durableMarkdownBlocks'

export const SHEET_BLOCK_TYPE = 'sheetBlock'
export const SHEET_FENCE_LANGUAGE = 'sheet'
export const EMPTY_SHEET_DOCUMENT = ''
/** Guards against a runaway table turning a note into an unopenable file. */
export const MAX_SHEET_DOCUMENT_LENGTH = 1_000_000

/** Block frame size in px; 0 means "unset" (width follows the editor, height uses the default). */
export interface SheetFrameSize { width: number; height: number }

const SHEET_FENCE_INFO_PATTERN = /^sheet(?:[ \t]+(\d{1,5})x(\d{1,5}))?$/iu

/**
 * Accepts `sheet` and `sheet 640x420` (a user-resized frame); anything else is
 * not a sheet fence.
 */
export function readSheetFenceInfo(info: string): SheetFrameSize | null {
  const match = SHEET_FENCE_INFO_PATTERN.exec(info.trim())
  if (!match) return null
  return { width: frameSize(match[1]), height: frameSize(match[2]) }
}

export function isSheetDocument(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= MAX_SHEET_DOCUMENT_LENGTH
    && !value.includes('\u0000')
}

function frameSize(value: string | undefined): number {
  if (value === undefined) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0
}

function frameProp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
}

export function sheetFenceInfo({ width, height }: SheetFrameSize): string {
  return width > 0 || height > 0 ? `${SHEET_FENCE_LANGUAGE} ${width}x${height}` : SHEET_FENCE_LANGUAGE
}

export function sheetFenceSource(document: string, size: SheetFrameSize = { width: 0, height: 0 }): string {
  let longest = 0
  for (const match of document.matchAll(/`+/g)) longest = Math.max(longest, match[0].length)
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}${sheetFenceInfo(size)}\n${document}\n${fence}`
}

interface SheetPayload {
  document: string
  width: number
  height: number
}

function payload(value: unknown): SheetPayload | null {
  if (!value || typeof value !== 'object') return null
  const document: unknown = Reflect.get(value, 'document')
  if (typeof document !== 'string') return null
  return {
    document,
    width: frameProp(Reflect.get(value, 'width')),
    height: frameProp(Reflect.get(value, 'height')),
  }
}

function readSheetCodeBlock(block: BlockLike) {
  const language = block.props?.language
  if (typeof language !== 'string') return null
  const size = readSheetFenceInfo(language)
  if (!size) return null
  const document = readInlineText(block.content)
  return document === null || !isSheetDocument(document) ? null : { document, ...size }
}

export const sheetMarkdownCodec: DurableBlockCodec = {
  tokenPrefix: '@@TOLARIA_SHEET_BLOCK:', tokenSuffix: '@@',
  readFenceMetadata: readSheetFenceInfo,
  buildPayload: ({ lines, start, end, metadata }) => {
    const size = (metadata ?? {}) as Partial<SheetFrameSize>
    return {
      document: lines.slice(start + 1, end).join('').trim(),
      width: frameProp(size.width),
      height: frameProp(size.height),
    }
  },
  decodePayload: payload,
  buildBlock: (block, value): BlockLike => {
    const sheet = payload(value)
    const document = sheet?.document ?? ''
    if (!isSheetDocument(document)) {
      return { ...block, type: 'codeBlock', props: { language: SHEET_FENCE_LANGUAGE }, content: [{ type: 'text', text: document }], children: [] }
    }
    return {
      ...block,
      type: SHEET_BLOCK_TYPE,
      props: { document, width: sheet?.width ?? 0, height: sheet?.height ?? 0 } as unknown as Record<string, string>,
      content: undefined,
      children: [],
    }
  },
  readCodeBlock: readSheetCodeBlock,
  isBlock: block => block.type === SHEET_BLOCK_TYPE && typeof block.props?.document === 'string',
  serializeBlock: block => sheetFenceSource(
    block.props?.document ?? EMPTY_SHEET_DOCUMENT,
    { width: frameProp(block.props?.width), height: frameProp(block.props?.height) },
  ),
}
