import { createElement } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { EMPTY_VIEW_TABLE_SOURCE, VIEW_TABLE_BLOCK_TYPE } from '../utils/viewTableMarkdown'
import { ViewTableBlock } from './ViewTableBlock'

export const viewTableBlockSpec = createReactBlockSpec({
  type: VIEW_TABLE_BLOCK_TYPE,
  propSchema: {
    source: { default: EMPTY_VIEW_TABLE_SOURCE },
  },
  content: 'none',
}, {
  runsBefore: ['codeBlock'],
  meta: { selectable: false },
  render: props => createElement(ViewTableBlock, { block: props.block, editor: props.editor }),
})()
