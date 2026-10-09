import { expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL })

test('slash drawio saves an offline preview in Markdown and reopens for editing @smoke', async ({ page }) => {
  test.setTimeout(60000)
  const directory = mkdtempSync(join(tmpdir(), 'tolaria-embedded-drawio-'))
  const notePath = join(directory, 'note.md')
  writeFileSync(notePath, '')
  const external: string[] = []
  page.on('pageerror', error => console.log('embedded drawio:', error.message))
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname
    if (!['localhost', '127.0.0.1'].includes(host)) { external.push(host); return route.abort() }
    return route.continue()
  })
  await page.route('**/embedded-drawio-harness', route => route.fulfill({
    contentType: 'text/html',
    body: '<html><head><link rel="stylesheet" href="/src/index.css"></head><body><div id="editor" style="height:95vh"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script></body></html>',
  }))
  const open = async (markdown: string) => {
    await page.goto('/embedded-drawio-harness')
    await page.evaluate(async ({ markdown, notePath }) => {
      const modules = {
        react: '/node_modules/.vite/deps/react.js', dom: '/node_modules/.vite/deps/react-dom_client.js',
        core: '/node_modules/.vite/deps/@blocknote_core.js', view: '/node_modules/.vite/deps/@blocknote_mantine.js',
        controls: '/node_modules/.vite/deps/@blocknote_react.js', schema: '/src/components/editorSchema.tsx',
        menu: '/src/components/tolariaEditorFormattingConfig.ts', durable: '/src/utils/editorDurableMarkdown.ts',
      }
      const React = (await import(modules.react)).default
      const { createRoot } = (await import(modules.dom)).default
      const { BlockNoteEditor } = await import(modules.core)
      const { BlockNoteView } = await import(modules.view)
      const { SuggestionMenuController } = await import(modules.controls)
      const { schema } = await import(modules.schema)
      const { getTolariaSlashMenuItems } = await import(modules.menu)
      const { preProcessDurableEditorMarkdown, injectDurableEditorMarkdownBlocks, serializeDurableEditorBlocks } = await import(modules.durable)
      const parser = BlockNoteEditor.create({ schema })
      const initialContent = markdown ? injectDurableEditorMarkdownBlocks(await parser.tryParseMarkdownToBlocks(preProcessDurableEditorMarkdown({ markdown }))) : undefined
      const editor = BlockNoteEditor.create({ schema, initialContent })
      let writes = Promise.resolve()
      editor.onChange(() => {
        const content = serializeDurableEditorBlocks(editor, editor.document)
        writes = writes.then(async () => {
          const result = await fetch('/api/vault/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: notePath, content }) })
          if (!result.ok) throw new Error('Could not persist QA note')
        })
      })
      createRoot(document.getElementById('editor')).render(React.createElement(BlockNoteView, { editor, slashMenu: false },
        React.createElement(SuggestionMenuController, { triggerCharacter: '/', getItems: async (query: string) => getTolariaSlashMenuItems(editor, query) })))
    }, { markdown, notePath })
  }
  try {
    await open('')
    const document = page.locator('.tiptap[contenteditable="true"]')
    await document.click()
    await page.keyboard.type('/drawio')
    await page.getByText('Draw.io 流程图', { exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const frame = page.frameLocator('iframe')
    await expect(frame.locator('.geSidebar a.geItem').first()).toBeVisible({ timeout: 30000 })
    await frame.locator('.geSidebar a.geItem').first().dblclick()
    await expect(page.getByRole('status')).toHaveText('已更新文档，随文档保存')
    await page.getByRole('button', { name: '保存并返回文档' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('img', { name: '流程图预览' })).toBeVisible()
    await expect.poll(() => page.getByRole('img', { name: '流程图预览' }).evaluate(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true)
    await expect.poll(() => readFileSync(notePath, 'utf8')).toContain('```drawio')
    await expect.poll(() => readFileSync(notePath, 'utf8')).toContain('<svg')
    const saved = readFileSync(notePath, 'utf8')
    const payloadLine = saved.split('```drawio\n')[1]?.split('\n```')[0]
    const payload = JSON.parse(payloadLine ?? '')
    expect(payload.version).toBe(1)
    expect(payload.svg).toContain('<g')
    expect(payload.xml).toContain('mxfile')
    await open(saved)
    await expect(page.getByRole('img', { name: '流程图预览' })).toBeVisible()
    await page.getByRole('button', { name: '编辑流程图' }).click()
    await expect(frame.locator('.geDiagramContainer svg').first()).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: '保存并返回文档' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    expect(external).toEqual([])
  } finally {
    await page.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
