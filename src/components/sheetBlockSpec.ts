import { createElement } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { EMPTY_SHEET_DOCUMENT, SHEET_BLOCK_TYPE } from '../utils/sheetMarkdown'
import { SheetBlock } from './SheetBlock'

export const sheetBlockSpec = createReactBlockSpec({
  type: SHEET_BLOCK_TYPE,
  propSchema: {
    document: { default: EMPTY_SHEET_DOCUMENT },
    width: { default: 0 },
    height: { default: 0 },
  },
  content: 'none',
}, {
  runsBefore: ['codeBlock'],
  meta: { selectable: false },
  render: props => createElement(SheetBlock, { block: props.block, editor: props.editor }),
})()
