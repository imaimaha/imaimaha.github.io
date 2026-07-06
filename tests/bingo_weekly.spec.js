const { test, expect } = require('@playwright/test')

test('weekly bingo: mode select shows updated text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('403') && !t.includes('406') && !t.includes('401')) errors.push(t)
    }
  })
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('/bingo.html')
  await page.waitForTimeout(2000)

  // 「今週のビンゴ」ボタンが表示
  const weeklyTitle = await page.locator('.mode-card.daily .mode-card-title').textContent()
  expect(weeklyTitle).toContain('今週のビンゴ')

  // 履歴ボタンが表示
  const historyExists = await page.locator('.mode-card:has-text("履歴を見る")').count()
  expect(historyExists).toBeGreaterThan(0)

  await page.screenshot({ path: 'tests/screenshots/bingo-weekly-mode.png', fullPage: true })

  // 履歴を開く
  await page.evaluate(() => openHistory())
  await page.waitForTimeout(1500)

  const historyScreenActive = await page.locator('#screen-history.active').count()
  expect(historyScreenActive).toBe(1)
  await page.screenshot({ path: 'tests/screenshots/bingo-history.png', fullPage: true })

  if (errors.length > 0) console.log('⚠️ errors:', errors)
  expect(errors).toEqual([])
})

test('weekly bingo: card generates and persists in same week', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/bingo.html')
  await page.waitForTimeout(2000)

  await page.evaluate(() => selectMode('weekly'))
  await page.waitForTimeout(2000)

  const first = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(first.length).toBeGreaterThan(0)

  await page.evaluate(() => showScreen('mode'))
  await page.waitForTimeout(300)
  await page.evaluate(() => selectMode('weekly'))
  await page.waitForTimeout(2000)

  const second = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(second).toEqual(first)
})
