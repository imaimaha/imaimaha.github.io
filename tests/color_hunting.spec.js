const { test, expect } = require('@playwright/test')

test('color hunting page loads without errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('403') && !t.includes('406') && !t.includes('401')) errors.push(t)
    }
  })
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('/color_hunting.html')
  await page.waitForTimeout(2500)

  // モード選択画面のカードが表示
  expect(await page.locator('.mode-card').count()).toBeGreaterThanOrEqual(3)
  await page.screenshot({ path: 'tests/screenshots/color_hunt-mode.png', fullPage: true })

  // カラーピッカー画面
  await page.evaluate(() => showScreen('pick'))
  await page.waitForTimeout(300)
  expect(await page.locator('.palette-swatch').count()).toBeGreaterThan(5)
  await page.screenshot({ path: 'tests/screenshots/color_hunt-pick.png', fullPage: true })

  // 履歴画面
  await page.evaluate(() => showScreen('history'))
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'tests/screenshots/color_hunt-history.png', fullPage: true })

  if (errors.length > 0) console.log('⚠️ errors:', errors)
  expect(errors).toEqual([])
})
