import { expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL })

test('offline drawio edits, saves and reopens local XML @smoke', async ({ page }) => {
  test.setTimeout(60000)
  page.on('pageerror', error => console.log('drawio page error:', error.message))
  page.on('console', message => { if (message.type() === 'error') console.log('drawio console:', message.text()) })
  const directory = mkdtempSync(join(tmpdir(), 'tolaria-drawio-qa-'))
  const diagramPath = join(directory, 'flow.drawio')
  const initial = '<mxfile><diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'
  writeFileSync(diagramPath, initial)
  const external: string[] = []
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) { external.push(url.hostname); await route.abort(); return }
    await route.continue()
  })
  await page.route('**/offline-diagram-harness', route => route.fulfill({
    contentType: 'text/html',
    body: '<html><head><link rel="stylesheet" href="/src/index.css"></head><body><div id="editor" style="height:95vh"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script></body></html>',
  }))
  const open = async (xml: string) => {
    await page.goto('/offline-diagram-harness')
    await page.evaluate(async ({ xml, diagramPath, directory }) => {
      const reactPath = '/node_modules/.vite/deps/react.js'
      const domPath = '/node_modules/.vite/deps/react-dom_client.js'
      const componentPath = '/src/components/DrawioEditor.tsx'
      const React = (await import(reactPath)).default
      const { createRoot } = (await import(domPath)).default
      const { DrawioEditor } = await import(componentPath)
      createRoot(document.getElementById('editor')).render(React.createElement(DrawioEditor, {
        path: diagramPath, title: 'Offline flow', content: xml, vaultPath: directory,
      }))
    }, { xml, diagramPath, directory })
    await expect(page.getByRole('status')).toHaveText('已保存到本地', { timeout: 30000 })
  }
  try {
    await open(initial)
    const frame = page.frameLocator('iframe')
    await expect(frame.locator('.geSidebar').nth(1)).toBeVisible()
    const shape = frame.locator('.geSidebar a.geItem').first()
    await expect(shape).toBeVisible()
    await shape.dblclick()
    await expect.poll(() => readFileSync(diagramPath, 'utf8')).not.toBe(initial)
    await frame.locator('.geDiagramContainer').click({ position: { x: 350, y: 250 } })
    await page.keyboard.press('Control+s')
    await expect(page.getByRole('status')).toHaveText('已保存到本地')
    const saved = readFileSync(diagramPath, 'utf8')
    expect(saved).toContain('mxfile')
    await open(saved)
    await expect(frame.locator('.geDiagramContainer svg').first()).toBeVisible()
    expect(readFileSync(diagramPath, 'utf8')).toBe(saved)
    expect(external).toEqual([])
  } finally {
    await page.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
