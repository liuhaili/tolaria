import { describe, expect, it } from 'vitest'
import { injectDurableEditorMarkdownBlocks, preProcessDurableEditorMarkdown, serializeDurableEditorBlocks } from './editorDurableMarkdown'
import { DRAWIO_BLOCK_TYPE, EMPTY_DRAWIO_SNAPSHOT, drawioFenceSource, readDrawioSnapshot } from './drawioMarkdown'

describe('embedded drawio persistence', () => {
  it('round trips editable diagram and preview through the real Markdown pipeline', () => {
    const source = drawioFenceSource(EMPTY_DRAWIO_SNAPSHOT)
    const token = preProcessDurableEditorMarkdown({ markdown: source })
    const blocks = injectDurableEditorMarkdownBlocks([{ type: 'paragraph', content: [{ type: 'text', text: token }] }])
    expect(blocks[0]).toMatchObject({ type: DRAWIO_BLOCK_TYPE, props: { snapshot: EMPTY_DRAWIO_SNAPSHOT } })
    expect(serializeDurableEditorBlocks({ blocksToMarkdownLossy: () => '' }, blocks)).toBe(source)
  })
  it('does not turn corrupt payloads into an empty editable diagram', () => {
    expect(readDrawioSnapshot('{"version":1,"xml":"<html/>","svg":""}')).toBeNull()
    expect(readDrawioSnapshot('broken')).toBeNull()
    const token = preProcessDurableEditorMarkdown({ markdown: '```drawio\nbroken\n```' })
    expect(injectDurableEditorMarkdownBlocks([{ type: 'paragraph', content: [{ type: 'text', text: token }] }])[0])
      .toMatchObject({ type: 'codeBlock', content: [{ type: 'text', text: 'broken' }] })
  })
  it('uses a longer fence when a diagram label contains backticks', () => {
    expect(drawioFenceSource('label ``` text')).toMatch(/^````drawio/)
  })
})
