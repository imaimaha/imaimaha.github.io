const { test, expect } = require('@playwright/test')

test('設定ページ: トグルが表示され DB に保存される', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/settings.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  // KINDS の全種類ぶんトグルが出る (種類数は機能追加で増えるため動的に比較)
  const kindCount = await page.evaluate(() => KINDS.length)
  const toggles = page.locator('#toggle-card input[type="checkbox"]')
  await expect(toggles).toHaveCount(kindCount)

  // quiz トグルを OFF にする (input は視覚的に隠しているのでラベルをクリック)
  const quiz = page.locator('#toggle-card input[data-kind="quiz"]')
  const quizLabel = page.locator('.toggle-row:has(input[data-kind="quiz"]) .switch')
  await expect(quiz).toBeChecked()
  await quizLabel.click()
  await page.waitForTimeout(600)
  await expect(quiz).not.toBeChecked()

  // DB に enabled=false で保存されたか (クライアントの _sb 経由で確認)
  const saved = await page.evaluate(async () => {
    const { data: { session } } = await _sb.auth.getSession()
    const { data } = await _sb.from('notification_prefs')
      .select('enabled').eq('user_id', session.user.id).eq('kind', 'quiz').single()
    return data
  })
  expect(saved.enabled).toBe(false)

  // 元に戻す (ON) — 後片付け
  await quizLabel.click()
  await page.waitForTimeout(600)
  await expect(quiz).toBeChecked()
  const restored = await page.evaluate(async () => {
    const { data: { session } } = await _sb.auth.getSession()
    const { data } = await _sb.from('notification_prefs')
      .select('enabled').eq('user_id', session.user.id).eq('kind', 'quiz').single()
    return data
  })
  expect(restored.enabled).toBe(true)

  expect(errors.filter(e => !/401|403|net::/.test(e))).toEqual([])
})

test('ヘッダー: 👤で設定へ / もっとシートに設定・お知らせ', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // 設定ボタンは settings.html へのリンク
  await expect(page.locator('#user-menu-btn')).toHaveAttribute('href', '/settings.html')

  // もっとシートを開く
  await page.locator('#bottom-nav [data-sheet="more"]').click()
  await page.waitForTimeout(400)
  const sheet = page.locator('#more-sheet')
  await expect(sheet.locator('.more-section-title')).toHaveCount(4)
  await expect(sheet.locator('a[href="/settings.html"]')).toBeVisible()
  await expect(sheet.locator('a[href="/notifications.html"]')).toBeVisible()
})

test('今ここボタン: 1タップでは送信されず確定待ちになる', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  const btn = page.locator('#loc-top-btn')
  const label = page.locator('.checkin-label')
  await expect(label).toHaveText('今ここにいるよ')

  // 1タップ目 → armed 状態・ラベル変化・位置情報取得は始まらない
  await btn.click()
  await page.waitForTimeout(200)
  await expect(btn).toHaveClass(/armed/)
  await expect(label).toHaveText('もう一度タップで送信')
  const status = await page.locator('#loc-top-status').textContent()
  expect(status.trim()).toBe('') // 送信処理が走っていない
})
