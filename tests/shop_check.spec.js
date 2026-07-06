const { test, expect } = require('@playwright/test')

test('shop page loads without errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('403') && !t.includes('406') && !t.includes('401')) errors.push(t)
    }
  })
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('/shop.html')
  await page.waitForTimeout(2500)

  await expect(page.locator('#user-menu-btn')).toBeVisible()
  await expect(page.locator('#tab-btn-buy')).toBeVisible()
  await page.screenshot({ path: 'tests/screenshots/shop.png', fullPage: true })

  // タブ切替
  await page.evaluate(() => switchTab('sell'))
  await page.waitForTimeout(300)
  const sellPanelActive = await page.locator('#panel-sell.active').count()
  expect(sellPanelActive).toBe(1)

  if (errors.length > 0) console.log('⚠️ errors:', errors)
  expect(errors).toEqual([])
})
