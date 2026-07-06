const { test, expect } = require('@playwright/test')

test('bingo category card persists across re-select', async ({ page }) => {
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

  // 「カテゴリから選ぶ」画面を出して、「日常」を選択
  await page.evaluate(() => showScreen('category'))
  await page.waitForTimeout(300)
  await page.evaluate(() => selectCategory('everyday'))
  await page.waitForTimeout(2000)

  const firstItems = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  await page.screenshot({ path: 'tests/screenshots/bingo-first-load.png', fullPage: true })

  // ホームへ戻る
  await page.evaluate(() => showScreen('mode'))
  await page.waitForTimeout(300)

  // 再び日常を選ぶ
  await page.evaluate(() => showScreen('category'))
  await page.waitForTimeout(300)
  await page.evaluate(() => selectCategory('everyday'))
  await page.waitForTimeout(2000)

  const secondItems = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  await page.screenshot({ path: 'tests/screenshots/bingo-second-load.png', fullPage: true })

  console.log('first items count:', firstItems.length, 'first[0]:', firstItems[0])
  console.log('second items count:', secondItems.length, 'second[0]:', secondItems[0])

  expect(firstItems.length).toBeGreaterThan(0)
  expect(secondItems).toEqual(firstItems) // 修正効果: 同じカードが返る

  if (errors.length > 0) console.log('⚠️ errors:', errors)
})

test('bingo difficulty card persists across re-select', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/bingo.html')
  await page.waitForTimeout(2000)

  await page.evaluate(() => showScreen('difficulty'))
  await page.waitForTimeout(300)
  await page.evaluate(() => selectDifficulty(2))
  await page.waitForTimeout(2000)

  const firstItems = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))

  await page.evaluate(() => showScreen('mode'))
  await page.waitForTimeout(300)
  await page.evaluate(() => showScreen('difficulty'))
  await page.waitForTimeout(300)
  await page.evaluate(() => selectDifficulty(2))
  await page.waitForTimeout(2000)

  const secondItems = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))

  console.log('difficulty first[0]:', firstItems[0])
  console.log('difficulty second[0]:', secondItems[0])

  expect(firstItems.length).toBeGreaterThan(0)
  expect(secondItems).toEqual(firstItems)
})
