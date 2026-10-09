import { useCallback, useMemo, useState } from 'react'
import { DRAWIO_BLOCK_TYPE, readDrawioSnapshot } from '../utils/drawioMarkdown'
import { drawioPreviewUrl } from '../utils/drawioPreview'
import { translate } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { DrawioEditor } from './DrawioEditor'
import { dispatchRichEditorExternalChange } from './editorExternalChangeEvents'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface DrawioBlockEditor {
  getBlock: (id: string) => unknown
  updateBlock: (id: string, update: { type: typeof DRAWIO_BLOCK_TYPE; props: { snapshot: string } }) => unknown
}
interface DrawioBlockProps {
  block: { id: string; props: { snapshot: string } }
  editor: DrawioBlockEditor
}

function liveSnapshot(editor: DrawioBlockEditor, id: string) {
  const live = editor.getBlock(id)
  if (!live || typeof live !== 'object' || Reflect.get(live, 'type') !== DRAWIO_BLOCK_TYPE) throw new Error('Diagram block no longer exists')
  const props: unknown = Reflect.get(live, 'props')
  const snapshot: unknown = props && typeof props === 'object' ? Reflect.get(props, 'snapshot') : null
  const payload = typeof snapshot === 'string' ? readDrawioSnapshot(snapshot) : null
  if (!payload) throw new Error('Invalid diagram block')
  return payload
}

export function DrawioBlock({ block, editor }: DrawioBlockProps) {
  const payload = useMemo(() => readDrawioSnapshot(block.props.snapshot), [block.props.snapshot])
  const [open, setOpen] = useState(!!payload && !payload.svg)
  const [sessionXml, setSessionXml] = useState(payload?.xml ?? '')
  const preview = useMemo(() => drawioPreviewUrl(payload?.svg ?? ''), [payload?.svg])
  const saveDraft = useCallback((xml: string) => {
    const current = liveSnapshot(editor, block.id)
    editor.updateBlock(block.id, { type: DRAWIO_BLOCK_TYPE, props: { snapshot: JSON.stringify({ ...current, xml }) } })
    dispatchRichEditorExternalChange(editor)
  }, [block.id, editor])
  const savePreview = useCallback((xml: string, svg: string) => {
    liveSnapshot(editor, block.id)
    editor.updateBlock(block.id, { type: DRAWIO_BLOCK_TYPE, props: { snapshot: JSON.stringify({ version: 1, xml, svg }) } })
    dispatchRichEditorExternalChange(editor)
    trackEvent('editor_drawio_saved', { format: 'embedded' })
    setOpen(false)
  }, [block.id, editor])
  const edit = () => { if (payload) { setSessionXml(payload.xml); setOpen(true) } }
  if (!payload) return <p role="alert">{translate('zh-CN', 'drawio.error')}</p>

  return <section contentEditable={false} data-drawio-block onMouseDown={event => event.stopPropagation()}>
    <Button variant="ghost" className="h-auto w-full border border-border p-3" onClick={edit} aria-label={translate('zh-CN', 'drawio.edit')}>
      {preview ? <img src={preview} alt={translate('zh-CN', 'drawio.preview')} className="max-h-[480px] max-w-full object-contain" /> : translate('zh-CN', 'drawio.edit')}
    </Button>
    <Dialog open={open} onOpenChange={value => { if (value) edit(); else setOpen(false) }}>
      <DialogContent aria-describedby={undefined} className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col gap-2 p-3 sm:max-w-[95vw]" onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
        <DialogHeader><DialogTitle>{translate('zh-CN', 'drawio.editor')}</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1">
          <DrawioEditor path={`embedded:${block.id}`} title={translate('zh-CN', 'drawio.preview')} content={sessionXml} onSaveDraft={saveDraft} onPreviewSaved={savePreview} />
        </div>
      </DialogContent>
    </Dialog>
  </section>
}
