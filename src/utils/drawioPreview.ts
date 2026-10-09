import { MAX_DIAGRAM_LENGTH } from './drawio'

/** SVG is displayed only as an image, never inserted into the document's DOM. */
export function safeDrawioSvg(svg: string): string | null {
  if (svg.length > MAX_DIAGRAM_LENGTH || /<!DOCTYPE/i.test(svg)) return null
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') return null
  document.querySelectorAll('script, iframe, object, embed, link').forEach(node => node.remove())
  for (const node of document.querySelectorAll('*')) {
    for (const attr of Array.from(node.attributes)) {
      const link = ['href', 'src'].includes(attr.localName)
      const safeLink = attr.value.startsWith('#') || /^data:image\/(png|jpeg|gif|webp);base64,/i.test(attr.value)
      if (/^on/i.test(attr.name) || (link && !safeLink) || /@import|url\(\s*['"]?(?:https?:|\/\/)/i.test(attr.value)) node.removeAttributeNode(attr)
    }
    if (node.localName === 'style' && /@import|url\(\s*['"]?(?:https?:|\/\/)/i.test(node.textContent ?? '')) node.remove()
  }
  return new XMLSerializer().serializeToString(document.documentElement)
}

export function decodeDrawioPreview(data: unknown): string | null {
  if (typeof data !== 'string' || data.length > MAX_DIAGRAM_LENGTH) return null
  const match = /^data:image\/svg\+xml(?:;charset=utf-8)?(;base64)?,(.*)$/is.exec(data)
  if (!match) return null
  try {
    const svg = match[1] ? new TextDecoder().decode(Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))) : decodeURIComponent(match[2])
    return safeDrawioSvg(svg)
  } catch { return null }
}

export function drawioPreviewUrl(svg: string): string | undefined {
  const safe = svg ? safeDrawioSvg(svg) : null
  return safe ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safe)}` : undefined
}
