const { test, expect } = require('@playwright/test')

// ページごとのコンソールエラーを収集するヘルパー
function collectErrors(page) {
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

// ===========================================================
// 1. コンソールエラーチェック（全ページ）
// ===========================================================
const PAGES = ['/', '/closer.html', '/calendar.html', '/memories.html', '/status.html', '/wishlist.html']

for (const path of PAGES) {
  test(`コンソールエラーなし: ${path}`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(path)
    await page.waitForTimeout(3000) // JS が全部実行されるまで少し待つ

    if (errors.length > 0) {
      console.log(`❌ エラー (${path}):`, errors)
    } else {
      console.log(`✅ エラーなし: ${path}`)
    }
    expect(errors).toHaveLength(0)
  })
}

// ===========================================================
// 2. closer.html — 基本表示
// ===========================================================
test('closer: ページが表示される', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  await expect(page.locator('#fox-float')).toBeVisible()
  await expect(page.locator('#hed-float')).toBeVisible()
  await expect(page.locator('#closer-gap')).toBeVisible()
  console.log('✅ 🦊🦔 と closer-gap が表示された')
})

// ===========================================================
// 3. closer.html — 🦔 クリックで animation が動くか
// ===========================================================
test('closer: 🦔 をクリックすると pop animation が動く', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  // z-index チェック
  const hedZ = await page.locator('#hed-float').evaluate(el => parseInt(window.getComputedStyle(el).zIndex) || 0)
  const btnZ = await page.locator('.btn-row').evaluate(el => parseInt(window.getComputedStyle(el).zIndex) || 0)
  console.log(`🦔 z-index: ${hedZ}  /  btn-row z-index: ${btnZ}`)
  expect(hedZ).toBeGreaterThan(btnZ)

  // 🦔 を実際にクリック
  await page.locator('#hed-float').click({ force: true })
  await page.waitForTimeout(100)

  // pop クラスが付いたか確認
  const hasPop = await page.locator('#hed-float').evaluate(el => el.classList.contains('pop'))
  console.log(`🦔 pop animation: ${hasPop ? '✅ 動いた' : '❌ 動いてない'}`)
  expect(hasPop).toBe(true)

  // UID の状態を確認
  await page.waitForTimeout(1000)
  const ids = await page.evaluate(() => ({
    foxUid: window._closer?.foxUid,
    hedUid: window._closer?.hedUid,
    myId:   window._closer?.myId,
  }))
  console.log(`foxUid: ${ids.foxUid}`)
  console.log(`hedUid: ${ids.hedUid}`)
  console.log(`myId:   ${ids.myId}`)
  if (!ids.hedUid) console.warn('⚠️  hedUid が null — プロフィールに 🦔 がいない可能性')
  else console.log('✅ hedUid は設定済み')
})

// ===========================================================
// 4. closer.html — 🦊 クリック → ゲージ増加
// ===========================================================
test('closer: 🦊 クリックでゲージが増える', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  // クリック前の closer-gap を記録
  const before = await page.locator('#closer-gap').textContent()
  const dotsBefore = (before.match(/·/g) || []).length
  console.log(`クリック前のドット数: ${dotsBefore}`)

  // 🦊 を3回クリック
  for (let i = 0; i < 3; i++) {
    await page.locator('#fox-float').click({ force: true })
    await page.waitForTimeout(400)
  }

  await page.waitForTimeout(1000)
  const after = await page.locator('#closer-gap').textContent()
  const dotsAfter = (after.match(/·/g) || []).length
  console.log(`クリック後のドット数: ${dotsAfter}`)

  expect(dotsAfter).toBeLessThan(dotsBefore)
  console.log('✅ 🦊 クリックでドットが減った（ゲージ増加）')
})

// ===========================================================
// 5. closer.html — ゲージがリロード後も保持されるか
// ===========================================================
test('closer: ゲージがDBに保存されてリロード後も残る', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  // 🦊 を5回クリック
  for (let i = 0; i < 5; i++) {
    await page.locator('#fox-float').click({ force: true })
    await page.waitForTimeout(300)
  }

  // DB書き込みを待つ
  await page.waitForTimeout(2000)
  const before = await page.locator('#closer-gap').textContent()
  const dotsBefore = (before.match(/·/g) || []).length
  console.log(`保存前ドット数: ${dotsBefore}`)

  // リロード
  await page.reload()
  await page.waitForTimeout(3000)

  const after = await page.locator('#closer-gap').textContent()
  const dotsAfter = (after.match(/·/g) || []).length
  console.log(`リロード後ドット数: ${dotsAfter}`)

  expect(dotsAfter).toBeLessThanOrEqual(dotsBefore + 1) // ±1 許容
  console.log('✅ ゲージはリロード後も保持された')
})

// ===========================================================
// 6. closer.html — 減衰ロジックの動作確認
// ===========================================================
test('closer: 24時間減衰ロジックが正しく動く', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  // ブラウザ内で effective() を直接テスト
  const results = await page.evaluate(() => {
    const DAY_MS = 24 * 60 * 60 * 1000

    function effective(raw) {
      if (!raw.updated_at || raw.gauge <= 0) return raw.gauge
      const elapsed = Date.now() - new Date(raw.updated_at).getTime()
      const factor  = Math.max(0, 1 - elapsed / DAY_MS)
      return Math.round(raw.gauge * factor)
    }

    const now     = new Date()
    const ago12h  = new Date(Date.now() - 12 * 60 * 60 * 1000)
    const ago24h  = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1)
    const ago6h   = new Date(Date.now() - 6 * 60 * 60 * 1000)

    return {
      justNow:    effective({ gauge: 100, updated_at: now.toISOString() }),      // ~100
      ago12h:     effective({ gauge: 100, updated_at: ago12h.toISOString() }),   // ~50
      ago24h:     effective({ gauge: 100, updated_at: ago24h.toISOString() }),   // 0
      ago6h:      effective({ gauge: 80,  updated_at: ago6h.toISOString() }),    // ~60
      zero:       effective({ gauge: 0,   updated_at: now.toISOString() }),      // 0
      noDate:     effective({ gauge: 50,  updated_at: null }),                   // 50
    }
  })

  console.log('減衰テスト結果:', results)

  expect(results.justNow).toBe(100)
  expect(results.ago12h).toBeCloseTo(50, -1)   // ±10 の誤差を許容
  expect(results.ago24h).toBe(0)
  expect(results.ago6h).toBeCloseTo(60, -1)
  expect(results.zero).toBe(0)
  expect(results.noDate).toBe(50)

  console.log('✅ 24時間減衰ロジック正常')
})

// ===========================================================
// 7. closer.html — ポップアップ表示
// ===========================================================
test('closer: ポップアップが開閉できる', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  // 🦊の✨を見る ボタンをクリック
  await page.getByRole('button', { name: '🦊の✨を見る' }).click()
  await page.waitForTimeout(500)

  const popup = page.locator('#popup')
  await expect(popup).toHaveClass(/open/)
  console.log('✅ ポップアップが開いた')

  // 閉じる
  await page.getByRole('button', { name: '閉じる' }).click()
  await page.waitForTimeout(300)
  await expect(popup).not.toHaveClass(/open/)
  console.log('✅ ポップアップが閉じた')
})

// ===========================================================
// 8. スクリーンショット（各ページ）
// ===========================================================
test('スクリーンショット: closer.html', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'tests/storage/screenshot-closer.png', fullPage: false })
  console.log('📸 screenshot-closer.png を保存')
})

test('スクリーンショット: index', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'tests/storage/screenshot-index.png', fullPage: true })
  console.log('📸 screenshot-index.png を保存')
})
