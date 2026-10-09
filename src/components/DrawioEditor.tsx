import { useCallback, useEffect, useRef, useState } from 'react'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { parseDrawioEvent } from '../utils/drawio'
import { translate } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { Button } from './ui/button'
import { decodeDrawioPreview } from '../utils/drawioPreview'

interface DrawioEditorProps {
  path: string
  title: string
  content: string
  vaultPath?: string
  onSaved?: (path: string, content: string) => void
  onSaveDraft?: (xml: string) => void | Promise<void>
  onPreviewSaved?: (xml: string, svg: string) => void | Promise<void>
}

export function DrawioEditor({ path, title, content, vaultPath, onSaved, onSaveDraft, onPreviewSaved }: DrawioEditorProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const writes = useRef(Promise.resolve())
  const latest = useRef(content)
  const loaded = useRef(false)
  const [status, setStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const alive = useRef(true)
  const previewTimer = useRef<number | null>(null)
  const base = isTauri() ? convertFileSrc('index.html', 'tolaria-drawio') : `${location.origin}/drawio/index.html`
  const origin = new URL(base).origin
  const nativeOrigin = `${new URL(base).protocol}//${new URL(base).host}`
  const targetOrigin = origin === 'null' ? '*' : origin
  const dark = document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark'
  const url = `${base}?embed=1&proto=json&offline=1&local=1&pwa=0&stealth=1&plugins=0&lang=zh&ui=kennedy&dark=${dark ? '1' : '0'}&noExitBtn=1&saveAndExit=0&libraries=1`
  const requestPreview = useCallback((xml?: string) => {
    setStatus('saving')
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => { if (alive.current) setStatus('error') }, 20000)
    frame.current?.contentWindow?.postMessage(JSON.stringify({ action: 'export', format: 'svg', xml, embedImages: true, currentPage: true, border: 8 }), targetOrigin)
  }, [targetOrigin])

  useEffect(() => { alive.current = true; return () => {
    alive.current = false
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current)
  } }, [])

  const persist = useCallback((xml: string, explicit: boolean) => {
    if (!vaultPath && !onSaveDraft) { setStatus('error'); return }
    setStatus('saving')
    writes.current = writes.current.then(async () => {
      try {
        const save = isTauri() ? invoke : mockInvoke
        if (onSaveDraft) await onSaveDraft(xml)
        else await save('save_note_content', { path, content: xml, vaultPath })
        onSaved?.(path, xml)
        if (alive.current && latest.current === xml) {
          if (explicit && onPreviewSaved) requestPreview(xml)
          else setStatus('saved')
          frame.current?.contentWindow?.postMessage(JSON.stringify({ action: 'status', message: translate('zh-CN', 'drawio.saved'), modified: false }), targetOrigin)
        }
        if (explicit && !onSaveDraft) trackEvent('diagram_saved', { format: 'drawio' })
      } catch {
        if (alive.current) setStatus('error')
      }
    })
  }, [onSaveDraft, onSaved, onPreviewSaved, path, requestPreview, targetOrigin, vaultPath])

  useEffect(() => {
    loaded.current = false
    const timer = window.setTimeout(() => { if (!loaded.current) setStatus('error') }, 30000)
    const receive = (message: MessageEvent) => {
      if (message.source !== frame.current?.contentWindow || (message.origin !== origin && message.origin !== nativeOrigin)) return
      const event = parseDrawioEvent(message.data)
      if (!event) return
      if (event.event === 'init') {
        if (!parseDrawioEvent(JSON.stringify({ event: 'save', xml: latest.current }))) { setStatus('error'); return }
        loaded.current = true
        window.clearTimeout(timer)
        frame.current?.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: latest.current, title, autosave: 1 }), targetOrigin)
        setStatus('saved')
        trackEvent('diagram_opened', { format: onSaveDraft ? 'embedded' : 'drawio' })
        return
      }
      if (!loaded.current) return
      if (event.event === 'export') {
        if (!onPreviewSaved) return
        if (previewTimer.current !== null) window.clearTimeout(previewTimer.current)
        const svg = decodeDrawioPreview(event.data)
        if (!svg) { setStatus('error'); return }
        latest.current = event.xml
        writes.current = writes.current.then(async () => {
          try {
            await onSaveDraft?.(event.xml)
            await onPreviewSaved(event.xml, svg)
            if (alive.current) setStatus('saved')
          } catch { if (alive.current) setStatus('error') }
        })
        return
      }
      latest.current = event.xml
      persist(event.xml, event.event === 'save')
    }
    window.addEventListener('message', receive)
    return () => { window.clearTimeout(timer); window.removeEventListener('message', receive) }
  }, [nativeOrigin, onPreviewSaved, onSaveDraft, origin, persist, retry, targetOrigin, title])

  return <section className="flex h-full min-h-0 flex-col" data-testid="drawio-editor">
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border px-3 text-sm">
      <span className="truncate">{title}</span>
      <span role="status" className="ml-auto">{translate('zh-CN', onSaveDraft && status === 'saved' ? 'drawio.documentUpdated' : `drawio.${status}`)}</span>
      {onPreviewSaved && <Button variant="outline" size="sm" disabled={status === 'loading' || status === 'saving'} onClick={() => requestPreview()}>{translate('zh-CN', 'drawio.finish')}</Button>}
      {status === 'error' && <Button variant="ghost" size="sm" onClick={() => {
        if (loaded.current) persist(latest.current, true)
        else { setStatus('loading'); setRetry(value => value + 1) }
      }}>{translate('zh-CN', 'drawio.retry')}</Button>}
    </div>
    <iframe key={retry} ref={frame} title={translate('zh-CN', 'drawio.editor')} src={url} className="min-h-0 w-full flex-1 border-0" sandbox="allow-scripts allow-same-origin allow-downloads" />
  </section>
}
