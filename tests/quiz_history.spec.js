// クイズ履歴「すべて見る」展開のテスト
const { test, expect } = require('@playwright/test')

test('quiz history: 初期表示 + すべて見るで全件展開', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/quiz.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const histEl = page.locator('#history-list')
  await expect(histEl).toBeVisible()

  const cardsBefore = await histEl.locator('.history-card').count()
  const btn = histEl.locator('.show-all-btn')
  const hasBtn = await btn.count()

  console.log('初期カード数:', cardsBefore, '/ すべて見るボタン:', hasBtn ? 'あり' : 'なし')

  if (hasBtn) {
    // 初期は HISTORY_INITIAL(7) 以下
    expect(cardsBefore).toBeLessThanOrEqual(7)
    await btn.click()
    await page.waitForTimeout(300)
    const cardsAfter = await histEl.locator('.history-card').count()
    console.log('展開後カード数:', cardsAfter)
    expect(cardsAfter).toBeGreaterThan(cardsBefore)
    // ボタンは消える
    await expect(btn).toHaveCount(0)
  } else {
    // ボタンが無い = 全件が初期表示に収まっている（7件以下）
    expect(cardsBefore).toBeLessThanOrEqual(7)
  }

  const jsErrors = errors.filter(e => !/401|403|net::/.test(e))
  expect(jsErrors, jsErrors.join('\n')).toEqual([])
})
