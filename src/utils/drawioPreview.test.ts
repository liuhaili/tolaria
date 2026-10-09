import { describe, expect, it } from 'vitest'
import { decodeDrawioPreview, drawioPreviewUrl, safeDrawioSvg } from './drawioPreview'

describe('passive drawio previews', () => {
  it('decodes local SVG exports and preserves labels', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>流程</text></svg>'
    expect(decodeDrawioPreview(`data:image/svg+xml,${encodeURIComponent(svg)}`)).toContain('流程')
    expect(drawioPreviewUrl(svg)).toMatch(/^data:image\/svg\+xml/)
  })
  it('removes scripts, active attributes and remote resources', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="evil()"><script>evil()</script><image href="https://example.com/a.png"/><style>@import "https://example.com/font";</style></svg>'
    expect(safeDrawioSvg(svg)).not.toMatch(/evil|https|script|onload/)
  })
  it('rejects malformed previews and external entities', () => {
    expect(safeDrawioSvg('<html/>')).toBeNull()
    expect(safeDrawioSvg('<!DOCTYPE svg><svg/>')).toBeNull()
    expect(decodeDrawioPreview('https://example.com/preview.svg')).toBeNull()
  })
})
