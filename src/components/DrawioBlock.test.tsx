import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { DrawioBlock } from './DrawioBlock'
import { DRAWIO_BLOCK_TYPE, EMPTY_DRAWIO_SNAPSHOT } from '../utils/drawioMarkdown'
import { EMPTY_DIAGRAM } from '../utils/drawio'

vi.mock('./DrawioEditor', () => ({
  DrawioEditor: ({ onSaveDraft, onPreviewSaved }: { onSaveDraft: (xml: string) => void; onPreviewSaved: (xml: string, svg: string) => void }) => (
    <>
      <button onClick={() => onSaveDraft(EMPTY_DIAGRAM)}>draft</button>
      <button onClick={() => onPreviewSaved(EMPTY_DIAGRAM, '<svg xmlns="http://www.w3.org/2000/svg"/>')}>preview</button>
    </>
  ),
}))
vi.mock('../lib/telemetry', () => ({ trackEvent: vi.fn() }))

it('updates the owning Markdown block, then closes the editor when the preview is saved', () => {
  const block = { id: 'diagram-a', type: DRAWIO_BLOCK_TYPE, props: { snapshot: EMPTY_DRAWIO_SNAPSHOT } }
  const editor = { getBlock: vi.fn(() => block), updateBlock: vi.fn() }
  render(<DrawioBlock block={block} editor={editor} />)
  fireEvent.click(screen.getByText('draft'))
  expect(editor.updateBlock).toHaveBeenCalledWith(block.id, expect.objectContaining({ type: DRAWIO_BLOCK_TYPE }))
  fireEvent.click(screen.getByText('preview'))
  expect(JSON.parse(editor.updateBlock.mock.calls[1][1].props.snapshot)).toMatchObject({ xml: EMPTY_DIAGRAM, svg: expect.stringContaining('<svg') })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('keeps a corrupt diagram visible as an error rather than overwriting it with a blank diagram', () => {
  const editor = { getBlock: vi.fn(), updateBlock: vi.fn() }
  render(<DrawioBlock block={{ id: 'a', props: { snapshot: 'corrupt' } }} editor={editor} />)
  expect(screen.getByRole('alert')).toHaveTextContent('流程图加载或保存失败')
  expect(editor.updateBlock).not.toHaveBeenCalled()
})
