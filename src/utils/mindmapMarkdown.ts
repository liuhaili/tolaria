import { MINDMAP_BLOCK_TYPE, EMPTY_MINDMAP_SNAPSHOT, readMindmapSnapshot } from './mindmapData'
import { type BlockLike, type DurableBlockCodec, readCodeBlockLanguage, readInlineText } from './durableMarkdownBlocks'

export function mindmapFenceSource(snapshot: string): string {
  let longest = 0
  for (const match of snapshot.matchAll(/`+/g)) longest = Math.max(longest, match[0].length)
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}mindmap\n${snapshot}\n${fence}`
}

function payload(value: unknown): { snapshot: string } | null {
  if (!value || typeof value !== 'object') return null
  const snapshot: unknown = Reflect.get(value, 'snapshot')
  return typeof snapshot === 'string' ? { snapshot } : null
}

function readCodeBlock(block: BlockLike) {
  if (block.type !== 'codeBlock' || readCodeBlockLanguage({ block }) !== 'mindmap') return null
  const snapshot = readInlineText(block.content)
  return snapshot === null || !readMindmapSnapshot(snapshot) ? null : { snapshot }
}

export const mindmapMarkdownCodec: DurableBlockCodec = {
  tokenPrefix: '@@TOLARIA_MINDMAP_BLOCK:', tokenSuffix: '@@',
  readFenceMetadata: info => info.trim().toLowerCase() === 'mindmap' ? {} : null,
  buildPayload: ({ lines, start, end }) => ({ snapshot: lines.slice(start + 1, end).join('').trim() }),
  decodePayload: payload,
  buildBlock: (block, value): BlockLike => {
    const snapshot = payload(value)?.snapshot ?? ''
    if (!readMindmapSnapshot(snapshot)) return { ...block, type: 'codeBlock', props: { language: 'mindmap' }, content: [{ type: 'text', text: snapshot }], children: [] }
    return { ...block, type: MINDMAP_BLOCK_TYPE, props: { snapshot }, content: undefined, children: [] }
  },
  readCodeBlock,
  isBlock: block => block.type === MINDMAP_BLOCK_TYPE && typeof block.props?.snapshot === 'string',
  serializeBlock: block => mindmapFenceSource(block.props?.snapshot ?? EMPTY_MINDMAP_SNAPSHOT),
}
