import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://localhost:5199'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()

const logs = []
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    logs.push(`[console.${msg.type()}] ${msg.text()}`)
  }
})
page.on('pageerror', (err) => {
  logs.push(`[pageerror] ${err.message}\n${err.stack ?? ''}`)
})
page.on('requestfailed', (req) => {
  logs.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText}`)
})
page.on('response', (res) => {
  if (res.status() >= 400) logs.push(`[response.${res.status()}] ${res.url()}`)
})

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 })
} catch (error) {
  logs.push(`[goto] ${error.message}`)
}
await page.waitForTimeout(4000)

const skip = page.getByText('稍后设置', { exact: true }).first()
if (await skip.count()) {
  logs.push('[probe] clicking 稍后设置')
  await skip.click({ timeout: 5000 }).catch((error) => logs.push(`[probe] click failed: ${error.message}`))
  await page.waitForTimeout(5000)
} else {
  logs.push('[probe] no 稍后设置 button')
}

const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 400) ?? 'NO_ROOT')
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600))

await page.screenshot({ path: '.probe-shot.png', fullPage: false })
await browser.close()

console.log('=== LOGS ===')
console.log(logs.join('\n---\n') || '(none)')
console.log('=== ROOT ===')
console.log(rootHtml)
console.log('=== BODY TEXT ===')
console.log(bodyText)
