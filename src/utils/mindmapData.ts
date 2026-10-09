import type { MindElixirData, NodeObj } from 'mind-elixir'

export const MINDMAP_BLOCK_TYPE = 'mindmapBlock'
export const MINDMAP_APPEARANCES = ['colorful', 'minimal', 'ocean'] as const
export type MindmapAppearance = typeof MINDMAP_APPEARANCES[number]
export interface MindmapSnapshot {
  version: 1
  data: MindElixirData
  appearance: MindmapAppearance
  svg: string
}
const MAX_SNAPSHOT_LENGTH = 8_000_000
const MAX_NODES = 2000

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid mind map object')
  return value as Record<string, unknown>
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum) throw new Error('Invalid mind map text')
  return value
}

function readStyle(value: unknown): NodeObj['style'] {
  if (value === undefined) return undefined
  const source = record(value)
  const style: NonNullable<NodeObj['style']> = {}
  for (const key of ['color', 'background'] as const) {
    const color = source[key]
    if (color !== undefined) {
      if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Invalid mind map color')
      style[key] = color
    }
  }
  if (source.fontSize !== undefined) {
    if (typeof source.fontSize !== 'string' || !/^(12|14|16|18|20|24|28|32)px$/.test(source.fontSize)) throw new Error('Invalid mind map font size')
    style.fontSize = source.fontSize
  }
  if (source.fontWeight !== undefined) {
    if (!['normal', 'bold', '400', '700'].includes(String(source.fontWeight))) throw new Error('Invalid mind map font weight')
    style.fontWeight = String(source.fontWeight)
  }
  return style
}

function readNode(value: unknown, ids: Set<string>, depth: number): NodeObj {
  if (depth > 80 || ids.size >= MAX_NODES) throw new Error('Mind map is too large')
  const source = record(value)
  const id = text(source.id, 100)
  if (!id || !/^[a-z0-9_-]+$/i.test(id) || ids.has(id)) throw new Error('Invalid mind map node id')
  ids.add(id)
  // Never give imported HTML, links, remote images or arbitrary CSS to the DOM renderer.
  if (source.dangerouslySetInnerHTML !== undefined || source.image !== undefined || source.hyperLink !== undefined) throw new Error('Unsupported active mind map content')
  const node: NodeObj = { id, topic: text(source.topic, 4000) }
  if (source.style !== undefined) node.style = readStyle(source.style)
  if (typeof source.expanded === 'boolean') node.expanded = source.expanded
  if (source.direction === 0 || source.direction === 1) node.direction = source.direction
  if (source.branchColor !== undefined) {
    const style = readStyle({ color: source.branchColor })
    node.branchColor = style?.color
  }
  if (source.icons !== undefined) {
    if (!Array.isArray(source.icons) || source.icons.length > 10) throw new Error('Invalid mind map icons')
    node.icons = source.icons.map(icon => text(icon, 32))
  }
  if (source.children !== undefined) {
    if (!Array.isArray(source.children)) throw new Error('Invalid mind map children')
    node.children = source.children.map(child => readNode(child, ids, depth + 1))
  }
  return node
}

export function normalizeMindmapData(value: unknown): MindElixirData {
  const source = record(value)
  const direction = source.direction ?? 2
  if (![0, 1, 2, 3].includes(Number(direction)) || typeof direction !== 'number') throw new Error('Invalid mind map direction')
  for (const key of ['arrows', 'summaries'] as const) {
    if (source[key] !== undefined && (!Array.isArray(source[key]) || source[key].length > 0)) throw new Error('Unsupported mind map relations')
  }
  return { nodeData: readNode(source.nodeData, new Set(), 0), direction: direction as 0 | 1 | 2 | 3, compact: source.compact === true }
}

export function readMindmapSnapshot(snapshot: string): MindmapSnapshot | null {
  if (snapshot.length > MAX_SNAPSHOT_LENGTH) return null
  try {
    const value = record(JSON.parse(snapshot))
    if (value.version !== 1 || !MINDMAP_APPEARANCES.some(name => name === value.appearance)) return null
    return { version: 1, data: normalizeMindmapData(value.data), appearance: value.appearance as MindmapAppearance, svg: text(value.svg, MAX_SNAPSHOT_LENGTH) }
  } catch { return null }
}

export function createMindmapSnapshot(rootTopic: string, childTopic: string): string {
  return JSON.stringify({ version: 1, appearance: 'colorful', svg: '', data: {
    direction: 2,
    nodeData: { id: crypto.randomUUID(), topic: rootTopic, children: [
      { id: crypto.randomUUID(), topic: childTopic, direction: 0 },
      { id: crypto.randomUUID(), topic: childTopic, direction: 1 },
    ] },
  } })
}

export const EMPTY_MINDMAP_SNAPSHOT = JSON.stringify({ version: 1, appearance: 'colorful', svg: '', data: {
  direction: 2, nodeData: { id: 'root', topic: '', children: [] },
} })
