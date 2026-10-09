import { useCallback, useEffect, useRef, useState } from 'react'
import MindElixir, { type NodeObj } from 'mind-elixir'
import { normalizeMindmapData, type MindmapAppearance, type MindmapSnapshot } from '../utils/mindmapData'
import { safeDrawioSvg } from '../utils/drawioPreview'
import { translate } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { mindmapTheme } from './mindmapThemes'

export interface MindmapEditorProps {
  initial: MindmapSnapshot
  onSaveDraft: (snapshot: MindmapSnapshot) => void
  onFinish: (snapshot: MindmapSnapshot) => void
  onClose: () => void
}

export function useMindmapEditor({ initial, onSaveDraft, onFinish }: MindmapEditorProps) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<MindElixir | null>(null)
  const callbacks = useRef({ onSaveDraft, onFinish })
  const appearance = useRef(initial.appearance)
  const [theme, setTheme] = useState(initial.appearance)
  const [selected, setSelected] = useState<NodeObj | null>(null)
  const [status, setStatus] = useState<'ready' | 'updated' | 'error'>('ready')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef(false)
  useEffect(() => { callbacks.current = { onSaveDraft, onFinish } }, [onSaveDraft, onFinish])

  const snapshot = useCallback((svg = ''): MindmapSnapshot => {
    if (!instance.current) throw new Error('Mind map is not ready')
    return { version: 1, data: normalizeMindmapData(instance.current.getData()), appearance: appearance.current, svg }
  }, [])
  const saveDraft = useCallback(() => {
    if (!pending.current || !instance.current) return
    try {
      callbacks.current.onSaveDraft(snapshot())
      pending.current = false
      setStatus('updated')
    } catch { setStatus('error') }
  }, [snapshot])
  const queueSave = useCallback(() => {
    pending.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(saveDraft, 250)
  }, [saveDraft])

  useEffect(() => {
    if (!container.current) return
    const mind = new MindElixir({ el: container.current, theme: mindmapTheme(initial.appearance),
      editable: true, contextMenu: false, toolBar: false, keypress: true,
      newTopicName: translate('zh-CN', 'mindmap.branch'),
      before: { copyNodes: nodes => {
        try {
          // The library's clipboard bridge can supply synthetic topics with arbitrary JSON.
          for (const node of nodes) {
            const candidate: unknown = node
            if (!(candidate instanceof HTMLElement)) node.nodeObj = normalizeMindmapData({ nodeData: node.nodeObj }).nodeData
          }
          return true
        } catch { setStatus('error'); return false }
      } },
    })
    instance.current = mind
    const select = (nodes: NodeObj[]) => {
      const node = nodes.length === 1 ? nodes[0] : null
      setSelected(node ? { id: node.id, topic: node.topic, style: { ...node.style }, icons: [...(node.icons ?? [])], branchColor: node.branchColor } : null)
    }
    const refreshSelection = () => { select(mind.currentNodes.map(node => node.nodeObj)); queueSave() }
    try {
      const result = mind.init(normalizeMindmapData(initial.data))
      if (result instanceof Error) throw result
      mind.bus.addListener('operation', refreshSelection)
      mind.bus.addListener('expandNode', queueSave)
      mind.bus.addListener('selectNodes', select)
      mind.bus.addListener('unselectNodes', () => select(mind.currentNodes.map(node => node.nodeObj)))
      mind.selectNode(mind.findEle(mind.nodeData.id))
      mind.scaleFit()
      setReady(true)
    } catch {
      setStatus('error')
      mind.destroy()
      instance.current = null
      return
    }
    const resize = new ResizeObserver(() => mind.toCenter())
    resize.observe(container.current)
    const observer = new MutationObserver(() => mind.changeTheme(mindmapTheme(appearance.current)))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      if (timer.current) clearTimeout(timer.current)
      saveDraft()
      observer.disconnect()
      resize.disconnect()
      mind.destroy()
      instance.current = null
    }
  }, [initial, queueSave, saveDraft])

  const run = (action: (mind: MindElixir) => void | Promise<void>) => {
    const mind = instance.current
    if (!mind || busy) return
    try { Promise.resolve(action(mind)).catch(() => setStatus('error')) } catch { setStatus('error') }
  }
  const changeTheme = (value: MindmapAppearance) => {
    appearance.current = value
    setTheme(value)
    run(mind => mind.changeTheme(mindmapTheme(value)))
    queueSave()
    trackEvent('editor_mindmap_styled', { control: 'theme', theme: value })
  }
  const changeLayout = (value: string) => run(mind => {
    if (value === '1') mind.initRight()
    else if (value === '3') mind.initDown()
    else mind.initSide()
    mind.toCenter()
    queueSave()
    trackEvent('editor_mindmap_styled', { control: 'layout' })
  })
  const reshape = (patch: Partial<NodeObj>) => run(mind => {
    if (!mind.currentNode) return
    return mind.reshapeNode(mind.currentNode, patch)
  })
  const finish = async () => {
    const mind = instance.current
    if (!mind || busy) return
    // Commit an active inline node edit before collecting data and rendering its preview.
    if (document.activeElement instanceof HTMLElement && mind.container.contains(document.activeElement)) document.activeElement.blur()
    setBusy(true)
    mind.disableEdit()
    if (timer.current) clearTimeout(timer.current)
    try {
      const exported = await mind.exportSvg(true).text()
      // Mind Elixir emits this fixed legacy declaration; discard it, never resolve a DTD.
      const svg = safeDrawioSvg(exported.replace('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">', ''))
      if (!svg) throw new Error('Invalid mind map preview')
      callbacks.current.onFinish(snapshot(svg))
      pending.current = false
    } catch { setStatus('error') }
    finally { mind.enableEdit(); setBusy(false) }
  }
  return { container, selected, theme, status, busy, ready, run, reshape, changeTheme, changeLayout, finish }
}
