import { advanceMarkdownFence, type MarkdownFence } from './markdownFences'
import { rewriteMarkdownImageTokens, type MarkdownImageToken } from './vaultImages'

const WIDTH_TITLE = /^\s+"tolaria-width=(\d{1,5})"$/u
const WIDTH_TOKEN = /@@TOLARIA_IMAGE_WIDTH:(\d{1,5})@@$/u

function imageWidth(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 10000
    ? Math.round(value)
    : null
}

function imageDestination(url: string): string {
  return /[\s)]/u.test(url) ? `<${url.replace(/>/gu, '%3E')}>` : url
}

function insideInlineCode(line: string, position: number): boolean {
  let delimiter = ''
  for (const match of line.slice(0, position).matchAll(/`+/gu)) {
    if (delimiter === '') delimiter = match[0]
    else if (delimiter === match[0]) delimiter = ''
  }
  return delimiter !== ''
}

function rewriteImagesOutsideCode(
  markdown: string,
  transform: (image: MarkdownImageToken) => string | null,
): string {
  let fence: MarkdownFence | null = null
  return markdown.split(/(\r?\n)/u).map(line => {
    if (line === '\n' || line === '\r\n') return line
    const nextFence = advanceMarkdownFence(line, fence)
    const boundary = nextFence !== fence
    fence = nextFence
    if (boundary || fence) return line
    return rewriteMarkdownImageTokens(line, image => (
      insideInlineCode(line, image.start) ? null : transform(image)
    ))
  }).join('')
}

/** Carry dimensions through BlockNote's Markdown parser without raw HTML. */
export function preProcessImageWidths(markdown: string): string {
  return rewriteImagesOutsideCode(markdown, image => {
    const match = WIDTH_TITLE.exec(image.title)
    const width = match ? imageWidth(Number(match[1])) : null
    if (width === null) return null
    return `![${image.alt}@@TOLARIA_IMAGE_WIDTH:${width}@@](${imageDestination(image.url)})`
  })
}

function restoreImageWidth(block: unknown): unknown {
  if (typeof block !== 'object' || block === null) return block
  const props: unknown = Reflect.get(block, 'props')
  let restored = block
  if (Reflect.get(block, 'type') === 'image' && typeof props === 'object' && props !== null) {
    const name: unknown = Reflect.get(props, 'name')
    const match = typeof name === 'string' ? WIDTH_TOKEN.exec(name) : null
    const width = match ? imageWidth(Number(match[1])) : null
    if (width !== null && typeof name === 'string') {
      restored = { ...block, props: { ...props, name: name.replace(WIDTH_TOKEN, ''), previewWidth: width } }
    }
  }
  const children: unknown = Reflect.get(restored, 'children')
  return Array.isArray(children)
    ? { ...restored, children: children.map(restoreImageWidth) }
    : restored
}

export function injectImageWidths(blocks: unknown[]): unknown[] {
  return blocks.map(restoreImageWidth)
}

function collectImageWidths(blocks: unknown[], widths: Map<string, (number | null)[]>): void {
  for (const block of blocks) {
    if (typeof block !== 'object' || block === null) continue
    const props: unknown = Reflect.get(block, 'props')
    if (Reflect.get(block, 'type') === 'image' && typeof props === 'object' && props !== null) {
      const url: unknown = Reflect.get(props, 'url')
      if (typeof url === 'string') {
        const values = widths.get(url) ?? []
        values.push(imageWidth(Reflect.get(props, 'previewWidth')))
        widths.set(url, values)
      }
    }
    const children: unknown = Reflect.get(block, 'children')
    if (Array.isArray(children)) collectImageWidths(children, widths)
  }
}

/** Markdown titles carry dimensions without tying attachments to this computer. */
export function serializeImageWidths(markdown: string, blocks: unknown[]): string {
  const widths = new Map<string, (number | null)[]>()
  collectImageWidths(blocks, widths)
  return rewriteImagesOutsideCode(markdown, image => {
    const width = widths.get(image.url)?.shift()
    return width ? `![${image.alt}](${imageDestination(image.url)} "tolaria-width=${width}")` : null
  })
}
