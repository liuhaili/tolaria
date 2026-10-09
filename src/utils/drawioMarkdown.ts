import { EMPTY_DIAGRAM, MAX_DIAGRAM_LENGTH, parseDrawioEvent } from './drawio'
import { type BlockLike, type DurableBlockCodec, readCodeBlockLanguage, readInlineText } from './durableMarkdownBlocks'

export const DRAWIO_BLOCK_TYPE = 'drawioBlock'
export const EMPTY_DRAWIO_SNAPSHOT = JSON.stringify({ version: 1, xml: EMPTY_DIAGRAM, svg: '' })
export interface DrawioSnapshot { version: 1; xml: string; svg: string }

export function readDrawioSnapshot(snapshot: string): DrawioSnapshot | null {
  if (snapshot.length > MAX_DIAGRAM_LENGTH) return null
  try {
    const value: unknown = JSON.parse(snapshot)
    if (!value || typeof value !== 'object' || Reflect.get(value, 'version') !== 1) return null
    const xml: unknown = Reflect.get(value, 'xml')
    const svg: unknown = Reflect.get(value, 'svg')
    if (typeof xml !== 'string' || typeof svg !== 'string') return null
    if (!parseDrawioEvent(JSON.stringify({ event: 'save', xml }))) return null
    return { version: 1, xml, svg }
  } catch { return null }
}

export function drawioFenceSource(snapshot: string): string {
  const longest = Math.max(0, ...Array.from(snapshot.matchAll(/`+/g), match => match[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}drawio\n${snapshot}\n${fence}`
}

function snapshotPayload(value: unknown): { snapshot: string } | null {
  if (!value || typeof value !== 'object') return null
  const snapshot: unknown = Reflect.get(value, 'snapshot')
  return typeof snapshot === 'string' ? { snapshot } : null
}

function codeBlockPayload(block: BlockLike) {
  if (block.type !== 'codeBlock' || readCodeBlockLanguage({ block }) !== 'drawio') return null
  const snapshot = readInlineText(block.content)
  return snapshot === null || !readDrawioSnapshot(snapshot) ? null : { snapshot }
}

export const drawioMarkdownCodec: DurableBlockCodec = {
  tokenPrefix: '@@TOLARIA_DRAWIO_BLOCK:', tokenSuffix: '@@',
  readFenceMetadata: info => info.trim().toLowerCase() === 'drawio' ? {} : null,
  buildPayload: ({ lines, start, end }) => ({ snapshot: lines.slice(start + 1, end).join('').trim() }),
  decodePayload: snapshotPayload,
  buildBlock: (block, payload): BlockLike => {
    const snapshot = snapshotPayload(payload)?.snapshot ?? ''
    if (!readDrawioSnapshot(snapshot)) return { ...block, type: 'codeBlock', props: { language: 'drawio' }, content: [{ type: 'text', text: snapshot }], children: [] }
    return { ...block, type: DRAWIO_BLOCK_TYPE, props: { snapshot }, content: undefined, children: [] }
  },
  readCodeBlock: codeBlockPayload,
  isBlock: block => block.type === DRAWIO_BLOCK_TYPE && typeof block.props?.snapshot === 'string',
  serializeBlock: block => drawioFenceSource(block.props?.snapshot ?? EMPTY_DRAWIO_SNAPSHOT),
}
