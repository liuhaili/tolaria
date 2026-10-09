import { expect, test } from '@playwright/test'

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL })

test('mouse dragging nests a note under the drop target', async ({ page }) => {
  await page.route('**/note-tree-drag-harness', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<html><head><link rel="stylesheet" href="/src/index.css"></head><body><div id="tree" style="width:300px"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></body></html>',
  }))
  await page.goto('/note-tree-drag-harness')
  await page.evaluate(async () => {
    const reactModule = '/node_modules/.vite/deps/react.js'
    const domModule = '/node_modules/.vite/deps/react-dom_client.js'
    const treeModule = '/src/components/NoteTree.tsx'
    const reactExports = await import(reactModule)
    const React = reactExports.default ?? reactExports
    const domExports = await import(domModule)
    const { createRoot } = domExports.default ?? domExports
    const { NoteTree } = await import(treeModule)
    const makeEntry = (path: string) => ({
      path, filename: path.split('/').at(-1), title: path.split('/').at(-1)?.replace('.md', ''),
      isA: null, aliases: [], belongsTo: [], relatedTo: [], status: null, archived: false,
      relationships: {}, icon: null, properties: {},
    })
    const entries = [makeEntry('/vault/parent.md'), makeEntry('/vault/child.md')]
    const root = createRoot(document.getElementById('tree'))
    root.render(React.createElement(NoteTree, {
      entries,
      onMoveNote: (note: { path: string }, parent: { path: string } | null) => {
        document.body.setAttribute('data-moved-note', note.path)
        document.body.setAttribute('data-parent-note', parent?.path ?? '')
      },
    }))
  })
  const child = page.getByTestId('note-tree-entry:/vault/child.md')
  const parent = page.getByTestId('note-tree-entry:/vault/parent.md')
  await expect(child).toBeVisible()
  const source = await child.boundingBox()
  const target = await parent.boundingBox()
  if (!source || !target) throw new Error('Tree rows are not measurable')
  await page.mouse.move(source.x + 80, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + 90, source.y + source.height / 2, { steps: 3 })
  await page.mouse.move(target.x + 80, target.y + target.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('body')).toHaveAttribute('data-moved-note', '/vault/child.md')
  await expect(page.locator('body')).toHaveAttribute('data-parent-note', '/vault/parent.md')

  const rootDrop = await page.getByTestId('note-tree-root-drop').boundingBox()
  if (!rootDrop) throw new Error('Root drop area is not measurable')
  await page.mouse.move(source.x + 80, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + 90, source.y + source.height / 2, { steps: 3 })
  await page.mouse.move(rootDrop.x + 80, rootDrop.y + rootDrop.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('body')).toHaveAttribute('data-parent-note', '')
})
