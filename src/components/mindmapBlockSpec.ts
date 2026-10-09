import { createElement } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { MINDMAP_BLOCK_TYPE, EMPTY_MINDMAP_SNAPSHOT } from '../utils/mindmapData'
import { MindmapBlock } from './MindmapBlock'

export const mindmapBlockSpec = createReactBlockSpec({
  type: MINDMAP_BLOCK_TYPE,
  propSchema: { snapshot: { default: EMPTY_MINDMAP_SNAPSHOT } },
  content: 'none',
}, {
  runsBefore: ['codeBlock'],
  meta: { selectable: false },
  render: props => createElement(MindmapBlock, { block: props.block, editor: props.editor }),
})()
