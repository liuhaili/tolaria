export const EMPTY_DIAGRAM = '<mxfile><diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'
export const MAX_DIAGRAM_LENGTH = 16 * 1024 * 1024

export function isDiagramPath(path: string): boolean {
  return /\.drawio$/i.test(path)
}

export function diagramFileStem(title: string): string {
  const stem = [...title.trim()].slice(0, 80).map(char => (
    char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? '-' : char
  )).join('').replace(/[. ]+$/, '') || 'diagram'
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ? `${stem}-diagram` : stem
}

export type DrawioEvent = { event: 'init' } | { event: 'save' | 'autosave'; xml: string } | { event: 'export'; xml: string; data: string }

export function parseDrawioEvent(data: unknown): DrawioEvent | null {
  if (typeof data !== 'string' || data.length > MAX_DIAGRAM_LENGTH) return null
  try {
    const message: unknown = JSON.parse(data)
    if (!message || typeof message !== 'object') return null
    const event = Reflect.get(message, 'event')
    if (event === 'init') return { event }
    if (event !== 'save' && event !== 'autosave' && event !== 'export') return null
    const xml: unknown = Reflect.get(message, 'xml')
    if (typeof xml !== 'string' || xml.length > MAX_DIAGRAM_LENGTH || /<!DOCTYPE/i.test(xml)) return null
    const document = new DOMParser().parseFromString(xml, 'application/xml')
    if (document.querySelector('parsererror') || !['mxfile', 'mxGraphModel'].includes(document.documentElement.nodeName)) return null
    if (event === 'export') {
      const data: unknown = Reflect.get(message, 'data')
      return typeof data === 'string' && Reflect.get(message, 'format') === 'svg' ? { event, xml, data } : null
    }
    return { event, xml }
  } catch {
    return null
  }
}
