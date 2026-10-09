import { BlockNoteEditor } from '@blocknote/core'
import { expect, it } from 'vitest'
import { getTolariaSlashMenuItems } from './tolariaEditorFormattingConfig'
import { DRAWIO_BLOCK_TYPE, EMPTY_DRAWIO_SNAPSHOT } from '../utils/drawioMarkdown'
import { schema } from './editorSchema'

it('matches both /drawio and /流程图 and inserts a persistent diagram block', () => {
  const editor = BlockNoteEditor.create({ schema })
  for (const query of ['drawio', '流程图']) {
    const items = getTolariaSlashMenuItems(editor, query)
    expect(items.find(item => item.key === 'drawio')?.title).toBe('Draw.io 流程图')
  }
  getTolariaSlashMenuItems(editor, 'drawio').find(item => item.key === 'drawio')?.onItemClick()
  expect(editor.document[0]).toMatchObject({ type: DRAWIO_BLOCK_TYPE, props: { snapshot: EMPTY_DRAWIO_SNAPSHOT } })
})
