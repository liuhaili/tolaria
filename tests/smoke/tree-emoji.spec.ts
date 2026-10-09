import { expect, test } from '@playwright/test'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL })

test('tree emoji selection, reload and removal preserve hierarchy', async ({ page }) => {
  const fixture = await mkdtemp(join(tmpdir(), 'tolaria-tree-emoji-'))
  const config = join(fixture, 'tolaria', 'config')
  await mkdir(config, { recursive: true })
  const treeFile = join(config, 'tree.yml')
  // JSON is valid YAML; this fixture tests the renderer/store disk boundary, not native IPC.
  await writeFile(treeFile, JSON.stringify({ version: 1, nodes: { 'diagram.drawio': { parent: 'parent.md', order: 2, icon: null } } }))
  try {
    await page.exposeFunction('readTreeFixture', async () => JSON.parse(await readFile(treeFile, 'utf8')))
    await page.exposeFunction('saveTreeFixture', async (tree: unknown) => writeFile(treeFile, JSON.stringify(tree)))
    await page.route('**/tree-emoji-harness', route => route.fulfill({ contentType: 'text/html', body: '<html><head><link rel="stylesheet" href="/src/index.css"></head><body><div id="tree" style="width:300px"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;</script></body></html>' }))
    const mount = async () => {
      await page.goto('/tree-emoji-harness')
      await page.evaluate(async () => {
        const reactPath = '/node_modules/.vite/deps/react.js'
        const domPath = '/node_modules/.vite/deps/react-dom_client.js'
        const componentPath = '/src/components/NoteTree.tsx'
        const storePath = '/src/utils/vaultTreeStore'
        const reactExports = await import(reactPath)
        const React = reactExports.default ?? reactExports
        const domExports = await import(domPath)
        const { createRoot } = domExports.default ?? domExports
        const { NoteTree } = await import(componentPath)
        const { bindVaultTreeStore } = await import(storePath)
        const bridge = window as unknown as { readTreeFixture: () => Promise<unknown>; saveTreeFixture: (tree: unknown) => Promise<void> }
        bindVaultTreeStore(await bridge.readTreeFixture(), (tree: unknown) => { void bridge.saveTreeFixture(tree) })
        const entries = ['parent.md', 'diagram.drawio'].map(filename => ({ path: `/vault/${filename}`, filename, title: filename, isA: null, icon: filename === 'diagram.drawio' ? '📚' : null, properties: {} }))
        createRoot(document.getElementById('tree')).render(React.createElement(NoteTree, { entries, vaultRootPath: '/vault', onSelectNote: () => document.body.setAttribute('data-opened', 'yes') }))
      })
    }
    await mount()
    const row = page.getByTestId('note-tree-entry:/vault/diagram.drawio')
    const icon = row.locator('..').getByRole('button', { name: '更换表情' })
    await icon.click()
    const option = page.getByTestId('emoji-option').first()
    const emoji = await option.innerText()
    await option.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(icon).toHaveText(emoji)
    await expect(page.locator('body')).not.toHaveAttribute('data-opened', 'yes')
    await expect.poll(async () => JSON.parse(await readFile(treeFile, 'utf8')).nodes['diagram.drawio'].icon).toBe(emoji)
    await mount()
    await expect(icon).toHaveText(emoji)
    await icon.focus()
    await page.keyboard.press('Enter')
    const next = page.getByTestId('emoji-option').nth(1)
    const nextEmoji = await next.innerText()
    await next.click()
    await expect.poll(async () => JSON.parse(await readFile(treeFile, 'utf8')).nodes['diagram.drawio'].icon).toBe(nextEmoji)
    await row.click({ button: 'right' })
    await page.getByRole('button', { name: '移除表情' }).click()
    await expect.poll(async () => JSON.parse(await readFile(treeFile, 'utf8')).nodes['diagram.drawio']).toEqual({ parent: 'parent.md', order: 2, icon: '' })
    await mount()
    const empty = row.locator('..').getByRole('button', { name: '添加表情' })
    await expect(empty).toHaveCSS('opacity', '0')
    await row.hover()
    await expect(empty).toHaveCSS('opacity', '1')
    await empty.click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await row.click()
    await expect(page.locator('body')).toHaveAttribute('data-opened', 'yes')
  } finally {
    await page.close()
    await rm(fixture, { recursive: true, force: true })
  }
})
