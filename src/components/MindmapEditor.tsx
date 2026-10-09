import type { MindmapEditorProps } from './useMindmapEditor'
import { useMindmapEditor } from './useMindmapEditor'
import { MindmapToolbar } from './MindmapToolbar'
import { translate } from '../lib/i18n'
import { Button } from './ui/button'
import 'mind-elixir/style.css'
import './MindmapEditor.css'

export default function MindmapEditor(props: MindmapEditorProps) {
  const editor = useMindmapEditor(props)
  return <section className="tolaria-mindmap flex h-full min-h-0 flex-col" data-testid="mindmap-editor" onKeyDown={event => event.stopPropagation()}>
    {editor.ready ? <MindmapToolbar {...editor} /> : <Button variant="outline" className="self-end" onClick={props.onClose}>{translate('zh-CN', 'mindmap.close')}</Button>}
    <div ref={editor.container} className="min-h-0 flex-1 overflow-hidden rounded-xl" />
    <div className="flex flex-wrap justify-between gap-2 pt-2 text-xs text-muted-foreground">
      <span>{translate('zh-CN', 'mindmap.help')}</span>
      <span role={editor.status === 'error' ? 'alert' : 'status'}>{translate('zh-CN', `mindmap.${editor.status}`)}</span>
    </div>
  </section>
}
