import { createElement } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { DRAWIO_BLOCK_TYPE, EMPTY_DRAWIO_SNAPSHOT } from '../utils/drawioMarkdown'
import { DrawioBlock } from './DrawioBlock'

export const drawioBlockSpec = createReactBlockSpec({
  type: DRAWIO_BLOCK_TYPE,
  propSchema: { snapshot: { default: EMPTY_DRAWIO_SNAPSHOT } },
  content: 'none',
}, {
  runsBefore: ['codeBlock'],
  meta: { selectable: false },
  render: props => createElement(DrawioBlock, { block: props.block, editor: props.editor }),
})()
