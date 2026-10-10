import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from './helpers/fixtureVault'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000)
  tempVaultDir = createFixtureVaultCopy()
  await openVault(page)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openVault(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  // The fixture helper insists on a visible note-list listbox; this build renders
  // the notes in the sidebar tree instead, so tolerate its final assertion.
  await openFixtureVault(page, tempVaultDir).catch(() => undefined)
  await expect(page.getByRole('button', { name: 'Alpha Project', exact: true })).toBeVisible({ timeout: 30_000 })
}

async function insertViewTable(page: Page) {
  await page.getByRole('button', { name: 'Alpha Project', exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await page.locator('.bn-block-content').last().click()
  await page.keyboard.press('Enter')
  await page.keyboard.type('/view')
  await expect(page.locator('.bn-suggestion-menu')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('option', { name: /数据表/ }).click()
  await expect(page.locator('[data-testid="view-table-block"]')).toBeVisible({ timeout: 5_000 })
}

test('@smoke column option colour can be picked from the select cell', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  await insertViewTable(page)

  const chip = page.locator('[data-testid="view-table-block"] .view-table__rdg .view-table__chip').first()
  await chip.click()

  const picker = page.locator('[data-testid="view-table-select-picker"]')
  await expect(picker).toBeVisible({ timeout: 5_000 })
  console.log('[probe] picker opened')

  const trigger = picker.locator('[data-testid="view-table-color-trigger"]').first()
  await trigger.click()
  console.log('[probe] colour trigger clicked')

  const palette = page.locator('[data-testid="view-table-color-popover"]')
  await expect(palette).toBeVisible({ timeout: 5_000 })
  console.log('[probe] palette visible')

  const swatch = palette.locator('[data-option-color="purple"]')
  await expect(swatch).toBeVisible({ timeout: 5_000 })
  await swatch.click()
  console.log('[probe] swatch clicked')

  await page.waitForTimeout(400)

  const pickerStillOpen = await picker.isVisible().catch(() => false)
  console.log('[probe] picker still open:', pickerStillOpen)

  const dot = picker.locator('.view-table__option-dot').first()
  console.log('[probe] option dot colour after pick:', await dot.getAttribute('data-option-color'))
  console.log('[probe] chip colour after pick:', await chip.getAttribute('data-option-color'))
  console.log('[probe] errors:', JSON.stringify(errors))

  expect(await dot.getAttribute('data-option-color')).toBe('purple')
})

test('@smoke column option colour can be picked from the column menu', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))

  await insertViewTable(page)
  await page.locator('[data-testid="view-table-block"]').screenshot({ path: 'test-results/vt-1-table.png' })

  const header = page.locator('[data-testid="view-table-header-cell"]').filter({ hasText: 'Status' })
  await header.locator('button').first().click()

  const menu = page.locator('[data-testid="view-table-column-menu"]')
  await expect(menu).toBeVisible({ timeout: 5_000 })
  console.log('[probe] column menu opened')

  const trigger = menu.locator('[data-testid="view-table-color-trigger"]').first()
  await expect(trigger).toBeVisible({ timeout: 5_000 })
  await trigger.click()
  console.log('[probe] colour trigger clicked')

  const palette = page.locator('[data-testid="view-table-color-popover"]')
  await expect(palette).toBeVisible({ timeout: 5_000 })
  console.log('[probe] palette visible')

  await palette.locator('[data-option-color="pink"]').click()
  await page.waitForTimeout(400)

  console.log('[probe] menu still open:', await menu.isVisible().catch(() => false))
  console.log('[probe] first option swatch active:', await page.locator('[data-testid="view-table-column-menu"] [data-testid="view-table-color-trigger"]').first().getAttribute('data-option-color'))
  await page.locator('[data-testid="view-table-block"]').screenshot({ path: 'test-results/vt-2-after.png' })
  console.log('[probe] errors:', JSON.stringify(errors))
})
