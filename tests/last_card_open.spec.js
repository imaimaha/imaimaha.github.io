// ビンゴ / カラーハント: フッターから開いた時、初期表示が「前回の続き」になること
// 「つづきから」のようなボタンUIは足さない方針なので、その不在も確認する
const { test, expect } = require('@playwright/test')

test('bingo: 開いた直後に最後に触ったカードが表示される', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  // まず何かカードを触っておく (このアカウントの「最後に触ったカード」を確定させる)
  await page.goto('/bingo.html')
  await page.waitForTimeout(2500)
  await page.evaluate(() => { setGridSize(5, true); showScreen('category') })
  await page.evaluate(() => selectCategory('city'))
  await page.waitForTimeout(2500)
  const expected = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(expected.length).toBe(25)

  // 開き直すと、モード選択ではなくそのカードが出る
  await page.goto('/bingo.html')
  await page.waitForTimeout(3500)
  await expect(page.locator('#screen-grid')).toHaveClass(/active/)
  const shown = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(shown).toEqual(expected)

  // 「つづきから」のようなボタンは無い
  expect(await page.locator('#resume-card').count()).toBe(0)

  // 戻るでモード選択に戻れる
  await page.evaluate(() => handleBack())
  await page.waitForTimeout(400)
  await expect(page.locator('#screen-mode')).toHaveClass(/active/)

  await page.screenshot({ path: 'tests/screenshots/0801-bingo-last-card.png', fullPage: true })
  expect(errors).toEqual([])
})

test('color hunt: 進行中のハントがあれば開いた直後に表示される', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/color_hunting.html')
  await page.waitForFunction(() => typeof state !== 'undefined' && state.userId, { timeout: 15000 })
  await page.waitForTimeout(2500)

  const hasHunt = await page.evaluate(async () => {
    const { data } = await _sb.from('color_hunts').select('id,mode,week_key')
      .eq('user_id', state.userId).order('updated_at', { ascending: false }).limit(20)
    return (data || []).some(h => h.mode !== 'weekly' || h.week_key === getWeekStr())
  })

  if (hasHunt) {
    await expect(page.locator('#screen-hunt')).toHaveClass(/active/)
    // 戻るでモード選択に戻れる
    await page.evaluate(() => showScreen('mode'))
    await page.waitForTimeout(300)
    await expect(page.locator('#screen-mode')).toHaveClass(/active/)
  } else {
    await expect(page.locator('#screen-mode')).toHaveClass(/active/)
  }
  await page.screenshot({ path: 'tests/screenshots/0801-color-last-hunt.png', fullPage: true })
  expect(errors).toEqual([])
})
