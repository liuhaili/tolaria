import { useEffect, useState, type ComponentType } from 'react'
import type { EditorProps } from './Editor'
import { EditorStartupFallback } from './EditorStartupFallback'
import { DrawioEditor } from './DrawioEditor'
import { isDiagramPath } from '../utils/drawio'
import { markStartupPhase, waitForStartupPhase } from '../lib/startupPerformance'

let editorModulePromise: Promise<{ Editor: ComponentType<EditorProps> }> | null = null

function loadEditorModule(): Promise<{ Editor: ComponentType<EditorProps> }> {
  editorModulePromise ??= (() => {
    markStartupPhase('editor_module_requested')
    return import('./Editor').then((module) => {
      markStartupPhase('editor_module_loaded')
      return module
    })
  })()
  return editorModulePromise
}

function LoadedEditor(props: EditorProps & { Editor: ComponentType<EditorProps> }) {
  const { Editor, ...editorProps } = props
  useEffect(() => { markStartupPhase('editor_committed') }, [])
  return <Editor {...editorProps} />
}

function commitLoadedEditor(
  lifecycle: AbortController,
  setEditor: (value: ComponentType<EditorProps>) => void,
  Editor: ComponentType<EditorProps>,
): void {
  if (!lifecycle.signal.aborted) setEditor(Editor)
}

export function LazyEditor(props: EditorProps) {
  const [Editor, setEditor] = useState<ComponentType<EditorProps> | null>(null)
  const diagram = props.tabs.find(tab => tab.entry.path === props.activeTabPath && isDiagramPath(tab.entry.path))
  const diagramActive = !!diagram

  useEffect(() => {
    if (diagramActive) return
    const lifecycle = new AbortController()
    void (async () => {
      if (!props.activeTabPath) await waitForStartupPhase('react_shell')
      if (lifecycle.signal.aborted) return
      const module = await loadEditorModule()
      commitLoadedEditor(lifecycle, (Editor) => { setEditor(() => Editor) }, module.Editor)
    })()
    return () => { lifecycle.abort() }
  }, [props.activeTabPath, diagramActive])

  if (diagram) return <DrawioEditor key={diagram.entry.path} path={diagram.entry.path} title={diagram.entry.title} content={diagram.content} vaultPath={props.vaultPath} onSaved={props.onDiagramSaved} />
  return Editor ? <LoadedEditor Editor={Editor} {...props} /> : <EditorStartupFallback {...props} />
}
