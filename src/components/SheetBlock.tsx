import { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { SHEET_BLOCK_TYPE, isSheetDocument } from '../utils/sheetMarkdown'
import { dispatchRichEditorExternalChange } from './editorExternalChangeEvents'
import { useDocumentLocale } from './markdownHighlightControlState'
import './SheetBlock.css'

// IronCalc is a WASM workbook engine; keep it in its own chunk exactly like the
// whole-note sheet surface does (see editor-content/EditorContentLayout).
const LazySheetEditor = lazy(() => import('./SheetEditor').then((module) => ({ default: module.SheetEditor })))

const MIN_SHEET_BLOCK_WIDTH = 280
const MIN_SHEET_BLOCK_HEIGHT = 200
const DEFAULT_SHEET_BLOCK_HEIGHT = 360

interface SheetBlockEditor {
  getBlock: (id: string) => unknown
  updateBlock: (id: string, update: { type: typeof SHEET_BLOCK_TYPE; props: { document: string; width: number; height: number } }) => unknown
}

interface SheetBlockProps {
  block: { id: string; props: { document: string; width?: number; height?: number } }
  editor: SheetBlockEditor
}

type ResizeMode = 'width' | 'height' | 'both'

function frameSize(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

/**
 * An inline spreadsheet block: the same IronCalc surface used by whole-note
 * sheets, mounted inside a note and persisted through a ```sheet fence, so the
 * Markdown file remains the only thing carrying the data (ADR 0187 pattern).
 * The frame is drag-resizable; the chosen size rides in the fence info line
 * (`sheet 640x420`) so it survives reloads.
 */
export function SheetBlock({ block, editor }: SheetBlockProps) {
  const locale = useDocumentLocale()
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null)
  const [resizing, setResizing] = useState(false)

  const propWidth = frameSize(block.props.width)
  const propHeight = frameSize(block.props.height) || DEFAULT_SHEET_BLOCK_HEIGHT
  const width = dragSize && dragSize.width > 0 ? dragSize.width : propWidth
  const height = dragSize ? dragSize.height : propHeight

  const handleContentChange = useCallback((_path: string, content: string) => {
    if (!isSheetDocument(content)) return
    editor.updateBlock(block.id, { type: SHEET_BLOCK_TYPE, props: { document: content, width: propWidth, height: frameSize(block.props.height) } })
    dispatchRichEditorExternalChange(editor)
  }, [block.id, block.props.height, editor, propWidth])

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>, mode: ResizeMode) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const frameRect = frameRef.current?.getBoundingClientRect()
    const startWidth = frameRect?.width ?? 0
    const startHeight = frameRect?.height ?? DEFAULT_SHEET_BLOCK_HEIGHT
    const originX = event.clientX
    const originY = event.clientY
    let nextWidth = 0
    let nextHeight = 0

    const onMove = (moveEvent: PointerEvent) => {
      if (mode !== 'height') {
        nextWidth = Math.max(MIN_SHEET_BLOCK_WIDTH, Math.round(startWidth + moveEvent.clientX - originX))
      }
      nextHeight = Math.max(MIN_SHEET_BLOCK_HEIGHT, Math.round(startHeight + moveEvent.clientY - originY))
      setDragSize({ width: nextWidth, height: nextHeight })
    }

    const finish = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', finish)
      handle.removeEventListener('pointercancel', finish)
      setResizing(false)
      setDragSize(null)
      if (nextWidth === 0 && nextHeight === 0) return
      editor.updateBlock(block.id, {
        type: SHEET_BLOCK_TYPE,
        props: {
          document: block.props.document,
          width: mode === 'height' ? propWidth : Math.max(MIN_SHEET_BLOCK_WIDTH, nextWidth),
          height: Math.max(MIN_SHEET_BLOCK_HEIGHT, nextHeight),
        },
      })
      dispatchRichEditorExternalChange(editor)
    }

    setResizing(true)
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
  }, [block.id, block.props.document, editor, propWidth])

  const frameStyle = {
    '--sheet-block-width': width > 0 ? `${width}px` : undefined,
    '--sheet-block-height': `${height}px`,
  } as CSSProperties

  // Handed to the workbook so it re-measures its canvas when the frame changes;
  // without this the grid keeps its first size and new space stays blank.
  const viewportSize = useMemo(() => ({ width, height }), [width, height])

  return (
    <div className="sheet-block" data-testid="sheet-block" data-resizing={resizing || undefined} ref={frameRef} style={frameStyle}>
      <Suspense fallback={<div className="sheet-block__loading" />}>
        <LazySheetEditor
          content={block.props.document}
          locale={locale}
          onContentChange={handleContentChange}
          path={`sheet-block/${block.id}`}
          viewportSize={viewportSize}
        />
      </Suspense>
      <div aria-hidden className="sheet-block__handle sheet-block__handle--e" onPointerDown={event => startResize(event, 'width')} />
      <div aria-hidden className="sheet-block__handle sheet-block__handle--s" onPointerDown={event => startResize(event, 'height')} />
      <div aria-hidden className="sheet-block__handle sheet-block__handle--se" onPointerDown={event => startResize(event, 'both')} />
    </div>
  )
}
