const { test, expect } = require('@playwright/test')

test('time capsule: received tab loads without errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('403') && !t.includes('406') && !t.includes('401')) errors.push(t)
    }
  })
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('/time_capsule.html')
  await page.waitForTimeout(3000)

  await page.screenshot({ path: 'tests/screenshots/time_capsule-received.png', fullPage: true })

  // 「返信」ボタンがある場合は動作確認、なくてもエラーがないこと
  if (errors.length > 0) console.log('⚠️ errors:', errors)
  expect(errors).toEqual([])

  // タブ切替
  await page.evaluate(() => switchTab('compose'))
  await page.waitForTimeout(500)
  const composeVisible = await page.locator('#tab-compose.active').count()
  expect(composeVisible).toBe(1)
})
