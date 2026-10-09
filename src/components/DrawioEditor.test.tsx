import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DrawioEditor } from './DrawioEditor'
import { EMPTY_DIAGRAM } from '../utils/drawio'

const save = vi.hoisted(() => vi.fn())
const runtime = vi.hoisted(() => ({ native: false, convert: vi.fn(() => 'http://tolaria-drawio.localhost/index.html') }))
vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: runtime.convert, invoke: save }))
vi.mock('../mock-tauri', () => ({ isTauri: () => runtime.native, mockInvoke: save }))
vi.mock('../lib/telemetry', () => ({ trackEvent: vi.fn() }))

function send(event: object, trusted = true) {
  const iframe = screen.getByTitle('离线流程图编辑器') as HTMLIFrameElement
  fireEvent(window, new MessageEvent('message', {
    source: trusted ? iframe.contentWindow : window,
    origin: location.origin,
    data: JSON.stringify(event),
  }))
}

describe('DrawioEditor persistence', () => {
  beforeEach(() => { runtime.native = false; runtime.convert.mockClear(); save.mockReset().mockResolvedValue(undefined) })
  it('uses a filename rather than an encoded absolute path for the native asset protocol', () => {
    runtime.native = true
    render(<DrawioEditor path="/vault/a.drawio" title="a" content={EMPTY_DIAGRAM} vaultPath="/vault" />)
    expect(runtime.convert).toHaveBeenCalledWith('index.html', 'tolaria-drawio')
    expect(screen.getByTitle('离线流程图编辑器').getAttribute('src')).toContain('http://tolaria-drawio.localhost/index.html?embed=1')
  })
  it('updates an embedded document and SVG preview without writing a separate file', async () => {
    const onSaveDraft = vi.fn()
    const onPreviewSaved = vi.fn()
    render(<DrawioEditor path="embedded:a" title="a" content={EMPTY_DIAGRAM} onSaveDraft={onSaveDraft} onPreviewSaved={onPreviewSaved} />)
    send({ event: 'init' })
    send({ event: 'autosave', xml: EMPTY_DIAGRAM })
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(EMPTY_DIAGRAM))
    send({ event: 'export', xml: EMPTY_DIAGRAM, format: 'svg', data: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E' })
    await waitFor(() => expect(onPreviewSaved).toHaveBeenCalledWith(EMPTY_DIAGRAM, expect.stringContaining('<svg')))
    expect(save).not.toHaveBeenCalled()
  })
  it('ignores messages from other frames and saves only valid diagrams', async () => {
    const onSaved = vi.fn()
    render(<DrawioEditor path="/vault/a.drawio" title="a" content={EMPTY_DIAGRAM} vaultPath="/vault" onSaved={onSaved} />)
    send({ event: 'init' })
    send({ event: 'save', xml: EMPTY_DIAGRAM }, false)
    send({ event: 'save', xml: '<html/>' })
    expect(save).not.toHaveBeenCalled()
    send({ event: 'save', xml: EMPTY_DIAGRAM })
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('/vault/a.drawio', EMPTY_DIAGRAM))
    expect(save).toHaveBeenCalledWith('save_note_content', { path: '/vault/a.drawio', content: EMPTY_DIAGRAM, vaultPath: '/vault' })
  })
  it('keeps a failed save visible and retries the same draft', async () => {
    save.mockRejectedValueOnce(new Error('disk full'))
    render(<DrawioEditor path="/vault/a.drawio" title="a" content={EMPTY_DIAGRAM} vaultPath="/vault" />)
    send({ event: 'init' })
    send({ event: 'save', xml: EMPTY_DIAGRAM })
    await screen.findByText('流程图加载或保存失败')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByText('已保存到本地')
    expect(save).toHaveBeenCalledTimes(2)
  })
  it('serializes writes so slow earlier saves cannot replace the newest diagram', async () => {
    let finish: (() => void) | undefined
    save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    render(<DrawioEditor path="/vault/a.drawio" title="a" content={EMPTY_DIAGRAM} vaultPath="/vault" />)
    send({ event: 'init' })
    const newer = EMPTY_DIAGRAM.replace('Page-1', 'Page-2')
    send({ event: 'autosave', xml: EMPTY_DIAGRAM })
    send({ event: 'autosave', xml: newer })
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await act(async () => { finish?.() })
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1][1].content).toBe(newer)
  })
})
