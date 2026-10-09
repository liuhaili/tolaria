import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { MINDMAP_BLOCK_TYPE, readMindmapSnapshot, type MindmapSnapshot } from '../utils/mindmapData'
import { drawioPreviewUrl } from '../utils/drawioPreview'
import { translate } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { dispatchRichEditorExternalChange } from './editorExternalChangeEvents'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

const MindmapEditor = lazy(() => import('./MindmapEditor'))
interface MindmapBlockEditor {
  getBlock: (id: string) => unknown
  updateBlock: (id: string, update: { type: typeof MINDMAP_BLOCK_TYPE; props: { snapshot: string } }) => unknown
}
interface MindmapBlockProps {
  block: { id: string; props: { snapshot: string } }
  editor: MindmapBlockEditor
}

export function MindmapBlock({ block, editor }: MindmapBlockProps) {
  const payload = useMemo(() => readMindmapSnapshot(block.props.snapshot), [block.props.snapshot])
  const [open, setOpen] = useState(!!payload && !payload.svg)
  const session = useRef(payload)
  const preview = useMemo(() => drawioPreviewUrl(payload?.svg ?? ''), [payload?.svg])
  const save = useCallback((next: MindmapSnapshot) => {
    const live = editor.getBlock(block.id)
    if (!live || typeof live !== 'object' || Reflect.get(live, 'type') !== MINDMAP_BLOCK_TYPE) throw new Error('Mind map block no longer exists')
    const snapshot = JSON.stringify(next)
    if (!readMindmapSnapshot(snapshot)) throw new Error('Invalid mind map snapshot')
    editor.updateBlock(block.id, { type: MINDMAP_BLOCK_TYPE, props: { snapshot } })
    dispatchRichEditorExternalChange(editor)
  }, [block.id, editor])
  const finish = useCallback((next: MindmapSnapshot) => {
    save(next)
    trackEvent('editor_mindmap_saved', { format: 'embedded' })
    setOpen(false)
  }, [save])
  const edit = () => {
    if (!payload) return
    session.current = payload
    setOpen(true)
    trackEvent('editor_mindmap_opened', { format: 'embedded' })
  }
  if (!payload) return <p role="alert">{translate('zh-CN', 'mindmap.error')}</p>
  return <section contentEditable={false} data-mindmap-block onMouseDown={event => event.stopPropagation()}>
    <Button variant="ghost" className="h-auto w-full rounded-xl border border-border p-4" onClick={edit} aria-label={translate('zh-CN', 'mindmap.edit')}>
      {preview ? <img src={preview} alt={translate('zh-CN', 'mindmap.preview')} className="max-h-[480px] max-w-full object-contain" /> : translate('zh-CN', 'mindmap.edit')}
    </Button>
    <Dialog open={open}>
      <DialogContent aria-describedby={undefined} showCloseButton={false} className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col gap-2 p-3 sm:max-w-[95vw]" onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
        <DialogHeader><DialogTitle>{translate('zh-CN', 'mindmap.editor')}</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1">
          <Suspense fallback={<p role="status">{translate('zh-CN', 'mindmap.loading')}</p>}>
            {open && session.current && <MindmapEditor initial={session.current} onSaveDraft={save} onFinish={finish} onClose={() => setOpen(false)} />}
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  </section>
}
