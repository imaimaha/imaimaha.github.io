const { test, expect } = require('@playwright/test')

test('gacha page: no console errors, elements render', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('403') && !t.includes('406') && !t.includes('401')) errors.push(t)
    }
  })
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('/gacha.html')
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'tests/screenshots/gacha-after-fix.png', fullPage: true })

  // ポイント履歴リンクが point-bar にある
  const historyLink = await page.locator('a.point-history-link').count()
  expect(historyLink).toBeGreaterThan(0)

  // ポイント表示が --- や NaN ではなく数値
  const ptText = await page.locator('#point-display').textContent()
  console.log('point display:', ptText)
  expect(ptText).toMatch(/\d+pt/)

  if (errors.length > 0) console.log('⚠️ JS errors:', errors)
  else console.log('✅ no errors')
  expect(errors).toEqual([])
})
