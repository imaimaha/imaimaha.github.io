const { test, expect } = require('@playwright/test')

// デート + カウントダウン機能のスモーク
// 実DBに書くので、作ったものは最後に消す

// テストアカウントは profiles 行が無く profiles?select=emoji が 406 になる既知ノイズ。
// JS 例外と、リソース以外の console error のみを実バグとして拾う。
function collectErrors(page) {
  const errors = []
  page.on('console', m => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (t.includes('Failed to load resource')) return // 環境依存の 406/404 ノイズは無視
    errors.push(t)
  })
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  return errors
}

const UNIQ = 'PWテスト' + Date.now()

test('dates: 計画→ミッション→写真→コメント→ふり返り', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/dates.html')
  await expect(page.locator('.plan-btn')).toBeVisible()

  // 計画作成
  await page.click('.plan-btn')
  await page.fill('#f-title', UNIQ)
  await page.fill('#f-place', 'テスト水族館')
  await page.fill('#f-memo', 'スモークテストのデート')
  await page.click('#modal-ok')
  const card = page.locator('.date-card', { hasText: UNIQ })
  await expect(card).toBeVisible({ timeout: 10000 })

  // 詳細を開く
  await card.click()
  await expect(page.locator('.detail-title', { hasText: UNIQ })).toBeVisible()
  // フォトミッションが3つ
  await expect(page.locator('.mission')).toHaveCount(3)

  // ミッション写真をアップ (1x1 png)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  await page.locator('.mission .mi-go').first().click()
  await page.setInputFiles('#photo-input', { name: 't.png', mimeType: 'image/png', buffer: png })
  // ミッションが1つ done になる
  await expect(page.locator('.mission.done')).toHaveCount(1, { timeout: 10000 })
  await expect(page.locator('.photo-cell')).toHaveCount(1)

  // コメント
  await page.fill('#comment-text', 'たのしかった！')
  await page.click('.comment-form button')
  await expect(page.locator('.comment .cm-text', { hasText: 'たのしかった' })).toBeVisible({ timeout: 8000 })

  // ふり返り (星4 + テキスト)
  await page.locator('#my-stars .star[data-v="4"]').click({ force: true })
  await page.fill('#review-text', 'また行きたい')
  await page.click('.review-mine .mini-btn.primary')
  await expect(page.locator('.review-mine textarea')).toHaveValue('また行きたい')

  // 完了にする
  await page.click('button:has-text("デート完了にする")')
  await expect(page.locator('button:has-text("予定に戻す")')).toBeVisible({ timeout: 8000 })

  // 後始末: 削除
  page.once('dialog', d => d.accept())
  await page.click('button:has-text("削除")')
  await expect(page.locator('.plan-btn')).toBeVisible({ timeout: 8000 })

  expect(errors, 'console errors: ' + errors.join(' | ')).toEqual([])
})

test('countdown: 追加→ホームカード表示→削除', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/countdown.html')
  await expect(page.locator('.add-btn')).toBeVisible()
  // 記念日 auto が出ている
  await expect(page.locator('.cd-card.fixed').first()).toBeVisible()

  // 追加
  await page.click('.add-btn')
  await page.fill('#f-label', UNIQ + '記念')
  // 30日後の日付
  const d = new Date(Date.now() + 30 * 86400000)
  const ds = d.toISOString().slice(0, 10)
  await page.fill('#f-date', ds)
  await page.click('.recur-opt[data-r="none"]')
  await page.click('.btn-ok')
  const row = page.locator('.cd-card', { hasText: UNIQ + '記念' })
  await expect(row).toBeVisible({ timeout: 8000 })

  // ホームでカウントダウンカードが出る
  await page.goto('/')
  await expect(page.locator('#countdown-card')).toBeVisible({ timeout: 10000 })

  // 削除
  await page.goto('/countdown.html')
  await page.locator('.cd-card', { hasText: UNIQ + '記念' }).locator('.cd-menu').click()
  page.once('dialog', dlg => dlg.accept())
  await page.click('#del-btn')
  await expect(page.locator('.cd-card', { hasText: UNIQ + '記念' })).toHaveCount(0, { timeout: 8000 })

  expect(errors, 'console errors: ' + errors.join(' | ')).toEqual([])
})
